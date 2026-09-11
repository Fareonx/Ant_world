"""Живое окно просмотра (WORLD_RULES.md §16).

Запускается локально; в удалённой среде окна нет. Ядро не трогает: либо
проигрывает запись, либо крутит собственный мир и читает его состояние.

    python viewer/pygame_viewer.py run.npz          # проигрывание записи
    python viewer/pygame_viewer.py --live --seed 1  # живой прогон
"""
from __future__ import annotations

import argparse
import sys

import numpy as np

sys.path.insert(0, str(__import__("pathlib").Path(__file__).resolve().parent.parent))

from antworld import record  # noqa: E402
from antworld.config import Config  # noqa: E402
from antworld.world import World  # noqa: E402

BACKGROUND = (18, 18, 22)


def terrain_surface(pygame, height: np.ndarray, food: np.ndarray, scale: int):
    """Рельеф в серо-коричневом, еда — зелёным поверх него."""
    h = height.astype(np.float32)
    shade = (h - h.min()) / max(h.ptp(), 1.0)
    rgb = np.empty(height.shape + (3,), dtype=np.uint8)
    rgb[..., 0] = 40 + shade * 90
    rgb[..., 1] = 38 + shade * 80
    rgb[..., 2] = 34 + shade * 62
    if food is not None:
        f = food.astype(np.float32) / 255.0
        rgb[..., 1] = np.minimum(255, rgb[..., 1] + f * 150)
        rgb[..., 0] = np.maximum(0, rgb[..., 0] - f * 20)
    surf = pygame.surfarray.make_surface(np.transpose(rgb, (1, 0, 2)))
    return pygame.transform.scale(surf, (height.shape[1] * scale, height.shape[0] * scale))


def draw_agents(pygame, screen, xs, ys, es, zs, surface_z, scale):
    for x, y, e, z in zip(xs, ys, es, zs):
        # Цвет по энергии, размер по тому, на поверхности агент или в глубине.
        warm = int(np.clip(e, 0, 255))
        depth = int(surface_z[y, x]) + 1 - int(z)
        colour = (255, 90 + warm // 2, 60) if depth <= 0 else (120, 140, 255)
        pygame.draw.rect(screen, colour, (int(x) * scale, int(y) * scale, scale, scale))


def play(path: str, scale: int, fps: int) -> None:
    import pygame

    rec = record.load(path)
    meta = rec["meta"]
    down = meta["downsample"]
    height = rec["surface0"].copy()
    pygame.init()
    screen = pygame.display.set_mode((meta["size_x"] * scale, meta["size_y"] * scale))
    pygame.display.set_caption("Ant World — запись")
    clock = pygame.time.Clock()
    font = pygame.font.SysFont("monospace", 14)

    frame, paused = 0, False
    changes = rec["surface_changes"]
    while True:
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                return
            if event.type == pygame.KEYDOWN:
                if event.key == pygame.K_SPACE:
                    paused = not paused
                elif event.key == pygame.K_ESCAPE:
                    return
                elif event.key == pygame.K_RIGHT:
                    frame = min(frame + 1, meta["frames"] - 1)
                elif event.key == pygame.K_LEFT:
                    frame = max(frame - 1, 0)

        for row in changes[changes[:, 0] == frame]:
            height[row[1], row[2]] = row[3]
        food = np.repeat(np.repeat(rec["food"][frame], down, 0), down, 1)
        screen.blit(terrain_surface(pygame, height, food, scale), (0, 0))
        a = record.frame_agents(rec, frame)
        draw_agents(pygame, screen, a["ax"], a["ay"], a["ae"], a["az"], height, scale)

        pop, energy, food_total = rec["stats"][frame]
        label = f"тик {rec['ticks'][frame]}  агентов {int(pop)}  энергия {energy:.0f}"
        screen.blit(font.render(label, True, (230, 230, 230)), (8, 8))
        pygame.display.flip()
        clock.tick(fps)
        if not paused:
            frame = (frame + 1) % meta["frames"]


def live(seed: int, scale: int, fps: int) -> None:
    import pygame

    cfg = Config()
    world = World(cfg, seed=seed, log_events=False)
    pygame.init()
    screen = pygame.display.set_mode((cfg.size_x * scale, cfg.size_y * scale))
    pygame.display.set_caption("Ant World — живой прогон")
    clock = pygame.time.Clock()
    font = pygame.font.SysFont("monospace", 14)

    paused = False
    while True:
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                return
            if event.type == pygame.KEYDOWN:
                if event.key == pygame.K_SPACE:
                    paused = not paused
                elif event.key == pygame.K_ESCAPE:
                    return
        if not paused:
            world.tick()
        food = np.clip(world.food * (255.0 / cfg.food_cap), 0, 255).astype(np.uint8)
        screen.blit(
            terrain_surface(pygame, world.terrain.surface_z, food, scale), (0, 0)
        )
        ag = world.agents
        live_slots = ag.live_slots()
        energy = np.clip(ag.energy[live_slots] * (255.0 / cfg.energy_max), 0, 255)
        draw_agents(pygame, screen, ag.x[live_slots], ag.y[live_slots], energy,
                    ag.z[live_slots], world.terrain.surface_z, scale)
        stats = world.stats()
        label = f"тик {stats['tick']}  агентов {stats['pop']}  энергия {stats['energy_mean']:.0f}"
        screen.blit(font.render(label, True, (230, 230, 230)), (8, 8))
        pygame.display.flip()
        clock.tick(fps)


def main() -> None:
    ap = argparse.ArgumentParser(description="Просмотр мира Ant World")
    ap.add_argument("recording", nargs="?", help="файл записи .npz")
    ap.add_argument("--live", action="store_true", help="крутить мир вживую")
    ap.add_argument("--seed", type=int, default=1)
    ap.add_argument("--scale", type=int, default=3, help="пикселей на воксель")
    ap.add_argument("--fps", type=int, default=30)
    args = ap.parse_args()
    try:
        import pygame  # noqa: F401
    except ImportError:
        sys.exit("нужен pygame: pip install pygame")
    if args.live or not args.recording:
        live(args.seed, args.scale, args.fps)
    else:
        play(args.recording, args.scale, args.fps)


if __name__ == "__main__":
    main()
