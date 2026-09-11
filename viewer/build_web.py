"""Сборка веб-просмотрщика из записи прогона (WORLD_RULES.md §16).

    python viewer/build_web.py run.npz colony.html

Данные упаковываются в один бинарный блок, сжимаются gzip и кладутся в страницу
как base64. Браузер распаковывает их штатным DecompressionStream — библиотека не
нужна, а страница остаётся самодостаточной.
"""
from __future__ import annotations

import argparse
import base64
import gzip
import json
import pathlib
import struct
import sys

import numpy as np

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent))

from antworld import record  # noqa: E402

TEMPLATE = pathlib.Path(__file__).with_name("web_template.html")


ALIGN = 8


def pack(arrays: dict[str, np.ndarray]) -> bytes:
    """Заголовок с описанием массивов, затем их байты.

    Каждый массив выравнивается по 8 байт. Без этого браузер отказывается
    строить Int32Array или Float32Array поверх буфера: типизированному виду
    нужно смещение, кратное размеру элемента.
    """
    header, blobs, offset = [], [], 0
    for name, arr in arrays.items():
        arr = np.ascontiguousarray(arr)
        padding = (-offset) % ALIGN
        if padding:
            blobs.append(b"\0" * padding)
            offset += padding
        raw = arr.tobytes()
        header.append(
            {"name": name, "dtype": arr.dtype.str, "shape": list(arr.shape),
             "offset": offset, "length": len(raw)}
        )
        blobs.append(raw)
        offset += len(raw)
    head = json.dumps(header).encode()
    # Тело начинается сразу за заголовком, поэтому и его длина выравнивается.
    head += b" " * ((-(4 + len(head))) % ALIGN)
    return struct.pack("<I", len(head)) + head + b"".join(blobs)


def build(recording: str, out: str) -> None:
    rec = record.load(recording)
    meta = rec["meta"]
    ny, nx = meta["size_y"], meta["size_x"]
    frames = meta["frames"]

    # Глубина агента считается здесь, а не в браузере: поверхность меняется от
    # копания, и её приходится проигрывать по кадрам.
    surface = rec["surface0"].astype(np.int16).copy()
    changes = rec["surface_changes"]
    depth = np.empty(rec["ax"].size, dtype=np.int8)
    for i in range(frames):
        for row in changes[changes[:, 0] == i]:
            surface[row[1], row[2]] = row[3]
        lo, hi = int(rec["offsets"][i]), int(rec["offsets"][i + 1])
        d = surface[rec["ay"][lo:hi], rec["ax"][lo:hi]] + 1 - rec["az"][lo:hi]
        depth[lo:hi] = np.clip(d, -128, 127)

    blob = pack({
        "height": rec["surface0"].astype(np.uint8),
        "mat": rec["material0"].astype(np.uint8),
        "changes": changes.astype(np.int32),
        "food": rec["food"].astype(np.uint8),
        "offsets": rec["offsets"].astype(np.int32),
        "ax": rec["ax"].astype(np.uint8),
        "ay": rec["ay"].astype(np.uint8),
        "ae": rec["ae"].astype(np.uint8),
        "adepth": depth,
        "aage": rec["aage"].astype(np.uint16),
        "aaid": rec["aaid"].astype(np.int32),
        "ticks": rec["ticks"].astype(np.int32),
        "stats": rec["stats"].astype(np.float32),
    })
    packed = gzip.compress(blob, 9)
    payload = base64.b64encode(packed).decode()

    cfg = meta["cfg"]
    info = {
        "nx": nx, "ny": ny, "nz": meta["size_z"], "down": meta["downsample"],
        "frames": frames, "foodCap": cfg["food_cap"], "energyMax": cfg["energy_max"],
        "capacity": cfg["capacity"], "founders": cfg["n_founders"],
    }
    html = TEMPLATE.read_text(encoding="utf-8")
    html = html.replace("__INFO__", json.dumps(info)).replace("__DATA__", payload)
    pathlib.Path(out).write_text(html, encoding="utf-8")
    print(
        f"{out}: {len(html) / 1e6:.1f} МБ "
        f"(данные {len(blob) / 1e6:.1f} МБ → {len(packed) / 1e6:.1f} МБ сжато)"
    )


def main() -> None:
    ap = argparse.ArgumentParser(description="Собрать веб-просмотрщик из записи")
    ap.add_argument("recording")
    ap.add_argument("out", nargs="?", default="colony.html")
    build(*vars(ap.parse_args()).values())


if __name__ == "__main__":
    main()
