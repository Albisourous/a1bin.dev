#!/usr/bin/env node
// Record real gameplay of /snowboard/game → public/snowboard-game.mp4, the
// clip the og:video tags point at for share previews (iMessage etc).
//
// Zero-dep CDP driver: headless Chrome loads the page, in-page JS records
// the game canvas via captureStream + MediaRecorder while an autopilot reads
// the dev-only window.__st sim hook (Snowboard.jsx) and plays. Takes come out
// as webm; ffmpeg transcodes the best one to h264 mp4.
//
// Usage: npm run record:game
//   --url http://localhost:5173   skip spawning a dev server
//   --seconds 20                  clip length per take
//   --takes 2                     page loads; longest run wins
//   --out public/snowboard-game.mp4
import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const arg = (n, d) => {
  const i = process.argv.indexOf(n);
  return i > -1 ? process.argv[i + 1] : d;
};
const SECS = Number(arg("--seconds", 20));
const TAKES = Number(arg("--takes", 2));
const OUT = arg("--out", "public/snowboard-game.mp4");
const PAGE = "snowboard/game";
const PORT = 5199;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const dir = mkdtempSync(join(tmpdir(), "sb-record-"));
const procs = [];
const kill = () => {
  for (const p of procs) try { p.kill("SIGKILL"); } catch {}
  rmSync(dir, { recursive: true, force: true });
};
process.on("exit", kill);
process.on("SIGINT", () => process.exit(1));

// --- dev server (skipped with --url) --------------------------------------
let base = arg("--url", null);
if (!base) {
  base = `http://localhost:${PORT}`;
  const vite = spawn("npx", ["vite", "--port", String(PORT), "--strictPort"], {
    stdio: "ignore",
  });
  procs.push(vite);
}
for (let i = 0; i < 100; i++) {
  try {
    if ((await fetch(base)).ok) break;
  } catch {}
  await sleep(200);
  if (i === 99) throw new Error(`no server at ${base}`);
}

// --- headless Chrome over CDP ----------------------------------------------
const profile = join(dir, "profile");
const chrome = spawn(
  CHROME,
  [
    "--headless=new",
    "--remote-debugging-port=0",
    `--user-data-dir=${profile}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--window-size=1440,900",
    "--force-device-scale-factor=2",
    "--mute-audio",
    "about:blank",
  ],
  { stdio: "ignore" }
);
procs.push(chrome);

let port = 0;
const portFile = join(profile, "DevToolsActivePort");
for (let i = 0; i < 100 && !port; i++) {
  if (existsSync(portFile)) port = Number(readFileSync(portFile, "utf8").split("\n")[0]);
  else await sleep(100);
}
if (!port) throw new Error("chrome DevToolsActivePort never appeared");
const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
const page = targets.find((t) => t.type === "page");
if (!page) throw new Error("no page target");

const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r, j) => ((ws.onopen = r), (ws.onerror = j)));
let seq = 0;
const pend = new Map();
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (!m.id || !pend.has(m.id)) return;
  const { res, rej } = pend.get(m.id);
  pend.delete(m.id);
  m.error ? rej(new Error(m.error.message)) : res(m.result);
};
const cdp = (method, params = {}) =>
  new Promise((res, rej) => {
    const id = ++seq;
    pend.set(id, { res, rej });
    ws.send(JSON.stringify({ id, method, params }));
  });
const evalJs = async (expression, awaitPromise = false) => {
  const r = await cdp("Runtime.evaluate", {
    expression,
    awaitPromise,
    returnByValue: true,
    timeout: (SECS + 30) * 1000,
  });
  if (r.exceptionDetails)
    throw new Error(r.exceptionDetails.exception?.description ?? "page eval failed");
  return r.result.value;
};

// Runs inside the page: fullscreen the game, stub out score/metrics posts
// (recorded runs must not touch the real board), record the canvas, play it
// via synthetic Space keydown/up driven by the live sim state.
const recordExpr = `(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const wrap = document.querySelector(".game");
  const canvas = wrap?.querySelector("canvas");
  if (!canvas) return { err: "no canvas" };
  const of = window.fetch;
  window.fetch = (u, ...a) =>
    /\\/api\\/(scores|metrics)/.test(String(u?.url ?? u))
      ? Promise.resolve(new Response("[]", { status: 200, headers: { "content-type": "application/json" } }))
      : of(u, ...a);
  wrap.style.cssText += ";position:fixed;inset:0;z-index:9999";
  await sleep(500); // let the ResizeObserver resize the canvas to the viewport
  const mime = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"]
    .find((m) => MediaRecorder.isTypeSupported(m));
  const rec = new MediaRecorder(canvas.captureStream(60), {
    mimeType: mime,
    videoBitsPerSecond: 16000000,
  });
  const parts = [];
  rec.ondataavailable = (e) => e.data.size && parts.push(e.data);
  rec.start(250);
  const key = (t) =>
    window.dispatchEvent(new KeyboardEvent(t, { code: "Space", key: " ", cancelable: true }));
  let held = false;
  // On snow always release — holding just carves speed away. In the air
  // hold to dive for speed and wind up a flip; once past half a turn the
  // board carries through, so let go and it snaps level for the landing.
  const pilot = setInterval(() => {
    const st = window.__st;
    if (!st) return;
    const want = st.ground ? false : st.spin > 0 ? st.spin < Math.PI : true;
    if (want !== held) { held = want; key(held ? "keydown" : "keyup"); }
  }, 40);
  await sleep(${SECS} * 1000);
  clearInterval(pilot);
  key("keyup");
  const st = window.__st;
  const stats = {
    dist: st ? Math.floor(st.x - st.start) : 0,
    over: !!st?.over, death: st?.death ?? null,
    w: canvas.width, h: canvas.height,
  };
  rec.stop();
  await new Promise((r) => (rec.onstop = r));
  const buf = new Uint8Array(await new Blob(parts).arrayBuffer());
  let bin = "";
  for (let i = 0; i < buf.length; i += 0x8000)
    bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return { stats, b64: btoa(bin) };
})()`;

// --- takes ------------------------------------------------------------------
let best = null;
for (let take = 1; take <= TAKES; take++) {
  await cdp("Page.navigate", { url: `${base}/${PAGE}` });
  for (let i = 0; i < 100; i++) {
    const ok = await evalJs(
      `!!(document.querySelector(".game canvas") && window.__st)`
    ).catch(() => false);
    if (ok) break;
    await sleep(200);
    if (i === 99) throw new Error("game canvas never mounted");
  }
  await sleep(700); // fonts + first paint
  const r = await evalJs(recordExpr, true);
  if (r.err) throw new Error(r.err);
  const f = join(dir, `take${take}.webm`);
  writeFileSync(f, Buffer.from(r.b64, "base64"));
  console.log(`take ${take}: ${r.stats.dist}m ${r.stats.over ? `(${r.stats.death})` : "(still riding)"} ${r.stats.w}x${r.stats.h}`);
  if (!best || r.stats.dist > best.stats.dist) best = { f, stats: r.stats };
}

// --- encode ------------------------------------------------------------------
// crop to the rider's quarter of the canvas — the camera anchors them
// around 25%/45%, and a share bubble is small, so tight beats full frame
execFileSync("ffmpeg", [
  "-y", "-i", best.f,
  "-vf", "crop=iw*0.58:ih*0.62:0:ih*0.14,scale=1200:-2",
  "-c:v", "libx264", "-preset", "slow", "-crf", "20",
  "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-an",
  OUT,
]);
const probe = execFileSync("ffprobe", [
  "-v", "error", "-select_streams", "v:0",
  "-show_entries", "stream=width,height", "-of", "csv=p=0", OUT,
]).toString().trim();
console.log(`wrote ${OUT} (${probe}) — best take ${best.stats.dist}m`);
