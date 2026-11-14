import asyncio
import io
import sys

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")


async def main() -> None:
    from playwright.async_api import async_playwright

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(
            headless=True,
            args=["--enable-webgl", "--ignore-gpu-blocklist", "--mute-audio", "--no-sandbox"],
        )
        page = await browser.new_page(viewport={"width": 540, "height": 960})
        await page.goto("http://127.0.0.1:9944/", wait_until="domcontentloaded", timeout=20000)
        await page.wait_for_selector("#halay-cinema-hud", timeout=15000)
        await page.wait_for_function("() => Boolean(window.halay?.engine?.renderer && window.__halayGfx?.internalRes)", timeout=20000)

        info = await page.evaluate(
            """() => ({
                sdk: document.getElementById('tikoyun-sdk')?.getAttribute('src') || '',
                activePR: window.__halayGfx?.activePR || null,
                internalRes: window.__halayGfx?.internalRes || '',
                prSet: window.halay?.engine?.renderer?.getPixelRatio?.() || null,
                isSoft: window.__halayGfx?.isSoftwareGl || false
            })"""
        )
        await browser.close()
        assert "v=46" in info["sdk"], f"Expected v=46, got {info}"
        assert info["activePR"] and info["activePR"] >= 1.5, f"Expected crisp activePR >= 1.5, got {info}"
        print(f"V46_GFX_PASS: {info}")


if __name__ == "__main__":
    asyncio.run(main())
