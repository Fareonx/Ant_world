import numpy as np
import pytest

from antworld.agents import Agents
from antworld.config import Config
from antworld.voxel import AIR, ROCK, SOIL, Terrain
from antworld.world import World

GROUND = 5  # верхний твёрдый воксель в плоском тестовом мире


@pytest.fixture
def cfg():
    """Маленький мир: тесты должны идти быстро, правила от размера не зависят."""
    return Config(
        size_x=40, size_y=40, size_z=16,
        noise_cells=2, height_min=5, height_max=11,
        rock_depth=3, rock_peak_height=10,
        capacity=400, n_founders=40,
    )


@pytest.fixture
def world(cfg):
    return World(cfg, seed=12345, log_events=True)


def flat_terrain(cfg, ground=GROUND):
    """Ровная площадка: поверхность на `ground`, агенты стоят на `ground + 1`."""
    z, y, x = cfg.size_z, cfg.size_y, cfg.size_x
    vox = np.full((z, y, x), AIR, dtype=np.uint8)
    vox[: ground + 1] = SOIL
    vox[: cfg.rock_depth + 1] = ROCK
    vox[0] = ROCK
    vox[z - 1] = ROCK
    vox[:, 0, :] = ROCK
    vox[:, y - 1, :] = ROCK
    vox[:, :, 0] = ROCK
    vox[:, :, x - 1] = ROCK
    return Terrain(cfg, vox)


def place(cfg, terrain, coords, energies):
    """Агенты на заданных местах, в заданном порядке слотов."""
    agents = Agents(cfg)
    n = len(coords)
    z = np.array([c[0] for c in coords], dtype=np.int16)
    y = np.array([c[1] for c in coords], dtype=np.int16)
    x = np.array([c[2] for c in coords], dtype=np.int16)
    agents.spawn(
        agents.free_slots(n), z, y, x,
        np.asarray(energies, dtype=np.float32),
        np.zeros((n, 12, 7), np.float32), np.zeros((n, 12, 3), np.float32),
        np.full(n, -1, dtype=np.int64),
    )
    return agents
