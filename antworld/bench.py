"""Бенчмарк скорости ядра (WORLD_RULES.md §15).

Меряется с первого дня и до любой оптимизации, чтобы регрессии были видны
между вехами. Лог событий выключается отдельно: его запись пропорциональна
числу агентов и искажает измерение чистой скорости.
"""
from __future__ import annotations

import statistics
import time

from .config import Config
from .world import World


def measure(cfg: Config, seed: int, ticks: int, warmup: int, log_events: bool) -> dict:
    world = World(cfg, seed=seed, log_events=log_events)
    world.run(warmup)
    samples, agent_ticks, elapsed = [], 0, 0.0
    chunk = max(1, ticks // 10)
    done = 0
    while done < ticks:
        n = min(chunk, ticks - done)
        pop = world.agents.count
        t0 = time.perf_counter()
        world.run(n)
        dt = time.perf_counter() - t0
        samples.append(dt / n)
        elapsed += dt
        agent_ticks += pop * n
        done += n
    # Медиана по кускам, а не среднее: одиночный всплеск сборки мусора не должен
    # определять результат.
    per_tick = statistics.median(samples)
    return {
        "pop": world.agents.count,
        "ticks_per_sec": 1.0 / per_tick,
        "agent_ticks_per_sec": agent_ticks / elapsed if elapsed else 0.0,
        "ms_per_tick": per_tick * 1e3,
    }


def run(ticks: int = 300, warmup: int = 50, seed: int = 1) -> list[dict]:
    rows = []
    for founders in (1_000, 5_000, 20_000):
        for log in (False, True):
            cfg = Config(n_founders=founders, capacity=max(20_000, founders * 2))
            result = measure(cfg, seed, ticks, warmup, log)
            rows.append({"founders": founders, "log": log, **result})
    return rows


def main() -> None:
    header = ("основателей", "лог", "популяция", "тиков/с", "агенто-тиков/с", "мс/тик")
    print(f"{header[0]:>12} {header[1]:>5} {header[2]:>10} {header[3]:>9} "
          f"{header[4]:>15} {header[5]:>8}")
    for r in run():
        print(
            f"{r['founders']:>12} {'да' if r['log'] else 'нет':>5} "
            f"{r['pop']:>10} {r['ticks_per_sec']:>9.0f} "
            f"{r['agent_ticks_per_sec']:>15,.0f} {r['ms_per_tick']:>8.2f}"
        )


if __name__ == "__main__":
    main()
