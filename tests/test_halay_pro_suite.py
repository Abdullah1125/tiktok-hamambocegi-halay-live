# -*- coding: utf-8 -*-
import asyncio
import io
import os
import sys
import tempfile
from pathlib import Path

if sys.stdout and hasattr(sys.stdout, "buffer"):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from event_engine import EventPriority, PriorityEventEngine
from event_scheduler import EventScheduler
from viewer_store import ViewerStore
from tiktok_bridge import HalayLiveBridge


async def run_all_tests() -> None:
    # 1. Priority ordering + dedup + 500 likes coalescing
    order = []
    eng = PriorityEventEngine(max_queue_size=512, like_coalesce_sec=0.12)
    eng.start()
    await eng.submit(EventPriority.LIKE, "like", lambda: _rec(order, "like"), dedup_key="l1")
    await eng.submit(EventPriority.CHAT, "chat", lambda: _rec(order, "chat1"), dedup_key="c1")
    dup_ok = await eng.submit(EventPriority.CHAT, "chat", lambda: _rec(order, "dup"), dedup_key="c1")
    assert dup_ok is False, "Duplicate msg_id must be dropped"
    await eng.submit(EventPriority.BIG_GIFT, "gift", lambda: _rec(order, "big"), dedup_key="g1")
    for _ in range(5):
        eng.submit_like("u_like", {"uid": "u_like", "nickname": "Tapper"}, 100, 500, _like_cb(order))
    await asyncio.sleep(0.35)
    m = eng.metrics()
    await eng.stop()
    assert m["dedup_dropped"] >= 1, f"Expected dedup_dropped >= 1, got {m}"
    assert m["coalesced_likes"] == 4, f"Expected 4 coalesced merges for 5 calls, got {m}"
    assert any(x == "like_flush:500" for x in order), f"Expected 500 coalesced likes flush, got {order}"
    print("[PASS] 1-4: PriorityQueue + Dedup + 500-Like Coalescing")

    # 2. ViewerStore SQLite WAL + Bridge state lock + TikFinity repeatEnd + 24-seat + Poll
    with tempfile.TemporaryDirectory() as tmp:
        events = []

        async def cap_broadcast(payload):
            events.append(payload)

        bridge = HalayLiveBridge(cap_broadcast)
        bridge.viewer_store.close()
        bridge.viewer_store = ViewerStore(os.path.join(tmp, "test_viewers.db"))
        bridge.event_engine.start()
        bridge.event_scheduler.start()
        await bridge.reset_state()

        # TikFinity streak bug fix: repeatEnd=False ignored, repeatEnd=True processed once
        for r in range(1, 10):
            await bridge._handle_tikfinity_event("gift", {
                "uniqueId": "tf_user", "nickname": "TF_King", "giftId": 5655,
                "giftName": "Rose", "diamondCount": 1, "repeatCount": r, "giftType": 1, "repeatEnd": False,
            })
        assert bridge.total_gifts == 0, f"Streaking ticks should not be credited early: {bridge.total_gifts}"
        await bridge._handle_tikfinity_event("gift", {
            "uniqueId": "tf_user", "nickname": "TF_King", "giftId": 5655,
            "giftName": "Rose", "diamondCount": 1, "repeatCount": 10, "giftType": 1, "repeatEnd": True,
        })
        await asyncio.sleep(0.15)
        assert bridge.total_gifts == 10, f"Expected 10 diamonds total after repeatEnd=True, got {bridge.total_gifts}"
        print("[PASS] 5-6: TikFinity repeatEnd Streak Dedup (10 != 55)")

        # Concurrent gifts + Rose + Donut + Gelin + Sabotage
        await asyncio.gather(
            bridge.process_gift({"uid": "g1", "nickname": "G1"}, "Donut", 30, gift_id=5879, diamond_unit=30),
            bridge.process_gift({"uid": "g2", "nickname": "G2"}, "Elle Kalp", 100, gift_id=5924, diamond_unit=100),
            bridge.process_gift({"uid": "g3", "nickname": "G3"}, "Sabotaj", 15, gift_id=5487, diamond_unit=15),
        )
        assert bridge.halaybasi_user and bridge.halaybasi_user["uid"] == "g1"
        assert bridge.gelin_user and bridge.gelin_user["uid"] == "g2"
        print("[PASS] 7-9: Concurrent Gifts + VIP Roles + Sabotage FX")

        # 24-seat lock + waiting queue + admin kick & promote
        for i in range(30):
            await bridge.queue_join({"uid": f"d{i}", "nickname": f"Dancer_{i}"}, reason="begeni", flush_now=False)
        assert len(bridge.joined_users) == bridge.max_halay_seats, f"Seats={len(bridge.joined_users)}"
        assert len(bridge.waiting_queue) > 0, "Expected waiting queue non-empty"
        prom_ok = await bridge.promote_halaybasi("d5")
        assert prom_ok and bridge.halaybasi_user["uid"] == "d5"
        kick_ok = await bridge.kick_dancer("d5")
        assert kick_ok and "d5" not in bridge.joined_uids
        print("[PASS] 10-12: 24-Seat Lock + Queue + Admin Kick/Promote")

        # EventScheduler mutex + Poll single vote per uid
        try:
            r1 = await bridge.event_scheduler.start_event("disco_mode", source="test", duration_override=10)
            r2 = await bridge.event_scheduler.start_event("giant_roach", source="test", duration_override=10)
            assert r1["ok"] is True and r2["ok"] is False, f"Overlapping event must be blocked by mutex: {r1}, {r2}"
            await bridge.event_scheduler.stop_event()

            p_res = await bridge.event_scheduler.start_poll(duration_sec=15)
            assert p_res["ok"] is True
            await bridge.process_chat({"uid": "voter1", "nickname": "Voter1"}, "!oy A")
            await bridge.process_chat({"uid": "voter1", "nickname": "Voter1"}, "!oy B")
            opts = {o["key"]: o["votes"] for o in bridge.event_scheduler.active_poll["options"]}
            assert opts["A"] == 1 and opts["B"] == 0, f"Single vote per uid failed: {opts}"
            await bridge.process_chat({"uid": "voter1", "nickname": "Voter1"}, "!profil")
            print("[PASS] 13-14: Event Mutex + !oy A/B/C Single-Vote + !profil")

            # Cross-stream SQLite persistence survives reset_state()
            await bridge.reset_state()
            prof = bridge.viewer_store.get_profile("g2")
            assert prof is not None and prof["total_diamonds"] >= 100 and prof["level"] >= 1
            assert len(bridge.viewer_store.get_top_xp(5)) >= 1
            print("[PASS] 15-16: Cross-Stream SQLite WAL XP Persistence Survives reset_state()")
        finally:
            await bridge.shutdown()
    print("ALL_16_HALAY_PRO_TESTS_PASSED")


async def _rec(lst, val):
    lst.append(val)


def _like_cb(lst):
    async def _fn(u, cnt, st):
        lst.append(f"like_flush:{cnt}")
    return _fn


if __name__ == "__main__":
    asyncio.run(run_all_tests())
