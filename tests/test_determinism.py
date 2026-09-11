"""Контракт детерминизма (WORLD_RULES.md §12).

Быстрые тесты идут на уменьшенном мире: побитовая воспроизводимость от размера
не зависит. Колония на малом мире не заводится — бутстрап эволюции требует
полного масштаба (§17), поэтому выживание проверяется отдельным медленным
тестом: `pytest -m slow`.
"""
import numpy as np
import pytest

from antworld.config import Config
from antworld.world import World

TICKS = 10_000


@pytest.fixture(scope="module")
def det_cfg():
    return Config(
        size_x=80, size_y=80, size_z=24,
        noise_cells=3, height_min=6, height_max=17,
        rock_depth=4, rock_peak_height=15,
        capacity=4_000, n_founders=400,
    )


@pytest.fixture(scope="module")
def reference(det_cfg):
    w = World(det_cfg, seed=2024, log_events=True)
    w.run(TICKS)
    return w


def test_same_seed_gives_identical_state(det_cfg, reference):
    other = World(det_cfg, seed=2024, log_events=True)
    other.run(TICKS)
    assert other.digest() == reference.digest()
    assert other.tick_no == TICKS


def test_the_run_actually_exercised_the_agents(reference):
    """Тест обязан прогонять код агентов, а не только рост еды в пустом мире."""
    counts = reference.events.counts()
    assert counts["BIRTH"] > 0 and counts["DEATH"] > 0
    assert counts["EAT"] > 0 and counts["DIG"] > 0
    rec = reference.events.records()
    assert int(rec["tick"].max()) > 500  # колония прожила заметный отрезок


def test_different_seeds_diverge(det_cfg, reference):
    other = World(det_cfg, seed=2025, log_events=True)
    other.run(TICKS)
    assert other.digest() != reference.digest()


def test_splitting_the_run_changes_nothing(det_cfg, reference):
    other = World(det_cfg, seed=2024, log_events=True)
    for _ in range(10):
        other.run(TICKS // 10)
    assert other.digest() == reference.digest()


def test_event_log_does_not_affect_the_simulation(det_cfg, reference):
    """Лог — наблюдение, а не часть физики: он не смеет менять траекторию."""
    quiet = World(det_cfg, seed=2024, log_events=False)
    quiet.run(TICKS)
    assert quiet.digest() == reference.digest()


def test_digest_reacts_to_a_single_changed_value(det_cfg):
    a = World(det_cfg, seed=5, log_events=False)
    a.run(50)
    before = a.digest()
    live = a.agents.live_slots()
    a.agents.energy[live[0]] += np.float32(1e-3)
    assert a.digest() != before


@pytest.mark.slow
def test_full_scale_run_is_reproducible_and_alive():
    """Полный мир 200×200×32: и побитовая воспроизводимость, и живая колония."""
    cfg = Config()
    a = World(cfg, seed=2024, log_events=False)
    a.run(TICKS)
    assert a.agents.count > 0
    b = World(cfg, seed=2024, log_events=False)
    b.run(TICKS)
    assert b.digest() == a.digest()
