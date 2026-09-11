import numpy as np

from antworld import events
from antworld.events import EventLog
from antworld.world import World


def test_disabled_log_stays_empty(cfg):
    w = World(cfg, seed=1, log_events=False)
    w.run(60)
    assert len(w.events) == 0
    assert w.events.records().size == 0


def test_log_grows_and_records_founders(world):
    born = (world.events.records()["kind"] == events.BIRTH).sum()
    assert born == world.agents.count      # основатели записаны как рождения
    world.run(80)
    counts = world.events.counts()
    assert counts["EAT"] > 0
    assert len(world.events) > born


def test_births_and_deaths_match_population(cfg):
    w = World(cfg, seed=7, log_events=True)
    w.run(300)
    rec = w.events.records()
    born = int((rec["kind"] == events.BIRTH).sum())
    died = int((rec["kind"] == events.DEATH).sum())
    assert born - died == w.agents.count


def test_buffer_grows_without_losing_records():
    log = EventLog(enabled=True, block=4)
    for t in range(50):
        log.add(t, events.EAT, np.array([t, t + 1]), 0, 0, 0, np.float32(1.5))
    rec = log.records()
    assert rec.size == 100
    assert rec["tick"][-1] == 49
    assert rec["aid"][-1] == 50


def test_clear_resets(world):
    world.run(10)
    world.events.clear()
    assert len(world.events) == 0
