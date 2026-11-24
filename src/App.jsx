import { useEffect, useState } from "react";
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

// Tabs that render a component instead of file text — graph, metrics,
// a/b. None of them count as "the explorer is open".
const PSEUDO = new Set([SITE.graphTab, SITE.metricsTab, SITE.abTab]);

export default function App() {
  // Tab state: `tabs` is the tab bar order, `active` the focused tab.
  // The graph tab is a pseudo-file named SITE.graphTab.
  const [tabs, setTabs] = useState(
    boot && !SITE.openTabs.includes(boot)
      ? [...SITE.openTabs, boot]
      : SITE.openTabs
  );
  const [active, setActive] = useState(boot ?? SITE.activeTab);
  // In-session drafts: edits survive file switches but reset on reload.
  const [drafts, setDrafts] = useState({});
  // Side panel widths; the editor takes whatever space is left.
  const [explorerW, setExplorerW] = useState(210);
  const [chatW, setChatW] = useState(330);
  // On mobile the panels stack vertically, so chat resizes by height.
  const [chatH, setChatH] = useState(240);
  // Bottom terminal height — open by default like a real IDE.
  const [termH, setTermH] = useState(180);
  // Chat starts closed on mobile: editor gets the screen. Terminal
  // stays open everywhere — the prompt is part of the landing view.
  const [chatOpen, setChatOpen] = useState(() => !startsMobile());
  const [termOpen, setTermOpen] = useState(true);
  // Mobile has no explorer column — the icon toggles a drawer instead.
  const [explorerOpen, setExplorerOpen] = useState(false);
  const mobile = useMedia(MOBILE_Q);
  const text = drafts[active] ?? (SITE.contents[active] || []).join("\n");

  const open = (name) => {
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

  // A pdf tab gaining focus = one "resume press" — explorer click,
  // file-link open, or a /Resume.pdf deep link all land here.
  useEffect(() => {
    if (SITE.pdfs[active]) trackEvent("resume");
  }, [active]);

  // Canonical follows the active file for SEO. The URL itself never
  // changes on navigation — deep links are inbound only.
  useEffect(() => {
    const wanted = active ? `/${SITE.urls[active] ?? active}` : "/";
    document.title = "Albin Shrestha — a1bin.dev";
    document
      .querySelector('link[rel="canonical"]')
      ?.setAttribute("href", `https://a1bin.dev${wanted}`);
  }, [active]);

  return (
    <div className="ide">
      <TitleBar />
      <div
        className={`workbench${chatOpen ? "" : " workbench--no-chat"}${
          termOpen ? "" : " workbench--no-term"
        }`}
        style={{
          "--explorer-w": `${explorerW}px`,
          "--chat-w": `${chatW}px`,
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
          open={active}
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
