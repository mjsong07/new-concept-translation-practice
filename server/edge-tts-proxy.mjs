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
import { createHash, randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { existsSync } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import WebSocket from "ws";

const PORT = Number(process.env.PORT || 8760);
const TOKEN = "6A5AA1D4EAFF4E9FB37E23D68491D6F4";
const SEC_MS_GEC_VERSION = "1-143.0.3650.75";
const WIN_EPOCH = 11644473600;
const WSS_BASE =
  "wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1";
const DIST_DIR = fileURLToPath(new URL("../dist", import.meta.url));

// 精选的微软英语神经音色（供声音下拉/性别映射使用）。
const EDGE_VOICES = [
  { voice: "en-GB-SoniaNeural", name: "Sonia (British, female)", gender: "female" },
  { voice: "en-GB-RyanNeural", name: "Ryan (British, male)", gender: "male" },
  { voice: "en-GB-LibbyNeural", name: "Libby (British, female)", gender: "female" },
  { voice: "en-US-JennyNeural", name: "Jenny (American, female)", gender: "female" },
  { voice: "en-US-GuyNeural", name: "Guy (American, male)", gender: "male" },
  { voice: "en-US-AriaNeural", name: "Aria (American, female)", gender: "female" },
  { voice: "en-US-ChristopherNeural", name: "Christopher (American, male)", gender: "male" },
  { voice: "en-AU-NatashaNeural", name: "Natasha (Australian, female)", gender: "female" },
  { voice: "en-AU-WilliamNeural", name: "William (Australian, male)", gender: "male" }
];

function secMsGec() {
  let ticks = Math.floor(Date.now() / 1000) + WIN_EPOCH;
  ticks -= ticks % 300; // 向下取整到 5 分钟
  ticks *= 1e7; // 转为 Windows 文件时间（100ns 间隔）
  return createHash("sha256").update(`${Math.round(ticks)}${TOKEN}`, "ascii")
    .digest("hex").toUpperCase();
}

function connectId() {
  return randomUUID().replaceAll("-", "");
}

function dateStr() {
  return new Date().toUTCString().replace("GMT", "GMT+0000 (Coordinated Universal Time)");
}

function xmlEscape(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function clampNum(raw, min, max, fallback) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

/** 通过 Edge Read Aloud WebSocket 合成一段语音，返回音频字节与 WordBoundary 元数据。 */
function synthesize(text, voice, ratePercent, volumePercent) {
  const url =
    `${WSS_BASE}?TrustedClientToken=${TOKEN}&ConnectionId=${connectId()}` +
    `&Sec-MS-GEC=${secMsGec()}&Sec-MS-GEC-Version=${SEC_MS_GEC_VERSION}`;
  const headers = {
    Origin: "chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold",
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0",
    Pragma: "no-cache",
    "Cache-Control": "no-cache",
    Cookie: `muid=${randomUUID().replaceAll("-", "").toUpperCase()};`
  };

  return new Promise((resolve, reject) => {
    const audioChunks = [];
    const boundaries = [];
    const ws = new WebSocket(url, { headers, handshakeTimeout: 10000 });

    const fail = (err) => {
      try { ws.terminate(); } catch { /* ignore */ }
      reject(err);
    };

    ws.on("open", () => {
      const ts = dateStr();
      ws.send(
        `X-Timestamp:${ts}\r\nContent-Type:application/json; charset=utf-8\r\n` +
          `Path:speech.config\r\n\r\n` +
          `{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":"false","wordBoundaryEnabled":"true"},"outputFormat":"audio-24khz-48kbitrate-mono-mp3"}}}}`
      );
      ws.send(
        `X-RequestId:${connectId()}\r\nContent-Type:application/ssml+xml\r\n` +
          `X-Timestamp:${ts}Z\r\nPath:ssml\r\n\r\n` +
          `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'>` +
          `<voice name='${voice}'><prosody pitch='+0Hz' rate='${ratePercent}%' volume='${volumePercent}%'>` +
          `${xmlEscape(text)}</prosody></voice></speak>`
      );
    });

    ws.on("message", (data, isBinary) => {
      if (!isBinary) {
        const str = data.toString();
        const headEnd = str.indexOf("\r\n\r\n");
        if (headEnd < 0) return;
        const head = str.slice(0, headEnd);
        const body = str.slice(headEnd + 4);
        const path = (head.match(/^Path:(.*)$/m) || [])[1];
        if (path === "audio.metadata") {
          try {
            const meta = JSON.parse(body);
            for (const o of meta.Metadata || []) {
              if (o.Type === "WordBoundary") {
                boundaries.push({
                  text: o.Data?.text?.Text || "",
                  offset: o.Data?.Offset ?? 0,
                  duration: o.Data?.Duration ?? 0
                });
              }
            }
          } catch { /* 忽略无法解析的元数据 */ }
        } else if (path === "turn.end") {
          ws.close();
        }
        return;
      }
      if (data.length < 2) return;
      const headerLength = data.readUInt16BE(0);
      if (headerLength > data.length) return;
      const head = data.subarray(2, headerLength + 2).toString("latin1");
      const payload = data.subarray(headerLength + 2);
      if (/^Path:audio/m.test(head) && payload.length) audioChunks.push(payload);
    });

    ws.on("error", (err) => fail(err));
    ws.on("close", () => {
      if (!audioChunks.length) {
        fail(new Error("Edge TTS 未返回音频（可能服务繁忙或被限流）"));
        return;
      }
      resolve({ audio: Buffer.concat(audioChunks), boundaries });
    });
  });
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
    const voice = EDGE_VOICES.some((v) => v.voice === url.searchParams.get("voice"))
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
