"""Воксельный мир: материалы, генерация, поверхность (WORLD_RULES.md §1-§4).

Ключевое решение по производительности — `support_count`. Правило §4 требует
знать, есть ли у вокселя хотя бы один твёрдый сосед. Считать это на лету значит
шесть лишних обращений к памяти на каждый из шести соседей каждого агента.
Вместо этого число твёрдых соседей хранится и правится инкрементально при
копании — единственной операции, которая меняет рельеф.
"""
from __future__ import annotations

import numpy as np

from .config import Config
from .rng import Rngs

AIR = np.uint8(0)
SOIL = np.uint8(1)
ROCK = np.uint8(2)
WATER = np.uint8(3)

MATERIAL_NAMES = {0: "AIR", 1: "SOIL", 2: "ROCK", 3: "WATER"}

# Опора считается по всем 26 окружающим вокселям, а не по 6 граням (§4).
# Иначе агент на краю уступа не может сделать шаг вниз: воксель у подножия не
# имеет твёрдого соседа по грани, и мир превращается в набор ловушек-вершин,
# из которых есть вход, но нет выхода.
_OFF26 = np.array(
    [(dz, dy, dx) for dz in (-1, 0, 1) for dy in (-1, 0, 1) for dx in (-1, 0, 1)
     if (dz, dy, dx) != (0, 0, 0)],
    dtype=np.int64,
)

# Порядок направлений зафиксирован и совпадает с головой движения (§8).
# Индекс i головы движения соответствует DIRS[i - 1].
DIRS = np.array(
    [(0, 0, 1), (0, 0, -1), (0, 1, 0), (0, -1, 0), (1, 0, 0), (-1, 0, 0)],
    dtype=np.int16,
)  # (dz, dy, dx): +X, -X, +Y, -Y, +Z, -Z


def _value_noise(rng: np.random.Generator, cfg: Config) -> np.ndarray:
    """Многооктавный value-noise с бикубическим сглаживанием, в [0, 1]."""
    total = np.zeros((cfg.size_y, cfg.size_x), dtype=np.float32)
    amplitude, norm = 1.0, 0.0
    for octave in range(cfg.noise_octaves):
        n = cfg.noise_cells * (2**octave)
        grid = rng.random((n + 1, n + 1), dtype=np.float32)

        gy = np.linspace(0, n, cfg.size_y, endpoint=False, dtype=np.float32)
        gx = np.linspace(0, n, cfg.size_x, endpoint=False, dtype=np.float32)
        y0, x0 = gy.astype(np.int32), gx.astype(np.int32)
        fy, fx = gy - y0, gx - x0
        fy = (fy * fy * (3.0 - 2.0 * fy))[:, None]  # smoothstep
        fx = (fx * fx * (3.0 - 2.0 * fx))[None, :]

        v00 = grid[np.ix_(y0, x0)]
        v01 = grid[np.ix_(y0, x0 + 1)]
        v10 = grid[np.ix_(y0 + 1, x0)]
        v11 = grid[np.ix_(y0 + 1, x0 + 1)]
        upsampled = (v00 * (1 - fx) + v01 * fx) * (1 - fy) + (v10 * (1 - fx) + v11 * fx) * fy

        total += amplitude * upsampled
        norm += amplitude
        amplitude *= cfg.noise_persistence
    return total / norm


def _river_path(height: np.ndarray, cfg: Config) -> list[tuple[int, int]]:
    """Жадный спуск с юга на север. Ничьи — в пользу меньшего x."""
    interior = slice(1, cfg.size_x - 1)
    x = int(np.argmin(height[1, interior])) + 1
    path = [(1, x)]
    for y in range(2, cfg.size_y - 1):
        lo, hi = max(1, x - 1), min(cfg.size_x - 2, x + 1)
        window = height[y, lo : hi + 1]
        x = lo + int(np.argmin(window))
        path.append((y, x))
    return path


class Terrain:
    """Воксельный мир и производные от него поля."""

    __slots__ = (
        "cfg", "voxel", "surface_z", "fertile", "support_count", "occupiable",
        "solid", "dir_offsets", "_yy", "_xx",
    )

    def __init__(self, cfg: Config, voxel: np.ndarray):
        self.cfg = cfg
        self.voxel = voxel
        self._yy, self._xx = np.meshgrid(
            np.arange(cfg.size_y), np.arange(cfg.size_x), indexing="ij"
        )
        self.solid = (self.voxel == SOIL) | (self.voxel == ROCK)
        self.support_count = self._build_support_count()
        # Готовое «сюда можно встать» (§4). Пересчитывать его из вокселя и опоры
        # на каждое обращение дорого: правило проверяется по 18 раз за тик, а
        # меняется поле только при копании.
        self.occupiable = (self.voxel == AIR) & (self.support_count > 0)
        self.dir_offsets = DIRS.astype(np.int64) @ np.array(
            [cfg.size_y * cfg.size_x, cfg.size_x, 1], dtype=np.int64
        )
        self.surface_z = np.zeros((cfg.size_y, cfg.size_x), dtype=np.int16)
        self.fertile = np.zeros((cfg.size_y, cfg.size_x), dtype=bool)
        self._recompute_columns(self._yy.ravel(), self._xx.ravel())

    # ----------------------------------------------------------------- поля

    def solid_mask(self) -> np.ndarray:
        return self.solid

    def _build_support_count(self) -> np.ndarray:
        """Число твёрдых вокселей среди 26 окружающих. Максимум 26 — влезает в uint8."""
        solid = self.solid.astype(np.uint8)
        sc = np.zeros_like(solid)
        for dz, dy, dx in _OFF26:
            dst = (
                slice(max(dz, 0), sc.shape[0] + min(dz, 0)),
                slice(max(dy, 0), sc.shape[1] + min(dy, 0)),
                slice(max(dx, 0), sc.shape[2] + min(dx, 0)),
            )
            src = (
                slice(max(-dz, 0), sc.shape[0] - max(dz, 0)),
                slice(max(-dy, 0), sc.shape[1] - max(dy, 0)),
                slice(max(-dx, 0), sc.shape[2] - max(dx, 0)),
            )
            sc[dst] += solid[src]
        return sc

    def _recompute_columns(self, ys: np.ndarray, xs: np.ndarray) -> None:
        """Пересчёт surface_z и fertile для перечисленных колонок.

        Свод купола (z = Z-1) из поиска исключён: он твёрдый везде, и без этого
        исключения поверхностью всегда оказывался бы потолок.
        """
        zz = self.cfg.size_z
        column = self.voxel[: zz - 1][:, ys, xs]
        solid = (column == SOIL) | (column == ROCK)
        top = (zz - 2) - np.argmax(solid[::-1], axis=0)
        self.surface_z[ys, xs] = top
        self.fertile[ys, xs] = (self.voxel[top, ys, xs] == SOIL) & (
            self.voxel[top + 1, ys, xs] == AIR
        )

    # ------------------------------------------------------------- правила

    def can_occupy(self, z: np.ndarray, y: np.ndarray, x: np.ndarray) -> np.ndarray:
        """Правило §4: воксель — воздух и имеет хотя бы одну твёрдую опору."""
        return self.occupiable[z, y, x]

    def neighbours_occupiable(self, z, y, x, out: np.ndarray) -> None:
        """Проходимость шести соседей разом, по плоским смещениям.

        Плоская индексация здесь законна: агенты никогда не стоят на оболочке
        мира (она сплошной камень), поэтому все шесть соседей лежат внутри
        массива и смещения не заворачиваются через край.
        """
        flat = self.occupiable.reshape(-1)
        base = (z.astype(np.int64) * self.cfg.size_y + y) * self.cfg.size_x + x
        for i, offset in enumerate(self.dir_offsets):
            out[:, i] = flat[base + offset]

    def dig(self, z: np.ndarray, y: np.ndarray, x: np.ndarray) -> np.ndarray:
        """Превращает SOIL в AIR. Возвращает маску реально выкопанных вокселей.

        Дубликаты целей схлопываются: два агента, копающие один воксель,
        выкапывают его один раз.
        """
        zz, yy, xx = self.cfg.size_z, self.cfg.size_y, self.cfg.size_x
        flat = (z.astype(np.int64) * yy + y) * xx + x
        diggable = self.voxel[z, y, x] == SOIL
        unique_flat = np.unique(flat[diggable])
        if unique_flat.size == 0:
            return diggable

        uz, rem = np.divmod(unique_flat, yy * xx)
        uy, ux = np.divmod(rem, xx)
        self.voxel[uz, uy, ux] = AIR
        self.solid[uz, uy, ux] = False

        # Опора соседей уменьшилась ровно на один твёрдый воксель.
        # Выкопанный воксель всегда внутренний (оболочка мира — камень), поэтому
        # все 26 соседей лежат в пределах массива и плоские смещения точны.
        offsets = _OFF26 @ np.array([yy * xx, xx, 1], dtype=np.int64)
        neigh = unique_flat[None, :] + offsets[:, None]
        np.subtract.at(self.support_count.reshape(-1), neigh.ravel(), 1)

        # Пригодность меняется у выкопанного вокселя и у всех его соседей.
        touched = np.unique(np.concatenate([unique_flat, neigh.ravel()]))
        self.occupiable.reshape(-1)[touched] = (
            self.voxel.reshape(-1)[touched] == AIR
        ) & (self.support_count.reshape(-1)[touched] > 0)

        cols = np.unique(uy.astype(np.int64) * xx + ux)
        self._recompute_columns(*np.divmod(cols, xx))
        return diggable

    def state(self) -> dict:
        return {"voxel": self.voxel}


def generate(cfg: Config, rngs: Rngs) -> Terrain:
    """Генерация мира по §3. Шаги строго в документированном порядке."""
    zz, yy, xx = cfg.size_z, cfg.size_y, cfg.size_x
    noise = _value_noise(rngs.world, cfg)
    height = (cfg.height_min + noise * (cfg.height_max - cfg.height_min)).astype(np.int16)

    z_axis = np.arange(zz, dtype=np.int16)[:, None, None]
    voxel = np.where(z_axis < height[None, :, :], SOIL, AIR).astype(np.uint8)

    # Скальное ядро снизу и каменные вершины сверху.
    voxel[: cfg.rock_depth + 1] = ROCK
    peaks = (z_axis >= cfg.rock_peak_height) & (voxel == SOIL)
    voxel[peaks] = ROCK

    # Река: русло прорезается только по земле, камень она не берёт.
    bed = height.copy()
    mask = np.zeros((yy, xx), dtype=bool)
    radius = cfg.river_width // 2
    floor = np.int16(cfg.rock_depth + 2)
    for py, px in _river_path(height, cfg):
        y0, y1 = max(1, py - radius), min(yy - 1, py + radius + 1)
        x0, x1 = max(1, px - radius), min(xx - 1, px + radius + 1)
        mask[y0:y1, x0:x1] = True
        level = max(floor, np.int16(height[py, px] - cfg.river_depth))
        np.minimum(bed[y0:y1, x0:x1], level, out=bed[y0:y1, x0:x1])

    carved = (z_axis >= bed[None, :, :]) & (voxel == SOIL) & mask[None, :, :]
    voxel[carved] = AIR
    flooded = (
        (z_axis >= bed[None, :, :])
        & (z_axis < (bed + cfg.river_water_depth)[None, :, :])
        & (voxel == AIR)
        & mask[None, :, :]
    )
    voxel[flooded] = WATER

    # Купол пишется последним, поверх всего: дно, свод и четыре стены.
    voxel[0] = ROCK
    voxel[zz - 1] = ROCK
    voxel[:, 0, :] = ROCK
    voxel[:, yy - 1, :] = ROCK
    voxel[:, :, 0] = ROCK
    voxel[:, :, xx - 1] = ROCK
    return Terrain(cfg, voxel)
