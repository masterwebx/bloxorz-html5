var currentLevel = 1;
var TOTAL_STAGES = 33;
var tableInitialized = false;
var stageTimeCells = [];
var stageMovesCells = [];
var currentLevelCell = null;
var timerActive = false;
var pausedElapsed = 0;

function setCurrentLevel(levelNumber) {
  currentLevel = levelNumber;
  currentLevelCell = stageTimeCells[currentLevel] || null;
  highlightCurrentStage();

  if (timerActive) {
    UpdateTable();
  }
}

/** Rebuild the side-panel table for classic (33) or shorter gauntlet/pack runs. */
function setTimerStageCount(n) {
  var count = Math.max(1, Math.floor(Number(n)) || 33);
  if (count === TOTAL_STAGES && tableInitialized) return;
  TOTAL_STAGES = count;
  tableInitialized = false;
  EnsureTable();
}

function liveMoveCount() {
  try {
    var world = window.stage && window.stage.bloxWorld;
    if (world && typeof world.moves === "number") return Math.max(0, world.moves);
  } catch (e) {
    /* ignore */
  }
  return 0;
}

var startTime = Date.now();
var times = [];
var moves = [];

function EnsureTable() {
  if (tableInitialized) return;

  var timeRows = document.getElementById("timeRows");
  if (!timeRows) return;

  var html = "";
  for (let i = 1; i <= TOTAL_STAGES; i++) {
    html +=
      `<tr id='stage${i}'><td>${i}</td>` +
      `<td id='stage${i}time'>-</td>` +
      `<td id='stage${i}moves'>-</td></tr>`;
  }

  timeRows.innerHTML = html;

  stageTimeCells = [];
  stageMovesCells = [];
  for (let i = 1; i <= TOTAL_STAGES; i++) {
    stageTimeCells[i] = document.getElementById(`stage${i}time`);
    stageMovesCells[i] = document.getElementById(`stage${i}moves`);
  }

  var table = document.getElementById("timeTable");
  if (table) table.style.setProperty("--timer-rows", String(TOTAL_STAGES + 1));

  tableInitialized = true;
  currentLevelCell = stageTimeCells[currentLevel] || null;
  highlightCurrentStage();
}

function highlightCurrentStage() {
  var rows = document.querySelectorAll("#timeRows tr");
  for (var i = 0; i < rows.length; i++) {
    rows[i].classList.toggle("is-current", rows[i].id === "stage" + currentLevel);
  }
}

function ResetTimer() {
  startTime = Date.now();
  times = [];
  moves = [];
  timerActive = false;
  pausedElapsed = 0;

  EnsureTable();

  for (let i = 1; i <= TOTAL_STAGES; i++) {
    times[i] = 0;
    moves[i] = null;
    if (stageTimeCells[i]) {
      stageTimeCells[i].textContent = "-";
    }
    if (stageMovesCells[i]) {
      stageMovesCells[i].textContent = "-";
    }
  }

  currentLevelCell = stageTimeCells[currentLevel] || null;
  highlightCurrentStage();
  UpdateTable();
}

var cancelTimerToken;

function StartTimer() {
  pausedElapsed = 0;
  timerActive = true;
  clearInterval(cancelTimerToken);
  cancelTimerToken = window.setInterval(UpdateTable, 50);
}

function PauseTimer() {
  if (!timerActive) {
    return;
  }

  pausedElapsed = Date.now() - startTime;
  timerActive = false;
  clearInterval(cancelTimerToken);
  cancelTimerToken = null;
}

function ResumeTimer() {
  if (timerActive) {
    return;
  }

  startTime = Date.now() - pausedElapsed;
  timerActive = true;
  clearInterval(cancelTimerToken);
  cancelTimerToken = window.setInterval(UpdateTable, 50);
  UpdateTable();
}

function RestartTimerForCurrentStage() {
  pausedElapsed = 0;
  startTime = Date.now();
  timerActive = true;
  clearInterval(cancelTimerToken);
  cancelTimerToken = window.setInterval(UpdateTable, 50);
  UpdateTable();
}

function AddStageByLevel(level) {
  clearInterval(cancelTimerToken);
  cancelTimerToken = null;

  var elapsed = Date.now() - startTime;
  times[level] = elapsed;
  moves[level] = liveMoveCount();

  if (stageTimeCells[level]) {
    stageTimeCells[level].textContent = FormatDuration(elapsed);
  }
  if (stageMovesCells[level]) {
    stageMovesCells[level].textContent = String(moves[level]);
  }

  StartTimer();
}

function UpdateTable() {
  if (!tableInitialized) {
    EnsureTable();
  }

  if (!timerActive) {
    return;
  }

  if (!currentLevelCell) {
    currentLevelCell = stageTimeCells[currentLevel] || null;
  }

  if (!currentLevelCell) return;

  currentLevelCell.textContent = FormatDuration(Date.now() - startTime);
  if (stageMovesCells[currentLevel]) {
    stageMovesCells[currentLevel].textContent = String(liveMoveCount());
  }
}

function pad(num, places) {
  return String(num).padStart(places, "0");
}

function FormatDuration(diff) {
  // var days = Math.floor(diff / (1000 * 60 * 60 * 24));
  // diff -=  days * (1000 * 60 * 60 * 24);

  // var hours = Math.floor(diff / (1000 * 60 * 60));
  // diff -= hours * (1000 * 60 * 60);

  var mins = Math.floor(diff / (1000 * 60));
  diff -= mins * (1000 * 60);

  var seconds = Math.floor(diff / 1000);
  diff -= seconds * 1000;

  //00:00.000
  return `${pad(mins, 2)}:${pad(seconds, 2)}.${pad(diff, 3)}`;
}
