/**
 * Microsoft Edge TTS 合成核心（与 HTTP 代理解耦，供 server/edge-tts-proxy.mjs
 * 与 scripts/generate-audio.mjs 复用）。
 *
 * Edge 在线朗读接口（speech.platform.bing.com）要求握手 Origin 必须为
 * chrome-extension://…，浏览器无法伪造，因此由 Node 端完成 WebSocket
 * 连接（带正确 Origin / User-Agent / muid 等头）。
 */
import { createHash, randomUUID } from "node:crypto";
import WebSocket from "ws";

const TOKEN = "6A5AA1D4EAFF4E9FB37E23D68491D6F4";
const SEC_MS_GEC_VERSION = "1-143.0.3650.75";
const WIN_EPOCH = 11644473600;
const WSS_BASE =
  "wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1";

// 精选的微软英语神经音色（供声音下拉/性别映射使用）。
export const EDGE_VOICES = [
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

export function isKnownVoice(voice) {
  return EDGE_VOICES.some((v) => v.voice === voice);
}

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

/** 通过 Edge Read Aloud WebSocket 合成一段语音，返回音频字节与 WordBoundary 元数据。 */
export function synthesize(text, voice, ratePercent = 0, volumePercent = 0) {
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
