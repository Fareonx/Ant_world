import numpy as np

from conftest import GROUND, flat_terrain, place


def test_slots_are_always_the_lowest_free(cfg):
    t = flat_terrain(cfg)
    ag = place(cfg, t, [(GROUND + 1, 5, i) for i in range(5)], [10.0] * 5)
    assert np.array_equal(ag.live_slots(), np.arange(5))
    ag.kill(np.array([1, 3]))
    assert np.array_equal(ag.free_slots(2), np.array([1, 3]))


def test_aid_is_never_reused(cfg):
    t = flat_terrain(cfg)
    ag = place(cfg, t, [(GROUND + 1, 5, 5)], [10.0])
    first = ag.aid[0]
    ag.kill(np.array([0]))
    ag.spawn(
        ag.free_slots(1), np.array([GROUND + 1], np.int16), np.array([5], np.int16),
        np.array([6], np.int16), np.array([10.0], np.float32),
        np.zeros((1, 12, 7), np.float32), np.zeros((1, 12, 3), np.float32),
        np.array([-1], np.int64),
    )
    assert ag.aid[0] != first  # слот переиспользован, личность — нет


def test_occupancy_tracks_positions(cfg):
    t = flat_terrain(cfg)
    ag = place(cfg, t, [(GROUND + 1, 5, 5), (GROUND + 1, 5, 7)], [10.0, 10.0])
    assert ag.occupancy[GROUND + 1, 5, 5] == 0
    ag.move_to(np.array([0]), np.array([GROUND + 1], np.int16),
               np.array([5], np.int16), np.array([6], np.int16))
    assert ag.occupancy[GROUND + 1, 5, 5] == -1
    assert ag.occupancy[GROUND + 1, 5, 6] == 0
    ag.kill(np.array([1]))
    assert ag.occupancy[GROUND + 1, 5, 7] == -1
    assert (ag.occupancy >= 0).sum() == 1


def test_swap_through_a_vacated_cell(cfg):
    """Освобождение идёт раньше занятия: цель одного агента может быть клеткой,
    которую в этом же вызове покидает другой."""
    t = flat_terrain(cfg)
    ag = place(cfg, t, [(GROUND + 1, 5, 5), (GROUND + 1, 5, 6)], [10.0, 10.0])
    ag.move_to(
        np.array([0, 1]),
        np.array([GROUND + 1, GROUND + 1], np.int16),
        np.array([5, 5], np.int16),
        np.array([6, 7], np.int16),
    )
    assert ag.occupancy[GROUND + 1, 5, 6] == 0
    assert ag.occupancy[GROUND + 1, 5, 7] == 1
    assert ag.occupancy[GROUND + 1, 5, 5] == -1
