import * as ort from "./vendor/ort.wasm.min.mjs";
import {
  LETTER_LIBRARY,
  LETTER_SEQUENCE,
  LOWERCASE_LETTER_LIBRARY,
  LOWERCASE_LETTER_SEQUENCE,
} from "./letters-data.js";

const MODEL_PATH = new URL("./models/mnist-8.onnx", import.meta.url).href;
const VENDOR_PATH = new URL("./vendor/", import.meta.url).href;
const MODEL_SIZE = 28;
const MODEL_INNER_SIZE = 20;
const STAR_GOAL = 14;
const MODE_SEQUENCE = ["addition", "subtraction", "multiplication"];
const LIMIT_OPTIONS = [10, 20, 30, 50, 100, 1000];
const PAGE_VALUES = ["math", "letters"];
const LETTER_CASES = ["uppercase", "lowercase"];

const state = {
  page: "math",
  mode: "addition",
  problem: null,
  limitIndex: 4,
  correct: 0,
  total: 0,
  streak: 0,
  stars: 0,
  history: [],
  locked: false,
  pads: [],
  modalNextAction: null,
  modalTimerId: 0,
  recognizerReady: false,
  recognizerSession: null,
  recognizerInputName: "",
  recognizerOutputName: "",
  recognitionRequestId: 0,
  letters: {
    letterCase: "uppercase",
    currentLetterIndex: 0,
    correct: 0,
    total: 0,
    streak: 0,
    history: [],
    activeStrokeIndex: 0,
    board: null,
    speechRequestId: 0,
  },
};

const coachLines = {
  addition: "Write the whole answer in one box.",
  subtraction: "Count carefully, then write the number.",
  multiplication: "Write the whole answer with your finger.",
};

const elements = {
  pageButtons: [...document.querySelectorAll("[data-page]")],
  letterCaseButtons: [...document.querySelectorAll("[data-letter-case]")],
  mathPage: document.querySelector("#math-page"),
  lettersPage: document.querySelector("#letters-page"),
  modeButtons: [...document.querySelectorAll("[data-mode]")],
  modeLabel: document.querySelector("#mode-label"),
  coachText: document.querySelector("#coach-text"),
  limitSlider: document.querySelector("#limit-slider"),
  leftNumber: document.querySelector("#left-number"),
  mathSign: document.querySelector("#math-sign"),
  rightNumber: document.querySelector("#right-number"),
  feedback: document.querySelector("#feedback"),
  correctCount: document.querySelector("#correct-count"),
  totalCount: document.querySelector("#total-count"),
  streakCount: document.querySelector("#streak-count"),
  nextButton: document.querySelector("#next-button"),
  resetButton: document.querySelector("#reset-button"),
  historyButton: document.querySelector("#history-button"),
  historyCard: document.querySelector("#history-card"),
  historyList: document.querySelector("#history-list"),
  historyEmpty: document.querySelector("#history-empty"),
  historyCount: document.querySelector("#history-count"),
  historyReviewCount: document.querySelector("#history-review-count"),
  historyCorrectCount: document.querySelector("#history-correct-count"),
  clearHistoryButton: document.querySelector("#clear-history-button"),
  closeHistoryButton: document.querySelector("#close-history-button"),
  checkButton: document.querySelector("#check-button"),
  clearAllButton: document.querySelector("#clear-all-button"),
  stickerRow: document.querySelector("#sticker-row"),
  starProgressText: document.querySelector("#star-progress-text"),
  problemBoard: document.querySelector("#problem-board"),
  recognizedAnswer: document.querySelector("#recognized-answer"),
  padShells: [...document.querySelectorAll(".pad-shell")],
  padCanvases: [...document.querySelectorAll(".digit-pad")],
  resultModal: document.querySelector("#result-modal"),
  modalBadge: document.querySelector("#modal-badge"),
  modalTitle: document.querySelector("#modal-title"),
  modalMessage: document.querySelector("#modal-message"),
  modalButton: document.querySelector("#modal-button"),
  letterCorrectCount: document.querySelector("#letter-correct-count"),
  letterTotalCount: document.querySelector("#letter-total-count"),
  letterStreakCount: document.querySelector("#letter-streak-count"),
  letterCoachText: document.querySelector("#letter-coach-text"),
  letterTargetChar: document.querySelector("#letter-target-char"),
  letterSequenceLabel: document.querySelector("#letter-sequence-label"),
  letterStrokeProgress: document.querySelector("#letter-stroke-progress"),
  letterStepIndicator: document.querySelector("#letter-step-indicator"),
  letterHandwritingHelp: document.querySelector("#letter-handwriting-help"),
  letterRulesCanvas: document.querySelector("#letter-rules-canvas"),
  letterCompletedPad: document.querySelector("#letter-completed-pad"),
  letterGuideCanvas: document.querySelector("#letter-guide-canvas"),
  letterPad: document.querySelector("#letter-pad"),
  letterCheckButton: document.querySelector("#letter-check-button"),
  letterClearButton: document.querySelector("#letter-clear-button"),
  letterFeedback: document.querySelector("#letter-feedback"),
  letterNextButton: document.querySelector("#letter-next-button"),
  letterSpeakButton: document.querySelector("#letter-speak-button"),
  letterHistoryButton: document.querySelector("#letter-history-button"),
  letterHistoryCard: document.querySelector("#letter-history-card"),
  letterHistoryCount: document.querySelector("#letter-history-count"),
  letterHistoryReviewCount: document.querySelector("#letter-history-review-count"),
  letterHistoryCorrectCount: document.querySelector("#letter-history-correct-count"),
  letterHistoryEmpty: document.querySelector("#letter-history-empty"),
  letterHistoryList: document.querySelector("#letter-history-list"),
  letterClearHistoryButton: document.querySelector("#letter-clear-history-button"),
  letterCloseHistoryButton: document.querySelector("#letter-close-history-button"),
};

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function modeLabel(mode) {
  return {
    addition: "Addition",
    subtraction: "Subtraction",
    multiplication: "Multiplication",
  }[mode];
}

function parsePageFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const page = params.get("page");
  return PAGE_VALUES.includes(page) ? page : "math";
}

function writePageToUrl(page) {
  const url = new URL(window.location.href);
  url.searchParams.set("page", page);
  window.history.pushState({}, "", url);
}

function shouldNormalizePageParam() {
  const params = new URLSearchParams(window.location.search);
  return !PAGE_VALUES.includes(params.get("page"));
}

function ensureLetterPageReady() {
  if (state.letters.board) {
    return;
  }

  setupLetterBoard();
  renderLetterCaseButtons();
  updateLetterScoreboard();
  renderLetterHistory();
  resetCurrentLetterTracing();
  void speakCurrentLetter();
}

function renderLetterCaseButtons() {
  for (const button of elements.letterCaseButtons) {
    const isActive = button.dataset.letterCase === state.letters.letterCase;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  }
}

function setLetterCase(letterCase) {
  if (!LETTER_CASES.includes(letterCase) || letterCase === state.letters.letterCase) {
    return;
  }

  state.letters.letterCase = letterCase;
  state.letters.currentLetterIndex = 0;
  state.letters.activeStrokeIndex = 0;
  renderLetterCaseButtons();
  resetCurrentLetterTracing(`Let's trace ${letterCase} ${currentLetterKey()}.`);
  void speakCurrentLetter();
}

function setPage(page, { updateUrl = true } = {}) {
  state.page = PAGE_VALUES.includes(page) ? page : "math";
  elements.mathPage.hidden = state.page !== "math";
  elements.lettersPage.hidden = state.page !== "letters";

  for (const button of elements.pageButtons) {
    button.classList.toggle("is-active", button.dataset.page === state.page);
  }

  if (updateUrl) {
    writePageToUrl(state.page);
  }

  resetResultModal();

  if (state.page !== "letters") {
    cancelLetterSpeech();
  }

  if (state.page === "letters") {
    ensureLetterPageReady();
  }
}

function nextMode(mode) {
  const index = MODE_SEQUENCE.indexOf(mode);
  return MODE_SEQUENCE[(index + 1) % MODE_SEQUENCE.length];
}

function currentLetterKey() {
  return currentLetterSequence()[state.letters.currentLetterIndex];
}

function currentLetterData() {
  return currentLetterLibrary()[currentLetterKey()];
}

function currentLetterSequence() {
  return state.letters.letterCase === "lowercase" ? LOWERCASE_LETTER_SEQUENCE : LETTER_SEQUENCE;
}

function currentLetterLibrary() {
  return state.letters.letterCase === "lowercase" ? LOWERCASE_LETTER_LIBRARY : LETTER_LIBRARY;
}

function nextLetterIndex(index) {
  return (index + 1) % currentLetterSequence().length;
}

function currentLimit() {
  return LIMIT_OPTIONS[state.limitIndex];
}

function randomIntFromRange(min, max) {
  return randomInt(Math.min(min, max), Math.max(min, max));
}

function createAdditionProblem() {
  const limit = currentLimit();
  const left = randomIntFromRange(Math.floor(limit * 0.35), limit);
  const right = randomInt(0, limit - left);
  return { left, right, sign: "+", answer: left + right };
}

function createSubtractionProblem() {
  const limit = currentLimit();
  const left = randomIntFromRange(Math.floor(limit * 0.35), limit);
  const right = randomInt(0, left);
  return { left, right, sign: "-", answer: left - right };
}

function createMultiplicationProblem() {
  const factorLimit = Math.min(11, currentLimit());
  const left = randomInt(0, factorLimit);
  const right = randomInt(0, factorLimit);
  return { left, right, sign: "x", answer: left * right };
}

function createProblem(mode) {
  if (mode === "subtraction") {
    return createSubtractionProblem();
  }
  if (mode === "multiplication") {
    return createMultiplicationProblem();
  }
  return createAdditionProblem();
}

function updateScoreboard() {
  elements.correctCount.textContent = String(state.correct);
  elements.totalCount.textContent = String(state.total);
  elements.streakCount.textContent = String(state.streak);
}

function renderLimitControl() {
  const limit = currentLimit();
  elements.limitSlider.value = String(state.limitIndex);
  elements.limitSlider.setAttribute("aria-valuetext", String(limit));
  elements.limitSlider.title = `Up to ${limit}`;
}

function renderStars() {
  const totalStars = Math.min(state.stars, STAR_GOAL);
  const stars = [];

  for (let index = 0; index < STAR_GOAL; index += 1) {
    stars.push(
      `<span class="sticker ${index < totalStars ? "filled" : ""}" aria-hidden="true"></span>`,
    );
  }

  elements.stickerRow.innerHTML = stars.join("");
  elements.starProgressText.textContent = `${state.stars} / ${STAR_GOAL} stars in this mode`;
}

function animateBoard(animationName) {
  elements.problemBoard.classList.remove("celebrate", "wiggle");
  void elements.problemBoard.offsetWidth;
  elements.problemBoard.classList.add(animationName);
}

function setFeedback(message, type) {
  elements.feedback.textContent = message;
  elements.feedback.className = `feedback ${type}`;
}

function setCheckEnabled(enabled) {
  elements.checkButton.disabled = !enabled;
}

function renderHistory() {
  const reviewCount = state.history.filter((entry) => !entry.isCorrect).length;
  const correctCount = state.history.length - reviewCount;
  elements.historyCount.textContent = String(state.history.length);
  elements.historyReviewCount.textContent = String(reviewCount);
  elements.historyCorrectCount.textContent = String(correctCount);

  if (!state.history.length) {
    elements.historyEmpty.hidden = false;
    elements.historyList.innerHTML = "";
    return;
  }

  elements.historyEmpty.hidden = true;
  elements.historyList.innerHTML = state.history
    .slice()
    .reverse()
    .map(
      (entry) => `
        <article class="history-item ${entry.isCorrect ? "is-correct" : "needs-review"}">
          <div class="history-item-top">
            <span class="history-mode-pill">${modeLabel(entry.mode)}</span>
            <span class="history-status-pill ${entry.isCorrect ? "" : "needs-review"}">
              ${entry.isCorrect ? "Correct" : "Needs review"}
            </span>
          </div>
          <p class="history-equation">${entry.problemText}</p>
          <div class="history-answer-row">
            <div class="history-answer-box">
              <span>Child wrote</span>
              <strong>${entry.writtenAnswer}</strong>
            </div>
            <div class="history-answer-box">
              <span>Correct answer</span>
              <strong>${entry.correctAnswer}</strong>
            </div>
          </div>
          <p class="history-time">${entry.timeLabel}</p>
        </article>`,
    )
    .join("");
}

function addHistoryEntry({ mode, problem, writtenAnswer, isCorrect }) {
  state.history.push({
    mode,
    problemText: `${problem.left} ${problem.sign} ${problem.right} = ${problem.answer}`,
    writtenAnswer,
    correctAnswer: String(problem.answer),
    isCorrect,
    timeLabel: new Date().toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
    }),
  });
  renderHistory();
}

function showHistory() {
  elements.historyCard.hidden = false;
  elements.historyCard.scrollIntoView({ behavior: "smooth", block: "start" });
}

function hideHistory() {
  elements.historyCard.hidden = true;
}

function clearHistory() {
  state.history = [];
  renderHistory();
  setFeedback("Session history cleared.", "neutral");
}

function resetPracticeSession(message) {
  state.correct = 0;
  state.total = 0;
  state.streak = 0;
  state.stars = 0;
  state.history = [];
  state.locked = false;
  updateScoreboard();
  renderStars();
  renderHistory();
  hideHistory();
  resetResultModal();
  nextProblem(message);
}

function setLimitIndex(limitIndex) {
  state.limitIndex = Math.max(0, Math.min(LIMIT_OPTIONS.length - 1, limitIndex));
  renderLimitControl();
  resetPracticeSession(`Number limit set to ${currentLimit()}. Everything was reset.`);
}

function playTone(type) {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) {
    return;
  }

  const context = new AudioContextClass();
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.connect(gain);
  gain.connect(context.destination);

  const config =
    type === "success"
      ? { start: 523.25, end: 659.25, duration: 0.22 }
      : { start: 220, end: 180, duration: 0.18 };

  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(config.start, context.currentTime);
  oscillator.frequency.linearRampToValueAtTime(
    config.end,
    context.currentTime + config.duration,
  );

  gain.gain.setValueAtTime(0.0001, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.12, context.currentTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(
    0.0001,
    context.currentTime + config.duration,
  );

  oscillator.start();
  oscillator.stop(context.currentTime + config.duration);
  oscillator.onended = () => {
    context.close().catch(() => {});
  };
}

function setupCanvas(canvas) {
  const ratio = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(220, Math.round(rect.width));
  const height = Math.max(160, Math.round(rect.height));

  canvas.width = width * ratio;
  canvas.height = height * ratio;

  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = "#20415f";
  ctx.lineWidth = Math.max(6, width * 0.035);
  ctx.clearRect(0, 0, width, height);

  return { width, height, ctx };
}

function createHiDPICanvas(width, height, ratio) {
  const canvas = document.createElement("canvas");
  canvas.width = width * ratio;
  canvas.height = height * ratio;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  return { canvas, ctx };
}

function letterLayout(board) {
  const boxSize = Math.min(board.height * 0.78, board.width * 0.68);
  const guideLineWidth = Math.max(8, boxSize * 0.06);
  const userLineWidth = Math.max(9, guideLineWidth * 1.05);
  return {
    left: (board.width - boxSize) / 2,
    top: (board.height - boxSize) / 2,
    boxSize,
    guideLineWidth,
    userLineWidth,
    maskLineWidth: Math.max(userLineWidth * 1.6, guideLineWidth + 7),
    eraseLineWidth: Math.max(userLineWidth * 1.7, guideLineWidth + 8),
    dotRadius: Math.max(6, boxSize * 0.026),
  };
}

function mapLetterPoint(board, point) {
  const layout = letterLayout(board);
  const templateY =
    state.letters.letterCase === "uppercase" ? 12 + ((point[1] - 10) * 64) / 82 : point[1];
  return {
    x: layout.left + (layout.boxSize * point[0]) / 100,
    y: layout.top + (layout.boxSize * templateY) / 100,
  };
}

function drawLetterStrokePath(ctx, board, stroke, lineWidth) {
  const [firstPoint, ...restPoints] = stroke.points;
  const mappedFirstPoint = mapLetterPoint(board, firstPoint);
  ctx.beginPath();
  ctx.moveTo(mappedFirstPoint.x, mappedFirstPoint.y);
  for (const point of restPoints) {
    const mappedPoint = mapLetterPoint(board, point);
    ctx.lineTo(mappedPoint.x, mappedPoint.y);
  }
  ctx.lineWidth = lineWidth;
  ctx.stroke();
}

function renderLetterWritingRules(board) {
  const layout = letterLayout(board);
  const ruleYs = [12, 40, 76];
  const ctx = board.rulesCtx;
  ctx.clearRect(0, 0, board.width, board.height);
  ctx.save();
  ctx.strokeStyle = "rgba(113, 160, 206, 0.3)";
  ctx.lineWidth = Math.max(1, layout.boxSize * 0.004);
  ctx.setLineDash([7, 6]);

  for (const templateY of ruleYs) {
    const y = layout.top + (layout.boxSize * templateY) / 100;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(board.width, y);
    ctx.stroke();
  }

  ctx.restore();
}

function clearLetterFeedback(message = "Trace the highlighted stroke in order.", type = "neutral") {
  elements.letterFeedback.textContent = message;
  elements.letterFeedback.className = `feedback ${type}`;
}

function updateLetterScoreboard() {
  elements.letterCorrectCount.textContent = String(state.letters.correct);
  elements.letterTotalCount.textContent = String(state.letters.total);
  elements.letterStreakCount.textContent = String(state.letters.streak);
}

function cancelLetterSpeech() {
  state.letters.speechRequestId += 1;
  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
}

function speakLetter(letter) {
  return new Promise((resolve) => {
    if (!("speechSynthesis" in window) || typeof SpeechSynthesisUtterance === "undefined") {
      resolve(false);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(letter);
    utterance.lang = "en-US";
    utterance.rate = 0.36;
    utterance.pitch = 0.96;
    utterance.volume = 1;
    utterance.onend = () => resolve(true);
    utterance.onerror = () => resolve(false);
    window.speechSynthesis.speak(utterance);
  });
}

async function speakCurrentLetter() {
  if (!("speechSynthesis" in window) || typeof SpeechSynthesisUtterance === "undefined") {
    return;
  }

  const letter = currentLetterKey();
  const requestId = ++state.letters.speechRequestId;
  window.speechSynthesis.cancel();

  if (requestId !== state.letters.speechRequestId) {
    return;
  }

  await speakLetter(letter);
}

function renderLetterHistory() {
  const reviewCount = state.letters.history.filter((entry) => !entry.isCorrect).length;
  const correctCount = state.letters.history.length - reviewCount;
  elements.letterHistoryCount.textContent = String(state.letters.history.length);
  elements.letterHistoryReviewCount.textContent = String(reviewCount);
  elements.letterHistoryCorrectCount.textContent = String(correctCount);

  if (!state.letters.history.length) {
    elements.letterHistoryEmpty.hidden = false;
    elements.letterHistoryList.innerHTML = "";
    return;
  }

  elements.letterHistoryEmpty.hidden = true;
  elements.letterHistoryList.innerHTML = state.letters.history
    .slice()
    .reverse()
    .map(
      (entry) => `
        <article class="history-item ${entry.isCorrect ? "is-correct" : "needs-review"}">
          <div class="history-item-top">
            <span class="history-mode-pill">Letter ${entry.letter}</span>
            <span class="history-status-pill ${entry.isCorrect ? "" : "needs-review"}">
              ${entry.isCorrect ? "Correct" : "Needs review"}
            </span>
          </div>
          <p class="history-equation">Target letter: ${entry.letter}</p>
          <div class="history-answer-row">
            <div class="history-answer-box">
              <span>Result</span>
              <strong>${entry.isCorrect ? "Passed tracing" : "Retry this letter"}</strong>
            </div>
            <div class="history-answer-box">
              <span>Stroke progress</span>
              <strong>${entry.strokeLabel}</strong>
            </div>
          </div>
          <p class="history-time">${entry.timeLabel}</p>
        </article>`,
    )
    .join("");
}

function addLetterHistoryEntry({ letter, isCorrect, strokeLabel }) {
  state.letters.history.push({
    letter,
    isCorrect,
    strokeLabel,
    timeLabel: new Date().toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
    }),
  });
  renderLetterHistory();
}

function showLetterHistory() {
  elements.letterHistoryCard.hidden = false;
  elements.letterHistoryCard.scrollIntoView({ behavior: "smooth", block: "start" });
}

function hideLetterHistory() {
  elements.letterHistoryCard.hidden = true;
}

function clearLetterHistory() {
  state.letters.history = [];
  renderLetterHistory();
  clearLetterFeedback("Letter session history cleared.", "neutral");
}

function setupLetterBoard() {
  const ratio = window.devicePixelRatio || 1;
  const rect = elements.letterPad.getBoundingClientRect();
  const width = Math.max(220, Math.round(rect.width));
  const height = Math.max(160, Math.round(rect.height));

  for (const canvas of [
    elements.letterRulesCanvas,
    elements.letterCompletedPad,
    elements.letterGuideCanvas,
    elements.letterPad,
  ]) {
    canvas.width = width * ratio;
    canvas.height = height * ratio;
  }

  const rulesCtx = elements.letterRulesCanvas.getContext("2d", { willReadFrequently: true });
  rulesCtx.setTransform(ratio, 0, 0, ratio, 0, 0);

  const completedCtx = elements.letterCompletedPad.getContext("2d", { willReadFrequently: true });
  completedCtx.setTransform(ratio, 0, 0, ratio, 0, 0);
  completedCtx.lineCap = "round";
  completedCtx.lineJoin = "round";

  const drawCtx = elements.letterPad.getContext("2d", { willReadFrequently: true });
  drawCtx.setTransform(ratio, 0, 0, ratio, 0, 0);
  drawCtx.lineCap = "round";
  drawCtx.lineJoin = "round";
  drawCtx.strokeStyle = "#20415f";

  const guideCtx = elements.letterGuideCanvas.getContext("2d", { willReadFrequently: true });
  guideCtx.setTransform(ratio, 0, 0, ratio, 0, 0);
  guideCtx.lineCap = "round";
  guideCtx.lineJoin = "round";

  state.letters.board = {
    width,
    height,
    ratio,
    drawCanvas: elements.letterPad,
    rulesCanvas: elements.letterRulesCanvas,
    completedCanvas: elements.letterCompletedPad,
    guideCanvas: elements.letterGuideCanvas,
    drawCtx,
    rulesCtx,
    completedCtx,
    guideCtx,
    drawing: false,
    lastX: 0,
    lastY: 0,
    activeStrokeBuffer: createHiDPICanvas(width, height, ratio),
    strokeMaskBuffers: [],
    fullMaskBuffer: createHiDPICanvas(width, height, ratio),
  };
}

function clearLetterBoardInk() {
  if (!state.letters.board) {
    return;
  }
  const board = state.letters.board;
  board.drawCtx.clearRect(0, 0, board.width, board.height);
  board.completedCtx.clearRect(0, 0, board.width, board.height);
  board.activeStrokeBuffer.ctx.clearRect(0, 0, board.width, board.height);
}

function renderLetterGuide() {
  const board = state.letters.board;
  if (!board) {
    return;
  }

  const letterData = currentLetterData();
  const layout = letterLayout(board);
  renderLetterWritingRules(board);
  board.guideCtx.clearRect(0, 0, board.width, board.height);

  for (let index = state.letters.activeStrokeIndex; index < letterData.strokes.length; index += 1) {
    const stroke = letterData.strokes[index];
    board.guideCtx.strokeStyle = "rgba(89, 167, 255, 0.12)";
    drawLetterStrokePath(board.guideCtx, board, stroke, layout.guideLineWidth);
  }

  const activeStroke = letterData.strokes[state.letters.activeStrokeIndex];
  if (activeStroke) {
    board.guideCtx.strokeStyle = "rgba(45, 127, 224, 0.46)";
    drawLetterStrokePath(board.guideCtx, board, activeStroke, layout.guideLineWidth);
    const startPoint = mapLetterPoint(board, activeStroke.points[0]);
    board.guideCtx.fillStyle = "#2d7fe0";
    board.guideCtx.beginPath();
    board.guideCtx.arc(startPoint.x, startPoint.y, layout.dotRadius, 0, Math.PI * 2);
    board.guideCtx.fill();
  }
}

function eraseGuideSegment(board, fromPoint, toPoint) {
  const layout = letterLayout(board);
  board.guideCtx.save();
  board.guideCtx.globalCompositeOperation = "destination-out";
  board.guideCtx.strokeStyle = "rgba(0, 0, 0, 1)";
  board.guideCtx.lineWidth = layout.eraseLineWidth;
  board.guideCtx.beginPath();
  board.guideCtx.moveTo(fromPoint.x, fromPoint.y);
  board.guideCtx.lineTo(toPoint.x, toPoint.y);
  board.guideCtx.stroke();
  board.guideCtx.restore();
}

function buildLetterMasks() {
  const board = state.letters.board;
  const letterData = currentLetterData();
  const layout = letterLayout(board);
  board.strokeMaskBuffers = letterData.strokes.map((stroke) => {
    const buffer = createHiDPICanvas(board.width, board.height, board.ratio);
    buffer.ctx.strokeStyle = "#000000";
    drawLetterStrokePath(buffer.ctx, board, stroke, layout.maskLineWidth);
    return buffer;
  });

  board.fullMaskBuffer = createHiDPICanvas(board.width, board.height, board.ratio);
  board.fullMaskBuffer.ctx.strokeStyle = "#000000";
  for (const stroke of letterData.strokes) {
    drawLetterStrokePath(board.fullMaskBuffer.ctx, board, stroke, layout.maskLineWidth);
  }
}

function readOverlapMetrics(sourceCanvas, targetCanvas) {
  const source = sourceCanvas.getContext("2d", { willReadFrequently: true }).getImageData(
    0,
    0,
    sourceCanvas.width,
    sourceCanvas.height,
  ).data;
  const target = targetCanvas.getContext("2d", { willReadFrequently: true }).getImageData(
    0,
    0,
    targetCanvas.width,
    targetCanvas.height,
  ).data;

  let overlapPixels = 0;
  let userPixels = 0;
  let targetPixels = 0;

  for (let index = 3; index < source.length; index += 4) {
    const userOn = source[index] > 12;
    const targetOn = target[index] > 12;
    if (userOn) {
      userPixels += 1;
    }
    if (targetOn) {
      targetPixels += 1;
    }
    if (userOn && targetOn) {
      overlapPixels += 1;
    }
  }

  return {
    overlapPixels,
    userPixels,
    targetPixels,
    targetCoverage: targetPixels ? overlapPixels / targetPixels : 0,
    userPrecision: userPixels ? overlapPixels / userPixels : 0,
  };
}

function updateLetterLabels() {
  const letterData = currentLetterData();
  const totalStrokes = letterData.strokes.length;
  const currentStep = Math.min(state.letters.activeStrokeIndex + 1, totalStrokes);
  const currentLetter = currentLetterKey();
  const allStrokesTraced = state.letters.activeStrokeIndex >= totalStrokes;
  const activeStroke = letterData.strokes[Math.min(state.letters.activeStrokeIndex, totalStrokes - 1)];
  elements.letterTargetChar.textContent = currentLetter;
  elements.letterTargetChar.dataset.letterCase = state.letters.letterCase;
  elements.letterSequenceLabel.textContent = `Letter ${state.letters.currentLetterIndex + 1} of ${currentLetterSequence().length}`;
  elements.letterStrokeProgress.textContent = `Stroke ${currentStep} of ${totalStrokes}`;
  elements.letterStepIndicator.textContent = `${currentStep} / ${totalStrokes}`;
  elements.letterCoachText.textContent = allStrokesTraced
    ? "All strokes are traced. Tap Check my letter."
    : activeStroke.hint;
  elements.letterHandwritingHelp.textContent =
    allStrokesTraced
      ? "All strokes are traced. Tap Check my letter."
      : "Start at the glowing dot and trace the blue stroke.";
}

function resetCurrentLetterTracing(
  message = "Trace the highlighted stroke in order.",
  type = "neutral",
) {
  if (!state.letters.board) {
    return;
  }
  state.letters.activeStrokeIndex = 0;
  clearLetterBoardInk();
  buildLetterMasks();
  renderLetterGuide();
  updateLetterLabels();
  clearLetterFeedback(message, type);
}

function advanceLetterStrokeIfReady() {
  const board = state.letters.board;
  const activeMask = board.strokeMaskBuffers[state.letters.activeStrokeIndex];
  if (!activeMask) {
    return;
  }

  const metrics = readOverlapMetrics(board.activeStrokeBuffer.canvas, activeMask.canvas);
  if (metrics.targetCoverage >= 0.48 && metrics.userPrecision >= 0.18) {
    board.completedCtx.drawImage(board.drawCanvas, 0, 0, board.width, board.height);
    board.drawCtx.clearRect(0, 0, board.width, board.height);
    state.letters.activeStrokeIndex += 1;
    board.activeStrokeBuffer.ctx.clearRect(0, 0, board.width, board.height);
    renderLetterGuide();
    updateLetterLabels();

    if (state.letters.activeStrokeIndex >= currentLetterData().strokes.length) {
      clearLetterFeedback("Nice tracing. Tap Check my letter.", "success");
    } else {
      clearLetterFeedback("Great. Now trace the next highlighted stroke.", "neutral");
    }
  }
}

function checkLetterTracing() {
  const letterData = currentLetterData();
  const totalStrokes = letterData.strokes.length;
  const letter = currentLetterKey();

  state.letters.total += 1;
  if (state.letters.activeStrokeIndex < totalStrokes) {
    state.letters.streak = 0;
    updateLetterScoreboard();
    addLetterHistoryEntry({
      letter,
      isCorrect: false,
      strokeLabel: `${state.letters.activeStrokeIndex} / ${totalStrokes} strokes`,
    });
    clearLetterFeedback("Finish tracing every highlighted stroke first.", "error");
    return false;
  }

  const metrics = readOverlapMetrics(
    state.letters.board.completedCanvas,
    state.letters.board.fullMaskBuffer.canvas,
  );
  const passed = metrics.targetCoverage >= 0.54 && metrics.userPrecision >= 0.18;
  if (!passed) {
    state.letters.streak = 0;
    updateLetterScoreboard();
    addLetterHistoryEntry({
      letter,
      isCorrect: false,
      strokeLabel: `${totalStrokes} / ${totalStrokes} strokes`,
    });
    resetCurrentLetterTracing("Close, but trace that same letter one more time.", "error");
    return false;
  }

  state.letters.correct += 1;
  state.letters.streak += 1;
  updateLetterScoreboard();
  addLetterHistoryEntry({
    letter,
    isCorrect: true,
    strokeLabel: `${totalStrokes} / ${totalStrokes} strokes`,
  });
  return true;
}

function moveToNextLetter(message) {
  state.letters.currentLetterIndex = nextLetterIndex(state.letters.currentLetterIndex);
  resetCurrentLetterTracing(message);
  void speakCurrentLetter();
}

function getLetterPoint(event) {
  const rect = elements.letterPad.getBoundingClientRect();
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  };
}

function startLetterDrawing(event) {
  event.preventDefault();
  const board = state.letters.board;
  if (!board || state.letters.activeStrokeIndex >= currentLetterData().strokes.length) {
    return;
  }

  const point = getLetterPoint(event);
  const layout = letterLayout(board);
  board.drawing = true;
  board.lastX = point.x;
  board.lastY = point.y;
  board.drawCtx.strokeStyle = "#20415f";
  board.drawCtx.lineWidth = layout.userLineWidth;
  board.activeStrokeBuffer.ctx.strokeStyle = "#000000";
  board.activeStrokeBuffer.ctx.lineWidth = layout.userLineWidth;
  board.drawCtx.beginPath();
  board.drawCtx.moveTo(point.x, point.y);
  board.drawCtx.lineTo(point.x + 0.01, point.y + 0.01);
  board.drawCtx.stroke();
  board.activeStrokeBuffer.ctx.beginPath();
  board.activeStrokeBuffer.ctx.moveTo(point.x, point.y);
  board.activeStrokeBuffer.ctx.lineTo(point.x + 0.01, point.y + 0.01);
  board.activeStrokeBuffer.ctx.stroke();
  eraseGuideSegment(board, point, { x: point.x + 0.01, y: point.y + 0.01 });
  elements.letterPad.setPointerCapture(event.pointerId);
}

function drawLetter(event) {
  const board = state.letters.board;
  if (!board?.drawing) {
    return;
  }

  const point = getLetterPoint(event);
  for (const ctx of [board.drawCtx, board.activeStrokeBuffer.ctx]) {
    ctx.beginPath();
    ctx.moveTo(board.lastX, board.lastY);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
  }
  eraseGuideSegment(board, { x: board.lastX, y: board.lastY }, point);
  board.lastX = point.x;
  board.lastY = point.y;
}

function stopLetterDrawing(event) {
  const board = state.letters.board;
  if (!board?.drawing) {
    return;
  }

  board.drawing = false;
  try {
    elements.letterPad.releasePointerCapture(event.pointerId);
  } catch {}
  advanceLetterStrokeIfReady();
}

function celebrateLetterSuccess() {
  const letter = currentLetterKey();
  playTone("success");

  openResultModal({
    title: "Great tracing!",
    message: `You traced the letter ${letter} well.`,
    tone: "success",
    buttonLabel: "Next letter",
    nextAction: {
      type: "letter-next",
      message: "Trace the next letter in order.",
    },
    autoCloseMs: 1200,
  });
}

function resetLetterSession(message) {
  state.letters.correct = 0;
  state.letters.total = 0;
  state.letters.streak = 0;
  state.letters.history = [];
  state.letters.currentLetterIndex = 0;
  state.letters.activeStrokeIndex = 0;
  updateLetterScoreboard();
  renderLetterHistory();
  hideLetterHistory();
  resetCurrentLetterTracing(message);
  void speakCurrentLetter();
}

function handleLetterCheck() {
  const passed = checkLetterTracing();
  if (passed) {
    celebrateLetterSuccess();
  } else {
    playTone("error");
  }
}
function createPads() {
  state.pads = elements.padCanvases.map((canvas, index) => {
    const setup = setupCanvas(canvas);
    return {
      index,
      canvas,
      shell: elements.padShells[index],
      ctx: setup.ctx,
      width: setup.width,
      height: setup.height,
      drawing: false,
      hasInk: false,
      lastX: 0,
      lastY: 0,
    };
  });
}

function clearPad(pad) {
  pad.ctx.clearRect(0, 0, pad.width, pad.height);
  pad.hasInk = false;
}

function clearAllPads(silent = false) {
  for (const pad of state.pads) {
    clearPad(pad);
  }
  elements.recognizedAnswer.textContent = "-";
  if (!silent) {
    setFeedback("The box is clear. Write a new answer.", "neutral");
  }
}

function getPoint(event, canvas) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  };
}

function startDrawing(event, pad) {
  event.preventDefault();
  if (state.locked) {
    return;
  }

  const point = getPoint(event, pad.canvas);
  pad.drawing = true;
  pad.hasInk = true;
  pad.lastX = point.x;
  pad.lastY = point.y;
  pad.ctx.beginPath();
  pad.ctx.moveTo(point.x, point.y);
  pad.ctx.lineTo(point.x + 0.01, point.y + 0.01);
  pad.ctx.stroke();
  pad.canvas.setPointerCapture(event.pointerId);
}

function draw(event, pad) {
  if (!pad.drawing) {
    return;
  }

  const point = getPoint(event, pad.canvas);
  pad.ctx.beginPath();
  pad.ctx.moveTo(pad.lastX, pad.lastY);
  pad.ctx.lineTo(point.x, point.y);
  pad.ctx.stroke();
  pad.lastX = point.x;
  pad.lastY = point.y;
  pad.hasInk = true;
}

function stopDrawing(event, pad) {
  if (!pad.drawing) {
    return;
  }

  pad.drawing = false;
  try {
    pad.canvas.releasePointerCapture(event.pointerId);
  } catch {}
  void updateRecognizedAnswer();
}

function getCanvasInkData(sourceCanvas) {
  const context = sourceCanvas.getContext("2d", { willReadFrequently: true });
  const { width, height } = sourceCanvas;
  const image = context.getImageData(0, 0, width, height).data;
  return { width, height, image };
}

function pixelDarkness(image, width, x, y) {
  const offset = (y * width + x) * 4;
  const alpha = image[offset + 3] / 255;
  return alpha * (1 - (image[offset] + image[offset + 1] + image[offset + 2]) / 765);
}

function measureInkBounds(sourceCanvas, threshold = 0.06) {
  const { width, height, image } = getCanvasInkData(sourceCanvas);
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  let ink = 0;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const darkness = pixelDarkness(image, width, x, y);
      if (darkness > threshold) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
        ink += darkness;
      }
    }
  }

  if (maxX < minX || maxY < minY) {
    return null;
  }

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
    ink,
  };
}

function columnHasInk(image, width, height, x, threshold = 0.06) {
  for (let y = 0; y < height; y += 1) {
    if (pixelDarkness(image, width, x, y) > threshold) {
      return true;
    }
  }
  return false;
}

function rowHasInk(image, width, startX, endX, y, threshold = 0.06) {
  for (let x = startX; x <= endX; x += 1) {
    if (pixelDarkness(image, width, x, y) > threshold) {
      return true;
    }
  }
  return false;
}

function splitCanvasIntoDigitCanvases(sourceCanvas) {
  const { width, height, image } = getCanvasInkData(sourceCanvas);
  const segments = [];
  let startX = -1;

  for (let x = 0; x < width; x += 1) {
    const hasInk = columnHasInk(image, width, height, x);
    if (hasInk && startX === -1) {
      startX = x;
    }

    if (!hasInk && startX !== -1) {
      if (x - startX > 6) {
        segments.push([startX, x - 1]);
      }
      startX = -1;
    }
  }

  if (startX !== -1 && width - startX > 6) {
    segments.push([startX, width - 1]);
  }

  return segments
    .slice(0, 3)
    .map(([segmentStartX, segmentEndX]) => {
      let minY = height;
      let maxY = -1;

      for (let y = 0; y < height; y += 1) {
        if (rowHasInk(image, width, segmentStartX, segmentEndX, y)) {
          minY = Math.min(minY, y);
          maxY = Math.max(maxY, y);
        }
      }

      if (maxY < minY) {
        return null;
      }

      const tempCanvas = document.createElement("canvas");
      const cropWidth = segmentEndX - segmentStartX + 1;
      const cropHeight = maxY - minY + 1;
      tempCanvas.width = cropWidth;
      tempCanvas.height = cropHeight;
      const tempContext = tempCanvas.getContext("2d", { willReadFrequently: true });
      tempContext.drawImage(
        sourceCanvas,
        segmentStartX,
        minY,
        cropWidth,
        cropHeight,
        0,
        0,
        cropWidth,
        cropHeight,
      );

      return tempCanvas;
    })
    .filter(Boolean);
}

function normalizeDigitCanvas(sourceCanvas, size = MODEL_SIZE, innerSize = MODEL_INNER_SIZE) {
  const bounds = measureInkBounds(sourceCanvas);
  const normalized = new Float32Array(size * size);

  if (!bounds || bounds.ink < 1) {
    return normalized;
  }

  const tempCanvas = document.createElement("canvas");
  tempCanvas.width = size;
  tempCanvas.height = size;
  const tempContext = tempCanvas.getContext("2d", { willReadFrequently: true });

  const scale = Math.min(innerSize / bounds.width, innerSize / bounds.height);
  const drawWidth = bounds.width * scale;
  const drawHeight = bounds.height * scale;
  const drawX = (size - drawWidth) / 2;
  const drawY = (size - drawHeight) / 2;

  tempContext.clearRect(0, 0, size, size);
  tempContext.drawImage(
    sourceCanvas,
    bounds.minX,
    bounds.minY,
    bounds.width,
    bounds.height,
    drawX,
    drawY,
    drawWidth,
    drawHeight,
  );

  const normalizedImage = tempContext.getImageData(0, 0, size, size).data;
  for (let index = 0; index < normalized.length; index += 1) {
    const offset = index * 4;
    const alpha = normalizedImage[offset + 3] / 255;
    normalized[index] =
      alpha *
      (1 - (normalizedImage[offset] + normalizedImage[offset + 1] + normalizedImage[offset + 2]) / 765);
  }

  return normalized;
}

function averageInk(normalized, size, startX, startY, endX, endY) {
  let ink = 0;
  let count = 0;

  for (let y = startY; y < endY; y += 1) {
    for (let x = startX; x < endX; x += 1) {
      ink += normalized[y * size + x];
      count += 1;
    }
  }

  return count ? ink / count : 0;
}

function findNormalizedBounds(normalized, size, threshold = 0.12) {
  let minX = size;
  let minY = size;
  let maxX = -1;
  let maxY = -1;
  let ink = 0;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const value = normalized[y * size + x];
      if (value > threshold) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
        ink += value;
      }
    }
  }

  if (maxX < minX || maxY < minY) {
    return null;
  }

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
    ink,
  };
}

function dilateMask(mask, size) {
  const dilated = mask.slice();

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (!mask[y * size + x]) {
        continue;
      }

      for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
        for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
          const nextX = x + offsetX;
          const nextY = y + offsetY;
          if (nextX >= 0 && nextX < size && nextY >= 0 && nextY < size) {
            dilated[nextY * size + nextX] = 1;
          }
        }
      }
    }
  }

  return dilated;
}

function findHoleComponents(mask, size) {
  const visited = new Uint8Array(size * size);
  const queue = [];
  const holes = [];

  function addIfOpen(x, y) {
    const index = y * size + x;
    if (!mask[index] && !visited[index]) {
      visited[index] = 1;
      queue.push(index);
    }
  }

  for (let index = 0; index < size; index += 1) {
    addIfOpen(index, 0);
    addIfOpen(index, size - 1);
    addIfOpen(0, index);
    addIfOpen(size - 1, index);
  }

  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const index = queue[cursor];
    const x = index % size;
    const y = Math.floor(index / size);
    if (x > 0) addIfOpen(x - 1, y);
    if (x < size - 1) addIfOpen(x + 1, y);
    if (y > 0) addIfOpen(x, y - 1);
    if (y < size - 1) addIfOpen(x, y + 1);
  }

  for (let y = 1; y < size - 1; y += 1) {
    for (let x = 1; x < size - 1; x += 1) {
      const startIndex = y * size + x;
      if (mask[startIndex] || visited[startIndex]) {
        continue;
      }

      const component = [startIndex];
      visited[startIndex] = 1;
      let area = 0;
      let sumX = 0;
      let sumY = 0;
      let minX = x;
      let maxX = x;
      let minY = y;
      let maxY = y;

      for (let cursor = 0; cursor < component.length; cursor += 1) {
        const index = component[cursor];
        const currentX = index % size;
        const currentY = Math.floor(index / size);
        area += 1;
        sumX += currentX;
        sumY += currentY;
        minX = Math.min(minX, currentX);
        maxX = Math.max(maxX, currentX);
        minY = Math.min(minY, currentY);
        maxY = Math.max(maxY, currentY);

        const neighbors = [
          [currentX - 1, currentY],
          [currentX + 1, currentY],
          [currentX, currentY - 1],
          [currentX, currentY + 1],
        ];

        for (const [nextX, nextY] of neighbors) {
          if (nextX <= 0 || nextX >= size - 1 || nextY <= 0 || nextY >= size - 1) {
            continue;
          }

          const nextIndex = nextY * size + nextX;
          if (!mask[nextIndex] && !visited[nextIndex]) {
            visited[nextIndex] = 1;
            component.push(nextIndex);
          }
        }
      }

      holes.push({
        area,
        centerX: sumX / area,
        centerY: sumY / area,
        width: maxX - minX + 1,
        height: maxY - minY + 1,
      });
    }
  }

  return holes;
}

function isZeroLikeDigit(normalized, size = MODEL_SIZE) {
  const bounds = findNormalizedBounds(normalized, size);

  if (!bounds || bounds.ink < 8 || bounds.width < 9 || bounds.height < 11) {
    return false;
  }

  const aspectRatio = bounds.width / bounds.height;
  if (aspectRatio < 0.45 || aspectRatio > 1.25) {
    return false;
  }

  const mask = new Uint8Array(size * size);
  for (let index = 0; index < normalized.length; index += 1) {
    mask[index] = normalized[index] > 0.16 ? 1 : 0;
  }

  const holes = findHoleComponents(dilateMask(mask, size), size).filter(
    (hole) => hole.area >= 8 && hole.width >= 3 && hole.height >= 3,
  );
  const centeredHole = holes.find((hole) => {
    const relativeX = (hole.centerX - bounds.minX) / bounds.width;
    const relativeY = (hole.centerY - bounds.minY) / bounds.height;
    return relativeX > 0.32 && relativeX < 0.68 && relativeY > 0.28 && relativeY < 0.72;
  });

  if (!centeredHole || holes.length > 1) {
    return false;
  }

  const bandWidth = Math.max(3, Math.round(bounds.width * 0.24));
  const bandHeight = Math.max(3, Math.round(bounds.height * 0.24));
  const centerStartX = bounds.minX + Math.round(bounds.width * 0.35);
  const centerEndX = bounds.minX + Math.round(bounds.width * 0.65);
  const centerStartY = bounds.minY + Math.round(bounds.height * 0.35);
  const centerEndY = bounds.minY + Math.round(bounds.height * 0.65);

  const topInk = averageInk(normalized, size, bounds.minX, bounds.minY, bounds.maxX + 1, bounds.minY + bandHeight);
  const bottomInk = averageInk(normalized, size, bounds.minX, bounds.maxY - bandHeight + 1, bounds.maxX + 1, bounds.maxY + 1);
  const leftInk = averageInk(normalized, size, bounds.minX, bounds.minY, bounds.minX + bandWidth, bounds.maxY + 1);
  const rightInk = averageInk(normalized, size, bounds.maxX - bandWidth + 1, bounds.minY, bounds.maxX + 1, bounds.maxY + 1);
  const centerInk = averageInk(normalized, size, centerStartX, centerStartY, centerEndX, centerEndY);
  const ringInk = (topInk + bottomInk + leftInk + rightInk) / 4;

  return topInk > 0.08 && bottomInk > 0.08 && leftInk > 0.08 && rightInk > 0.08 && centerInk < ringInk * 0.48;
}

function softmax(values) {
  const max = Math.max(...values);
  const exps = values.map((value) => Math.exp(value - max));
  const sum = exps.reduce((total, value) => total + value, 0);
  return exps.map((value) => value / sum);
}

async function initializeDigitRecognizer() {
  try {
    setCheckEnabled(false);
    ort.env.wasm.wasmPaths = VENDOR_PATH;
    state.recognizerSession = await ort.InferenceSession.create(MODEL_PATH, {
      executionProviders: ["wasm"],
      graphOptimizationLevel: "all",
    });
    state.recognizerInputName = state.recognizerSession.inputNames[0];
    state.recognizerOutputName = state.recognizerSession.outputNames[0];
    state.recognizerReady = true;
    setCheckEnabled(true);
    setFeedback("Better digit detection is ready.", "neutral");
  } catch (error) {
    console.error(error);
    state.recognizerReady = false;
    setCheckEnabled(false);
    setFeedback("Digit model could not load. Please refresh the page.", "error");
  }
}

async function predictDigit(digitCanvas) {
  if (!state.recognizerSession) {
    throw new Error("Recognizer is not ready yet.");
  }

  const normalized = normalizeDigitCanvas(digitCanvas);
  const zeroLike = isZeroLikeDigit(normalized);
  const tensor = new ort.Tensor("float32", normalized, [1, 1, MODEL_SIZE, MODEL_SIZE]);
  const results = await state.recognizerSession.run({
    [state.recognizerInputName]: tensor,
  });
  const output = Array.from(results[state.recognizerOutputName].data);
  const probabilities = softmax(output);

  let bestIndex = 0;
  let secondIndex = 0;

  for (let index = 1; index < probabilities.length; index += 1) {
    if (probabilities[index] > probabilities[bestIndex]) {
      secondIndex = bestIndex;
      bestIndex = index;
    } else if (index !== bestIndex && probabilities[index] > probabilities[secondIndex]) {
      secondIndex = index;
    }
  }

  if (zeroLike && (bestIndex === 0 || probabilities[bestIndex] < 0.82 || [6, 8, 9].includes(bestIndex))) {
    return {
      digit: 0,
      confidence: Math.max(probabilities[0], 0.9),
      margin: Math.max(probabilities[0] - probabilities[secondIndex], 0.35),
      heuristic: true,
    };
  }

  return {
    digit: bestIndex,
    confidence: probabilities[bestIndex],
    margin: probabilities[bestIndex] - probabilities[secondIndex],
    heuristic: false,
  };
}

async function readHandwrittenAnswer() {
  const pad = state.pads[0];
  const digitCanvases = splitCanvasIntoDigitCanvases(pad.canvas);

  if (!digitCanvases.length) {
    return {
      text: "",
      value: null,
      hasInk: false,
      needsRewrite: false,
    };
  }

  const digits = [];
  for (const digitCanvas of digitCanvases) {
    const prediction = await predictDigit(digitCanvas);
    if (prediction.confidence < 0.52 || prediction.margin < 0.18) {
      return {
        text: "?",
        value: null,
        hasInk: true,
        needsRewrite: true,
      };
    }
    digits.push(String(prediction.digit));
  }

  return {
    text: digits.join(""),
    value: Number(digits.join("")),
    hasInk: true,
    needsRewrite: false,
  };
}

async function updateRecognizedAnswer() {
  const requestId = ++state.recognitionRequestId;

  if (!state.recognizerReady) {
    elements.recognizedAnswer.textContent = "...";
    return;
  }

  try {
    const reading = await readHandwrittenAnswer();
    if (requestId !== state.recognitionRequestId) {
      return;
    }

    if (!reading.hasInk) {
      elements.recognizedAnswer.textContent = "-";
      return;
    }

    if (reading.needsRewrite) {
      elements.recognizedAnswer.textContent = "?";
      return;
    }

    elements.recognizedAnswer.textContent = reading.text;
  } catch (error) {
    console.error(error);
    if (requestId === state.recognitionRequestId) {
      elements.recognizedAnswer.textContent = "?";
    }
  }
}

function clearModalTimer() {
  if (state.modalTimerId) {
    window.clearTimeout(state.modalTimerId);
    state.modalTimerId = 0;
  }
}

function resetResultModal() {
  clearModalTimer();
  elements.resultModal.hidden = true;
  elements.resultModal.classList.remove("is-toast", "is-dialog");
  elements.modalButton.hidden = false;
  state.modalNextAction = null;
}

function openResultModal({
  title,
  message,
  tone,
  buttonLabel,
  nextAction,
  autoCloseMs = 0,
}) {
  clearModalTimer();
  state.modalNextAction = nextAction ?? null;
  elements.modalTitle.textContent = title;
  elements.modalMessage.textContent = message;
  elements.modalButton.textContent = buttonLabel;
  elements.modalBadge.textContent = tone === "success" ? "OK" : "!";
  elements.modalBadge.className = `modal-badge ${tone}`;
  elements.resultModal.classList.toggle("is-toast", tone === "success");
  elements.resultModal.classList.toggle("is-dialog", tone !== "success");
  elements.modalButton.hidden = tone === "success";
  elements.resultModal.hidden = false;

  if (autoCloseMs > 0) {
    state.modalTimerId = window.setTimeout(() => {
      closeResultModal();
    }, autoCloseMs);
  }
}

function closeResultModal() {
  const nextAction = state.modalNextAction;
  resetResultModal();
  state.locked = false;

  if (nextAction?.type === "letter-next") {
    moveToNextLetter(nextAction.message);
    return;
  }

  if (nextAction?.type === "switch-mode") {
    setMode(nextAction.mode, {
      message: nextAction.message,
      resetStars: true,
    });
    return;
  }

  nextProblem(nextAction?.message);
}

function renderProblem() {
  resetResultModal();
  state.problem = createProblem(state.mode);
  state.locked = false;
  elements.modeLabel.textContent = modeLabel(state.mode);
  elements.coachText.textContent = coachLines[state.mode];
  elements.leftNumber.textContent = String(state.problem.left);
  elements.mathSign.textContent = state.problem.sign;
  elements.rightNumber.textContent = String(state.problem.right);
  clearAllPads(true);
}

function nextProblem(message) {
  renderProblem();
  if (message) {
    setFeedback(message, "neutral");
  }
}

function celebrateCorrectAnswer(readingText) {
  state.correct += 1;
  state.total += 1;
  state.streak += 1;
  state.stars += 1;
  addHistoryEntry({
    mode: state.mode,
    problem: state.problem,
    writtenAnswer: readingText,
    isCorrect: true,
  });

  updateScoreboard();
  renderStars();
  animateBoard("celebrate");
  setFeedback("Nice work. That answer is right.", "success");
  playTone("success");

  if (state.stars >= STAR_GOAL) {
    const upcomingMode = nextMode(state.mode);
    openResultModal({
      title: `${STAR_GOAL} stars!`,
      message: `${modeLabel(state.mode)} is complete. Next up: ${modeLabel(upcomingMode)}.`,
      tone: "success",
      buttonLabel: "Next mode",
      nextAction: {
        type: "switch-mode",
        mode: upcomingMode,
        message: `Great work. Now playing ${modeLabel(upcomingMode).toLowerCase()}.`,
      },
      autoCloseMs: 1600,
    });
    return;
  }

  openResultModal({
    title: "Great job!",
    message: `You wrote ${readingText}. That is correct.`,
    tone: "success",
    buttonLabel: "Next problem",
    nextAction: {
      type: "next-problem",
      message: "Write the next answer.",
    },
    autoCloseMs: 1200,
  });
}

function handleWrongAnswer(readingText) {
  state.total += 1;
  state.streak = 0;
  addHistoryEntry({
    mode: state.mode,
    problem: state.problem,
    writtenAnswer: readingText,
    isCorrect: false,
  });

  updateScoreboard();
  animateBoard("wiggle");
  setFeedback(`You wrote ${readingText}. The correct answer is ${state.problem.answer}.`, "error");
  playTone("error");
  openResultModal({
    title: "Try again next one!",
    message: `You wrote ${readingText}. The right answer is ${state.problem.answer}.`,
    tone: "error",
    buttonLabel: "Next problem",
    nextAction: {
      type: "next-problem",
      message: "Let's try a new problem.",
    },
  });
}

async function checkHandwrittenAnswer() {
  if (state.locked) {
    return;
  }

  if (!state.recognizerReady) {
    setFeedback("Digit model is still loading. Please wait a moment.", "neutral");
    return;
  }

  try {
    const reading = await readHandwrittenAnswer();
    elements.recognizedAnswer.textContent = reading.text || "-";

    if (!reading.hasInk) {
      setFeedback("Please write a number first.", "error");
      return;
    }

    if (reading.needsRewrite || reading.value === null) {
      setFeedback("I could not read the number clearly. Please write bigger.", "error");
      return;
    }

    state.locked = true;

    if (reading.value === state.problem.answer) {
      celebrateCorrectAnswer(reading.text);
      return;
    }

    handleWrongAnswer(reading.text);
  } catch (error) {
    console.error(error);
    state.locked = false;
    setFeedback("Digit check failed. Please try again.", "error");
  }
}

function resetStarsProgress() {
  state.stars = 0;
  renderStars();
}

function setMode(mode, { message, resetStars = true } = {}) {
  if (!MODE_SEQUENCE.includes(mode)) {
    return;
  }

  state.mode = mode;
  if (resetStars) {
    resetStarsProgress();
  }

  for (const button of elements.modeButtons) {
    button.classList.toggle("is-active", button.dataset.mode === mode);
  }

  nextProblem(message ?? `Now playing ${modeLabel(mode).toLowerCase()}.`);
}

function resetScore() {
  resetStarsProgress();
  setFeedback("Stars reset for this mode.", "neutral");
}

function bindPadEvents() {
  for (const pad of state.pads) {
    pad.canvas.addEventListener("pointerdown", (event) => startDrawing(event, pad));
    pad.canvas.addEventListener("pointermove", (event) => draw(event, pad));
    pad.canvas.addEventListener("pointerup", (event) => stopDrawing(event, pad));
    pad.canvas.addEventListener("pointercancel", (event) => stopDrawing(event, pad));
    pad.canvas.addEventListener("pointerleave", (event) => stopDrawing(event, pad));
  }
}

function bindLetterPadEvents() {
  elements.letterPad.addEventListener("pointerdown", startLetterDrawing);
  elements.letterPad.addEventListener("pointermove", drawLetter);
  elements.letterPad.addEventListener("pointerup", stopLetterDrawing);
  elements.letterPad.addEventListener("pointercancel", stopLetterDrawing);
  elements.letterPad.addEventListener("pointerleave", stopLetterDrawing);
}

for (const button of elements.modeButtons) {
  button.addEventListener("click", () => {
    if (button.dataset.mode !== state.mode) {
      setMode(button.dataset.mode);
    }
  });
}

elements.checkButton.addEventListener("click", () => {
  void checkHandwrittenAnswer();
});

for (const button of elements.pageButtons) {
  button.addEventListener("click", () => {
    if (button.dataset.page !== state.page) {
      setPage(button.dataset.page);
    }
  });
}

for (const button of elements.letterCaseButtons) {
  button.addEventListener("click", () => setLetterCase(button.dataset.letterCase));
}

elements.clearAllButton.addEventListener("click", () => clearAllPads());
elements.nextButton.addEventListener("click", () => {
  nextProblem("Here comes a new problem.");
});
elements.resetButton.addEventListener("click", resetScore);
elements.historyButton.addEventListener("click", showHistory);
elements.clearHistoryButton.addEventListener("click", clearHistory);
elements.closeHistoryButton.addEventListener("click", hideHistory);
elements.limitSlider.addEventListener("input", (event) => {
  const nextIndex = Number(event.target.value);
  if (nextIndex !== state.limitIndex) {
    setLimitIndex(nextIndex);
  }
});
elements.limitSlider.addEventListener("change", (event) => {
  const nextIndex = Number(event.target.value);
  if (nextIndex !== state.limitIndex) {
    setLimitIndex(nextIndex);
  }
});
elements.modalButton.addEventListener("click", closeResultModal);
elements.letterCheckButton.addEventListener("click", handleLetterCheck);
elements.letterClearButton.addEventListener("click", () => {
  resetCurrentLetterTracing("Try tracing that letter again.");
});
elements.letterNextButton.addEventListener("click", () => {
  moveToNextLetter("Skipped ahead. Trace the next letter.");
});
elements.letterSpeakButton.addEventListener("click", () => {
  void speakCurrentLetter();
});
elements.letterHistoryButton.addEventListener("click", showLetterHistory);
elements.letterClearHistoryButton.addEventListener("click", clearLetterHistory);
elements.letterCloseHistoryButton.addEventListener("click", hideLetterHistory);

window.addEventListener("popstate", () => {
  setPage(parsePageFromUrl(), { updateUrl: false });
});

createPads();
bindPadEvents();
bindLetterPadEvents();
updateScoreboard();
renderStars();
renderLimitControl();
renderHistory();
renderProblem();
setPage(parsePageFromUrl(), { updateUrl: shouldNormalizePageParam() });
void initializeDigitRecognizer();

window.mathPractice = {
  clearAllPads,
  checkHandwrittenAnswer,
  readHandwrittenAnswer,
  setMode,
  setPage,
  state,
};
