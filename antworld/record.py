"""Запись прогона для просмотрщиков (WORLD_RULES.md §16).

Ядро остаётся headless: запись — это отдельный наблюдатель, который снимает
состояние раз в `record_every` тиков. Просмотрщики читают только её и к ядру не
обращаются, поэтому скорость симуляции от способа просмотра не зависит.
"""
from __future__ import annotations

import json
from dataclasses import asdict

import numpy as np

from .config import Config
from .world import World


class Recorder:
    """Снимает кадры прогона. Рельеф пишется один раз плюс дельты копания:
    он меняется редко, а полная карта высот в каждом кадре весила бы больше
    всего остального вместе взятого."""

    def __init__(self, world: World, food_downsample: int = 2):
        self.cfg = world.cfg
        self.down = max(1, int(food_downsample))
        self.surface0 = world.terrain.surface_z.copy()
        self._surface_prev = self.surface0.copy()
        self.ticks: list[int] = []
        self.food: list[np.ndarray] = []
        self.ax: list[np.ndarray] = []
        self.ay: list[np.ndarray] = []
        self.az: list[np.ndarray] = []
        self.ae: list[np.ndarray] = []
        self.aage: list[np.ndarray] = []
        self.aaid: list[np.ndarray] = []
        self.changes: list[np.ndarray] = []
        self.stats: list[tuple[int, float, float]] = []

    def capture(self, world: World) -> None:
        cfg, ag = self.cfg, world.agents
        live = ag.live_slots()
        self.ticks.append(world.tick_no)

        d = self.down
        block = world.food[: cfg.size_y // d * d, : cfg.size_x // d * d]
        block = block.reshape(cfg.size_y // d, d, cfg.size_x // d, d)
        # Максимум по блоку, а не среднее: пятна еды не должны размываться.
        quantised = (block.max(axis=(1, 3)) * (255.0 / cfg.food_cap)).astype(np.uint8)
        self.food.append(quantised)

        self.ax.append(ag.x[live].copy())
        self.ay.append(ag.y[live].copy())
        self.az.append(ag.z[live].copy())
        self.ae.append(
            np.clip(ag.energy[live] * (255.0 / cfg.energy_max), 0, 255).astype(np.uint8)
        )
        self.aage.append(np.clip(ag.age[live], 0, 65535).astype(np.uint16))
        self.aaid.append(ag.aid[live].astype(np.int64))

        surf = world.terrain.surface_z
        moved = np.nonzero(surf != self._surface_prev)
        if moved[0].size:
            frame = len(self.ticks) - 1
            self.changes.append(
                np.stack(
                    [
                        np.full(moved[0].size, frame, np.int32),
                        moved[0].astype(np.int32),
                        moved[1].astype(np.int32),
                        surf[moved].astype(np.int32),
                    ],
                    axis=1,
                )
            )
            self._surface_prev = surf.copy()

        self.stats.append(
            (live.size, float(ag.energy[live].mean()) if live.size else 0.0,
             float(world.food.sum()))
        )

    def save(self, path: str) -> None:
        counts = np.array([a.size for a in self.ax], dtype=np.int32)
        offsets = np.concatenate([[0], np.cumsum(counts)]).astype(np.int64)
        changes = (
            np.concatenate(self.changes) if self.changes
            else np.zeros((0, 4), dtype=np.int32)
        )
        meta = {
            "size_x": self.cfg.size_x, "size_y": self.cfg.size_y,
            "size_z": self.cfg.size_z, "downsample": self.down,
            "frames": len(self.ticks), "cfg": asdict(self.cfg),
        }
        np.savez_compressed(
            path,
            _meta=np.frombuffer(json.dumps(meta).encode(), dtype=np.uint8),
            ticks=np.array(self.ticks, dtype=np.int32),
            surface0=self.surface0,
            surface_changes=changes,
            food=np.stack(self.food),
            offsets=offsets,
            ax=np.concatenate(self.ax), ay=np.concatenate(self.ay),
            az=np.concatenate(self.az), ae=np.concatenate(self.ae),
            aage=np.concatenate(self.aage), aaid=np.concatenate(self.aaid),
            stats=np.array(self.stats, dtype=np.float64),
        )


def record_run(
    cfg: Config, seed: int, ticks: int, path: str, every: int | None = None,
    food_downsample: int = 2,
) -> Recorder:
    every = every or cfg.record_every
    world = World(cfg, seed=seed, log_events=False)
    rec = Recorder(world, food_downsample=food_downsample)
    rec.capture(world)
    for _ in range(ticks):
        world.tick()
        if world.tick_no % every == 0:
            rec.capture(world)
    rec.save(path)
    return rec


def load(path: str) -> dict:
    with np.load(path, allow_pickle=False) as data:
        out = {k: data[k] for k in data.files if k != "_meta"}
        out["meta"] = json.loads(bytes(data["_meta"]).decode())
    return out


def frame_agents(rec: dict, i: int) -> dict:
    lo, hi = int(rec["offsets"][i]), int(rec["offsets"][i + 1])
    return {k: rec[k][lo:hi] for k in ("ax", "ay", "az", "ae", "aage", "aaid")}
