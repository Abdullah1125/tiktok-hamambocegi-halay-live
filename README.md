# Hamamböceği Halay Simulator — TikTok Live (Portable Edition)

Başka bir bilgisayarda tek tıkla kurup `@cs2premiergunlukleri` hesabından canlı yayın açmak için hazırlanmış taşınabilir paket.

## Başka Bilgisayarda Kurulum (Windows + Python 3.12)

1. Repoyu klonla:
   ```bash
   git clone https://github.com/mephisto-mert/tiktok-hamambocegi-halay-live.git
   cd tiktok-hamambocegi-halay-live
   ```
2. İlk kurulum ve başlatma için **`Setup_Ve_Baslat.bat`** dosyasına çift tıkla (otomatik `.venv` kurar, `requirements.txt` paketlerini yükler ve `http://127.0.0.1:9944/?obs=1` adresini açar).
3. Sonraki çalıştırmalarda doğrudan **`Baslat_TikTok_Halay.bat`** dosyasını kullanabilirsin.

## OBS / TikTok LIVE Studio Ayarı

- **Tarayıcı Kaynağı (Browser Source) URL:** `http://127.0.0.1:9944/?obs=1`
- **Çözünürlük:** `1080 x 1920` (9:16 Dikey)
- **Kontrol Paneli:** `http://127.0.0.1:9944/ai_panel.html`
- **Varsayılan TikTok Hesabı (`config.json`):** `cs2premiergunlukleri`

## Notlar

- `static/audio/halay_cache/` müzik dosyaları repo boyutunu küçük tutmak için dahil edilmemiştir; `jukebox_service.py` yayındayken `data/halay_100_catalog.json` listesindeki parçaları otomatik indirir. İstersen tüm 100 parçayı önceden indirmek için `python scripts/harvest_100_halay.py` çalıştırabilirsin.
- `config.json` içindeki `tiktok_session_id` güvenlik nedeniyle boş bırakılmıştır.
