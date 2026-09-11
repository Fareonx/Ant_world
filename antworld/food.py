"""Поле еды и его рост (WORLD_RULES.md §5).

Поле двумерное и поверхностное. Это главный рычаг скорости: рост — единственная
работа, пропорциональная объёму мира, и в 3D он стоил бы 1.28M клеток за тик
вместо 40k.
"""
from __future__ import annotations

import numpy as np

from .config import Config
from .rng import Rngs
from .voxel import Terrain


def initial(cfg: Config, terrain: Terrain, rngs: Rngs) -> np.ndarray:
    noise = rngs.world.random((cfg.size_y, cfg.size_x), dtype=np.float32)
    field = noise * (cfg.food_cap * cfg.food_init_frac * 2.0)
    np.clip(field, 0.0, cfg.food_cap, out=field)
    field *= terrain.fertile
    return field


def grow(food: np.ndarray, fertile_f: np.ndarray, cfg: Config) -> None:
    """Логистический рост с независимым притоком, на месте.

    `seed_rate` не косметика: логистический член при food == 0 равен нулю, и без
    притока клетка, выеденная ровно в ноль, остаётся мёртвой навсегда — популяция
    необратимо выжигает мир.
    """
    delta = food * (1.0 - food / cfg.food_cap)
    delta *= cfg.growth_rate
    delta += cfg.seed_rate
    delta *= fertile_f
    food += delta
    np.clip(food, 0.0, cfg.food_cap, out=food)
