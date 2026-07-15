import * as ort from "./vendor/ort.wasm.min.mjs";

const MODEL_PATH = new URL("./models/mnist-8.onnx", import.meta.url).href;
const VENDOR_PATH = new URL("./vendor/", import.meta.url).href;
const MODEL_SIZE = 28;
const MODEL_INNER_SIZE = 20;
const STAR_GOAL = 14;
const MODE_SEQUENCE = ["addition", "subtraction", "multiplication"];
const LIMIT_OPTIONS = [10, 20, 30, 50, 100, 1000];

const state = {
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
};

const coachLines = {
  addition: "Write the whole answer in one box.",
  subtraction: "Count carefully, then write the number.",
  multiplication: "Write the whole answer with your finger.",
};

const elements = {
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

function nextMode(mode) {
  const index = MODE_SEQUENCE.indexOf(mode);
  return MODE_SEQUENCE[(index + 1) % MODE_SEQUENCE.length];
}

function currentLimit() {
  return LIMIT_OPTIONS[state.limitIndex];
}

function createAdditionProblem() {
  const limit = currentLimit();
  const left = randomInt(0, limit);
  const right = randomInt(0, limit - left);
  return { left, right, sign: "+", answer: left + right };
}

function createSubtractionProblem() {
  const limit = currentLimit();
  const left = randomInt(0, limit);
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
elements.modalButton.addEventListener("click", closeResultModal);

createPads();
bindPadEvents();
updateScoreboard();
renderStars();
renderLimitControl();
renderHistory();
renderProblem();
void initializeDigitRecognizer();

window.mathPractice = {
  clearAllPads,
  checkHandwrittenAnswer,
  readHandwrittenAnswer,
  setMode,
  state,
};
