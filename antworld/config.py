"""Конфигурация мира. Все числа физики живут здесь и только здесь.

WORLD_RULES.md §17. В остальном коде числовых литералов физики быть не должно.
"""
from __future__ import annotations

import hashlib
import json
from dataclasses import asdict, dataclass


@dataclass(frozen=True)
class Config:
    # --- геометрия (§1) ---
    size_x: int = 200
    size_y: int = 200
    size_z: int = 32

    # --- генерация рельефа (§3) ---
    noise_cells: int = 4
    noise_octaves: int = 4
    noise_persistence: float = 0.5
    height_min: int = 6
    height_max: int = 24
    rock_depth: int = 4
    rock_peak_height: int = 20
    river_depth: int = 3
    river_width: int = 3
    river_water_depth: int = 2

    # --- еда (§5) ---
    food_cap: float = 10.0
    growth_rate: float = 0.02
    seed_rate: float = 0.002
    food_init_frac: float = 0.5
    eat_rate: float = 4.0

    # --- популяция (§6) ---
    capacity: int = 20_000
    n_founders: int = 2_000

    # --- энергия (§11) ---
    energy_init: float = 80.0
    energy_max: float = 200.0
    metabolism: float = 0.15
    move_cost_h: float = 0.20
    move_cost_up: float = 0.60
    move_cost_down: float = 0.10
    push_cost: float = 0.50
    move_passes: int = 1
    dig_cost: float = 0.80

    # --- жизненный цикл (§11) ---
    max_age: int = 5_000
    repro_threshold: float = 90.0
    repro_share: float = 0.45
    repro_cost: float = 5.0
    repro_cooldown: int = 20

    # --- геном (§11) ---
    mutation_rate: float = 0.30
    mutation_sigma: float = 0.15
    init_weight_sigma: float = 0.50
    init_bias_sigma: float = 0.00

    # --- сенсоры (§7) ---
    food_grad_scale: float = 1.0
    depth_scale: float = 8.0

    # --- запись прогона (§16) ---
    record_every: int = 25

    def __post_init__(self) -> None:
        if self.height_max >= self.size_z - 1:
            raise ValueError("height_max должен быть ниже свода купола (size_z - 1)")
        if self.height_min <= self.rock_depth:
            raise ValueError("height_min должен быть выше скального ядра")
        if not 0.0 < self.repro_share < 1.0:
            raise ValueError("repro_share должен лежать в (0, 1)")
        if self.repro_threshold > self.energy_max:
            raise ValueError("порог размножения недостижим при данном energy_max")

    def digest(self) -> str:
        """Стабильный хеш конфига. Снапшот с другим хешем загружать нельзя (§13)."""
        blob = json.dumps(asdict(self), sort_keys=True, separators=(",", ":"))
        return hashlib.sha256(blob.encode()).hexdigest()[:16]
