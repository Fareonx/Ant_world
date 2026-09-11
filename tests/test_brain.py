import numpy as np

from antworld import brain
from antworld.agents import N_ACT, N_MOVE, N_SENSE
from antworld.rng import Rngs
from antworld.voxel import DIRS
from conftest import GROUND, flat_terrain, place


def test_sensor_layout(cfg):
    """Порядок входов — часть контракта генома (§7)."""
    t = flat_terrain(cfg)
    ag = place(cfg, t, [(GROUND + 1, 10, 10)], [cfg.energy_max / 2])
    food = np.zeros((cfg.size_y, cfg.size_x), np.float32)
    food[10, 10] = cfg.food_cap
    food[10, 11] = cfg.food_cap
    s = brain.sense(ag, t, food, ag.live_slots(), cfg)

    assert s.shape == (1, N_SENSE)
    assert s[0, 0] == 1.0                       # смещение
    assert s[0, 1] == 0.5                       # энергия
    assert s[0, 2] == 1.0                       # еда под собой
    assert s[0, 3] > 0                          # градиент указывает на +X
    assert s[0, 4] == 0.0
    assert s[0, 5] == 0.0                       # ноль = «стою на поверхности»
    # Проходимость: по горизонтали ровно, вверх нет опоры, вниз земля.
    passable = s[0, 6:12]
    assert passable[:4].tolist() == [1.0, 1.0, 1.0, 1.0]
    assert passable[4] == 0.0 and passable[5] == 0.0


def test_sensors_stay_in_range(cfg, world):
    world.run(30)
    idx = world.agents.live_slots()
    s = brain.sense(world.agents, world.terrain, world.food, idx, cfg)
    assert np.isfinite(s).all()
    assert s[:, 1:].min() >= -1.0 and s[:, 1:].max() <= 1.0


def test_passability_matches_the_movement_rule(cfg, world):
    """Сенсор не имеет права расходиться с правилом §4."""
    ag, t = world.agents, world.terrain
    idx = ag.live_slots()
    s = brain.sense(ag, t, world.food, idx, cfg)
    for i, (dz, dy, dx) in enumerate(DIRS):
        expected = t.can_occupy(ag.z[idx] + dz, ag.y[idx] + dy, ag.x[idx] + dx)
        assert np.array_equal(s[:, 6 + i].astype(bool), expected)


def test_decide_is_deterministic_and_in_range(cfg, world):
    idx = world.agents.live_slots()
    s = brain.sense(world.agents, world.terrain, world.food, idx, cfg)
    m1, a1 = brain.decide(world.agents, s, idx)
    m2, a2 = brain.decide(world.agents, s, idx)
    assert np.array_equal(m1, m2) and np.array_equal(a1, a2)
    assert m1.min() >= 0 and m1.max() < N_MOVE
    assert a1.min() >= 0 and a1.max() < N_ACT


def test_founder_bias_row_is_damped(cfg):
    """Иначе argmax случайного генома не зависит от сенсоров вовсе (§8)."""
    wm, _ = brain.founder_genomes(4000, cfg, Rngs(1))
    assert wm[:, 0, :].std() < wm[:, 1, :].std() / 2


def test_mutation_is_the_only_rng_in_the_tick(cfg):
    rngs = Rngs(1)
    wm = np.zeros((3, N_SENSE, N_MOVE), np.float32)
    wa = np.zeros((3, N_SENSE, N_ACT), np.float32)
    m1, a1 = brain.mutate(wm, wa, cfg, rngs)
    assert not np.array_equal(m1, wm)          # что-то изменилось
    assert np.array_equal(wm, np.zeros_like(wm))  # родитель не тронут

    again = Rngs(1)
    m2, a2 = brain.mutate(wm, wa, cfg, again)
    assert np.array_equal(m1, m2) and np.array_equal(a1, a2)
    assert abs(float(m1[m1 != 0].std()) - cfg.mutation_sigma) < cfg.mutation_sigma
