"""Priority Event Queue, Deduplication Cache & Like Coalescer for TikTok Halay Live."""
from __future__ import annotations

import asyncio
import itertools
import logging
import time
from collections import OrderedDict
from enum import IntEnum
from typing import Any, Awaitable, Callable, Dict, Optional, Tuple

logger = logging.getLogger("halay.event_engine")


class EventPriority(IntEnum):
    ADMIN = 1
    BIG_GIFT = 2
    SPECIAL_GIFT = 3
    NORMAL_GIFT = 4
    FOLLOW = 5
    SCHEDULED = 6
    CHAT = 7
    LIKE = 8


class BoundedTTLCache:
    """Bounded O(1) LRU+TTL cache to prevent duplicate event/gift processing."""

    def __init__(self, max_size: int = 4096, ttl_sec: float = 120.0) -> None:
        self.max_size = max(64, int(max_size))
        self.ttl_sec = max(5.0, float(ttl_sec))
        self._data: OrderedDict[str, float] = OrderedDict()

    def seen_or_add(self, key: str, now_mono: Optional[float] = None) -> bool:
        if not key:
            return False
        now = time.monotonic() if now_mono is None else now_mono
        self._evict_expired(now)
        exp = self._data.get(key)
        if exp is not None and exp > now:
            return True
        self._data[key] = now + self.ttl_sec
        self._data.move_to_end(key)
        while len(self._data) > self.max_size:
            self._data.popitem(last=False)
        return False

    def _evict_expired(self, now: float) -> None:
        while self._data:
            _, exp = next(iter(self._data.items()))
            if exp <= now:
                self._data.popitem(last=False)
            else:
                break

    def clear(self) -> None:
        self._data.clear()


class PriorityEventEngine:
    """Bounded async priority queue with gift idempotency and 350ms like coalescing."""

    def __init__(self, max_queue_size: int = 2048, like_coalesce_sec: float = 0.35) -> None:
        self.queue: asyncio.PriorityQueue[Tuple[int, int, str, Callable[[], Awaitable[Any]]]] = (
            asyncio.PriorityQueue(maxsize=max_queue_size)
        )
        self.dedup = BoundedTTLCache(max_size=4096, ttl_sec=120.0)
        self.like_coalesce_sec = max(0.1, float(like_coalesce_sec))
        self._seq = itertools.count()
        self._worker_task: Optional[asyncio.Task] = None
        self._running = False

        # Coalesced like buffer: uid -> {"user": dict, "count": int, "stream_total": int, "cb": callable, "timer": Task}
        self._like_buf: Dict[str, Dict[str, Any]] = {}

        # Telemetry
        self.processed_count = 0
        self.dedup_dropped = 0
        self.coalesced_likes = 0
        self.dropped_overflow = 0
        self.errors_count = 0
        self._latency_ema_ms = 0.0

    def start(self) -> None:
        if self._running and self._worker_task and not self._worker_task.done():
            return
        self._running = True
        self._worker_task = asyncio.create_task(self._worker_loop(), name="halay-event-engine")

    async def stop(self) -> None:
        self._running = False
        for item in list(self._like_buf.values()):
            t = item.get("timer")
            if t and not t.done():
                t.cancel()
        self._like_buf.clear()
        if self._worker_task and not self._worker_task.done():
            self._worker_task.cancel()
            try:
                await self._worker_task
            except asyncio.CancelledError:
                pass
        self._worker_task = None

    async def submit(
        self,
        priority: EventPriority,
        kind: str,
        coro_factory: Callable[[], Awaitable[Any]],
        dedup_key: str = "",
    ) -> bool:
        if dedup_key and self.dedup.seen_or_add(dedup_key):
            self.dedup_dropped += 1
            return False

        # Reserve top 15% of queue capacity for gifts/admin/follow when near saturation
        if priority >= EventPriority.CHAT and self.queue.qsize() >= int(self.queue.maxsize * 0.85):
            self.dropped_overflow += 1
            return False

        item = (int(priority), next(self._seq), kind, coro_factory)
        if not self._running:
            # Direct execution fallback when loop/worker is not started (e.g. unit tests)
            await self._execute_item(kind, coro_factory)
            return True

        try:
            self.queue.put_nowait(item)
        except asyncio.QueueFull:
            self.dropped_overflow += 1
            return False
        return True

    def submit_like(
        self,
        uid: str,
        user: Dict[str, Any],
        count: int,
        stream_total: int,
        flush_factory: Callable[[Dict[str, Any], int, int], Awaitable[Any]],
    ) -> None:
        """Coalesces rapid like bursts per user within like_coalesce_sec."""
        clean_cnt = max(1, int(count))
        if not self._running:
            asyncio.create_task(flush_factory(user, clean_cnt, stream_total))
            return

        slot = self._like_buf.get(uid)
        if slot is not None:
            slot["count"] += clean_cnt
            slot["stream_total"] = max(slot["stream_total"], int(stream_total))
            slot["user"] = user
            self.coalesced_likes += 1
            return

        async def _flush_after() -> None:
            await asyncio.sleep(self.like_coalesce_sec)
            entry = self._like_buf.pop(uid, None)
            if not entry:
                return
            await self.submit(
                EventPriority.LIKE,
                "like",
                lambda: entry["cb"](entry["user"], entry["count"], entry["stream_total"]),
            )

        self._like_buf[uid] = {
            "user": user,
            "count": clean_cnt,
            "stream_total": int(stream_total),
            "cb": flush_factory,
            "timer": asyncio.create_task(_flush_after()),
        }

    async def _worker_loop(self) -> None:
        while self._running:
            try:
                _, _, kind, coro_factory = await self.queue.get()
            except asyncio.CancelledError:
                break
            try:
                await self._execute_item(kind, coro_factory)
            finally:
                self.queue.task_done()

    async def _execute_item(self, kind: str, coro_factory: Callable[[], Awaitable[Any]]) -> None:
        t0 = time.perf_counter()
        try:
            await coro_factory()
            self.processed_count += 1
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            self.errors_count += 1
            logger.warning("EventEngine error on %s: %s", kind, exc)
        finally:
            dt_ms = (time.perf_counter() - t0) * 1000.0
            self._latency_ema_ms = dt_ms if self._latency_ema_ms == 0.0 else (self._latency_ema_ms * 0.85 + dt_ms * 0.15)

    def metrics(self) -> Dict[str, Any]:
        return {
            "running": self._running,
            "queue_depth": self.queue.qsize(),
            "like_buffer_users": len(self._like_buf),
            "processed": self.processed_count,
            "dedup_dropped": self.dedup_dropped,
            "coalesced_likes": self.coalesced_likes,
            "dropped_overflow": self.dropped_overflow,
            "errors": self.errors_count,
            "avg_latency_ms": round(self._latency_ema_ms, 2),
        }
