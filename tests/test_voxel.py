import numpy as np

from antworld import voxel as V
from antworld.rng import Rngs
from antworld.voxel import AIR, ROCK, SOIL, WATER


def build(cfg, seed=1):
    return V.generate(cfg, Rngs(seed))


def test_dome_is_sealed(cfg):
    """Границы — камень, поэтому проверок выхода за край не нужно нигде (§1)."""
    v = build(cfg).voxel
    assert (v[0] == ROCK).all() and (v[-1] == ROCK).all()
    assert (v[:, 0, :] == ROCK).all() and (v[:, -1, :] == ROCK).all()
    assert (v[:, :, 0] == ROCK).all() and (v[:, :, -1] == ROCK).all()


def test_generation_is_deterministic(cfg):
    assert np.array_equal(build(cfg, 5).voxel, build(cfg, 5).voxel)
    assert not np.array_equal(build(cfg, 5).voxel, build(cfg, 6).voxel)


def test_surface_is_topmost_solid_below_the_ceiling(cfg):
    t = build(cfg)
    solid = (t.voxel == SOIL) | (t.voxel == ROCK)
    expected = (cfg.size_z - 2) - np.argmax(solid[: cfg.size_z - 1][::-1], axis=0)
    assert np.array_equal(t.surface_z, expected)


def test_fertile_excludes_rock_and_water(cfg):
    t = build(cfg)
    yy, xx = np.meshgrid(np.arange(cfg.size_y), np.arange(cfg.size_x), indexing="ij")
    top = t.voxel[t.surface_z, yy, xx]
    above = t.voxel[t.surface_z + 1, yy, xx]
    assert not t.fertile[top != SOIL].any()
    assert not t.fertile[above != AIR].any()


def test_river_carved_and_flooded(cfg):
    t = build(cfg)
    assert (t.voxel == WATER).sum() > 0
    # Вода непроходима, значит ни один её воксель не может быть занят.
    wz, wy, wx = np.nonzero(t.voxel == WATER)
    assert not t.can_occupy(wz, wy, wx).any()


def test_support_count_matches_bruteforce(cfg):
    t = build(cfg)
    assert np.array_equal(t.support_count, t._build_support_count())
    assert t.support_count.max() <= 26


def test_dig_updates_derived_fields(cfg):
    t = build(cfg)
    sy, sx = cfg.size_y // 2, cfg.size_x // 2
    sz = int(t.surface_z[sy, sx])
    if t.voxel[sz, sy, sx] != SOIL:
        return  # колонка каменная, копать нечего
    t.dig(np.array([sz]), np.array([sy]), np.array([sx]))
    assert t.voxel[sz, sy, sx] == AIR
    assert t.surface_z[sy, sx] < sz
    assert np.array_equal(t.support_count, t._build_support_count())


def test_dig_ignores_rock_and_duplicates(cfg):
    t = build(cfg)
    z = np.array([1, 1])  # скальное ядро
    y = np.array([5, 5])
    x = np.array([5, 5])
    before = t.voxel.copy()
    assert not t.dig(z, y, x).any()
    assert np.array_equal(t.voxel, before)
