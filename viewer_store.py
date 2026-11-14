"""Persistent SQLite WAL Viewer XP, Levels, Profiles & Match History Store."""
from __future__ import annotations

import json
import os
import sqlite3
import threading
import time
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple

LEVEL_TITLES: List[Tuple[int, str]] = [
    (30, "Halay Kralı"),
    (20, "Halay Efsanesi"),
    (10, "Dans Ustası"),
    (5, "Halaycı"),
    (1, "Yeni Hamamböceği"),
]


def calc_level(xp: int) -> Tuple[int, str]:
    safe_xp = max(0, int(xp))
    lvl = max(1, int((safe_xp / 25.0) ** 0.5) + 1)
    title = "Yeni Hamamböceği"
    for min_lvl, label in LEVEL_TITLES:
        if lvl >= min_lvl:
            title = label
            break
    return lvl, title


class ViewerStore:
    """Thread-safe / WAL-mode SQLite persistence across live streams."""

    def __init__(self, db_path: str) -> None:
        self.db_path = db_path
        self._lock = threading.RLock()
        os.makedirs(os.path.dirname(db_path), exist_ok=True)
        self.conn = sqlite3.connect(db_path, timeout=5.0, check_same_thread=False)
        self.conn.row_factory = sqlite3.Row
        self._init_schema()

    def _init_schema(self) -> None:
        with self._lock:
            self.conn.execute("PRAGMA journal_mode=WAL;")
            self.conn.execute("PRAGMA synchronous=NORMAL;")
            self.conn.execute("PRAGMA busy_timeout=5000;")
            with self.conn:
                self.conn.execute(
                    """
                    CREATE TABLE IF NOT EXISTS viewers (
                        uid TEXT PRIMARY KEY,
                        nickname TEXT NOT NULL,
                        xp INTEGER NOT NULL DEFAULT 0,
                        level INTEGER NOT NULL DEFAULT 1,
                        title TEXT NOT NULL DEFAULT 'Yeni Hamamböceği',
                        total_likes INTEGER NOT NULL DEFAULT 0,
                        total_chats INTEGER NOT NULL DEFAULT 0,
                        total_diamonds INTEGER NOT NULL DEFAULT 0,
                        join_count INTEGER NOT NULL DEFAULT 0,
                        titles_json TEXT NOT NULL DEFAULT '[]',
                        streak_days INTEGER NOT NULL DEFAULT 1,
                        last_streak_day TEXT NOT NULL DEFAULT '',
                        round_wins INTEGER NOT NULL DEFAULT 0,
                        last_seen_at REAL NOT NULL DEFAULT 0,
                        created_at REAL NOT NULL DEFAULT 0
                    );
                    """
                )
                existing_cols = {
                    r[1] for r in self.conn.execute("PRAGMA table_info(viewers);").fetchall()
                }
                if "streak_days" not in existing_cols:
                    self.conn.execute("ALTER TABLE viewers ADD COLUMN streak_days INTEGER NOT NULL DEFAULT 1;")
                if "last_streak_day" not in existing_cols:
                    self.conn.execute("ALTER TABLE viewers ADD COLUMN last_streak_day TEXT NOT NULL DEFAULT '';")
                if "round_wins" not in existing_cols:
                    self.conn.execute("ALTER TABLE viewers ADD COLUMN round_wins INTEGER NOT NULL DEFAULT 0;")
                self.conn.execute("CREATE INDEX IF NOT EXISTS idx_viewers_xp ON viewers(xp DESC);")
                self.conn.execute("CREATE INDEX IF NOT EXISTS idx_viewers_diamonds ON viewers(total_diamonds DESC);")
                self.conn.execute(
                    """
                    CREATE TABLE IF NOT EXISTS team_history (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        round_number INTEGER NOT NULL,
                        winner_team TEXT NOT NULL,
                        gelin_score INTEGER NOT NULL DEFAULT 0,
                        damat_score INTEGER NOT NULL DEFAULT 0,
                        finished_at REAL NOT NULL
                    );
                    """
                )
                self.conn.execute("CREATE INDEX IF NOT EXISTS idx_team_history_round ON team_history(round_number DESC);")

    def record_activity(
        self,
        uid: str,
        nickname: str,
        xp_delta: int = 0,
        likes_delta: int = 0,
        chats_delta: int = 0,
        diamonds_delta: int = 0,
        joined: bool = False,
        badge: Optional[str] = None,
    ) -> Dict[str, Any]:
        clean_uid = str(uid or "").strip()
        if not clean_uid:
            return {}
        clean_nick = str(nickname or "İzleyici")[:32]
        now = time.time()
        dxp = max(0, int(xp_delta))
        dlikes = max(0, int(likes_delta))
        dchats = max(0, int(chats_delta))
        ddia = max(0, int(diamonds_delta))
        djoin = 1 if joined else 0
        init_lvl, init_title = calc_level(dxp)
        init_titles_json = json.dumps([badge] if badge else [], ensure_ascii=False)

        with self._lock:
            with self.conn:
                self.conn.execute(
                    """
                    INSERT INTO viewers (
                        uid, nickname, xp, level, title, total_likes, total_chats,
                        total_diamonds, join_count, titles_json, last_seen_at, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(uid) DO UPDATE SET
                        nickname = excluded.nickname,
                        xp = viewers.xp + excluded.xp,
                        total_likes = viewers.total_likes + excluded.total_likes,
                        total_chats = viewers.total_chats + excluded.total_chats,
                        total_diamonds = viewers.total_diamonds + excluded.total_diamonds,
                        join_count = viewers.join_count + excluded.join_count,
                        last_seen_at = excluded.last_seen_at
                    """,
                    (
                        clean_uid, clean_nick, dxp, init_lvl, init_title,
                        dlikes, dchats, ddia, djoin, init_titles_json, now, now,
                    ),
                )
                row = self.conn.execute(
                    "SELECT xp, level, title, join_count, titles_json, streak_days, last_streak_day, round_wins "
                    "FROM viewers WHERE uid = ?",
                    (clean_uid,),
                ).fetchone()
                cur_xp = int(row["xp"]) if row else dxp
                lvl, title = calc_level(cur_xp)
                try:
                    titles = json.loads((row["titles_json"] if row else None) or "[]")
                except Exception:
                    titles = []
                today_str = datetime.now().strftime("%Y-%m-%d")
                yesterday_str = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")
                cur_streak = int(row["streak_days"]) if row else 1
                last_day = str(row["last_streak_day"] or "") if row else ""
                streak_changed = False
                if last_day != today_str:
                    cur_streak = (cur_streak + 1) if last_day == yesterday_str else 1
                    last_day = today_str
                    streak_changed = True
                need_meta_upd = (row is None) or (lvl != int(row["level"])) or (title != row["title"]) or streak_changed
                if badge and badge not in titles:
                    titles.append(badge)
                    need_meta_upd = True
                if need_meta_upd:
                    self.conn.execute(
                        "UPDATE viewers SET level = ?, title = ?, titles_json = ?, streak_days = ?, last_streak_day = ? WHERE uid = ?",
                        (lvl, title, json.dumps(titles[-10:], ensure_ascii=False), cur_streak, last_day, clean_uid),
                    )
            return {
                "uid": clean_uid,
                "nickname": clean_nick,
                "xp": cur_xp,
                "level": lvl,
                "title": title,
                "join_count": int(row["join_count"]) if row else djoin,
                "titles": titles[-10:],
                "streak_days": cur_streak,
                "round_wins": int(row["round_wins"]) if row else 0,
            }

    def record_round_win(self, uid: str) -> None:
        clean_uid = str(uid or "").strip()
        if not clean_uid:
            return
        with self._lock:
            with self.conn:
                self.conn.execute(
                    "UPDATE viewers SET round_wins = round_wins + 1 WHERE uid = ?",
                    (clean_uid,),
                )

    def get_profile(self, uid: str) -> Optional[Dict[str, Any]]:
        with self._lock:
            row = self.conn.execute("SELECT * FROM viewers WHERE uid = ?", (str(uid),)).fetchone()
            return dict(row) if row else None

    def get_top_xp(self, limit: int = 12) -> List[Dict[str, Any]]:
        with self._lock:
            rows = self.conn.execute(
                "SELECT uid, nickname, xp, level, title, total_likes, total_chats, total_diamonds, join_count, streak_days, round_wins "
                "FROM viewers ORDER BY xp DESC LIMIT ?",
                (max(1, min(50, int(limit))),),
            ).fetchall()
            return [dict(r) for r in rows]

    def record_round_history(self, round_number: int, winner_team: str, gelin_score: int, damat_score: int) -> None:
        with self._lock:
            with self.conn:
                self.conn.execute(
                    "INSERT INTO team_history (round_number, winner_team, gelin_score, damat_score, finished_at) "
                    "VALUES (?, ?, ?, ?, ?)",
                    (int(round_number), str(winner_team), int(gelin_score), int(damat_score), time.time()),
                )

    def get_team_history(self, limit: int = 10) -> List[Dict[str, Any]]:
        with self._lock:
            rows = self.conn.execute(
                "SELECT round_number, winner_team, gelin_score, damat_score, finished_at "
                "FROM team_history ORDER BY id DESC LIMIT ?",
                (max(1, min(50, int(limit))),),
            ).fetchall()
            return [dict(r) for r in rows]

    def total_viewers(self) -> int:
        with self._lock:
            row = self.conn.execute("SELECT COUNT(*) AS c FROM viewers").fetchone()
            return int(row["c"]) if row else 0

    def close(self) -> None:
        with self._lock:
            try:
                self.conn.execute("PRAGMA wal_checkpoint(TRUNCATE);")
            except Exception:
                pass
            try:
                self.conn.close()
            except Exception:
                pass
