import numpy as np
import pytest

from antworld import persist
from antworld.config import Config
from antworld.world import World


def test_roundtrip_is_bit_exact(cfg, tmp_path):
    w = World(cfg, seed=99, log_events=False)
    w.run(120)
    path = str(tmp_path / "snap.npz")
    persist.save(w, path)
    loaded = persist.load(path)
    assert loaded.digest() == w.digest()
    assert loaded.tick_no == w.tick_no
    assert loaded.agents.next_aid == w.agents.next_aid


def test_continuing_from_a_snapshot_matches_an_unbroken_run(cfg, tmp_path):
    """Контракт §13: save → load → N тиков даёт то же, что N тиков подряд."""
    w = World(cfg, seed=4, log_events=False)
    w.run(100)
    path = str(tmp_path / "snap.npz")
    persist.save(w, path)

    w.run(150)
    resumed = persist.load(path)
    resumed.run(150)
    assert resumed.digest() == w.digest()


def test_derived_fields_are_rebuilt_not_stored(cfg, tmp_path):
    w = World(cfg, seed=11, log_events=False)
    w.run(80)
    path = str(tmp_path / "snap.npz")
    persist.save(w, path)
    loaded = persist.load(path)
    t = loaded.terrain
    assert np.array_equal(t.support_count, t._build_support_count())
    assert np.array_equal(t.surface_z, w.terrain.surface_z)
    assert np.array_equal(t.fertile, w.terrain.fertile)
    live = loaded.agents.live_slots()
    occ = loaded.agents.occupancy
    assert np.array_equal(occ[loaded.agents.z[live], loaded.agents.y[live],
                              loaded.agents.x[live]], live)
    assert (occ >= 0).sum() == live.size


def test_mismatched_config_is_refused(cfg, tmp_path, monkeypatch):
    w = World(cfg, seed=1, log_events=False)
    path = str(tmp_path / "snap.npz")
    persist.save(w, path)
    # Подменяем хеш так, будто снапшот писали другой конфигурацией.
    with np.load(path, allow_pickle=False) as data:
        arrays = {k: data[k] for k in data.files}
    meta = bytes(arrays["_meta"]).decode().replace(w.cfg.digest(), "0" * 16)
    arrays["_meta"] = np.frombuffer(meta.encode(), dtype=np.uint8)
    np.savez(path, **arrays)
    with pytest.raises(ValueError, match="другой конфигурацией"):
        persist.load(path)
