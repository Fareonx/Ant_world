"""Лог событий (WORLD_RULES.md §14).

Структурированный numpy-массив, растущий удвоением. Списков Python нет: лог
должен оставаться дешёвым даже при десятках тысяч событий в тик, а при
выключенном флаге — бесплатным.
"""
from __future__ import annotations

import numpy as np

BIRTH, DEATH, EAT, DIG, PUSH = 0, 1, 2, 3, 4
KIND_NAMES = {0: "BIRTH", 1: "DEATH", 2: "EAT", 3: "DIG", 4: "PUSH"}

DEATH_STARVED, DEATH_AGED = 0.0, 1.0

DTYPE = np.dtype(
    [
        ("tick", np.int32),
        ("kind", np.uint8),
        ("aid", np.int64),
        ("z", np.int16),
        ("y", np.int16),
        ("x", np.int16),
        ("value", np.float32),
    ]
)


class EventLog:
    __slots__ = ("enabled", "_buf", "_n")

    def __init__(self, enabled: bool = True, block: int = 4096):
        self.enabled = enabled
        self._buf = np.empty(block, dtype=DTYPE)
        self._n = 0

    def __len__(self) -> int:
        return self._n

    def add(self, tick, kind, aid, z, y, x, value) -> None:
        if not self.enabled:
            return
        aid = np.atleast_1d(aid)
        n = aid.size
        if n == 0:
            return
        if self._n + n > self._buf.size:
            grow = max(self._buf.size * 2, self._n + n)
            self._buf = np.resize(self._buf, grow)
        rec = self._buf[self._n : self._n + n]
        rec["tick"], rec["kind"], rec["aid"] = tick, kind, aid
        rec["z"], rec["y"], rec["x"] = z, y, x
        rec["value"] = value
        self._n += n

    def records(self) -> np.ndarray:
        return self._buf[: self._n]

    def counts(self) -> dict[str, int]:
        rec = self.records()
        return {name: int((rec["kind"] == k).sum()) for k, name in KIND_NAMES.items()}

    def clear(self) -> None:
        self._n = 0
