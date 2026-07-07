import express from "express";
import http from "node:http";
import https from "node:https";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  getChildProfiles,
  getTodayAssignment,
  recordTaskAnswer,
  recordTaskCompletion,
  saveTaskRecording,
  getParentDashboard,
  updateChildDifficulty,
  updateParentSettings,
  verifyParentPassword,
} from "./src/store.js";
import { buildSystemInfo, getHttpsConfig } from "./src/system.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const rootDir = __dirname;
const httpPort = Number(process.env.PORT || 3000);
const httpsPort = Number(process.env.HTTPS_PORT || 3443);
const httpsConfig = getHttpsConfig(rootDir);
const rootCertPath = httpsConfig?.rootCertPath ?? null;

app.use(express.json({ limit: "15mb" }));
app.use(express.static(path.join(__dirname, "public")));
app.use("/recordings", express.static(path.join(__dirname, "recordings")));

app.get("/downloads/lan-root.cer", (_req, res) => {
  if (!rootCertPath) {
    res.status(404).json({ error: "Root certificate not available" });
    return;
  }

  res.download(rootCertPath, "lan-root.cer");
});

app.get("/api/children", (_req, res) => {
  res.json({ children: getChildProfiles() });
});

app.get("/api/children/:childId/today", (req, res) => {
  const assignment = getTodayAssignment(req.params.childId);

  if (!assignment) {
    res.status(404).json({ error: "Child not found" });
    return;
  }

  res.json({ assignment });
});

app.post("/api/tasks/:taskId/answer", (req, res) => {
  const { childId, answer, durationSec } = req.body;
  const result = recordTaskAnswer({
    childId,
    taskId: req.params.taskId,
    answer,
    durationSec,
  });

  if (!result) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  res.json(result);
});

app.post("/api/tasks/:taskId/complete", (req, res) => {
  const { childId, durationSec } = req.body;
  const result = recordTaskCompletion({
    childId,
    taskId: req.params.taskId,
    durationSec,
  });

  if (!result) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  res.json(result);
});

app.post("/api/tasks/:taskId/recording", (req, res) => {
  const { childId, audioBase64, mimeType } = req.body;
  const result = saveTaskRecording({
    childId,
    taskId: req.params.taskId,
    audioBase64,
    mimeType,
  });

  if (!result) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  res.json(result);
});

app.post("/api/parent/login", (req, res) => {
  const { password } = req.body;
  const ok = verifyParentPassword(password);
  res.json({ ok });
});

app.get("/api/parent/dashboard", (_req, res) => {
  res.json(getParentDashboard());
});

app.post("/api/parent/children/:childId/difficulty", (req, res) => {
  const { difficulty } = req.body;
  const child = updateChildDifficulty(req.params.childId, difficulty);

  if (!child) {
    res.status(404).json({ error: "Child not found" });
    return;
  }

  res.json({ child });
});

app.post("/api/parent/settings", (req, res) => {
  const { dailyTaskCount, difficultyPreference, password, moduleToggles } = req.body;
  const settings = updateParentSettings({
    dailyTaskCount,
    difficultyPreference,
    password,
    moduleToggles,
  });

  res.json({ settings });
});

app.get("/api/system/info", (_req, res) => {
  res.json(
    buildSystemInfo({
      httpPort,
      httpsPort,
      httpsEnabled: Boolean(httpsConfig),
      rootCertAvailable: Boolean(rootCertPath),
    }),
  );
});

app.get("/api/system/ping", (_req, res) => {
  res.json({
    ok: true,
    serverTime: new Date().toISOString(),
    port: httpPort,
  });
});

app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

http.createServer(app).listen(httpPort, "0.0.0.0", () => {
  const info = buildSystemInfo({
    httpPort,
    httpsPort,
    httpsEnabled: Boolean(httpsConfig),
    rootCertAvailable: Boolean(rootCertPath),
  });
  console.log(`Home learning app running on ${info.localUrl}`);
  for (const url of info.lanUrls) {
    console.log(`LAN access: ${url}`);
  }
  if (!httpsConfig) {
    console.log("HTTPS not enabled. Run npm run setup:https for iPad microphone support.");
  }
});

if (httpsConfig) {
  https
    .createServer(
      httpsConfig.kind === "pfx"
        ? {
            pfx: httpsConfig.pfx,
            passphrase: httpsConfig.passphrase,
          }
        : {
            key: httpsConfig.key,
            cert: httpsConfig.cert,
          },
      app,
    )
    .listen(httpsPort, "0.0.0.0", () => {
      const info = buildSystemInfo({
        httpPort,
        httpsPort,
        httpsEnabled: true,
        rootCertAvailable: Boolean(rootCertPath),
      });
      console.log(`HTTPS ready on ${info.localHttpsUrl}`);
      for (const url of info.lanHttpsUrls) {
        console.log(`HTTPS LAN access: ${url}`);
      }
    });
}
