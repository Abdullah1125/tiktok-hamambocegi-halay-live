"""Event Scheduler, Non-Overlapping Event Mutex & Free Audience Poll (!oy A/B/C)."""
from __future__ import annotations

import asyncio
import random
import re
import time
from typing import Any, Awaitable, Callable, Dict, List, Optional

EVENT_CATALOG: Dict[str, Dict[str, Any]] = {
    "disco_mode": {
        "id": "disco_mode",
        "name": "Disko Modu",
        "icon": "🪩",
        "duration": 45,
        "fx": "disco",
        "cooldown": 150,
    },
    "giant_roach": {
        "id": "giant_roach",
        "name": "Dev Hamamböceği",
        "icon": "🪲",
        "duration": 45,
        "fx": "giant",
        "cooldown": 150,
    },
    "meteor_rain": {
        "id": "meteor_rain",
        "name": "Meteor Şoku",
        "icon": "☄️",
        "duration": 30,
        "fx": "shockwave",
        "cooldown": 120,
    },
    "halay_war": {
        "id": "halay_war",
        "name": "Gelin vs Damat Savaşı",
        "icon": "⚔️",
        "duration": 60,
        "fx": "war",
        "cooldown": 180,
    },
}

VENUE_POLL_CATALOG: Dict[str, Dict[str, Any]] = {
    "venue_sunset": {
        "id": "venue_sunset",
        "kind": "venue",
        "name": "Altın Sahil",
        "icon": "🌅",
        "director": {"atmosphere": "sunset", "weather": "fireflies", "floor": "kum", "figure": "kol"},
    },
    "venue_night": {
        "id": "venue_night",
        "kind": "venue",
        "name": "Gece Neon",
        "icon": "🌃",
        "director": {"atmosphere": "night", "weather": "fireflies", "floor": "seramik", "figure": "one"},
    },
    "venue_snow": {
        "id": "venue_snow",
        "kind": "venue",
        "name": "Karlı Dağ",
        "icon": "❄️",
        "director": {"atmosphere": "snow", "weather": "snow", "floor": "seramik", "figure": "cokme"},
    },
    "venue_rain": {
        "id": "venue_rain",
        "kind": "venue",
        "name": "Yağmurlu Meydan",
        "icon": "🌧️",
        "director": {"atmosphere": "rain", "weather": "rain", "floor": "toprak", "figure": "ana"},
    },
    "venue_day": {
        "id": "venue_day",
        "kind": "venue",
        "name": "Kır Düğünü",
        "icon": "☀️",
        "director": {"atmosphere": "day", "weather": "clear", "floor": "altigen", "figure": "ana"},
    },
}


class EventScheduler:
    """Coordinates scheduled/manual events and audience votes without overlapping collisions."""

    def __init__(
        self,
        broadcast_fn: Callable[[Dict[str, Any]], Awaitable[None]],
        apply_director_fn: Optional[Callable[[Dict[str, Any]], Awaitable[None]]] = None,
    ) -> None:
        self.broadcast = broadcast_fn
        self.apply_director_fn = apply_director_fn
        self.auto_enabled = True
        self.auto_interval_sec = 210.0
        self._auto_poll_next = True
        self._poll_kind_next = "venue"
        self.active_event: Optional[Dict[str, Any]] = None
        self.last_event_id: str = ""
        self.cooldowns: Dict[str, float] = {}
        self.event_history: List[Dict[str, Any]] = []
        self._event_end_task: Optional[asyncio.Task] = None
        self._auto_task: Optional[asyncio.Task] = None
        self._lock = asyncio.Lock()

        # Audience Poll state
        self.active_poll: Optional[Dict[str, Any]] = None
        self._poll_voters: Dict[str, str] = {}
        self._poll_task: Optional[asyncio.Task] = None

    def start(self) -> None:
        if self._auto_task is None or self._auto_task.done():
            self._auto_task = asyncio.create_task(self._auto_loop(), name="halay-event-scheduler")

    async def stop(self) -> None:
        for t in (self._auto_task, self._event_end_task, self._poll_task):
            if t and not t.done():
                t.cancel()
        self._auto_task = None
        self._event_end_task = None
        self._poll_task = None

    async def _auto_loop(self) -> None:
        await asyncio.sleep(45.0)
        while True:
            try:
                if self.auto_enabled and self.active_event is None and self.active_poll is None:
                    if self._auto_poll_next:
                        self._auto_poll_next = False
                        await self.start_poll(duration_sec=45, poll_kind="auto")
                    else:
                        self._auto_poll_next = True
                        await self.start_surprise_event(source="scheduler")
                await asyncio.sleep(self.auto_interval_sec)
            except asyncio.CancelledError:
                break
            except Exception:
                pass

    async def start_surprise_event(self, source: str = "surprise") -> Dict[str, Any]:
        now = time.time()
        candidates = [
            eid
            for eid, cfg in EVENT_CATALOG.items()
            if eid != self.last_event_id and now >= self.cooldowns.get(eid, 0.0)
        ]
        if not candidates:
            candidates = [eid for eid in EVENT_CATALOG if eid != self.last_event_id] or list(EVENT_CATALOG.keys())
        chosen = random.choice(candidates)
        return await self.start_event(chosen, source=source)

    async def start_event(
        self,
        event_id: str,
        source: str = "manual",
        duration_override: Optional[int] = None,
    ) -> Dict[str, Any]:
        cfg = EVENT_CATALOG.get(event_id)
        if not cfg:
            return {"ok": False, "error": f"unknown_event:{event_id}"}
        async with self._lock:
            now = time.time()
            if self.active_event is not None:
                return {"ok": False, "error": "event_already_active", "active": self.active_event}
            if source != "manual" and now < self.cooldowns.get(event_id, 0.0):
                return {"ok": False, "error": "cooldown_active"}

            dur = max(10, min(180, int(duration_override or cfg["duration"])))
            self.active_event = {
                "id": event_id,
                "name": cfg["name"],
                "icon": cfg["icon"],
                "fx": cfg["fx"],
                "source": source,
                "started_at": now,
                "ends_at": now + dur,
                "duration": dur,
            }
            self.last_event_id = event_id
            self.cooldowns[event_id] = now + dur + float(cfg["cooldown"])
            self.event_history.append({**self.active_event})
            self.event_history = self.event_history[-25:]

            if self._event_end_task and not self._event_end_task.done():
                self._event_end_task.cancel()
            self._event_end_task = asyncio.create_task(self._finish_after(dur, event_id))

            await self.broadcast({"type": "scheduled_event", "action": "start", "event": self.active_event})
            return {"ok": True, "event": self.active_event}

    async def _finish_after(self, dur: int, event_id: str) -> None:
        try:
            await asyncio.sleep(dur)
            await self.stop_event(expected_id=event_id)
        except asyncio.CancelledError:
            pass

    async def stop_event(self, expected_id: Optional[str] = None) -> Dict[str, Any]:
        finished: Optional[Dict[str, Any]] = None
        async with self._lock:
            if self.active_event is None:
                return {"ok": True, "stopped": False}
            if expected_id and self.active_event.get("id") != expected_id:
                return {"ok": False, "stopped": False}
            finished = self.active_event
            self.active_event = None
            if self._event_end_task and not self._event_end_task.done() and asyncio.current_task() is not self._event_end_task:
                self._event_end_task.cancel()
            self._event_end_task = None
            ev_id = str(finished.get("id") or "")
            rem_unused = max(0.0, float(finished.get("ends_at", 0.0)) - time.time())
            if ev_id in self.cooldowns and rem_unused > 0:
                self.cooldowns[ev_id] = max(time.time(), self.cooldowns[ev_id] - rem_unused)
        await self.broadcast({"type": "scheduled_event", "action": "end", "event": finished})
        return {"ok": True, "stopped": True, "event": finished}

    async def start_poll(self, duration_sec: int = 45, poll_kind: str = "auto") -> Dict[str, Any]:
        async with self._lock:
            if self.active_poll is not None:
                return {"ok": False, "error": "poll_already_active", "poll": self.active_poll}
            now = time.time()
            chosen_kind = poll_kind
            if chosen_kind == "auto":
                chosen_kind = self._poll_kind_next
                self._poll_kind_next = "event" if chosen_kind == "venue" else "venue"
            if chosen_kind == "venue":
                eligible = list(VENUE_POLL_CATALOG.values())
                poll_title = "🏛️ Sıradaki Mekan & Hava?"
            else:
                eligible = [cfg for cfg in EVENT_CATALOG.values() if now >= self.cooldowns.get(cfg["id"], 0.0)]
                if len(eligible) < 3:
                    eligible = list(EVENT_CATALOG.values())
                poll_title = "🎭 Sıradaki Sahne Şovu?"
            picks = random.sample(eligible, k=min(3, len(eligible)))
            labels = ["A", "B", "C"]
            options = [
                {
                    "key": labels[i],
                    "id": p["id"],
                    "kind": p.get("kind", "event"),
                    "name": p["name"],
                    "icon": p["icon"],
                    "votes": 0,
                }
                for i, p in enumerate(picks)
            ]
            dur = max(15, min(120, int(duration_sec)))
            self._poll_voters.clear()
            self.active_poll = {
                "poll_kind": chosen_kind,
                "title": poll_title,
                "options": options,
                "started_at": now,
                "ends_at": now + dur,
                "duration": dur,
                "total_votes": 0,
            }
            if self._poll_task and not self._poll_task.done():
                self._poll_task.cancel()
            self._poll_task = asyncio.create_task(self._close_poll_after(dur))
            poll_snap = dict(self.active_poll)
        await self.broadcast({"type": "audience_poll", "action": "open", "poll": poll_snap})
        return {"ok": True, "poll": poll_snap}

    async def stop_poll(self) -> Dict[str, Any]:
        async with self._lock:
            if self.active_poll is None:
                return {"ok": True, "stopped": False}
            poll = self.active_poll
            self.active_poll = None
            if self._poll_task and not self._poll_task.done():
                self._poll_task.cancel()
            self._poll_task = None
        await self.broadcast({"type": "audience_poll", "action": "close", "winner": None, "poll": poll})
        return {"ok": True, "stopped": True}

    async def cast_vote(self, uid: str, raw_choice: str) -> Optional[str]:
        raw = str(raw_choice or "").strip().upper()
        m = re.match(r"^!OY\s*[:\-]?\s*([ABC])\b", raw)
        if not m:
            return None
        ch = m.group(1)
        poll_snap: Optional[Dict[str, Any]] = None
        async with self._lock:
            if self.active_poll is None:
                return None
            if uid in self._poll_voters:
                return "already_voted"
            for opt in self.active_poll["options"]:
                if opt["key"] == ch:
                    opt["votes"] += 1
                    self._poll_voters[uid] = ch
                    self.active_poll["total_votes"] += 1
                    poll_snap = {
                        **self.active_poll,
                        "options": [dict(o) for o in self.active_poll["options"]],
                    }
                    break
        if poll_snap is not None:
            await self.broadcast({"type": "audience_poll", "action": "update", "poll": poll_snap})
            return ch
        return None

    async def _close_poll_after(self, dur: int) -> None:
        try:
            await asyncio.sleep(dur)
            async with self._lock:
                poll = self.active_poll
                self.active_poll = None
                self._poll_task = None
            if not poll:
                return
            opts = poll.get("options") or []
            max_votes = max((o["votes"] for o in opts), default=0)
            tied = [o for o in opts if o["votes"] == max_votes]
            winner = random.choice(tied) if tied else (opts[0] if opts else None)
            await self.broadcast({"type": "audience_poll", "action": "close", "winner": winner, "poll": poll})
            if winner:
                wid = str(winner.get("id") or "")
                if wid in VENUE_POLL_CATALOG:
                    dir_cfg = dict(VENUE_POLL_CATALOG[wid]["director"])
                    if self.apply_director_fn is not None:
                        await self.apply_director_fn(dir_cfg)
                    else:
                        await self.broadcast({"type": "director_control", **dir_cfg, "from_poll": True})
                elif wid in EVENT_CATALOG and self.active_event is None:
                    await self.start_event(wid, source="poll")
        except asyncio.CancelledError:
            pass

    def snapshot(self) -> Dict[str, Any]:
        return {
            "auto_enabled": self.auto_enabled,
            "active_event": self.active_event,
            "active_poll": self.active_poll,
            "history": self.event_history[-5:],
            "catalog": list(EVENT_CATALOG.values()),
        }
