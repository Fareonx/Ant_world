import numpy as np
import pytest

from antworld.config import Config
from antworld.rng import Rngs, array_digest, prio_hash, splitmix64


def test_digest_stable_and_sensitive():
    assert Config().digest() == Config().digest()
    assert Config().digest() != Config(metabolism=0.31).digest()


@pytest.mark.parametrize(
    "kwargs",
    [
        {"height_max": 40},          # выше свода купола
        {"height_min": 2},           # внутри скального ядра
        {"repro_share": 1.5},        # доля вне (0, 1)
        {"repro_threshold": 9_999},  # порог недостижим
    ],
)
def test_impossible_configs_rejected(kwargs):
    with pytest.raises(ValueError):
        Config(**kwargs)


def test_streams_are_independent_and_reproducible():
    a, b = Rngs(7), Rngs(7)
    assert a.world.random() == b.world.random()
    # Расход одного потока не сдвигает остальные — ради этого они и разделены.
    a.world.random(1000)
    assert a.sim.random() == b.sim.random()


def test_rng_state_roundtrip():
    r = Rngs(3)
    r.sim.random(10)
    saved = r.get_state()
    expected = r.sim.random(5)
    r.set_state(saved)
    assert np.array_equal(r.sim.random(5), expected)


def test_prio_hash_reshuffles_every_tick():
    aid = np.arange(2000, dtype=np.int64)
    h0, h1 = prio_hash(aid, 0), prio_hash(aid, 1)
    assert not np.array_equal(h0, h1)
    assert np.unique(h0).size == aid.size  # без коллизий на разумном масштабе
    # Младший aid не должен систематически выигрывать: иначе отбор пойдёт по
    # возрасту, а не по приспособленности.
    wins = sum(int(prio_hash(aid, t)[0] < prio_hash(aid, t)[1]) for t in range(400))
    assert 150 < wins < 250


def test_splitmix_is_pure():
    v = np.arange(10, dtype=np.uint64)
    assert np.array_equal(splitmix64(v), splitmix64(v))


def test_array_digest_notices_one_bit():
    a = np.zeros(100, dtype=np.float32)
    before = array_digest({"a": a})
    a[42] = np.float32(1e-30)
    assert array_digest({"a": a}) != before
