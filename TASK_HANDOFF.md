# TASK_HANDOFF.md — Hamamböceği Halay Simülatörü (`v50`)

**Son Güncelleme:** 2026-11-13  
**Durum:** Tamamlandı & Canlı Doğrulandı (`http://127.0.0.1:9944`)

## Tamamlanan Bileşenler
- **`PROJECT_AUDIT.md`:** Aşama 1 keşif raporu, 15 teknik soru cevabı ve A–E özellik sınıflandırması.
- **`event_engine.py`:** `EventPriority` (8 seviye), `BoundedTTLCache` (`msg_id` tekilleştirme), 350ms beğeni birleştirme (`submit_like`) ve canlı metrikler.
- **`viewer_store.py`:** `data/halay_viewers.db` (`SQLite WAL`) ile yayınlar arası kalıcı XP, seviye, toplam elmas/beğeni/yorum ve Gelin/Damat tur geçmişi (`reset_state()` sıfırlamaz).
- **`event_scheduler.py`:** Çakışma önleyici `asyncio.Lock` mutex'li zamanlanmış etkinlikler (`disco_mode`, `giant_roach`, `meteor_rain`, `halay_war`) ve tek-oy garantili `!oy A/B/C` izleyici anketi.
- **`tiktok_bridge.py`:** `PriorityEventEngine`, `ViewerStore`, `EventScheduler` ve `self._state_lock` entegrasyonu; TikFinity `repeatEnd` combo hatası düzeltmesi; `!profil` komutu; `kick_dancer` & `promote_halaybasi` admin metotları.
- **`server.py` & `static/ai_panel.html`:** `/api/system/metrics`, `/api/gifts/rules`, `/api/dancers/action`, `/api/events/trigger`, `/api/viewers/top` uç noktaları, `HALAY_ADMIN_TOKEN` / tünel `403` koruması ve tam kontrol paneli.
- **`local_sdk.js` (`v=50`) & `index_local.html`:** `scheduled_event`, `audience_poll` Stealth HUD bildirimleri ve `floorHoriz` kamera güncelleme hatasının giderilmesi.
- **Doğrulama:** `tests/test_halay_pro_suite.py` (`ALL_16_HALAY_PRO_TESTS_PASSED`), canlı `:9944` Playwright konsol kontrolü (`0 Errors, 0 Warnings`), `MIROFISH_AUDIT.md` (`96/100` jüri konsensüsü).
