import numpy as np

from antworld import movement
from antworld.voxel import AIR, SOIL, Terrain
from conftest import GROUND, flat_terrain, place

STAY, PX, MX, PY, MY, UP, DOWN = range(7)
Z = GROUND + 1


def single_pass(cfg):
    """Строгий снимок начала фазы — для проверок правил разрешения по отдельности."""
    return type(cfg)(**{**cfg.__dict__, "move_passes": 1})


def step(cfg, terrain, coords, energies, moves, tick=0):
    ag = place(cfg, terrain, coords, energies)
    idx = ag.live_slots()
    res = movement.resolve(ag, terrain, np.array(moves, np.int8), idx, tick, cfg)
    return ag, res


def pos(ag, slot):
    return (int(ag.z[slot]), int(ag.y[slot]), int(ag.x[slot]))


def test_strongest_takes_the_contested_cell(cfg):
    t = flat_terrain(cfg)
    ag, _ = step(cfg, t, [(Z, 10, 10), (Z, 10, 12)], [100.0, 50.0], [PX, MX])
    assert pos(ag, 0) == (Z, 10, 11)   # сильный зашёл
    assert pos(ag, 1) == (Z, 10, 12)   # слабый остался


def test_contest_ignores_slot_order(cfg):
    """Тот же расклад, обратный порядок слотов — тот же исход (§10)."""
    t = flat_terrain(cfg)
    ag, _ = step(cfg, t, [(Z, 10, 12), (Z, 10, 10)], [50.0, 100.0], [MX, PX])
    assert pos(ag, 1) == (Z, 10, 11)
    assert pos(ag, 0) == (Z, 10, 12)


def test_stronger_pushes_weaker(cfg):
    t = flat_terrain(cfg)
    ag, res = step(cfg, t, [(Z, 10, 10), (Z, 10, 11)], [100.0, 50.0], [PX, STAY])
    assert pos(ag, 0) == (Z, 10, 11)
    assert pos(ag, 1) == (Z, 10, 12)
    assert res.pusher_slots.tolist() == [0] and res.pushed_slots.tolist() == [1]
    assert res.cost[0] == cfg.move_cost_h + cfg.push_cost
    assert res.cost[1] == 0.0          # толкнутый за это не платит


def test_weaker_cannot_push(cfg):
    t = flat_terrain(cfg)
    ag, res = step(cfg, t, [(Z, 10, 10), (Z, 10, 11)], [50.0, 100.0], [PX, STAY])
    assert pos(ag, 0) == (Z, 10, 10)
    assert res.pusher_slots.size == 0
    assert res.cost[0] == cfg.move_cost_h  # усилие потрачено и без результата


def test_push_fails_when_there_is_nowhere_to_shove(cfg):
    t = flat_terrain(cfg)
    coords = [(Z, 10, 10), (Z, 10, 11), (Z, 10, 12)]
    ag, res = step(cfg, t, coords, [100.0, 50.0, 50.0], [PX, STAY, STAY])
    assert [pos(ag, i) for i in range(3)] == coords
    assert res.pusher_slots.size == 0


def test_push_does_not_chain(cfg):
    """Внутри одного прохода толкнуть можно лишь того, кто сам никого не толкает
    (§10). Продвижение колонны — это уже следующий проход, не цепочка."""
    cfg = single_pass(cfg)
    t = flat_terrain(cfg)
    coords = [(Z, 10, 10), (Z, 10, 11), (Z, 10, 12)]
    ag, res = step(cfg, t, coords, [100.0, 80.0, 50.0], [PX, PX, STAY])
    assert res.pusher_slots.tolist() == [1]     # толкает только средний
    assert pos(ag, 1) == (Z, 10, 12) and pos(ag, 2) == (Z, 10, 13)
    assert pos(ag, 0) == (Z, 10, 10)            # первый не пошёл: цепочки нет


def test_vertical_moves_need_support(cfg):
    t = flat_terrain(cfg)
    ag, _ = step(cfg, t, [(Z, 10, 10)], [50.0], [UP])
    assert pos(ag, 0) == (Z, 10, 10)            # над ровной землёй опоры нет
    ag, _ = step(cfg, t, [(Z, 10, 10)], [50.0], [DOWN])
    assert pos(ag, 0) == (Z, 10, 10)            # снизу земля


def test_walk_climbs_a_single_step(cfg):
    t = flat_terrain(cfg)
    t.voxel[GROUND + 1, 10, 11] = SOIL          # ступенька в один воксель
    t = Terrain(cfg, t.voxel)
    ag, res = step(cfg, t, [(Z, 10, 10)], [50.0], [PX])
    assert pos(ag, 0) == (Z + 1, 10, 11)
    assert res.cost[0] == cfg.move_cost_up      # подъём дороже ходьбы


def test_walk_descends_a_single_step(cfg):
    t = flat_terrain(cfg)
    t.voxel[GROUND, 10, 11] = AIR               # спуск на один воксель
    t = Terrain(cfg, t.voxel)
    ag, _ = step(cfg, t, [(Z, 10, 10)], [50.0], [PX])
    # Ходьба держит контакт с грунтом, а не идёт на прежней высоте.
    assert pos(ag, 0) == (Z - 1, 10, 11)


def test_two_voxel_wall_and_cliff_stay_impassable(cfg):
    t = flat_terrain(cfg)
    t.voxel[GROUND + 1 : GROUND + 3, 10, 11] = SOIL   # стена в два вокселя
    t.voxel[GROUND - 1 : GROUND + 1, 10, 9] = AIR     # обрыв в два вокселя
    t = Terrain(cfg, t.voxel)
    ag, _ = step(cfg, t, [(Z, 10, 10)], [50.0], [PX])
    assert pos(ag, 0) == (Z, 10, 10)
    ag, _ = step(cfg, t, [(Z, 10, 10)], [50.0], [MX])
    assert pos(ag, 0) == (Z, 10, 10)


def test_multiple_passes_let_a_column_advance(cfg):
    """Один проход — строгий снимок: за уходящим не шагнуть. Несколько проходов
    дают движение колонной."""
    coords = [(Z, 10, 10), (Z, 10, 11), (Z, 10, 12)]
    moves = [PX, PX, PX]
    energies = [10.0, 20.0, 30.0]  # передний сильнее, чтобы толкания не было

    one = single_pass(cfg)
    t = flat_terrain(one)
    ag1, _ = step(one, t, coords, energies, moves)
    moved_one = sum(pos(ag1, i) != coords[i] for i in range(3))

    cfg_multi = type(cfg)(**{**cfg.__dict__, "move_passes": 3})
    t2 = flat_terrain(cfg_multi)
    ag2, _ = step(cfg_multi, t2, coords, energies, moves)
    moved_many = sum(pos(ag2, i) != coords[i] for i in range(3))

    assert moved_one == 1
    assert moved_many == 3
