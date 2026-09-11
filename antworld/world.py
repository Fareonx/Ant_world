"""Мир и порядок тика (WORLD_RULES.md §9).

Девять фаз в документированном порядке. Каждая фаза завершается полностью до
следующей; внутри фазы все агенты обрабатываются относительно снимка состояния
на её начало, поэтому порядок в массивах на результат не влияет.
"""
from __future__ import annotations

import numpy as np

from . import brain, events, food as food_mod, movement, voxel
from .agents import Agents
from .config import Config
from .events import EventLog
from .rng import Rngs, array_digest, prio_hash
from .voxel import DIRS


class World:
    def __init__(self, cfg: Config | None = None, seed: int = 0, log_events: bool = True):
        self.cfg = cfg or Config()
        self.seed = int(seed)
        self.rngs = Rngs(self.seed)
        self.tick_no = 0
        self.terrain = voxel.generate(self.cfg, self.rngs)
        self.food = food_mod.initial(self.cfg, self.terrain, self.rngs)
        self._fertile_f = self.terrain.fertile.astype(np.float32)
        self.agents = Agents(self.cfg)
        self.events = EventLog(enabled=log_events)
        self._seed_founders()

    # --------------------------------------------------------------- старт

    def _seed_founders(self) -> None:
        cfg, ag, terr = self.cfg, self.agents, self.terrain
        fy, fx = np.nonzero(terr.fertile)
        n = min(cfg.n_founders, fy.size, cfg.capacity)
        pick = np.sort(self.rngs.init.choice(fy.size, size=n, replace=False))
        y, x = fy[pick].astype(np.int16), fx[pick].astype(np.int16)
        z = (terr.surface_z[y, x] + 1).astype(np.int16)
        w_move, w_act = brain.founder_genomes(n, cfg, self.rngs)
        slots = ag.free_slots(n)
        ag.spawn(
            slots, z, y, x,
            np.full(n, cfg.energy_init, dtype=np.float32),
            w_move, w_act, np.full(n, -1, dtype=np.int64),
        )
        self.events.add(0, events.BIRTH, ag.aid[slots], z, y, x, ag.energy[slots])

    # ----------------------------------------------------------------- тик

    def tick(self) -> None:
        cfg, ag, terr = self.cfg, self.agents, self.terrain
        t = self.tick_no
        idx = ag.live_slots()

        if idx.size:
            senses = brain.sense(ag, terr, self.food, idx, cfg)          # 1
            move, act = brain.decide(ag, senses, idx)                    # 2
            result = movement.resolve(ag, terr, move, idx, t, cfg)       # 3
            cost = result.cost
            if result.pusher_slots.size:
                p = result.pusher_slots
                self.events.add(
                    t, events.PUSH, ag.aid[p], ag.z[p], ag.y[p], ag.x[p],
                    ag.aid[result.pushed_slots],
                )
            self._eat(idx, act, t)                                       # 4
            self._dig(idx, move, act, cost, t)                           # 4
            ag.energy[idx] -= cost + cfg.metabolism                      # 5
            ag.age[idx] += 1
            ag.repro_cd[idx] = np.maximum(ag.repro_cd[idx] - 1, 0)
            self._reap(idx, t)                                           # 6
            self._reproduce(t)                                           # 7

        food_mod.grow(self.food, self._fertile_f, cfg)                   # 8
        self.tick_no += 1                                                # 9

    def run(self, n: int) -> None:
        for _ in range(n):
            self.tick()

    # -------------------------------------------------------------- фазы

    def _eat(self, idx: np.ndarray, act: np.ndarray, t: int) -> None:
        cfg, ag = self.cfg, self.agents
        sel = np.flatnonzero(act == 1)
        if sel.size == 0:
            return
        slots = idx[sel]
        z, y, x = ag.z[slots], ag.y[slots], ag.x[slots]
        # Еда доступна только вплотную над поверхностью (§5).
        on_surface = z == self.terrain.surface_z[y, x] + 1
        if not on_surface.any():
            return
        slots, y, x = slots[on_surface], y[on_surface], x[on_surface]
        # На колонку приходится ровно один такой воксель, поэтому едоки за одну
        # клетку не конкурируют и вычитание из поля безопасно делать напрямую.
        take = np.minimum(self.food[y, x], cfg.eat_rate)
        np.minimum(take, cfg.energy_max - ag.energy[slots], out=take)
        np.maximum(take, 0.0, out=take)
        self.food[y, x] -= take
        ag.energy[slots] += take
        self.events.add(t, events.EAT, ag.aid[slots], ag.z[slots], y, x, take)

    def _dig(self, idx: np.ndarray, move: np.ndarray, act: np.ndarray,
             cost: np.ndarray, t: int) -> None:
        cfg, ag = self.cfg, self.agents
        sel = np.flatnonzero((act == 2) & (move != 0))
        if sel.size == 0:
            return
        slots = idx[sel]
        step = DIRS[(move[sel] - 1).astype(np.intp)]
        tz = ag.z[slots] + step[:, 0]
        ty = ag.y[slots] + step[:, 1]
        tx = ag.x[slots] + step[:, 2]
        # Плата берётся за сопротивление материала. Удар по воздуху ничего не
        # встречает и ничего не стоит: иначе агент, чья голова действия выбрала
        # копание, платит полную цену каждый тик, ни разу не коснувшись земли,
        # и вымирает быстрее, чем отбор успевает его выбраковать.
        material = self.terrain.voxel[tz, ty, tx]
        cost[sel] += cfg.dig_cost * (material != voxel.AIR)
        dug = self.terrain.dig(tz, ty, tx)
        if dug.any():
            # Рельеф изменился: плодородие пересчитано, еда на утративших его
            # колонках снимается, иначе она осталась бы висеть на голом камне.
            self._fertile_f = self.terrain.fertile.astype(np.float32)
            self.food *= self._fertile_f
            self.events.add(
                t, events.DIG, ag.aid[slots[dug]], tz[dug], ty[dug], tx[dug], 0.0
            )

    def _reap(self, idx: np.ndarray, t: int) -> None:
        cfg, ag = self.cfg, self.agents
        starved = ag.energy[idx] <= 0.0
        aged = ag.age[idx] >= cfg.max_age
        dead = starved | aged
        if not dead.any():
            return
        slots = idx[dead]
        self.events.add(
            t, events.DEATH, ag.aid[slots], ag.z[slots], ag.y[slots], ag.x[slots],
            np.where(starved[dead], events.DEATH_STARVED, events.DEATH_AGED),
        )
        ag.kill(slots)

    def _reproduce(self, t: int) -> None:
        cfg, ag, terr = self.cfg, self.agents, self.terrain
        live = ag.live_slots()
        ready = live[(ag.energy[live] >= cfg.repro_threshold) & (ag.repro_cd[live] == 0)]
        if ready.size == 0:
            return

        # Место потомка — первый подходящий сосед в фиксированном порядке (§11).
        z, y, x = ag.z[ready], ag.y[ready], ag.x[ready]
        cz = np.zeros(ready.size, dtype=np.int16)
        cy, cx = cz.copy(), cz.copy()
        found = np.zeros(ready.size, dtype=bool)
        for dz, dy, dx in DIRS:
            nz, ny, nx = z + dz, y + dy, x + dx
            good = ~found & terr.can_occupy(nz, ny, nx) & (ag.occupancy[nz, ny, nx] < 0)
            cz[good], cy[good], cx[good] = nz[good], ny[good], nx[good]
            found |= good
            if found.all():
                break
        ready, cz, cy, cx = ready[found], cz[found], cy[found], cx[found]
        if ready.size == 0:
            return

        key_e = -ag.energy[ready]
        key_h = prio_hash(ag.aid[ready], t)
        target = (cz.astype(np.int64) * cfg.size_y + cy) * cfg.size_x + cx
        win = movement.first_of_each_group(target, key_e, key_h)

        free = ag.free_slots(win.size)
        if free.size < win.size:  # ёмкость исчерпана — проходят сильнейшие
            win = win[np.lexsort((key_h[win], key_e[win]))[: free.size]]
        ready, cz, cy, cx = ready[win], cz[win], cy[win], cx[win]

        # RNG расходуется строго в порядке возрастания aid родителя (§12).
        order = np.argsort(ag.aid[ready], kind="stable")
        ready, cz, cy, cx = ready[order], cz[order], cy[order], cx[order]
        w_move, w_act = brain.mutate(ag.w_move[ready], ag.w_act[ready], cfg, self.rngs)

        child_energy = (ag.energy[ready] * cfg.repro_share).astype(np.float32)
        ag.energy[ready] -= child_energy + cfg.repro_cost
        ag.repro_cd[ready] = cfg.repro_cooldown
        slots = ag.free_slots(ready.size)
        ag.spawn(slots, cz, cy, cx, child_energy, w_move, w_act, ag.aid[ready])
        self.events.add(t, events.BIRTH, ag.aid[slots], cz, cy, cx, child_energy)

    # ------------------------------------------------------------ сводка

    def state(self) -> dict:
        s = {"tick": self.tick_no, "seed": self.seed, "food": self.food}
        s.update(self.terrain.state())
        s.update(self.agents.state())
        s["next_aid"] = int(self.agents.next_aid)
        return s

    def digest(self) -> str:
        s = self.state()
        s["rng"] = repr(self.rngs.get_state())
        return array_digest(s)

    def stats(self) -> dict:
        ag = self.agents
        live = ag.live_slots()
        return {
            "tick": self.tick_no,
            "pop": live.size,
            "energy_mean": float(ag.energy[live].mean()) if live.size else 0.0,
            "age_mean": float(ag.age[live].mean()) if live.size else 0.0,
            "food_total": float(self.food.sum()),
        }
