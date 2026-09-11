"""Детерминированная случайность и тай-брейки (WORLD_RULES.md §12).

Два разных механизма, которые нельзя путать:

* `Rngs` — именованные потоки PCG64. Расходуются явно и в фиксированном порядке.
* `prio_hash` — детерминированный хеш для разрешения ничьих. RNG **не** трогает,
  поэтому добавление или удаление ничьей не сдвигает поток мутаций.
"""
from __future__ import annotations

import hashlib

import numpy as np

_GOLDEN = np.uint64(0x9E3779B97F4A7C15)
_M1 = np.uint64(0xBF58476D1CE4E5B9)
_M2 = np.uint64(0x94D049BB133111EB)
_S30, _S27, _S31 = np.uint64(30), np.uint64(27), np.uint64(31)

STREAMS = ("world", "init", "sim")


class Rngs:
    """Три независимых потока, порождённых из одного сида."""

    def __init__(self, seed: int):
        self.seed = int(seed)
        children = np.random.SeedSequence(self.seed).spawn(len(STREAMS))
        for name, child in zip(STREAMS, children):
            setattr(self, name, np.random.Generator(np.random.PCG64(child)))

    def get_state(self) -> dict:
        return {name: getattr(self, name).bit_generator.state for name in STREAMS}

    def set_state(self, state: dict) -> None:
        for name in STREAMS:
            getattr(self, name).bit_generator.state = state[name]


def splitmix64(v: np.ndarray) -> np.ndarray:
    """Финализатор splitmix64. Переполнение uint64 здесь — часть алгоритма."""
    z = np.asarray(v, dtype=np.uint64)
    with np.errstate(over="ignore"):
        z = (z ^ (z >> _S30)) * _M1
        z = (z ^ (z >> _S27)) * _M2
        return z ^ (z >> _S31)


def prio_hash(aid: np.ndarray, tick: int) -> np.ndarray:
    """Ключ для разрешения ничьих. Меньше — выигрывает (§10).

    Перемешивается каждый тик, поэтому агенты с малым `aid` не получают
    систематического преимущества — иначе отбор шёл бы по возрасту, а не по
    приспособленности.
    """
    with np.errstate(over="ignore"):
        return splitmix64(np.asarray(aid, dtype=np.uint64) * _GOLDEN + np.uint64(tick))


def array_digest(arrays: dict) -> str:
    """Побитовый хеш набора массивов — основа теста на детерминизм (§12)."""
    h = hashlib.blake2b(digest_size=16)
    for key in sorted(arrays):
        value = arrays[key]
        if np.isscalar(value) or isinstance(value, (int, float, str, bytes)):
            h.update(f"{key}={value!r}".encode())
            continue
        arr = np.ascontiguousarray(value)
        h.update(f"{key}|{arr.dtype.str}|{arr.shape}".encode())
        h.update(arr.tobytes())
    return h.hexdigest()
