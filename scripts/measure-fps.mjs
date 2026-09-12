/**
 * Measure CreateJS ticker FPS on title, attract, and in-stage play.
 * Usage: node scripts/measure-fps.mjs [url] [--seconds=5] [--label=run]
 */
import puppeteer from "puppeteer";

const url = process.argv.find((a) => a.startsWith("http")) || "http://127.0.0.1:4398/";
const seconds = Number((process.argv.find((a) => a.startsWith("--seconds=")) || "--seconds=5").slice(10)) || 5;
const label = (process.argv.find((a) => a.startsWith("--label=")) || "--label=run").slice(8);

async function waitReady(page, timeoutMs = 90000) {
  await page.waitForFunction(
    () => window.stage && document.getElementById("canvas")?.width > 100 && window.__bloxDebug,
    { timeout: timeoutMs },
  );
  await new Promise((r) => setTimeout(r, 1500));
}

async function sample(page, sampleMs) {
  return page.evaluate(async (ms) => {
    const ticker = window.createjs.Ticker;
    const dts = [];
    let last = performance.now();
    let n = 0;
    const onTick = () => {
      const now = performance.now();
      if (n++) dts.push(now - last);
      last = now;
    };
    ticker.addEventListener("tick", onTick);
    await new Promise((r) => setTimeout(r, ms));
    ticker.removeEventListener("tick", onTick);
    const sample = dts.slice(4);
    const avg = sample.reduce((a, b) => a + b, 0) / Math.max(1, sample.length);
    const sorted = [...sample].sort((a, b) => a - b);
    const p95 = sorted[Math.floor(sorted.length * 0.95)] || 0;
    const long33 = sample.filter((d) => d > 33.5).length;
    const long50 = sample.filter((d) => d > 50).length;
    let atlas = null;
    try {
      const ss = window.AdobeAn.getComposition("FE31B685947E79408F0C8768D6EC8517").getSpriteSheet().bloxorz_atlas_;
      const img = ss._images[0];
      atlas = {
        kind: img instanceof HTMLCanvasElement ? "canvas" : img instanceof HTMLImageElement ? "image" : typeof img,
        w: img.naturalWidth || img.width || 0,
        h: img.naturalHeight || img.height || 0,
      };
    } catch {
      /* ignore */
    }
    return {
      exportLabel: window.exportRoot?.currentLabel ?? null,
      hasWorld: !!window.stage?.bloxWorld,
      tiles: window.stage?.bloxWorld?.tiles?.length ?? 0,
      attracting: !!window.__bloxDebug?.attracting?.(),
      fps: Math.round((1000 / avg) * 10) / 10,
      avgDt: Math.round(avg * 100) / 100,
      p95Dt: Math.round(p95 * 100) / 100,
      maxDt: Math.round(Math.max(0, ...sample) * 100) / 100,
      long33,
      long50,
      longPct: sample.length ? Math.round((long33 / sample.length) * 1000) / 10 : 0,
      samples: sample.length,
      tickerFps: ticker.framerate || ticker.getFPS?.(),
      timingMode: ticker.timingMode,
      atlas,
      canvas: { w: canvas.width, h: canvas.height },
    };
  }, sampleMs);
}

async function main() {
  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH || "/usr/local/bin/google-chrome",
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--window-size=1920,1080"],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
  await page.evaluateOnNewDocument(() => {
    try {
      localStorage.clear();
      sessionStorage.clear();
      localStorage.setItem("bloxorz-player-name", "FPSBOT");
    } catch {
      /* ignore */
    }
  });
  await page.goto(url, { waitUntil: "networkidle0", timeout: 120000 });
  await waitReady(page);

  const sampleMs = Math.max(3000, seconds * 1000);
  const results = {};

  results.title = { scene: "title", ...(await sample(page, sampleMs)) };

  await page.evaluate(() => window.__bloxDebug.startAttract());
  // Fade + generateAttract can take a beat
  await new Promise((r) => setTimeout(r, 2500));
  for (let i = 0; i < 20; i++) {
    const ready = await page.evaluate(
      () => !!(window.__bloxDebug?.attracting?.() && window.stage?.bloxWorld && window.exportRoot?.currentLabel === "game"),
    );
    if (ready) break;
    await new Promise((r) => setTimeout(r, 250));
  }
  results.attract = { scene: "attract", ...(await sample(page, sampleMs)) };

  await page.evaluate(() => window.__bloxDebug.endAttract());
  await new Promise((r) => setTimeout(r, 1000));
  await page.evaluate(() => window.__bloxDebug.startCampaign());
  await new Promise((r) => setTimeout(r, 800));
  for (let i = 0; i < 30; i++) {
    await page.evaluate(() => {
      const lab = window.exportRoot?.currentLabel;
      if (lab === "instructions") {
        try {
          window.exportRoot.inst?.gotoAndPlay?.("skip");
        } catch {
          /* ignore */
        }
        try {
          window.exportRoot.gotoAndPlay?.("stagetitle");
        } catch {
          /* ignore */
        }
      } else if (lab === "stagetitle") {
        try {
          window.exportRoot.gotoAndPlay?.("game");
        } catch {
          /* ignore */
        }
      }
    });
    const ready = await page.evaluate(
      () => !!(window.stage?.bloxWorld && window.exportRoot?.currentLabel === "game"),
    );
    if (ready) break;
    await new Promise((r) => setTimeout(r, 200));
  }
  // Nudge a few rolls so floor/block paths are warm
  await page.evaluate(async () => {
    for (const code of ["ArrowRight", "ArrowDown", "ArrowLeft"]) {
      window.stage?.triggerKeyDown?.({ code });
      await new Promise((r) => setTimeout(r, 280));
      window.stage?.triggerKeyUp?.({ code });
    }
  });
  results.play = { scene: "play", ...(await sample(page, sampleMs)) };

  const out = { label, url, seconds, results };
  console.log(JSON.stringify(out, null, 2));
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
