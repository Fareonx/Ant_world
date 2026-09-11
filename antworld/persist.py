"""Сохранение и загрузка состояния мира (WORLD_RULES.md §13).

Производные поля (`surface_z`, `fertile`, `support_count`, `occupancy`) не
сохраняются: они однозначно восстанавливаются из вокселей и позиций агентов, а
хранение дубликата — лишний способ рассинхронизировать состояние.
"""
from __future__ import annotations

import json
from dataclasses import asdict, fields

import numpy as np

from .agents import Agents
from .config import Config
from .voxel import Terrain
from .world import World

_ARRAYS = (
    "alive", "x", "y", "z", "energy", "age", "repro_cd", "aid", "parent",
    "w_move", "w_act",
)


def save(world: World, path: str) -> None:
    meta = {
        "tick": int(world.tick_no),
        "seed": int(world.seed),
        "next_aid": int(world.agents.next_aid),
        "cfg": asdict(world.cfg),
        "cfg_digest": world.cfg.digest(),
        "rng": _encode_rng(world.rngs.get_state()),
        "log_events": bool(world.events.enabled),
    }
    arrays = {name: getattr(world.agents, name) for name in _ARRAYS}
    np.savez(
        path,
        _meta=np.frombuffer(json.dumps(meta).encode(), dtype=np.uint8),
        voxel=world.terrain.voxel,
        food=world.food,
        **arrays,
    )


def load(path: str) -> World:
    with np.load(path, allow_pickle=False) as data:
        meta = json.loads(bytes(data["_meta"]).decode())
        cfg = Config(**{f.name: meta["cfg"][f.name] for f in fields(Config)})
        if cfg.digest() != meta["cfg_digest"]:
            raise ValueError(
                "снапшот записан с другой конфигурацией мира — "
                f"ожидался {meta['cfg_digest']}, получен {cfg.digest()}"
            )
        # Мир создаётся обычным путём и целиком перезаписывается: генерация
        # стоит доли секунды, а отдельный путь построения был бы вторым местом,
        # где состояние мира собирается по кусочкам.
        world = World(cfg, seed=meta["seed"], log_events=meta["log_events"])
        world.terrain = Terrain(cfg, data["voxel"].copy())
        world.food = data["food"].copy()
        world._fertile_f = world.terrain.fertile.astype(np.float32)
        agents = Agents(cfg)
        for name in _ARRAYS:
            getattr(agents, name)[...] = data[name]
        agents.next_aid = np.int64(meta["next_aid"])
        live = agents.live_slots()
        agents.occupancy[agents.z[live], agents.y[live], agents.x[live]] = live.astype(
            np.int32
        )
        world.agents = agents
        world.tick_no = meta["tick"]
        world.rngs.set_state(_decode_rng(meta["rng"]))
        return world


def _encode_rng(state: dict) -> dict:
    """Состояние PCG64 содержит 128-битные числа: json их держит, numpy — нет."""
    return {name: json.loads(json.dumps(st, default=str)) for name, st in state.items()}


def _decode_rng(encoded: dict) -> dict:
    out = {}
    for name, st in encoded.items():
        st = dict(st)
        st["state"] = {k: int(v) for k, v in st["state"].items()}
        st["has_uint32"] = int(st["has_uint32"])
        st["uinteger"] = int(st["uinteger"])
        out[name] = st
    return out
