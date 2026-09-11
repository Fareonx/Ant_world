import numpy as np
import pytest

from antworld import events
from antworld.voxel import AIR, SOIL
from antworld.world import World
from conftest import GROUND, flat_terrain, place

Z = GROUND + 1
STAY, PX, MX, PY, MY, UP, DOWN = range(7)
NOTHING, EAT, DIG = range(3)


def solo(cfg, coords=(Z, 10, 10), energy=50.0, move=STAY, act=NOTHING, food=0.0):
    """Мир с ровной площадкой и одним агентом с заданной жёсткой политикой."""
    w = World(cfg, seed=1, log_events=True)
    w.terrain = flat_terrain(cfg)
    w._fertile_f = w.terrain.fertile.astype(np.float32)
    w.food = np.zeros((cfg.size_y, cfg.size_x), np.float32)
    w.food[coords[1], coords[2]] = food
    w.agents = place(cfg, w.terrain, [coords], [energy])
    w.agents.w_move[0, 0, move] = 1.0   # строка смещения задаёт постоянное решение
    w.agents.w_act[0, 0, act] = 1.0
    w.agents.repro_cd[0] = 0
    return w


def test_starvation_kills(cfg):
    w = solo(cfg, energy=cfg.metabolism / 2)
    w.tick()
    assert w.agents.count == 0
    rec = w.events.records()
    death = rec[rec["kind"] == events.DEATH]
    assert death["value"][0] == events.DEATH_STARVED


def test_old_age_kills(cfg):
    w = solo(cfg, energy=cfg.energy_max)
    w.agents.age[0] = cfg.max_age - 1
    w.tick()
    assert w.agents.count == 0
    rec = w.events.records()
    assert rec[rec["kind"] == events.DEATH]["value"][0] == events.DEATH_AGED


def test_eating_on_the_surface_transfers_food(cfg):
    w = solo(cfg, act=EAT, energy=10.0, food=cfg.food_cap)
    w.tick()
    taken = min(cfg.food_cap, cfg.eat_rate)
    assert float(w.agents.energy[0]) == pytest.approx(10.0 + taken - cfg.metabolism, abs=1e-4)
    # Поле растёт в фазе 8 того же тика, уже после того как из него поели (§9).
    left = cfg.food_cap - taken
    left += cfg.growth_rate * left * (1.0 - left / cfg.food_cap) + cfg.seed_rate
    assert float(w.food[10, 10]) == pytest.approx(left, abs=1e-4)


def test_no_food_underground(cfg):
    """Вся еда лежит на поверхности — внизу безопасно и голодно (§5).

    Копать надо не верхний воксель: выкопав его, агент опускает саму поверхность
    и снова оказывается на ней. Нужна полость под нетронутой кровлей.
    """
    w = solo(cfg, act=EAT, energy=50.0, food=cfg.food_cap)
    w.terrain.dig(np.array([GROUND - 1]), np.array([10]), np.array([10]))
    assert w.terrain.surface_z[10, 10] == GROUND  # кровля цела
    w.agents.move_to(np.array([0]), np.array([GROUND - 1], np.int16),
                     np.array([10], np.int16), np.array([10], np.int16))
    before = float(w.food[10, 10])
    w.tick()
    assert float(w.food[10, 10]) >= before   # ни крошки не тронуто
    assert float(w.agents.energy[0]) < 50.0  # только расход


def test_digging_turns_soil_to_air_and_costs(cfg):
    """Стена в два вокселя: на одноксельную агент просто взобрался бы, потому
    что движение идёт раньше действия, и копал бы уже за ней."""
    w = solo(cfg, coords=(Z, 10, 10), energy=50.0, move=PX, act=DIG)
    w.terrain.voxel[Z : Z + 2, 10, 11] = SOIL
    w.terrain = type(w.terrain)(cfg, w.terrain.voxel)
    w.tick()
    assert w.terrain.voxel[Z, 10, 11] == AIR
    assert w.agents.energy[0] < 50.0 - cfg.dig_cost + 1e-3


def test_digging_air_is_free(cfg):
    """Удар по пустоте не встречает сопротивления и не стоит ничего (§11)."""
    w = solo(cfg, move=PX, act=DIG, energy=50.0)
    w.tick()
    spent = 50.0 - float(w.agents.energy[0])
    assert abs(spent - (cfg.metabolism + cfg.move_cost_h)) < 1e-4


def test_reproduction_splits_energy_and_sets_cooldown(cfg):
    w = solo(cfg, energy=cfg.repro_threshold + cfg.metabolism)
    w.tick()
    assert w.agents.count == 2
    parent, child = 0, 1
    assert w.agents.parent[child] == w.agents.aid[parent]
    assert w.agents.energy[child] > 0
    assert w.agents.repro_cd[parent] == cfg.repro_cooldown
    assert w.agents.repro_cd[child] == cfg.repro_cooldown
    # Потомок появляется в допустимом соседнем вокселе.
    cz, cy, cx = w.agents.z[child], w.agents.y[child], w.agents.x[child]
    assert abs(int(cz) - Z) + abs(int(cy) - 10) + abs(int(cx) - 10) == 1


def test_reproduction_blocked_without_a_free_neighbour(cfg):
    w = solo(cfg, energy=cfg.repro_threshold + cfg.metabolism)
    # Замуровать агента: все шесть соседей непроходимы.
    for dz, dy, dx in ((0, 0, 1), (0, 0, -1), (0, 1, 0), (0, -1, 0), (1, 0, 0)):
        w.terrain.voxel[Z + dz, 10 + dy, 10 + dx] = SOIL
    w.terrain = type(w.terrain)(cfg, w.terrain.voxel)
    energy_before = float(w.agents.energy[0])
    w.tick()
    assert w.agents.count == 1
    assert w.agents.energy[0] > energy_before - cfg.repro_cost  # энергия не потрачена


def test_occupancy_invariant_holds_over_a_long_run(world):
    """Каждый живой агент стоит ровно в своей клетке, и двоих в клетке нет."""
    for _ in range(250):
        world.tick()
        ag = world.agents
        live = ag.live_slots()
        assert np.array_equal(ag.occupancy[ag.z[live], ag.y[live], ag.x[live]], live)
        assert (ag.occupancy >= 0).sum() == live.size
        if live.size == 0:
            break


def test_agents_never_stand_in_solid_or_water(world):
    for _ in range(150):
        world.tick()
        ag = world.agents
        live = ag.live_slots()
        if live.size == 0:
            break
        assert (world.terrain.voxel[ag.z[live], ag.y[live], ag.x[live]] == AIR).all()
        assert (world.terrain.support_count[ag.z[live], ag.y[live], ag.x[live]] > 0).all()
