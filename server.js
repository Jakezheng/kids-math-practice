import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.join(__dirname, "public");
const port = Number(process.env.PORT || 3000);

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".onnx": "application/octet-stream",
  ".svg": "image/svg+xml",
  ".wasm": "application/wasm",
};

function getContentType(filePath) {
  return contentTypes[path.extname(filePath).toLowerCase()] || "application/octet-stream";
}

function resolveFilePath(urlPath) {
  const normalizedPath = decodeURIComponent(urlPath.split("?")[0]);
  const trimmedPath = normalizedPath === "/" ? "/index.html" : normalizedPath;
  const candidatePath = path.normalize(path.join(publicDir, trimmedPath));

  if (!candidatePath.startsWith(publicDir)) {
    return null;
  }

  return candidatePath;
}

const server = createServer(async (req, res) => {
  const filePath = resolveFilePath(req.url || "/");

  if (!filePath) {
    res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Forbidden");
    return;
  }

  try {
    const data = await readFile(filePath);
    res.writeHead(200, { "Content-Type": getContentType(filePath) });
    res.end(data);
  } catch {
    const wantsHtml = !path.extname(filePath);

    if (wantsHtml) {
      try {
        const indexPath = path.join(publicDir, "index.html");
        const data = await readFile(indexPath);
        res.writeHead(200, { "Content-Type": getContentType(indexPath) });
        res.end(data);
        return;
      } catch {}
    }

    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Kids Math Practice running at http://127.0.0.1:${port}/`);
});
