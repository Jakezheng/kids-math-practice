import * as ort from "./vendor/ort.wasm.min.mjs";

const MODEL_PATH = new URL("./models/mnist-8.onnx", import.meta.url).href;
const VENDOR_PATH = new URL("./vendor/", import.meta.url).href;
const MODEL_SIZE = 28;
const MODEL_INNER_SIZE = 20;

const state = {
  mode: "addition",
  problem: null,
  correct: 0,
  total: 0,
  streak: 0,
  stars: 0,
  locked: false,
  pads: [],
  modalNextMessage: "",
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
  leftNumber: document.querySelector("#left-number"),
  mathSign: document.querySelector("#math-sign"),
  rightNumber: document.querySelector("#right-number"),
  feedback: document.querySelector("#feedback"),
  correctCount: document.querySelector("#correct-count"),
  totalCount: document.querySelector("#total-count"),
  streakCount: document.querySelector("#streak-count"),
  nextButton: document.querySelector("#next-button"),
  resetButton: document.querySelector("#reset-button"),
  checkButton: document.querySelector("#check-button"),
  clearAllButton: document.querySelector("#clear-all-button"),
  stickerRow: document.querySelector("#sticker-row"),
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

function createAdditionProblem() {
  const left = randomInt(0, 100);
  const right = randomInt(0, 100 - left);
  return { left, right, sign: "+", answer: left + right };
}

function createSubtractionProblem() {
  const left = randomInt(0, 100);
  const right = randomInt(0, left);
  return { left, right, sign: "-", answer: left - right };
}

function createMultiplicationProblem() {
  const left = randomInt(0, 11);
  const right = randomInt(0, 11);
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

function renderStars() {
  const totalStars = Math.min(state.stars, 12);
  const stars = [];

  for (let index = 0; index < 12; index += 1) {
    stars.push(
      `<span class="sticker ${index < totalStars ? "filled" : ""}" aria-hidden="true"></span>`,
    );
  }

  elements.stickerRow.innerHTML = stars.join("");
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

  return {
    digit: bestIndex,
    confidence: probabilities[bestIndex],
    margin: probabilities[bestIndex] - probabilities[secondIndex],
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
}

function openResultModal({
  title,
  message,
  tone,
  buttonLabel,
  nextMessage,
  autoCloseMs = 0,
}) {
  clearModalTimer();
  state.modalNextMessage = nextMessage;
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
  resetResultModal();
  state.locked = false;
  nextProblem(state.modalNextMessage);
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

  updateScoreboard();
  renderStars();
  animateBoard("celebrate");
  setFeedback("Nice work. That answer is right.", "success");
  playTone("success");
  openResultModal({
    title: "Great job!",
    message: `You wrote ${readingText}. That is correct.`,
    tone: "success",
    buttonLabel: "Next problem",
    nextMessage: "Write the next answer.",
    autoCloseMs: 1200,
  });
}

function handleWrongAnswer(readingText) {
  state.total += 1;
  state.streak = 0;

  updateScoreboard();
  animateBoard("wiggle");
  setFeedback(`You wrote ${readingText}. The correct answer is ${state.problem.answer}.`, "error");
  playTone("error");
  openResultModal({
    title: "Try again next one!",
    message: `You wrote ${readingText}. The right answer is ${state.problem.answer}.`,
    tone: "error",
    buttonLabel: "Next problem",
    nextMessage: "Let's try a new problem.",
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

function setMode(mode) {
  state.mode = mode;

  for (const button of elements.modeButtons) {
    button.classList.toggle("is-active", button.dataset.mode === mode);
  }

  nextProblem(`Now playing ${modeLabel(mode).toLowerCase()}.`);
}

function resetScore() {
  state.correct = 0;
  state.total = 0;
  state.streak = 0;
  state.stars = 0;
  updateScoreboard();
  renderStars();
  nextProblem("Stars reset. Let's play again.");
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
  button.addEventListener("click", () => setMode(button.dataset.mode));
}

elements.checkButton.addEventListener("click", () => {
  void checkHandwrittenAnswer();
});
elements.clearAllButton.addEventListener("click", () => clearAllPads());
elements.nextButton.addEventListener("click", () => {
  nextProblem("Here comes a new problem.");
});
elements.resetButton.addEventListener("click", resetScore);
elements.modalButton.addEventListener("click", closeResultModal);

createPads();
bindPadEvents();
updateScoreboard();
renderStars();
renderProblem();
void initializeDigitRecognizer();

window.mathPractice = {
  clearAllPads,
  checkHandwrittenAnswer,
  readHandwrittenAnswer,
  setMode,
  state,
};
