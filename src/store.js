import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_CHILDREN, DEFAULT_PARENT_SETTINGS } from "./content.js";
import { generateAssignment } from "./generator.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const dataDir = process.env.KIDS_APP_DATA_DIR || path.join(rootDir, "data");
const recordingsDir =
  process.env.KIDS_APP_RECORDINGS_DIR || path.join(rootDir, "recordings");
const storePath = path.join(dataDir, "store.json");

function currentDate() {
  const override = process.env.KIDS_APP_TODAY;
  if (override) {
    return new Date(`${override}T12:00:00.000Z`);
  }

  return new Date();
}

function todayKey(date = currentDate()) {
  return date.toISOString().slice(0, 10);
}

function ensureDirs() {
  fs.mkdirSync(dataDir, { recursive: true });
  fs.mkdirSync(recordingsDir, { recursive: true });
}

function createInitialStore() {
  return {
    children: DEFAULT_CHILDREN,
    parentSettings: DEFAULT_PARENT_SETTINGS,
    dailyAssignments: {},
    resultsHistory: [],
  };
}

function readStore() {
  ensureDirs();

  if (!fs.existsSync(storePath)) {
    const initialStore = createInitialStore();
    fs.writeFileSync(storePath, JSON.stringify(initialStore, null, 2));
    return initialStore;
  }

  const store = JSON.parse(fs.readFileSync(storePath, "utf8"));
  store.parentSettings = {
    ...DEFAULT_PARENT_SETTINGS,
    ...store.parentSettings,
    moduleToggles: {
      ...DEFAULT_PARENT_SETTINGS.moduleToggles,
      ...(store.parentSettings?.moduleToggles ?? {}),
    },
  };

  return store;
}

function writeStore(store) {
  ensureDirs();
  fs.writeFileSync(storePath, JSON.stringify(store, null, 2));
}

function findChild(store, childId) {
  return store.children.find((child) => child.id === childId) ?? null;
}

function calculateCompletionPercent(tasks) {
  if (tasks.length === 0) {
    return 0;
  }

  const completedCount = tasks.filter((task) => task.completed).length;
  return Math.round((completedCount / tasks.length) * 100);
}

function calculateStars(tasks) {
  return tasks.reduce((sum, task) => {
    if (!task.completed) {
      return sum;
    }

    if (task.correct === true) {
      return sum + 3;
    }

    if (task.correct === false) {
      return sum + 1;
    }

    return sum + 2;
  }, 0);
}

function getAssignmentForDate(store, childId, dateKey) {
  return store.dailyAssignments[`${dateKey}:${childId}`] ?? null;
}

function getRecentDates(days) {
  const dates = [];
  const base = currentDate();
  base.setHours(0, 0, 0, 0);

  for (let index = days - 1; index >= 0; index -= 1) {
    const current = new Date(base);
    current.setDate(base.getDate() - index);
    dates.push(current.toISOString().slice(0, 10));
  }

  return dates;
}

function calculateChildStreak(store, childId) {
  const dates = getRecentDates(30).reverse();
  let streak = 0;

  for (const dateKey of dates) {
    const assignment = getAssignmentForDate(store, childId, dateKey);
    if (assignment?.completionPercent === 100) {
      streak += 1;
      continue;
    }

    if (dateKey === todayKey()) {
      continue;
    }

    break;
  }

  return streak;
}

function getOrCreateAssignment(store, childId) {
  const child = findChild(store, childId);
  if (!child) {
    return null;
  }

  const dateKey = todayKey();
  const assignmentKey = `${dateKey}:${childId}`;

  if (!store.dailyAssignments[assignmentKey]) {
    store.dailyAssignments[assignmentKey] = generateAssignment({
      child,
      dateKey,
      settings: store.parentSettings,
      resultsHistory: store.resultsHistory,
    });
    writeStore(store);
  }

  return store.dailyAssignments[assignmentKey];
}

function buildChildDailyView(store, childId) {
  const assignment = getOrCreateAssignment(store, childId);
  if (!assignment) {
    return null;
  }

  return {
    ...assignment,
    streak: calculateChildStreak(store, childId),
  };
}

function updateAssignmentSummary(assignment) {
  assignment.completionPercent = calculateCompletionPercent(assignment.tasks);
  assignment.totalStars = calculateStars(assignment.tasks);
  assignment.updatedAt = new Date().toISOString();
}

function taskModuleLabel(moduleName) {
  switch (moduleName) {
    case "sightWords":
      return "Sight Words";
    default:
      return moduleName.charAt(0).toUpperCase() + moduleName.slice(1);
  }
}

function createHistoryEntry(childId, task, durationSec) {
  return {
    date: todayKey(),
    childId,
    taskId: task.id,
    taskRef: task.taskRef,
    module: taskModuleLabel(task.module),
    correctRate: task.correct === null ? 1 : task.correct ? 1 : 0,
    durationSec: durationSec ?? task.durationSec ?? 0,
    hasRecording: Boolean(task.recordingPath),
    weaknessTags: task.correct === false ? task.weaknessTags ?? [] : [],
  };
}

function replaceHistoryEntry(store, entry) {
  const existingIndex = store.resultsHistory.findIndex(
    (item) =>
      item.date === entry.date &&
      item.childId === entry.childId &&
      item.taskId === entry.taskId,
  );

  if (existingIndex >= 0) {
    store.resultsHistory[existingIndex] = entry;
  } else {
    store.resultsHistory.push(entry);
  }
}

function findTask(assignment, taskId) {
  return assignment.tasks.find((task) => task.id === taskId) ?? null;
}

function summarizeWeakTags(store, childId) {
  const recent = store.resultsHistory
    .filter((entry) => entry.childId === childId)
    .slice(-20);

  const counts = new Map();
  for (const entry of recent) {
    for (const tag of entry.weaknessTags ?? []) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 4)
    .map(([tag, count]) => ({ tag, count }));
}

function buildSevenDayHistory(store, childId) {
  return getRecentDates(7).map((dateKey) => {
    const assignment = getAssignmentForDate(store, childId, dateKey);
    return {
      date: dateKey,
      completionPercent: assignment?.completionPercent ?? 0,
      stars: assignment?.totalStars ?? 0,
    };
  });
}

function buildTodayRecordings(assignment) {
  return (assignment?.tasks ?? [])
    .filter((task) => task.format === "recording")
    .map((task) => ({
      taskId: task.id,
      title: task.title,
      prompt: task.prompt,
      targetText: task.targetText,
      recordingPath: task.recordingPath,
      completed: task.completed,
      hasRecording: Boolean(task.recordingPath),
    }));
}

export function getChildProfiles() {
  const store = readStore();
  return store.children;
}

export function getTodayAssignment(childId) {
  const store = readStore();
  return buildChildDailyView(store, childId);
}

export function recordTaskAnswer({ childId, taskId, answer, durationSec = 0 }) {
  const store = readStore();
  const assignment = getOrCreateAssignment(store, childId);

  if (!assignment) {
    return null;
  }

  const task = findTask(assignment, taskId);
  if (!task) {
    return null;
  }

  task.response = answer;
  task.durationSec = Math.max(task.durationSec, Number(durationSec) || 0);
  task.attempts += 1;
  task.completed = true;

  if (task.format === "drag-match") {
    const matches = Object.entries(answer ?? {});
    task.correct =
      matches.length === task.dropzones.length &&
      task.dropzones.every((dropzone) => answer?.[dropzone.id] === dropzone.answer);
  } else {
    task.correct = String(answer) === String(task.answer);
  }

  updateAssignmentSummary(assignment);
  replaceHistoryEntry(store, createHistoryEntry(childId, task, durationSec));
  writeStore(store);

  return { task, assignment };
}

export function recordTaskCompletion({ childId, taskId, durationSec = 0 }) {
  const store = readStore();
  const assignment = getOrCreateAssignment(store, childId);

  if (!assignment) {
    return null;
  }

  const task = findTask(assignment, taskId);
  if (!task) {
    return null;
  }

  task.completed = true;
  task.correct = task.correct ?? null;
  task.durationSec = Math.max(task.durationSec, Number(durationSec) || 0);
  updateAssignmentSummary(assignment);
  replaceHistoryEntry(store, createHistoryEntry(childId, task, durationSec));
  writeStore(store);

  return { task, assignment };
}

export function saveTaskRecording({
  childId,
  taskId,
  audioBase64,
  mimeType = "audio/webm",
}) {
  const store = readStore();
  const assignment = getOrCreateAssignment(store, childId);

  if (!assignment) {
    return null;
  }

  const task = findTask(assignment, taskId);
  if (!task) {
    return null;
  }

  const extension = mimeType.includes("mp4") ? "m4a" : "webm";
  const fileName = `${childId}-${taskId}.${extension}`;
  const filePath = path.join(recordingsDir, fileName);
  const cleaned = audioBase64.replace(/^data:audio\/[^;]+;base64,/, "");

  fs.writeFileSync(filePath, Buffer.from(cleaned, "base64"));

  task.recordingPath = `/recordings/${fileName}`;
  task.completed = true;
  updateAssignmentSummary(assignment);
  replaceHistoryEntry(store, createHistoryEntry(childId, task, 0));
  writeStore(store);

  return { task, assignment };
}

export function getParentDashboard() {
  const store = readStore();

  for (const child of store.children) {
    getOrCreateAssignment(store, child.id);
  }

  return {
    settings: store.parentSettings,
    children: store.children.map((child) => {
      const todayAssignment = getAssignmentForDate(store, child.id, todayKey());
      return {
        ...child,
        todayCompletion: todayAssignment?.completionPercent ?? 0,
        todayRecordings: buildTodayRecordings(todayAssignment),
        streak: calculateChildStreak(store, child.id),
        weakTags: summarizeWeakTags(store, child.id),
        sevenDayHistory: buildSevenDayHistory(store, child.id),
      };
    }),
  };
}

export function updateChildDifficulty(childId, difficulty) {
  const store = readStore();
  const child = findChild(store, childId);
  if (!child) {
    return null;
  }

  child.targetDifficulty = difficulty;
  writeStore(store);
  return child;
}

export function updateParentSettings({
  dailyTaskCount,
  difficultyPreference,
  password,
  moduleToggles,
}) {
  const store = readStore();

  if (dailyTaskCount !== undefined) {
    store.parentSettings.dailyTaskCount = Math.max(
      4,
      Math.min(6, Number(dailyTaskCount) || 5),
    );
  }

  if (difficultyPreference) {
    store.parentSettings.difficultyPreference = difficultyPreference;
  }

  if (password) {
    store.parentSettings.password = String(password);
  }

  if (moduleToggles) {
    store.parentSettings.moduleToggles = {
      ...store.parentSettings.moduleToggles,
      ...moduleToggles,
    };
  }

  writeStore(store);
  return store.parentSettings;
}

export function verifyParentPassword(password) {
  const store = readStore();
  return store.parentSettings.password === String(password);
}
