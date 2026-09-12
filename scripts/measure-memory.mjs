/**
 * Cold-load memory probe for Bloxorz+ (title/idle, Original, no customize/cast).
 * Reports Chrome JS heap + CDP Performance.getMetrics + optional process RSS.
 *
 * Usage: node scripts/measure-memory.mjs [url] [--label=before|after]
 */
import puppeteer from "puppeteer";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const url = process.argv.find((a) => a.startsWith("http")) || "http://127.0.0.1:4398/";
const label = (process.argv.find((a) => a.startsWith("--label=")) || "--label=run").slice(8);

function mb(bytes) {
  return Math.round((bytes / (1024 * 1024)) * 10) / 10;
}

async function waitForIdleTitle(page, timeoutMs = 90000) {
  await page.waitForFunction(
    () => {
      const stage = window.stage;
      const root = window.exportRoot;
      if (!stage || !root) return false;
      // Title / menu-ish: canvas painted and createjs ticker running
      const canvas = document.getElementById("canvas");
      if (!canvas || canvas.width < 100) return false;
      // Extra boot finished: settings applied, no forced customize
      return typeof window.__bloxLoadThemeAtlas === "function";
    },
    { timeout: timeoutMs },
  );
  // Settle: allow atlas compose + deferred audio start to finish
  await new Promise((r) => setTimeout(r, 4000));
  // Force GC if available
  try {
    await page.evaluate(() => {
      if (typeof gc === "function") gc();
    });
  } catch {
    /* ignore */
  }
  await new Promise((r) => setTimeout(r, 1000));
}

async function collect(page, client, browserProcess) {
  const metrics = await client.send("Performance.getMetrics");
  const byName = Object.fromEntries(metrics.metrics.map((m) => [m.name, m.value]));
  const heap = await page.evaluate(() => {
    const m = performance.memory;
    return m
      ? {
          usedJSHeapSize: m.usedJSHeapSize,
          totalJSHeapSize: m.totalJSHeapSize,
          jsHeapSizeLimit: m.jsHeapSizeLimit,
        }
      : null;
  });
  const probe = await page.evaluate(() => {
    const canvases = [...document.querySelectorAll("canvas")];
    let canvasPixels = 0;
    const sizes = canvases.map((c) => {
      canvasPixels += c.width * c.height;
      return { w: c.width, h: c.height, id: c.id || "" };
    });
    let settings = null;
    try {
      settings = JSON.parse(localStorage.getItem("blox-settings") || "null");
    } catch {
      /* ignore */
    }
    const theme = localStorage.getItem("theme");
    return {
      canvasCount: canvases.length,
      canvasPixels,
      canvasApproxRgbaMb: Math.round(((canvasPixels * 4) / (1024 * 1024)) * 10) / 10,
      bigCanvases: sizes.filter((s) => s.w * s.h >= 512 * 512),
      theme,
      colorCustom: settings?.colorCustom ?? null,
      webcamBg: settings?.webcamBg ?? null,
      tabCastBg: settings?.tabCastBg ?? null,
      readyState: document.readyState,
      title: document.title,
    };
  });

  let processRssMb = null;
  try {
    // Chromium may spawn zygote + renderer; sum Private Memory via CDP if available
    const { targets } = await client.send("Target.getTargets");
    void targets;
  } catch {
    /* ignore */
  }
  try {
    const pid = browserProcess?.pid;
    if (pid) {
      const fs = await import("fs");
      // Sum RSS of chrome process tree roughly via /proc
      const status = fs.readFileSync(`/proc/${pid}/status`, "utf8");
      const vmRss = status.match(/VmRSS:\s+(\d+)\s+kB/);
      if (vmRss) processRssMb = Math.round((Number(vmRss[1]) / 1024) * 10) / 10;
    }
  } catch {
    /* ignore */
  }

  // Renderer JS heap from Performance metrics (Chrome-style)
  const jsHeapUsed = byName.JSHeapUsedSize ?? heap?.usedJSHeapSize ?? null;
  const jsHeapTotal = byName.JSHeapTotalSize ?? heap?.totalJSHeapSize ?? null;

  return {
    label,
    url,
    cold: true,
    chromeMetricsMb: {
      JSHeapUsedSize: jsHeapUsed != null ? mb(jsHeapUsed) : null,
      JSHeapTotalSize: jsHeapTotal != null ? mb(jsHeapTotal) : null,
      Nodes: byName.Nodes ?? null,
      JSEventListeners: byName.JSEventListeners ?? null,
      LayoutCount: byName.LayoutCount ?? null,
    },
    performanceMemoryMb: heap
      ? {
          usedJSHeapSize: mb(heap.usedJSHeapSize),
          totalJSHeapSize: mb(heap.totalJSHeapSize),
          jsHeapSizeLimit: mb(heap.jsHeapSizeLimit),
        }
      : null,
    browserProcessRssMb: processRssMb,
    probe,
    /** Primary scoreboard: JS heap used + estimated live canvas RGBA (not double-count GPU). */
    estimatedTabMb:
      (jsHeapUsed != null ? mb(jsHeapUsed) : 0) + (probe.canvasApproxRgbaMb || 0),
  };
}

async function sumChromeTreeRssMb(rootPid) {
  const fs = await import("fs");
  const path = await import("path");
  function children(pid) {
    try {
      const dir = `/proc/${pid}/task/${pid}/children`;
      const raw = fs.readFileSync(dir, "utf8").trim();
      return raw ? raw.split(/\s+/).map(Number) : [];
    } catch {
      return [];
    }
  }
  function rssKb(pid) {
    try {
      const status = fs.readFileSync(`/proc/${pid}/status`, "utf8");
      const m = status.match(/VmRSS:\s+(\d+)\s+kB/);
      return m ? Number(m[1]) : 0;
    } catch {
      return 0;
    }
  }
  const seen = new Set();
  const stack = [rootPid];
  let total = 0;
  while (stack.length) {
    const pid = stack.pop();
    if (!pid || seen.has(pid)) continue;
    seen.add(pid);
    total += rssKb(pid);
    for (const c of children(pid)) stack.push(c);
  }
  return Math.round((total / 1024) * 10) / 10;
}

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH || "/usr/local/bin/google-chrome",
  headless: true,
  args: [
    "--no-sandbox",
    "--disable-dev-shm-usage",
    "--disable-gpu",
    "--js-flags=--expose-gc",
    // Isolate: fresh profile each run
    "--disable-extensions",
  ],
});

const page = await browser.newPage();
const client = await page.createCDPSession();
await client.send("Performance.enable");

// Cold: empty storage — Original theme, no customize, no cast
await page.goto("about:blank");
const client2 = await page.createCDPSession();
await client2.send("Network.clearBrowserCache").catch(() => {});
await page.evaluateOnNewDocument(() => {
  try {
    localStorage.clear();
    sessionStorage.clear();
  } catch {
    /* ignore */
  }
});

await page.goto(url, { waitUntil: "networkidle2", timeout: 120000 });
await waitForIdleTitle(page);

const result = await collect(page, client, browser.process());
try {
  result.chromeTreeRssMb = await sumChromeTreeRssMb(browser.process().pid);
} catch {
  result.chromeTreeRssMb = null;
}

// Also capture after a short warm settle (still title/idle, not playing)
await new Promise((r) => setTimeout(r, 2000));
try {
  await page.evaluate(() => {
    if (typeof gc === "function") gc();
  });
} catch {
  /* ignore */
}
const warm = await collect(page, client, browser.process());
result.afterSettleMb = {
  JSHeapUsedSize: warm.chromeMetricsMb.JSHeapUsedSize,
  estimatedTabMb: warm.estimatedTabMb,
  chromeTreeRssMb: await sumChromeTreeRssMb(browser.process().pid).catch(() => null),
};

console.log(JSON.stringify(result, null, 2));
await browser.close();
