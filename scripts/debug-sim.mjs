#!/usr/bin/env node
// Trace the live snowboard sim — samples window.__st on the dev page and
// prints state so a stuck/dead start shows its cause. Needs `npm run dev`
// running (or --url). Usage: node scripts/debug-sim.mjs [--seconds 15]
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const arg = (n, d) => {
  const i = process.argv.indexOf(n);
  return i > -1 ? process.argv[i + 1] : d;
};
const SECS = Number(arg("--seconds", 15));
const base = arg("--url", "http://localhost:5173");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const dir = mkdtempSync(join(tmpdir(), "sb-debug-"));
const procs = [];
const kill = () => {
  for (const p of procs) try { p.kill("SIGKILL"); } catch {}
  rmSync(dir, { recursive: true, force: true });
};
process.on("exit", kill);
process.on("SIGINT", () => process.exit(1));

for (let i = 0; i < 100; i++) {
  try {
    if ((await fetch(base)).ok) break;
  } catch {}
  await sleep(200);
  if (i === 99) throw new Error(`no server at ${base} — run npm run dev first`);
}

const profile = join(dir, "profile");
const chrome = spawn(
  CHROME,
  [
    "--headless=new",
    "--remote-debugging-port=0",
    `--user-data-dir=${profile}`,
    "--no-first-run",
    "--window-size=1440,900",
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

const TAKES = Number(arg("--takes", 1));
const HOLD = arg("--hold", "0"); // "0" never, "1" always, "pilot" air-dive
for (let take = 1; take <= TAKES; take++) {
  await cdp("Page.navigate", { url: `${base}/snowboard/game` });
  for (let i = 0; i < 100; i++) {
    const ok = await evalJs(
      `!!(document.querySelector(".game canvas") && window.__st)`
    ).catch(() => false);
    if (ok) break;
    await sleep(200);
    if (i === 99) throw new Error("game canvas never mounted");
  }
  await sleep(700);

  // sample the sim; --hold 1 rides with space held from the start
  const rows = await evalJs(`(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const key = (t) =>
      window.dispatchEvent(new KeyboardEvent(t, { code: "Space", key: " ", cancelable: true }));
    if (${HOLD === "1"})
      key("keydown");
    let held = false;
    const pilot = ${HOLD === "pilot"} ? setInterval(() => {
      const st = window.__st;
      if (!st) return;
      const want = st.ground ? false : st.spin > 0 ? st.spin < Math.PI : true;
      if (want !== held) { held = want; key(held ? "keydown" : "keyup"); }
    }, 40) : null;
    const out = [];
    const t0 = performance.now();
    while (performance.now() - t0 < ${SECS} * 1000) {
      const st = window.__st;
      if (st) out.push({
        ms: Math.round(performance.now() - t0),
        t: +st.t.toFixed(2), x: +(st.x - st.start).toFixed(1),
        vx: +st.vx.toFixed(1), vy: +st.vy.toFixed(1),
        ground: st.ground, held: st.held, spin: +st.spin.toFixed(2),
        spinV: +st.spinV.toFixed(1), over: st.over, death: st.death,
        fx: st.fx?.text ?? null, intro: +st.intro.toFixed(2),
      });
      await sleep(120);
    }
    if (pilot) clearInterval(pilot);
    key("keyup");
    return out;
  })()`, true);

  const last = rows[rows.length - 1] ?? {};
  const dead = rows.find((r) => r.over);
  const stuck = rows.filter(
    (r, i) => i > 10 && r.ground && !r.over && r.vx < 9
  ).length;
  console.log(
    `take ${take}: ${rows.length ? `dist ${last.x}m vx ${last.vx}` : "no samples"} ` +
      (dead ? `DEAD "${dead.death}" at t=${dead.t} x=${dead.x}` : last.over ? `over "${last.death}"` : "alive") +
      (stuck ? ` — ${stuck} slow-crawl samples` : "")
  );
  if (dead) {
    const i = rows.indexOf(dead);
    for (const r of rows.slice(Math.max(0, i - 4), i + 1)) console.log("  " + JSON.stringify(r));
  }
  if (TAKES === 1) for (const r of rows) console.log(JSON.stringify(r));
}
