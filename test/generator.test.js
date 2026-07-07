import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { generateAssignment } from "../src/generator.js";
import { buildSystemInfo } from "../src/system.js";

test("generateAssignment creates one task per enabled module within configured count", () => {
  const assignment = generateAssignment({
    child: {
      id: "kid-k",
      enabledModules: ["phonics", "sightWords", "reading", "writing", "math"],
      targetDifficulty: "easier",
    },
    dateKey: "2026-06-29",
    settings: {
      dailyTaskCount: 5,
      difficultyPreference: "normal",
      moduleToggles: {
        phonics: true,
        sightWords: true,
        reading: true,
        writing: true,
        math: true,
      },
    },
    resultsHistory: [],
  });

  assert.equal(assignment.tasks.length, 5);
  assert.deepEqual(
    assignment.tasks.map((task) => task.module),
    ["phonics", "sightWords", "reading", "writing", "math"],
  );
});

test("generateAssignment prefers weak-skill task variants when history shows low mastery", () => {
  const assignment = generateAssignment({
    child: {
      id: "kid-g1",
      enabledModules: ["phonics"],
      targetDifficulty: "normal",
    },
    dateKey: "2026-06-29",
    settings: {
      dailyTaskCount: 4,
      difficultyPreference: "normal",
      moduleToggles: {
        phonics: true,
      },
    },
    resultsHistory: [
      {
        childId: "kid-g1",
        correctRate: 0,
        weaknessTags: ["digraphs"],
      },
    ],
  });

  assert.equal(assignment.tasks[0].weaknessTags[0], "digraphs");
});

test("generateAssignment respects module toggles and challenge difficulty", () => {
  const assignment = generateAssignment({
    child: {
      id: "kid-g1",
      enabledModules: ["phonics", "sightWords"],
      targetDifficulty: "normal",
    },
    dateKey: "2026-06-29",
    settings: {
      dailyTaskCount: 5,
      difficultyPreference: "challenge",
      moduleToggles: {
        phonics: true,
        sightWords: false,
      },
    },
    resultsHistory: [],
  });

  assert.equal(assignment.tasks.length, 1);
  assert.equal(assignment.tasks[0].module, "phonics");
  assert.equal(assignment.tasks[0].difficulty, "challenge");
});

test("generateAssignment rotates equal-strength content across days", () => {
  const build = (dateKey) =>
    generateAssignment({
      child: {
        id: "kid-k",
        enabledModules: ["sightWords"],
        targetDifficulty: "normal",
      },
      dateKey,
      settings: {
        dailyTaskCount: 4,
        difficultyPreference: "normal",
        moduleToggles: {
          sightWords: true,
        },
      },
      resultsHistory: [],
    });

  const dayOne = build("2026-06-29");
  const dayTwo = build("2026-06-30");

  assert.notEqual(dayOne.tasks[0].prompt, dayTwo.tasks[0].prompt);
});

test("store exposes today's recordings in the parent dashboard", async () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "kids-app-"));
  const dataDir = path.join(tempRoot, "data");
  const recordingsDir = path.join(tempRoot, "recordings");
  process.env.KIDS_APP_DATA_DIR = dataDir;
  process.env.KIDS_APP_RECORDINGS_DIR = recordingsDir;

  try {
    const storeModule = await import(
      `${pathToFileURL(path.join(process.cwd(), "src", "store.js")).href}?recording-test=${Date.now()}`
    );

    const assignment = storeModule.getTodayAssignment("kid-k");
    const readingTask = assignment.tasks.find((task) => task.format === "recording");
    assert.ok(readingTask);

    const saved = storeModule.saveTaskRecording({
      childId: "kid-k",
      taskId: readingTask.id,
      audioBase64: Buffer.from("test-audio").toString("base64"),
      mimeType: "audio/mp4",
    });

    assert.equal(saved.task.recordingPath.endsWith(".m4a"), true);

    const dashboard = storeModule.getParentDashboard();
    const child = dashboard.children.find((entry) => entry.id === "kid-k");
    const recordingEntry = child.todayRecordings.find(
      (entry) => entry.taskId === readingTask.id,
    );

    assert.ok(recordingEntry);
    assert.equal(recordingEntry.hasRecording, true);
    assert.equal(recordingEntry.recordingPath.endsWith(".m4a"), true);
  } finally {
    delete process.env.KIDS_APP_DATA_DIR;
    delete process.env.KIDS_APP_RECORDINGS_DIR;
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test("store repeats weak content on the next day after an incorrect answer", async () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "kids-app-"));
  const dataDir = path.join(tempRoot, "data");
  const recordingsDir = path.join(tempRoot, "recordings");
  process.env.KIDS_APP_DATA_DIR = dataDir;
  process.env.KIDS_APP_RECORDINGS_DIR = recordingsDir;
  process.env.KIDS_APP_TODAY = "2026-06-29";

  try {
    const storeModule = await import(
      `${pathToFileURL(path.join(process.cwd(), "src", "store.js")).href}?weak-repeat-test=${Date.now()}`
    );

    storeModule.updateChildDifficulty("kid-g1", "challenge");
    const dayOne = storeModule.getTodayAssignment("kid-g1");
    const phonicsTask = dayOne.tasks.find((task) => task.module === "phonics");
    assert.ok(phonicsTask);
    assert.equal(phonicsTask.weaknessTags.includes("digraphs"), true);

    const wrongAnswer = phonicsTask.options.find(
      (option) => option !== phonicsTask.answer,
    );
    storeModule.recordTaskAnswer({
      childId: "kid-g1",
      taskId: phonicsTask.id,
      answer: wrongAnswer,
      durationSec: 45,
    });

    process.env.KIDS_APP_TODAY = "2026-06-30";
    const dayTwo = storeModule.getTodayAssignment("kid-g1");
    const nextPhonicsTask = dayTwo.tasks.find((task) => task.module === "phonics");

    assert.ok(nextPhonicsTask);
    assert.equal(nextPhonicsTask.weaknessTags.includes("digraphs"), true);
    assert.notEqual(dayOne.id, dayTwo.id);
  } finally {
    delete process.env.KIDS_APP_DATA_DIR;
    delete process.env.KIDS_APP_RECORDINGS_DIR;
    delete process.env.KIDS_APP_TODAY;
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test("buildSystemInfo returns localhost and LAN deployment metadata", () => {
  const info = buildSystemInfo({
    httpPort: 3000,
    httpsPort: 3443,
    httpsEnabled: false,
    rootCertAvailable: false,
  });

  assert.equal(info.localUrl, "http://127.0.0.1:3000");
  assert.equal(info.httpPort, 3000);
  assert.equal(info.httpsEnabled, false);
  assert.equal(info.rootCertUrl, null);
  assert.equal(Array.isArray(info.lanUrls), true);
  assert.equal(Array.isArray(info.notes), true);
  assert.equal(info.notes.length >= 2, true);
});
