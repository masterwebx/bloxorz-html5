(function () {
  var MODE_KEY = "bloxorz-play-mode";
  var NAME_KEY = "bloxorz-player-name";
  var VANILLA_BUTTONS = ["startNewGame", "resumeGame", "loadStage", "toggleSound", "credits"];
  var extraView = "auto";

  function isLegacy() {
    try {
      return window.localStorage.getItem(MODE_KEY) === "legacy";
    } catch (e) {
      return false;
    }
  }

  function setMode(mode) {
    try {
      window.localStorage.setItem(MODE_KEY, mode);
    } catch (e) {
      /* ignore */
    }
  }

  function getName() {
    try {
      return (window.localStorage.getItem(NAME_KEY) || "").trim();
    } catch (e) {
      return "";
    }
  }

  function setName(name) {
    try {
      window.localStorage.setItem(NAME_KEY, name.trim());
    } catch (e) {
      /* ignore */
    }
  }

  function brandName(name) {
    var stem = name.trim().toUpperCase().replace(/[^A-Z0-9]/g, "") || "BLOX";
    return stem + "ORZ";
  }

  function isDevName(name) {
    return name.trim().toUpperCase() === "DEV";
  }

  function reloadSamePage() {
    window.location.reload();
  }

  function findMenu() {
    return window.exportRoot && window.exportRoot.menu;
  }

  function onMainMenu() {
    var root = window.exportRoot;
    var menu = findMenu();
    if (!root || !menu) return false;
    if (root.currentLabel !== "menu") return false;
    return menu.currentFrame === 133;
  }

  function setVanillaButtonsVisible(visible) {
    var menu = findMenu();
    if (!menu) return;
    VANILLA_BUTTONS.forEach(function (name) {
      if (menu[name]) menu[name].visible = visible;
    });
  }

  function clickVanilla(name) {
    var menu = findMenu();
    if (!menu || !menu[name]) return;
    menu[name].visible = true;
    menu[name].dispatchEvent("click");
  }

  function $(id) {
    return document.getElementById(id);
  }

  function show(el, on) {
    if (!el) return;
    el.classList.toggle("is-open", !!on);
  }

  function soundOn() {
    return typeof createjs !== "undefined" && createjs.Sound && createjs.Sound.volume === 1;
  }

  function paintExtraMenu() {
    var name = getName();
    var title = $("extra-brand");
    if (title) title.textContent = brandName(name);
    var resume = $("extra-resume");
    var menu = findMenu();
    var canResume = !!(menu && menu.resumeGame && menu.resumeGame.mouseEnabled);
    if (resume) resume.disabled = !canResume;
    var sound = $("extra-sound");
    if (sound) sound.textContent = soundOn() ? "Sound: On" : "Sound: Off";
    var dev = $("extra-dev");
    if (dev) dev.hidden = !isDevName(name);
    var settingsName = $("settings-name");
    if (settingsName && extraView !== "settings") settingsName.value = name;
  }

  function openPanel(name) {
    extraView = name === "extra-name" ? "name" : name === "extra-settings" ? "settings" : "home";
    ["extra-name", "extra-home", "extra-settings"].forEach(function (id) {
      var el = $(id);
      if (el) el.hidden = id !== name;
    });
    if (name === "extra-settings") {
      var settingsName = $("settings-name");
      if (settingsName) settingsName.value = getName();
    }
    if (name === "extra-name") {
      var field = $("player-name");
      if (field && !field.value) field.value = getName();
    }
  }

  function syncOverlay() {
    var extra = $("extra-shell");
    var exitBtn = $("exit-legacy");
    var version = $("build-version");
    var main = onMainMenu();

    if (version) {
      version.style.display = main ? "block" : "none";
    }

    if (isLegacy()) {
      extraView = "auto";
      show(extra, false);
      setVanillaButtonsVisible(true);
      show(exitBtn, main);
      return;
    }

    show(exitBtn, false);
    if (!main) {
      extraView = "auto";
      show(extra, false);
      setVanillaButtonsVisible(true);
      return;
    }

    setVanillaButtonsVisible(false);
    show(extra, true);
    paintExtraMenu();
    if (!getName()) {
      if (extraView !== "name") openPanel("extra-name");
    } else if (extraView === "auto" || extraView === "name") {
      openPanel("extra-home");
    }
  }

  function bind() {
    var extra = $("extra-shell");
    var exitBtn = $("exit-legacy");
    if (!extra || !exitBtn) return;

    extra.addEventListener("keydown", function (ev) {
      ev.stopPropagation();
    });
    extra.addEventListener("keyup", function (ev) {
      ev.stopPropagation();
    });
    extra.addEventListener("keypress", function (ev) {
      ev.stopPropagation();
    });

    extra.addEventListener("click", function (ev) {
      var btn = ev.target.closest("button[data-act]");
      if (!btn || btn.disabled) return;
      var act = btn.getAttribute("data-act");
      if (act === "start") clickVanilla("startNewGame");
      else if (act === "resume") clickVanilla("resumeGame");
      else if (act === "load") clickVanilla("loadStage");
      else if (act === "sound") {
        if (window.stage && window.stage.toggleSound) window.stage.toggleSound();
        paintExtraMenu();
      } else if (act === "credits") clickVanilla("credits");
      else if (act === "legacy") {
        setMode("legacy");
        reloadSamePage();
      } else if (act === "settings") openPanel("extra-settings");
      else if (act === "back") openPanel("extra-home");
      else if (act === "skip-name") {
        if (!getName()) setName("BLOX");
        paintExtraMenu();
        openPanel("extra-home");
      } else if (act === "save-name") {
        var field = $("settings-name");
        var next = field ? field.value : "";
        if (!next.trim()) return;
        setName(next);
        paintExtraMenu();
        openPanel("extra-home");
      }
    });

    extra.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var field = $("player-name");
      if (!field || !field.value.trim()) return;
      setName(field.value);
      paintExtraMenu();
      openPanel("extra-home");
    });

    exitBtn.addEventListener("click", function () {
      setMode("extra");
      reloadSamePage();
    });

    var nameField = $("player-name");
    if (nameField) nameField.value = getName();
    var settingsName = $("settings-name");
    if (settingsName) settingsName.value = getName();
  }

  window.startBloxorzShell = function () {
    var version = $("build-version");
    if (version) version.textContent = "v" + (window.GAME_VERSION || "2.1.0");
    bind();
    if (typeof createjs !== "undefined" && createjs.Ticker) {
      createjs.Ticker.addEventListener("tick", syncOverlay);
    }
    syncOverlay();
  };
})();
