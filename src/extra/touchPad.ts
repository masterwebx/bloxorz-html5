import { loadSettings } from "./settings";

export type TouchDir = "up" | "down" | "left" | "right";

export type TouchPadHandlers = {
  down: (code: string) => void;
  up: (code: string) => void;
  pause: () => void;
  rotate: () => void;
};

const DIR_CODE: Record<TouchDir, string> = {
  up: "ArrowUp",
  down: "ArrowDown",
  left: "ArrowLeft",
  right: "ArrowRight",
};

const INSTALL_KEY = "bloxorz-install-hint";

export function isCoarsePointer(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (window.matchMedia?.("(pointer: coarse)").matches) return true;
  } catch {
    /* ignore */
  }
  return "ontouchstart" in window || (navigator.maxTouchPoints ?? 0) > 0;
}

export function isPhoneViewport(): boolean {
  if (typeof window === "undefined") return false;
  return Math.min(window.innerWidth, window.innerHeight) < 720;
}

export function isPortrait(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.matchMedia("(orientation: portrait)").matches;
  } catch {
    return window.innerHeight >= window.innerWidth;
  }
}

export function looksLikeMobile(ua = typeof navigator !== "undefined" ? navigator.userAgent : ""): boolean {
  if (isCoarsePointer() || isPhoneViewport()) return true;
  return /Mobi|Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua);
}

/** Larger HUD hits when the on-screen pad is on, or the window is phone-sized. */
export function wantsVirtualPad(): boolean {
  try {
    if (loadSettings().mobilePad) return true;
  } catch {
    /* ignore */
  }
  return isPhoneViewport();
}

export function showVirtualPad(enabled: boolean, playing: boolean): boolean {
  return enabled && playing;
}

type Held = { code: string; el: HTMLElement };

export class TouchChrome {
  private pad: HTMLElement | null = null;
  private install: HTMLElement | null = null;
  private landscape: HTMLElement | null = null;
  private held = new Map<number, Held>();
  private deferred: { prompt: () => Promise<void> } | null = null;
  private playing = false;
  private handlers: TouchPadHandlers = {
    down: () => undefined,
    up: () => undefined,
    pause: () => undefined,
    rotate: () => undefined,
  };

  mount(handlers: TouchPadHandlers): void {
    this.handlers = handlers;
    this.pad = document.getElementById("touch-pad");
    this.install = document.getElementById("install-hint");
    this.landscape = document.getElementById("landscape-hint");
    this.bindPad();
    this.bindInstall();
    window.addEventListener("beforeinstallprompt", (ev) => {
      ev.preventDefault();
      this.deferred = ev as unknown as { prompt: () => Promise<void> };
      this.sync();
    });
    window.addEventListener("resize", () => this.sync());
    window.addEventListener("orientationchange", () => this.sync());
  }

  sync(playing?: boolean): void {
    if (typeof playing === "boolean") this.playing = playing;
    const enabled = loadSettings().mobilePad;
    const phone = isPhoneViewport();
    const portrait = isPortrait();
    const device = isCoarsePointer() || looksLikeMobile();
    document.body.classList.toggle("is-mobile", phone || enabled);
    document.body.classList.toggle("is-portrait", portrait);
    document.body.classList.toggle("is-playing", this.playing);
    document.body.classList.toggle("is-pad-on", enabled);
    const rotate = enabled && loadSettings().rotateScreen;
    const wasRotated = document.body.classList.contains("is-rotated");
    document.body.classList.toggle("is-rotated", rotate);
    if (wasRotated !== rotate) window.dispatchEvent(new Event("resize"));
    if (this.pad) this.pad.hidden = !showVirtualPad(enabled, this.playing);
    if (this.landscape) this.landscape.hidden = true;
    if (this.install) {
      this.install.hidden = !device || enabled || this.installDismissed() || this.playing;
    }
  }

  private installDismissed(): boolean {
    try {
      return localStorage.getItem(INSTALL_KEY) === "1";
    } catch {
      return false;
    }
  }

  private bindInstall(): void {
    document.getElementById("install-now")?.addEventListener("click", () => {
      if (this.deferred) {
        void this.deferred.prompt();
        this.deferred = null;
        return;
      }
      const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
      const hint = document.getElementById("install-how");
      if (hint) {
        hint.hidden = false;
        hint.textContent = ios
          ? "Share → Add to Home Screen. Portrait keeps the stage on top and the pad underneath."
          : "Use the browser menu → Install app / Add to Home Screen.";
      }
    });
    document.getElementById("install-dismiss")?.addEventListener("click", () => {
      try {
        localStorage.setItem(INSTALL_KEY, "1");
      } catch {
        /* ignore */
      }
      if (this.install) this.install.hidden = true;
    });
  }

  private bindPad(): void {
    if (!this.pad) return;
    this.pad.addEventListener("contextmenu", (ev) => ev.preventDefault());
    this.pad.querySelectorAll<HTMLElement>("[data-dir], [data-act]").forEach((el) => {
      el.addEventListener("pointerdown", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        el.setPointerCapture?.(ev.pointerId);
        const act = el.dataset.act;
        if (act === "pause") {
          this.handlers.pause();
          return;
        }
        if (act === "rotate") {
          this.handlers.rotate();
          return;
        }
        const code = this.codeFor(el);
        if (!code) return;
        this.held.set(ev.pointerId, { code, el });
        el.classList.add("is-down");
        this.handlers.down(code);
      });
      el.addEventListener("pointerup", (ev) => this.release(ev.pointerId));
      el.addEventListener("pointercancel", (ev) => this.release(ev.pointerId));
      el.addEventListener("pointerleave", (ev) => {
        if (ev.buttons === 0) this.release(ev.pointerId);
      });
    });
  }

  private codeFor(el: HTMLElement): string {
    const dir = el.dataset.dir as TouchDir | undefined;
    if (dir && DIR_CODE[dir]) return DIR_CODE[dir];
    if (el.dataset.act === "swap") return "Space";
    return "";
  }

  private release(id: number): void {
    const held = this.held.get(id);
    if (!held) return;
    this.held.delete(id);
    held.el.classList.remove("is-down");
    this.handlers.up(held.code);
  }
}

export function registerServiceWorker(): void {
  if (!("serviceWorker" in navigator)) return;
  const secure = window.location.protocol === "https:" || window.location.hostname === "localhost";
  if (!secure) return;
  void navigator.serviceWorker.register(new URL("sw.js", window.location.href).href).catch(() => undefined);
}
