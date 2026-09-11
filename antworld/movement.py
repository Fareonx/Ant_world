"""Разрешение движения: конкуренция, состязание сил, толкание (§10).

Порядок агентов в массивах на результат не влияет: и конкуренция за клетку, и
толкание решаются ключом `(-энергия, prio_hash)`, а не позицией в памяти.

Проходов за тик — `cfg.move_passes`, фиксированное число. Один проход означает
строгий снимок: занять освобождающуюся клетку нельзя, и плотная группа
запирается намертво. Несколько проходов дают «движение колонной»: сначала идёт
передний, затем открывшуюся клетку занимает следующий.
"""
from __future__ import annotations

from typing import NamedTuple

import numpy as np

from .agents import Agents
from .config import Config
from .rng import prio_hash
from .voxel import DIRS, Terrain


class MoveResult(NamedTuple):
    cost: np.ndarray  # расход энергии, выровнен с idx
    pusher_slots: np.ndarray
    pushed_slots: np.ndarray


def move_costs(cfg: Config) -> np.ndarray:
    """Стоимость по индексу направления (§11). Вверх дороже вниз — иначе горы
    перестают быть препятствием."""
    h, up, down = cfg.move_cost_h, cfg.move_cost_up, cfg.move_cost_down
    return np.array([h, h, h, h, up, down], dtype=np.float32)


def first_of_each_group(group: np.ndarray, k1: np.ndarray, k2: np.ndarray) -> np.ndarray:
    """По одному лучшему элементу на группу. Результат определяется только
    ключами, поэтому не зависит от исходного порядка строк."""
    order = np.lexsort((k2, k1, group))
    sorted_group = group[order]
    first = np.empty(sorted_group.size, dtype=bool)
    first[0] = True
    np.not_equal(sorted_group[1:], sorted_group[:-1], out=first[1:])
    return order[first]


def step_targets(
    ag: Agents, terrain: Terrain, slots: np.ndarray, dir_idx: np.ndarray, cfg: Config
) -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    """Куда ведёт шаг (§10, пункт 2). Возвращает (tz, ty, tx, допустим, подъём).

    Ходьба и лазанье — разные режимы. Агент, стоящий на твёрдом, при
    горизонтальном шаге обязан снова встать на твёрдое: цель ищется на уровне
    `z`, затем `z+1`, затем `z-1`, и всякий раз требуется твёрдый воксель снизу.
    Агент, висящий на стене или потолке, шагает строго на свой уровень.

    Без требования контакта с грунтом спуск по склону не работает: воксель на
    прежней высоте над более низкой колонкой остаётся опорным по диагонали к
    покинутому краю, агент зависает над землёй и теряет доступ к еде, которая
    вся лежит на поверхности.
    """
    step = DIRS[dir_idx]
    tz = ag.z[slots] + step[:, 0]
    ty = ag.y[slots] + step[:, 1]
    tx = ag.x[slots] + step[:, 2]

    plain = terrain.can_occupy(tz, ty, tx)
    horizontal = dir_idx < 4
    if not horizontal.any():
        return tz, ty, tx, plain, np.zeros(slots.size, dtype=bool)

    below = np.clip(ag.z[slots] - 1, 0, cfg.size_z - 1)
    grounded = horizontal & terrain.solid[below, ag.y[slots], ag.x[slots]]

    out_z = tz.copy()
    ok = plain & ~grounded  # лазающие и вертикальные ходоки — по общему правилу
    climbed = np.zeros(slots.size, dtype=bool)
    pending = grounded.copy()
    for offset in (0, 1, -1):  # свой уровень, ступенька вверх, ступенька вниз
        if not pending.any():
            break
        level = np.clip(tz + offset, 1, cfg.size_z - 1)
        fits = (
            pending
            & terrain.can_occupy(level, ty, tx)
            & terrain.solid[level - 1, ty, tx]
        )
        out_z = np.where(fits, level, out_z)
        ok |= fits
        if offset == 1:
            climbed |= fits
        pending &= ~fits
    return out_z, ty, tx, ok, climbed


def _member(values: np.ndarray, reference: np.ndarray) -> np.ndarray:
    """Принадлежность к небольшому множеству через поиск по отсортированному.

    Заметно дешевле `np.isin` на тех размерах, что встречаются в фазе движения:
    множества здесь — сотни элементов, а вызовов три на каждый проход.
    """
    if reference.size == 0:
        return np.zeros(values.shape, dtype=bool)
    ref = np.sort(reference)
    pos = np.searchsorted(ref, values)
    np.clip(pos, 0, ref.size - 1, out=pos)
    return ref[pos] == values


def _one_pass(
    ag: Agents, terrain: Terrain, dir_idx: np.ndarray, slots: np.ndarray,
    tick: int, cfg: Config,
) -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    """Один проход разрешения. Возвращает (сдвинувшиеся, толкнувшие,
    толкнутые, поднявшиеся_на_ступеньку) — всё в виде слотов/масок по `slots`."""
    empty = np.empty(0, dtype=np.int32)
    tz, ty, tx, ok, climbed = step_targets(ag, terrain, slots, dir_idx, cfg)
    if not ok.any():
        return empty, empty, empty, climbed & ok

    sel = np.flatnonzero(ok)
    s_slots, s_dir = slots[sel], dir_idx[sel]
    tz, ty, tx = tz[sel], ty[sel], tx[sel]

    t_flat = (tz.astype(np.int64) * cfg.size_y + ty) * cfg.size_x + tx
    key_e = -ag.energy[s_slots]
    key_h = prio_hash(ag.aid[s_slots], tick)

    # Конкуренция за одну клетку: забирает сильнейший претендент.
    win = first_of_each_group(t_flat, key_e, key_h)
    w_slots, w_dir = s_slots[win], s_dir[win]
    wz, wy, wx, w_tflat = tz[win], ty[win], tx[win], t_flat[win]
    w_e, w_h = key_e[win], key_h[win]

    occupant = ag.occupancy[wz, wy, wx]
    free = occupant < 0
    moved_slots = [w_slots[free]]
    moved_z, moved_y, moved_x = [wz[free]], [wy[free]], [wx[free]]
    pusher_slots = pushed_slots = empty

    contested = np.flatnonzero(~free)
    if contested.size:
        other = occupant[contested].astype(np.intp)
        o_e, o_h = -ag.energy[other], prio_hash(ag.aid[other], tick)
        stronger = (w_e[contested] < o_e) | (
            (w_e[contested] == o_e) & (w_h[contested] < o_h)
        )
        c = contested[stronger]
        if c.size:
            push_step = DIRS[w_dir[c]]
            pz = np.clip(wz[c] + push_step[:, 0], 0, cfg.size_z - 1)
            py, px = wy[c] + push_step[:, 1], wx[c] + push_step[:, 2]
            p_flat = (pz.astype(np.int64) * cfg.size_y + py) * cfg.size_x + px

            # Клетка под толчок: пригодна, пуста и не отобрана у победителя.
            candidate = (
                terrain.can_occupy(pz, py, px)
                & (ag.occupancy[pz, py, px] < 0)
                & ~_member(p_flat, w_tflat)
            )
            # Цепочек толчков нет: толкнуть можно лишь того, кто сам не толкает.
            victim = occupant[c].astype(np.int32)
            accept = np.flatnonzero(candidate & ~_member(victim, w_slots[c][candidate]))
            if accept.size:
                best = accept[
                    first_of_each_group(p_flat[accept], w_e[c][accept], w_h[c][accept])
                ]
                pusher_slots, pushed_slots = w_slots[c][best], victim[best]
                moved_slots += [pusher_slots, pushed_slots]
                moved_z += [wz[c][best], pz[best]]
                moved_y += [wy[c][best], py[best]]
                moved_x += [wx[c][best], px[best]]
                # Толкаемый теряет собственный ход этого тика (§10).
                keep = ~_member(moved_slots[0], pushed_slots)
                moved_slots[0] = moved_slots[0][keep]
                moved_z[0], moved_y[0], moved_x[0] = (
                    moved_z[0][keep], moved_y[0][keep], moved_x[0][keep]
                )

    all_slots = np.concatenate(moved_slots)
    ag.move_to(all_slots, np.concatenate(moved_z), np.concatenate(moved_y),
               np.concatenate(moved_x))
    return all_slots, pusher_slots, pushed_slots, climbed


def resolve(
    ag: Agents, terrain: Terrain, move: np.ndarray, idx: np.ndarray, tick: int, cfg: Config
) -> MoveResult:
    cost = np.zeros(idx.size, dtype=np.float32)
    empty = np.empty(0, dtype=np.int32)
    active = move != 0
    if not active.any():
        return MoveResult(cost, empty, empty)

    # Усилие списывается один раз за тик, независимо от числа проходов и от того,
    # удался ли шаг.
    all_dirs = (move - 1).astype(np.intp)
    cost[active] = move_costs(cfg)[all_dirs[active]]

    pushers: list[np.ndarray] = []
    pushed: list[np.ndarray] = []
    for _ in range(cfg.move_passes):
        loc = np.flatnonzero(active)
        if loc.size == 0:
            break
        moved, pu, pd, climbed = _one_pass(
            ag, terrain, all_dirs[loc], idx[loc], tick, cfg
        )
        if climbed.any():  # надбавка за подъём на ступеньку
            climb_slots = np.intersect1d(idx[loc[climbed]], moved, assume_unique=False)
            cost[np.searchsorted(idx, climb_slots)] += cfg.move_cost_up - cfg.move_cost_h
        if moved.size == 0:
            break
        cost[np.searchsorted(idx, pu)] += cfg.push_cost
        active[np.searchsorted(idx, moved)] = False  # сдвинулся — на сегодня всё
        if pd.size:
            active[np.searchsorted(idx, pd)] = False  # толкнутый теряет свой ход
        pushers.append(pu)
        pushed.append(pd)

    if not pushers:
        return MoveResult(cost, empty, empty)
    return MoveResult(cost, np.concatenate(pushers), np.concatenate(pushed))
