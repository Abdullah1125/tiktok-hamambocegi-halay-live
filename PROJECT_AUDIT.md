# PROJECT_AUDIT.md — Hamamböceği Halay Simulator (`TikTok_Halay_Live` + `halay_web`)

**Tarih:** 2026-11-13  
**Kapsam:** `c:\Users\pc\Documents\projelerim\TikTok_Halay_Live\` ve `c:\Users\pc\Documents\projelerim\Tikoyun_Unpacked\halay_web\`

---

## 1. Keşif Özeti ve 15 Kritik Sorunun Cevapları

1. **Hamamböceği oyunu tam olarak nasıl çalışıyor?**  
   Three.js tabanlı 3D sahne (`Tikoyun_Unpacked/halay_web/bundle/index-DxI1Ji3R.js`) `window.halay` global nesnesini dışa açar (`engine`, `scene`, `line`, `roles`, `director`, `tags`, `bubbles`, `fireworks`, `para`, `couple`, `skinSync`, `davul`). `local_sdk.js` (`v=49`) bu nesneye bağlanarak WebSocket (`ws://127.0.0.1:9944/ws`) üzerinden gelen olayları 3D sahneye ve 9:16 Stealth Cinema HUD'a aktarır.
2. **Oyun hangi teknolojiyle geliştirilmiş?**  
   Ön yüz Three.js + WebGL2 + Vanilla JS (`bundle/index-DxI1Ji3R.js` + `local_sdk.js`); arka uç Python 3.12 + FastAPI + Uvicorn + `TikTokLive` v7.0.1 + `curl_cffi` + `edge_tts` + `yt_dlp`.
3. **Oyuna dışarıdan müdahale etmek için hangi güvenilir yöntemler mevcut?**  
   Korumalı bundle kodunu değiştirmeden `window.halay` runtime API'si (`roles.run`, `line.addDancer`, `line.removeDancer`, `line.swapGender`, `director.update`, `fireworks.show`, `para`, `engine.scene`) ve `:9944/ws` WebSocket protokolü üzerinden tam kontrol sağlanmaktadır.
4. **TikFinity olayları sisteme nasıl iletiyor?**  
   `tiktok_bridge.py:2107-2147` içinde isteğe bağlı yedek köprü olarak `ws://localhost:21213/` üzerinden `websockets` ile `like`, `chat`, `gift`, `follow` JSON mesajları dinlenir (`connect_tikfinity` WS komutuyla tetiklenir). Varsayılan birincil kaynak `TikTokLive` Python istemcisidir.
5. **Hediyeler nasıl algılanıyor?**  
   `TikTokLive` `GiftEvent` (`on_gift`, `tiktok_bridge.py:1213-1235`) ve TikFinity `gift` JSON'ı üzerinden `gift_id`, `gift_name`, `diamond_count` ve `repeat_count` okunur.
6. **Aynı hediye birden fazla kez işlenebilir mi?**  
   **Evet (Risk):** `TikTokLive` tarafında `msg_id` / idempotency önbelleği yoktur. TikFinity yedek köprüsünde (`_tikfinity_loop`) ise `repeatEnd` kontrolü hiç olmadığı için her seri tikinde hediye baştan işlenip elmas sayısını katlamaktadır (P0 hata).
7. **Hediye serileri nasıl yönetiliyor?**  
   `TikTokLive` `on_gift` içinde `if ev.streaking: return` filtresi ile seri bitimi beklenir; ancak `repeat_end` veya `msg_id` tabanlı tekilleştirme yoktur.
8. **Takip ve yorum olayları güvenilir şekilde algılanıyor mu?**  
   Evet, `CommentEvent` ve `FollowEvent` doğrudan işlenir, NFKC + küfür/URL/tofu sanitizasyonundan geçirilir.
9. **Oyunda karakter sayısı sınırı var mı?**  
   Evet: Backend `max_halay_seats = 24` ve bekleyen kuyruğu (`waiting_queue`) yönetir; frontend `maxDancers` yapılandırması `20..56` arasındadır.
10. **Çok sayıda izleyici etkileşime girdiğinde performans düşüyor mu?**  
    Önceki `v44–v47` sürümlerinde `2.5x` PixelRatio + `origDirUpdate` kamera çakışması + tüm misafirlere zorlanan `lodDetail` nedeniyle iGPU'da (`AMD Radeon`) takılma vardı; `v49` ile `zeroMoves: 0`, `bigJumps: 0`, `p50: 13.8ms` seviyesine çekildi. Ancak backend event yoğunluğunda `like` birleştirme ve merkezi öncelik kuyruğu eksiktir.
11. **Bir bağlantı koparsa sistem kendini toparlayabiliyor mu?**  
    Kısmen: `TikTokLive` için `_live_supervisor_loop` + proxy rotasyonu mevcut, ancak TikFinity köprüsünde otomatik yeniden bağlanma döngüsü yoktur. `logs/active_room_state.json` aynı yayın içi çökme kurtarması sağlar.
12. **Etkinlikler aynı anda tetiklendiğinde birbirleriyle çakışıyor mu?**  
    Evet, merkezi bir etkinlik zamanlayıcısı ve kilitli etkinlik mutex'i olmadığı için `disco`, `giant`, `shockwave` manuel/hediye tetiklemeleri üst üste binebilir.
13. **Yayın arayüzü ve oyun görüntüsü birbirinden bağımsız yönetilebiliyor mu?**  
    Evet, `?obs=1` ile kontrol butonları gizlenir, 9:16 SafeZone katmanları `#app` üzerinde bağımsız konumlanır.
14. **Sistemde kalıcı izleyici bilgileri tutuluyor mu?**  
    **Hayır:** Yeni yayın başladığında (`new_rid != _active_state_room_id`) `reset_state()` tüm skor, beğeni ve izleyici geçmişini sıfırlar. SQLite kalıcı izleyici profili/XP veritabanı yoktur (P0/P1 eksik).
15. **Mevcut özelliklerin hangileri gerçekten kullanılıyor?**  
    `TikTokLive` akışı, 9:16 Stealth Cinema HUD, 8 dil desteği, Halay Jukebox, 81 il/ülke/gelin-damat savaşları, Sabotaj FX, Final 3X ve Şölen Barı aktif; `static/js/*` altındaki eski 2D prototip dosyaları kullanılmıyor (`halay_web` aktif).

---

## 2. Mevcut Özellik Sınıflandırması (A–E)

| Bileşen | Sınıf | Durum ve Karar |
| :--- | :---: | :--- |
| Three.js Halay Sahnesi & IK (`halay_web` + `local_sdk.js v49`) | **A** | Korunmalı; kamera ve 60FPS optimizasyonu tamamlandı. |
| 9:16 Stealth Anti-Ban HUD & 8 Dil Desteği | **A** | Korunmalı; coin/hediye dilenciliği temizliği tam. |
| Halay Jukebox (100 parça + anti-fingerprint pitch) | **A** | Korunmalı; TTS ducking ile uyumlu. |
| Multilingual AI Host & Edge-TTS | **A** | Korunmalı; `auto_chat_enabled=False` güvenli modda. |
| TikTokLive Supervisor & Proxy Rotasyonu | **A-** | Korunmalı; `msg_id` dedup ve event queue ile güçlendirilmeli. |
| Oyun Ekonomisi (`Final 3X`, `Sabotage FX`, `Şölen Barı`, `Ülke Savaşı`) | **B+** | Korunmalı; `asyncio.Lock` ile yarış durumları giderilmeli. |
| Bekleme Kuyruğu & 24 Koltuk Kapasitesi | **B** | İyileştirilmeli (`queue_join` lock + panelden görsel yönetim). |
| TikFinity Yedek Köprüsü (`_tikfinity_loop`) | **C-** | `repeatEnd` düzeltmesi ve auto-reconnect eklenmeli. |
| Yönetim Paneli (`static/ai_panel.html`) | **C** | Canlı dansçı/kuyruk yönetimi, hediye editörü, oylama ve etkinlik zamanlayıcı ile yükseltilmeli. |
| Merkezi Öncelikli Event Queue & Dedup Motoru | **D** | `event_engine.py` olarak geliştirilmeli. |
| Kalıcı SQLite İzleyici XP / Seviye / Profil Sistemi | **D** | `viewer_store.py` olarak geliştirilmeli. |
| Etkinlik Zamanlayıcı & İzleyici Oylaması (`!oy A/B/C`) | **D** | `event_scheduler.py` olarak geliştirilmeli. |
| Yönetim Paneli Token/Yetki Koruması | **D** | Tunnel/harici erişime karşı korumalı, localhost uyumlu auth eklenmeli. |
| Eski `index_local.html` `#hud` kalıntısı | **E** | Kaldırılabilir/gizli tutulabilir (regresyon riski yoksa temizlenir). |
