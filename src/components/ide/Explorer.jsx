import { useState } from "react";
import { SITE } from "../../content/site.js";

// Immutable tree ops for drag reorder — filenames are unique site-wide
// (they're tab names), so name identity is enough.
const has = (nodes, name) =>
  nodes.some(
    (n) => n.name === name || (n.type === "folder" && has(n.children, name))
  );

// Remove `name` from the tree; the removed node lands on `out.node`.
function pluck(nodes, name, out) {
  return nodes
    .filter((n) => (n.name === name ? ((out.node = n), false) : true))
    .map((n) =>
      n.type === "folder" ? { ...n, children: pluck(n.children, name, out) } : n
    );
}

function insertBefore(nodes, target, node) {
  if (nodes.some((n) => n.name === target))
    return nodes.flatMap((n) => (n.name === target ? [node, n] : [n]));
  return nodes.map((n) =>
    n.type === "folder"
      ? { ...n, children: insertBefore(n.children, target, node) }
      : n
  );
}

function insertInto(nodes, folder, node) {
  return nodes.map((n) =>
    n.type !== "folder"
      ? n
      : n.name === folder
        ? { ...n, children: [...n.children, node] }
        : { ...n, children: insertInto(n.children, folder, node) }
  );
}

function Tree({ nodes, ctx, depth }) {
  const { open, closed, onToggle, dnd } = ctx;
  return nodes.map((n) =>
    n.type === "folder" ? (
      <div key={n.name}>
        <div
          className={`explorer__row explorer__row--folder${
            n.name === dnd.drag ? " is-drag" : ""
          }${n.name === dnd.over && n.name !== dnd.drag ? " is-drop" : ""}`}
          style={{ paddingLeft: 8 + depth * 14 }}
          onClick={() => onToggle(n.name)}
          {...dnd.row(n)}
        >
          <span className="explorer__tw" aria-hidden="true">
            {closed.has(n.name) ? "▸" : "▾"}
          </span>
          {n.name}
        </div>
        {!closed.has(n.name) && (
          <Tree nodes={n.children} ctx={ctx} depth={depth + 1} />
        )}
      </div>
    ) : (
      <button
        key={n.name}
        className={`explorer__row explorer__row--file${
          n.name === open ? " is-open" : ""
        }${n.name === dnd.drag ? " is-drag" : ""}${
          n.name === dnd.over && n.name !== dnd.drag ? " is-drop" : ""
        }`}
        style={{ paddingLeft: 8 + depth * 14 }}
        onClick={() => ctx.onOpen(n.name)}
        {...dnd.row(n)}
      >
        {n.name}
      </button>
    )
  );
}

export default function Explorer({ open, onOpen, drawer }) {
  // Local mutable copy of SITE.files — reorder drags rewrite it.
  const [tree, setTree] = useState(SITE.files);
  // Folders start expanded; names land here when collapsed.
  const [closed, setClosed] = useState(() => new Set());
  // Drag state — `over` is the hovered drop target.
  const [drag, setDrag] = useState(null);
  const [over, setOver] = useState(null);
  const endDrag = () => {
    setDrag(null);
    setOver(null);
  };

  const toggle = (name) =>
    setClosed((c) => {
      const next = new Set(c);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });

  // Drop on a row: file target inserts before it, folder target moves
  // inside. Dropping inside the dragged folder's own subtree is a no-op
  // (the target was plucked away, so `has` fails and we keep `prev`).
  const move = (name, target, into) => {
    if (!name || name === target) return;
    setTree((prev) => {
      const out = {};
      const kids = pluck(prev[0].children, name, out);
      if (!out.node || !has(kids, target)) return prev;
      return [
        {
          ...prev[0],
          children: into
            ? insertInto(kids, target, out.node)
            : insertBefore(kids, target, out.node),
        },
      ];
    });
  };

  // Drop on empty panel space appends to the root folder.
  const moveToRoot = (name) =>
    setTree((prev) => {
      const out = {};
      const kids = pluck(prev[0].children, name, out);
      return out.node
        ? [{ ...prev[0], children: [...kids, out.node] }]
        : prev;
    });

  const dnd = {
    drag,
    over,
    row: (n) => ({
      draggable: n.name !== SITE.files[0].name,
      onDragStart: (e) => {
        setDrag(n.name);
        e.dataTransfer.effectAllowed = "move";
      },
      onDragEnd: endDrag,
      onDragOver: (e) => {
        e.preventDefault();
        e.stopPropagation();
        setOver(n.name);
      },
      onDragLeave: () => setOver((o) => (o === n.name ? null : o)),
      onDrop: (e) => {
        e.preventDefault();
        e.stopPropagation();
        move(drag, n.name, n.type === "folder");
        endDrag();
      },
    }),
  };

  return (
    <nav
      className={`explorer${drawer ? " explorer--open" : ""}`}
      aria-label="file explorer"
      onDragOver={(e) => e.preventDefault()}
      onDrop={() => {
        if (drag) moveToRoot(drag);
        endDrag();
      }}
    >
      <div className="explorer__head">explorer</div>
      <Tree
        nodes={tree}
        ctx={{ open, onOpen, closed, onToggle: toggle, dnd }}
        depth={0}
      />
    </nav>
  );
}
