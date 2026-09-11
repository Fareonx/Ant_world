"""Сенсоры, две головы решения и наследование генома (WORLD_RULES.md §7, §8, §11)."""
from __future__ import annotations

import numpy as np

from .agents import Agents, N_ACT, N_MOVE, N_SENSE
from .config import Config
from .rng import Rngs
from .voxel import Terrain


def sense(
    ag: Agents, terrain: Terrain, food: np.ndarray, idx: np.ndarray, cfg: Config
) -> np.ndarray:
    """Сенсорный вектор (N, 12). Порядок входов зафиксирован в §7 и является
    частью контракта генома — менять его нельзя без смены версии мира."""
    z, y, x = ag.z[idx], ag.y[idx], ag.x[idx]
    out = np.empty((idx.size, N_SENSE), dtype=np.float32)

    out[:, 0] = 1.0  # смещение
    out[:, 1] = ag.energy[idx] / cfg.energy_max
    out[:, 2] = food[y, x] / cfg.food_cap
    # Градиент нормируется на типичный запас клетки, а не на её потолок: при
    # делении на food_cap характерная величина выходит около 0.05 и такой вход
    # не может конкурировать с константой смещения, равной 1.0.
    inv = np.float32(1.0 / (2.0 * cfg.food_grad_scale))
    np.clip((food[y, x + 1] - food[y, x - 1]) * inv, -1.0, 1.0, out=out[:, 3])
    np.clip((food[y + 1, x] - food[y - 1, x]) * inv, -1.0, 1.0, out=out[:, 4])
    # Ноль означает «стою на поверхности» (z = surface_z + 1), плюс — под землёй,
    # минус — над ней. Для линейной политики важно, где именно ноль: относительно
    # него и работает знак веса.
    np.clip(
        (terrain.surface_z[y, x] + 1 - z) / np.float32(cfg.depth_scale), -1.0, 1.0,
        out=out[:, 5],
    )
    # Проходимость шести соседей: агент чувствует рельеф, но не чужие тела —
    # осязание соседей вынесено в следующую веху.
    terrain.neighbours_occupiable(z, y, x, out[:, 6:12])
    return out


def decide(ag: Agents, senses: np.ndarray, idx: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Два argmax по линейным головам. RNG не участвует: при данном геноме и
    сенсорах решение полностью определено."""
    move = np.argmax(
        np.einsum("ns,nsk->nk", senses, ag.w_move[idx], optimize=False), axis=1
    ).astype(np.int8)
    act = np.argmax(
        np.einsum("ns,nsk->nk", senses, ag.w_act[idx], optimize=False), axis=1
    ).astype(np.int8)
    return move, act


def founder_genomes(n: int, cfg: Config, rngs: Rngs) -> tuple[np.ndarray, np.ndarray]:
    """Стартовые геномы. Вес строки смещения занижен отдельно.

    При одинаковой сигме константа смещения перевешивает все сенсорные входы, и
    argmax случайного генома выдаёт одно и то же действие независимо от
    обстановки: агент, которому выпало «копать», копает до самой смерти. Отбору
    нужны реагирующие политики, а не постоянные.
    """
    sigma = cfg.init_weight_sigma
    w_move = rngs.init.normal(0.0, sigma, (n, N_SENSE, N_MOVE)).astype(np.float32)
    w_act = rngs.init.normal(0.0, sigma, (n, N_SENSE, N_ACT)).astype(np.float32)
    w_move[:, 0, :] *= cfg.init_bias_sigma / sigma
    w_act[:, 0, :] *= cfg.init_bias_sigma / sigma
    return w_move, w_act


def mutate(
    w_move: np.ndarray, w_act: np.ndarray, cfg: Config, rngs: Rngs
) -> tuple[np.ndarray, np.ndarray]:
    """Единственное место в цикле тиков, где расходуется RNG (§12).

    Порядок розыгрышей задан порядком строк на входе; вызывающая сторона
    обязана отсортировать родителей по `aid`.
    """
    out_move, out_act = w_move.copy(), w_act.copy()
    for arr in (out_move, out_act):
        mask = rngs.sim.random(arr.shape, dtype=np.float32) < cfg.mutation_rate
        noise = rngs.sim.normal(0.0, cfg.mutation_sigma, arr.shape).astype(np.float32)
        arr += noise * mask
    return out_move, out_act
