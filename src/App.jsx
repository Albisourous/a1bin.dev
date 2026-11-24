import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { SITE } from "./content/site.js";
import { trackEvent } from "./lib/metrics.js";
import TitleBar from "./components/ide/TitleBar.jsx";
import ActivityBar from "./components/ide/ActivityBar.jsx";
import Explorer from "./components/ide/Explorer.jsx";
import Editor from "./components/ide/Editor.jsx";
import Chat from "./components/ide/Chat.jsx";
import Terminal from "./components/ide/Terminal.jsx";
import StatusBar from "./components/ide/StatusBar.jsx";
import ResizeHandle from "./components/ide/ResizeHandle.jsx";

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const MOBILE_Q = "(max-width: 860px)";

// iOS Safari drops touches inside iframes when the top document has no
// touch handler on the iframe's ancestor chain (WebKit bug 128924) —
// the app binds none, so the game tab is untappable on phones. One
// listener on .ide (parent of both play iframes) marks the region.
// React's delegated onTouchStart only registers at the root container,
// so this binds a real element-level listener via ref.
const bindIosIframeTouch = (el) => {
  el?.addEventListener("touchstart", () => {});
};
const startsMobile = () => window.matchMedia(MOBILE_Q).matches;

// Live media-query flag — drives the mobile stacked layout.
function useMedia(query) {
  const [m, setM] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const fn = () => setM(mq.matches);
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, [query]);
  return m;
}

// URL → file, reverse of SITE.urls. Lowercase so /readme.md works.
const byPath = {};
for (const [name, p] of Object.entries(SITE.urls)) {
  byPath[`/${p}`.toLowerCase()] = name;
}

// Deep link — /README.md, /snowboard/game, or any explorer file path
// (.txt may be dropped) boots straight into that tab instead of the
// default landing view. Basename alone works too (/game).
const resolve = (pathname) => {
  const path = decodeURIComponent(pathname).replace(/\/+$/, "");
  if (!path) return null;
  if (path.toLowerCase() === "/snowboard") return SITE.gameFile;
  const hit = byPath[path.toLowerCase()] ?? byPath[`${path.toLowerCase()}.txt`];
  if (hit) return hit;
  const base = path.split("/").pop();
  // Pseudo-tabs match the whole path — a basename can't hold "A/B".
  const pseudo = [SITE.graphTab, SITE.metricsTab, SITE.abTab].find(
    (t) => path.toLowerCase() === `/${t.toLowerCase()}`
  );
  if (pseudo) return pseudo;
  return (
    [base, `${base}.txt`].find((f) => SITE.contents[f] || SITE.pdfs[f]) ?? null
  );
};
const boot = resolve(location.pathname);
// A play file deep link (/projects/pokestrike) boots into the split
// editor group — but only where a split makes sense (desktop).
const bootPlay =
  boot &&
  SITE.play[boot] &&
  (SITE.play[boot].open ?? (startsMobile() ? "tab" : "split")) === "split"
    ? boot
    : null;

// Tabs that render a component instead of file text — graph, metrics,
// a/b. None of them count as "the explorer is open".
const PSEUDO = new Set([SITE.graphTab, SITE.metricsTab, SITE.abTab]);

export default function App() {
  // Tab state: `tabs` is the tab bar order, `active` the focused tab.
  // The graph tab is a pseudo-file named SITE.graphTab.
  const [tabs, setTabs] = useState(
    boot && !bootPlay && !SITE.openTabs.includes(boot)
      ? [...SITE.openTabs, boot]
      : SITE.openTabs
  );
  const [active, setActive] = useState(
    boot && !bootPlay ? boot : SITE.activeTab
  );
  // In-session drafts: edits survive file switches but reset on reload.
  const [drafts, setDrafts] = useState({});
  // Side panel widths; the editor takes whatever space is left.
  const [explorerW, setExplorerW] = useState(210);
  const [chatW, setChatW] = useState(330);
  // On mobile the panels stack vertically, so chat resizes by height.
  const [chatH, setChatH] = useState(240);
  // Bottom terminal height — open by default like a real IDE.
  const [termH, setTermH] = useState(180);
  // Split editor group — play files open to the side of the main
  // editor, VS Code-style, so the current file stays put.
  const [split, setSplit] = useState(bootPlay);
  const [splitW, setSplitW] = useState(480);
  // Auto-fit bookkeeping: `sized` = a no-aspect entry got its one-time
  // max sizing; `manual` = the user dragged, so aspect-fit stands down.
  const splitSized = useRef(false);
  const splitManual = useRef(false);
  // The most the split column can take: viewport minus rail, explorer,
  // chat and a minimum main-editor column.
  const splitBound = () =>
    Math.max(
      240,
      window.innerWidth - 44 - explorerW - (chatOpen ? chatW : 0) - 240
    );
  // Chat and terminal start closed on mobile: editor gets the screen.
  // On desktop the terminal stays open — the prompt is part of the
  // landing view.
  const [chatOpen, setChatOpen] = useState(() => !startsMobile());
  const [termOpen, setTermOpen] = useState(() => !startsMobile());
  // Mobile has no explorer column — the icon toggles a drawer instead.
  const [explorerOpen, setExplorerOpen] = useState(false);
  const mobile = useMedia(MOBILE_Q);
  const text = drafts[active] ?? (SITE.contents[active] || []).join("\n");

  const open = (name) => {
    // Play files pick an open mode: the entry's `open` wins, else
    // desktop splits to the side and mobile opens a normal tab.
    if (SITE.play[name]) {
      splitManual.current = false; // fresh open refits to the app
      if ((SITE.play[name].open ?? (mobile ? "tab" : "split")) === "split") {
        return setSplit(name);
      }
    }
    setTabs((ts) => (ts.includes(name) ? ts : [...ts, name]));
    setActive(name);
  };
  const close = (name) => {
    if (name === SITE.graphTab) return; // graph is chrome, not a file
    const next = tabs.filter((t) => t !== name);
    setTabs(next);
    if (name === active) setActive(next[next.length - 1] ?? null);
  };
  // Drag reorder — insert `name` before `target`; null target appends.
  const move = (name, target) => {
    if (!name || name === target) return;
    setTabs((ts) => {
      const next = ts.filter((t) => t !== name);
      next.splice(target ? next.indexOf(target) : next.length, 0, name);
      return next;
    });
  };

  // Aspect-fit: an entry with a fixed logical ratio gets a column
  // exactly pane-height × aspect wide — the app fills it edge to edge.
  // Watched so terminal/window changes refit; a manual drag takes over.
  useLayoutEffect(() => {
    if (!split) return;
    const entry = SITE.play[split];
    const el = document.querySelector(".editor--split .editor__play");
    if (entry?.aspect && el) {
      const ro = new ResizeObserver(() => {
        if (!splitManual.current) {
          // +1 — the column's border-left sits inside the track.
          setSplitW(
            clamp(el.clientHeight * entry.aspect + 1, 240, splitBound())
          );
        }
      });
      ro.observe(el);
      return () => ro.disconnect();
    }
    if (!splitSized.current) {
      splitSized.current = true;
      setSplitW(splitBound());
    }
    // Panel resizes re-run this so the bound and the refit stay fresh.
  }, [split, explorerW, chatW, chatOpen]);

  // A pdf tab gaining focus = one "resume press" — explorer click,
  // file-link open, or a /Resume.pdf deep link all land here.
  useEffect(() => {
    if (SITE.pdfs[active]) trackEvent("resume");
  }, [active]);

  // Explorer rows and editor tabs are real anchors now — dropping one
  // on an unhandled target would navigate. Nothing on the page consumes
  // external drops, so swallow every drop that escapes a handled zone.
  useEffect(() => {
    const swallow = (e) => e.preventDefault();
    document.addEventListener("dragover", swallow);
    document.addEventListener("drop", swallow);
    return () => {
      document.removeEventListener("dragover", swallow);
      document.removeEventListener("drop", swallow);
    };
  }, []);

  // Canonical follows the active file for SEO. The URL itself never
  // changes on navigation — deep links are inbound only.
  useEffect(() => {
    const shown = split ?? active;
    const wanted = shown ? `/${SITE.urls[shown] ?? shown}` : "/";
    document.title = "Albin Shrestha — a1bin.dev";
    document
      .querySelector('link[rel="canonical"]')
      ?.setAttribute("href", `https://a1bin.dev${wanted}`);
  }, [active, split]);

  return (
    <div className="ide" ref={bindIosIframeTouch}>
      <TitleBar />
      <div
        className={`workbench${split ? " workbench--split" : ""}${chatOpen ? "" : " workbench--no-chat"}${
          termOpen ? "" : " workbench--no-term"
        }`}
        style={{
          "--explorer-w": `${explorerW}px`,
          "--chat-w": `${chatW}px`,
          "--split-w": `${splitW}px`,
          "--chat-h": `${chatH}px`,
          "--term-h": `${termH}px`,
        }}
      >
        <ActivityBar
          explorerActive={mobile ? explorerOpen : !PSEUDO.has(active)}
          onOpenExplorer={() => {
            if (mobile) return setExplorerOpen((o) => !o);
            // Explorer never closes — the icon only leaves pseudo-tab
            // views, returning to the most recent file tab.
            if (PSEUDO.has(active)) {
              open(
                [...tabs].reverse().find((t) => !PSEUDO.has(t)) ??
                  SITE.graphCenter
              );
            }
          }}
          graphActive={active === SITE.graphTab}
          onOpenGraph={() => open(SITE.graphTab)}
          metricsActive={active === SITE.metricsTab}
          onOpenMetrics={() => open(SITE.metricsTab)}
          abActive={active === SITE.abTab}
          onOpenAb={() => open(SITE.abTab)}
        />
        <Explorer
          drawer={explorerOpen}
          open={split ?? active}
          onOpen={(name) => {
            open(name);
            setExplorerOpen(false);
          }}
        />
        {explorerOpen && (
          <div
            className="explorer-scrim"
            onClick={() => setExplorerOpen(false)}
          />
        )}
        <ResizeHandle
          name="explorer"
          label="resize explorer"
          onDrag={(dx) => setExplorerW((w) => clamp(w + dx, 140, 480))}
        />
        <Editor
          tabs={tabs}
          active={active}
          onSelect={setActive}
          onClose={close}
          onMove={move}
          text={text}
          onEdit={(t) => setDrafts((d) => ({ ...d, [active]: t }))}
          onOpenFile={open}
        />
        <ResizeHandle
          name="chat"
          axis={mobile ? "y" : "x"}
          label="resize chat"
          onDrag={(d) =>
            mobile
              ? setChatH((h) => clamp(h - d, 120, 480))
              : setChatW((w) => clamp(w - d, 200, 600))
          }
        />
        {split && (
          <ResizeHandle
            name="split"
            label="resize split editor"
            onDrag={(d) => {
              splitManual.current = true;
              setSplitW((w) => clamp(w - d, 240, splitBound()));
            }}
          />
        )}
        {split && (
          <div className="editor editor--split">
            <div className="editor__tabbar">
              <button className="editor__tab is-open">
                {split}
                <span
                  className="editor__x"
                  aria-label={`close ${split}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSplit(null);
                  }}
                >
                  ×
                </span>
              </button>
            </div>
            <div className="editor__play">
              <iframe src={SITE.play[split].url} title={split} scrolling="no" />
            </div>
          </div>
        )}
        <Chat onClose={() => setChatOpen(false)} />
        <ResizeHandle
          name="term"
          axis="y"
          label="resize terminal"
          onDrag={(d) => setTermH((h) => clamp(h - d, 80, 400))}
        />
        <Terminal onOpen={open} onClose={() => setTermOpen(false)} />
      </div>
      <StatusBar
        chatActive={chatOpen}
        onToggleChat={() => setChatOpen((o) => !o)}
        termActive={termOpen}
        onToggleTerm={() => setTermOpen((o) => !o)}
      />
    </div>
  );
}
