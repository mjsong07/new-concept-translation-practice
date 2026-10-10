/**
 * Microsoft Edge TTS 代理服务。
 *
 * Edge 在线朗读接口（speech.platform.bing.com）要求握手 Origin 必须为
 * chrome-extension://…，浏览器无法伪造，因此需要本代理在后台完成 WebSocket
 * 连接（带正确 Origin / User-Agent / muid 等头），并把合成结果以 HTTP 暴露给
 * 前端 App 播放。
 *
 * 端点：
 *   GET /tts?text=…&voice=…&rate=…&volume=…  → JSON { audio: <mp3 base64>, boundaries: [{text,offset,duration}] }
 *   GET /voices                               → JSON [ {voice, name, gender} ... ]（精选英语音色）
 *   其他路径 → 若存在 dist/ 则按静态站点提供（便于平板同源访问）。
 *
 * 启动：node server/edge-tts-proxy.mjs   （可用 PORT 环境变量改端口，默认 8760）
 */
import { createServer } from "node:http";
import { existsSync } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { EDGE_VOICES, isKnownVoice, synthesize } from "./edge-tts-synth.mjs";

const PORT = Number(process.env.PORT || 8760);
const DIST_DIR = fileURLToPath(new URL("../dist", import.meta.url));

function clampNum(raw, min, max, fallback) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".mp3": "audio/mpeg",
  ".webmanifest": "application/manifest+json"
};

const server = createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "*");
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);

  if (url.pathname === "/tts") {
    const text = (url.searchParams.get("text") || "").slice(0, 3000);
    const voice = isKnownVoice(url.searchParams.get("voice"))
      ? url.searchParams.get("voice")
      : "en-GB-SoniaNeural";
    const rate = clampNum(url.searchParams.get("rate"), -100, 100, 0);
    const volume = clampNum(url.searchParams.get("volume"), -100, 0, 0);
    if (!text.trim()) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "text 不能为空" }));
      return;
    }
    try {
      const { audio, boundaries } = await synthesize(text, voice, rate, volume);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ audio: audio.toString("base64"), boundaries }));
    } catch (e) {
      res.writeHead(502, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: String((e && e.message) || e) }));
    }
    return;
  }

  if (url.pathname === "/voices") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(EDGE_VOICES));
    return;
  }

  // 静态站点（dist）——便于平板在局域网内直接访问同一进程。
  if (existsSync(DIST_DIR)) {
    try {
      let filePath = url.pathname === "/" ? "/index.html" : url.pathname;
      let target = normalize(join(DIST_DIR, filePath));
      if (!target.startsWith(DIST_DIR)) throw new Error("forbidden");
      if (!(await stat(target)).isFile()) target = join(DIST_DIR, "index.html");
      const body = await readFile(target);
      res.writeHead(200, { "Content-Type": MIME[extname(target)] || "application/octet-stream" });
      res.end(body);
      return;
    } catch {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not found");
      return;
    }
  }

  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("Not found");
});

server.listen(PORT, () => {
  console.log(`Edge TTS 代理已启动：http://localhost:${PORT}（/tts、/voices，并托管 dist/）`);
});
