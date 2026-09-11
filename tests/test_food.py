import numpy as np

from antworld import food as F
from antworld.rng import Rngs
from antworld.voxel import generate


def test_stays_within_bounds(cfg):
    t = generate(cfg, Rngs(1))
    field = F.initial(cfg, t, Rngs(1))
    fertile = t.fertile.astype(np.float32)
    for _ in range(500):
        F.grow(field, fertile, cfg)
    assert field.min() >= 0.0
    assert field.max() <= cfg.food_cap + 1e-6


def test_grows_only_where_fertile(cfg):
    t = generate(cfg, Rngs(1))
    field = np.zeros((cfg.size_y, cfg.size_x), dtype=np.float32)
    F.grow(field, t.fertile.astype(np.float32), cfg)
    assert (field[~t.fertile] == 0.0).all()
    assert (field[t.fertile] > 0.0).all()


def test_grazed_cell_recovers(cfg):
    """Клетка, выеденная ровно в ноль, обязана восстанавливаться.

    Логистический член при food == 0 равен нулю, поэтому без независимого
    притока популяция необратимо выжигает мир (§5).
    """
    fertile = np.ones((1, 1), dtype=np.float32)
    field = np.zeros((1, 1), dtype=np.float32)
    for _ in range(2000):
        F.grow(field, fertile, cfg)
    assert field[0, 0] > cfg.food_cap * 0.5


def test_growth_saturates_at_cap(cfg):
    fertile = np.ones((1, 1), dtype=np.float32)
    field = np.full((1, 1), cfg.food_cap, dtype=np.float32)
    F.grow(field, fertile, cfg)
    assert field[0, 0] == cfg.food_cap
