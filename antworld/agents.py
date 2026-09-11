"""Состояние агентов как структура массивов (WORLD_RULES.md §6).

Объектов-агентов не существует. Всё состояние — параллельные массивы
фиксированной ёмкости; слоты умерших переиспользуются.
"""
from __future__ import annotations

import numpy as np

from .config import Config

N_MOVE = 7  # стоять + 6 направлений (§8)
N_ACT = 3  # ничего / есть / копать (§8)
N_SENSE = 12  # §7


class Agents:
    """Массивы состояния и детерминированная аллокация слотов."""

    def __init__(self, cfg: Config):
        c = cfg.capacity
        self.cfg = cfg
        self.alive = np.zeros(c, dtype=bool)
        self.x = np.zeros(c, dtype=np.int16)
        self.y = np.zeros(c, dtype=np.int16)
        self.z = np.zeros(c, dtype=np.int16)
        self.energy = np.zeros(c, dtype=np.float32)
        self.age = np.zeros(c, dtype=np.int32)
        self.repro_cd = np.zeros(c, dtype=np.int32)
        self.aid = np.full(c, -1, dtype=np.int64)
        self.parent = np.full(c, -1, dtype=np.int64)
        self.w_move = np.zeros((c, N_SENSE, N_MOVE), dtype=np.float32)
        self.w_act = np.zeros((c, N_SENSE, N_ACT), dtype=np.float32)
        self.next_aid = np.int64(0)
        self.occupancy = np.full(
            (cfg.size_z, cfg.size_y, cfg.size_x), -1, dtype=np.int32
        )

    # ------------------------------------------------------------ выборка

    @property
    def count(self) -> int:
        return int(self.alive.sum())

    def live_slots(self) -> np.ndarray:
        return np.flatnonzero(self.alive)

    def free_slots(self, n: int) -> np.ndarray:
        """Всегда наименьшие свободные индексы — аллокация детерминирована."""
        return np.flatnonzero(~self.alive)[:n]

    # ------------------------------------------------------- жизнь и смерть

    def spawn(
        self,
        slots: np.ndarray,
        z: np.ndarray,
        y: np.ndarray,
        x: np.ndarray,
        energy: np.ndarray,
        w_move: np.ndarray,
        w_act: np.ndarray,
        parent: np.ndarray,
    ) -> None:
        n = slots.size
        self.alive[slots] = True
        self.z[slots], self.y[slots], self.x[slots] = z, y, x
        self.energy[slots] = energy
        self.age[slots] = 0
        self.repro_cd[slots] = self.cfg.repro_cooldown
        self.aid[slots] = self.next_aid + np.arange(n, dtype=np.int64)
        self.parent[slots] = parent
        self.w_move[slots] = w_move
        self.w_act[slots] = w_act
        self.next_aid += n
        self.occupancy[z, y, x] = slots.astype(np.int32)

    def kill(self, slots: np.ndarray) -> None:
        if slots.size == 0:
            return
        self.occupancy[self.z[slots], self.y[slots], self.x[slots]] = -1
        self.alive[slots] = False
        self.aid[slots] = -1
        self.energy[slots] = 0.0

    def move_to(
        self, slots: np.ndarray, z: np.ndarray, y: np.ndarray, x: np.ndarray
    ) -> None:
        """Перемещение пачкой. Освобождение идёт раньше занятия: цель одного
        агента может быть клеткой, которую в этом же тике покидает другой."""
        if slots.size == 0:
            return
        self.occupancy[self.z[slots], self.y[slots], self.x[slots]] = -1
        self.z[slots], self.y[slots], self.x[slots] = z, y, x
        self.occupancy[z, y, x] = slots.astype(np.int32)

    def state(self) -> dict:
        return {
            name: getattr(self, name)
            for name in (
                "alive", "x", "y", "z", "energy", "age",
                "repro_cd", "aid", "parent", "w_move", "w_act",
            )
        }
