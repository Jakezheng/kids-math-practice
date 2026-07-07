import crypto from "node:crypto";
import { MODULE_BANKS, MODULE_ORDER } from "./content.js";

function buildRecentWeaknessMap(resultsHistory, childId) {
  const recent = resultsHistory
    .filter((entry) => entry.childId === childId)
    .slice(-20);

  const map = new Map();

  for (const entry of recent) {
    const weight = entry.correctRate >= 0.8 ? 0 : 2;
    for (const tag of entry.weaknessTags ?? []) {
      map.set(tag, (map.get(tag) ?? 0) + weight);
    }
  }

  return map;
}

function buildRecentTaskStats(resultsHistory, childId) {
  const recent = resultsHistory
    .filter((entry) => entry.childId === childId)
    .slice(-30);

  const stats = new Map();

  for (const entry of recent) {
    if (!entry.taskRef) {
      continue;
    }

    const current = stats.get(entry.taskRef) ?? {
      correctCount: 0,
      incorrectCount: 0,
      appearances: 0,
    };

    current.appearances += 1;
    if (entry.correctRate >= 0.8) {
      current.correctCount += 1;
    } else {
      current.incorrectCount += 1;
    }

    stats.set(entry.taskRef, current);
  }

  return stats;
}

function taskReference(moduleName, task) {
  return `${moduleName}:${task.title}:${task.prompt}`;
}

function dateSerial(dateKey) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return Math.floor(Date.UTC(year, month - 1, day) / 86400000);
}

function rotationBonus(index, bankLength, dateKey, seedIndex) {
  if (bankLength <= 1) {
    return 0;
  }

  const targetIndex = (dateSerial(dateKey) + seedIndex) % bankLength;
  return index === targetIndex ? 6 : 0;
}

function difficultyDistance(targetDifficulty, taskDifficulty) {
  const scale = {
    easier: 0,
    normal: 1,
    challenge: 2,
  };

  return Math.abs((scale[targetDifficulty] ?? 1) - (scale[taskDifficulty] ?? 1));
}

function effectiveDifficulty(child, settings) {
  if (settings.difficultyPreference && settings.difficultyPreference !== "normal") {
    return settings.difficultyPreference;
  }

  return child.targetDifficulty || "normal";
}

function pickTaskVariant(
  moduleName,
  child,
  settings,
  weaknessMap,
  taskStats,
  dateKey,
  seedIndex,
) {
  const bank = MODULE_BANKS[moduleName]?.[child.id] ?? [];

  if (bank.length === 0) {
    return null;
  }

  const scored = bank.map((task, index) => {
    const taskRef = taskReference(moduleName, task);
    const recentStats = taskStats.get(taskRef) ?? {
      correctCount: 0,
      incorrectCount: 0,
      appearances: 0,
    };
    const weaknessScore = (task.weaknessTags ?? []).reduce(
      (sum, tag) => sum + (weaknessMap.get(tag) ?? 0),
      0,
    );
    const distancePenalty = difficultyDistance(
      effectiveDifficulty(child, settings),
      task.difficulty ?? "normal",
    );
    const masteryPenalty = recentStats.correctCount * 3 + recentStats.appearances * 0.3;
    const retryBoost = recentStats.incorrectCount * 4;
    const dayRotation = rotationBonus(index, bank.length, dateKey, seedIndex);

    return {
      task,
      score:
        weaknessScore * 10 +
        retryBoost +
        dayRotation -
        masteryPenalty -
        distancePenalty * 4,
    };
  });

  scored.sort((left, right) => right.score - left.score);
  return scored[0]?.task ?? bank[0];
}

function cloneTask(moduleName, task, childId, dateKey) {
  return {
    id: crypto
      .createHash("sha1")
      .update(`${dateKey}:${childId}:${moduleName}:${task.title}:${task.prompt}`)
      .digest("hex")
      .slice(0, 12),
    module: moduleName,
    title: task.title,
    prompt: task.prompt,
    format: task.format,
    options: task.options ?? [],
    answer: task.answer ?? null,
    difficulty: task.difficulty ?? "normal",
    taskRef: taskReference(moduleName, task),
    draggables: task.draggables ?? [],
    dropzones: task.dropzones ?? [],
    targetText: task.targetText ?? null,
    weaknessTags: task.weaknessTags ?? [],
    completed: false,
    correct: null,
    attempts: 0,
    durationSec: 0,
    recordingPath: null,
    response: null,
  };
}

export function generateAssignment({ child, dateKey, settings, resultsHistory }) {
  const weaknessMap = buildRecentWeaknessMap(resultsHistory, child.id);
  const taskStats = buildRecentTaskStats(resultsHistory, child.id);
  const enabledModules = MODULE_ORDER.filter(
    (moduleName) =>
      child.enabledModules.includes(moduleName) &&
      settings.moduleToggles?.[moduleName] !== false,
  );

  const count = Math.max(
    4,
    Math.min(settings.dailyTaskCount || enabledModules.length, enabledModules.length),
  );

  const modulesForToday = enabledModules.slice(0, count);
  const tasks = modulesForToday
    .map((moduleName, index) =>
      pickTaskVariant(
        moduleName,
        child,
        settings,
        weaknessMap,
        taskStats,
        dateKey,
        index,
      ),
    )
    .filter(Boolean)
    .map((task, index) =>
      cloneTask(modulesForToday[index], task, child.id, dateKey),
    );

  return {
    id: `${dateKey}:${child.id}`,
    date: dateKey,
    childId: child.id,
    totalStars: 0,
    completionPercent: 0,
    streakAwarded: false,
    tasks,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}
