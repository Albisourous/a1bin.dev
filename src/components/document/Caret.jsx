export default function Caret({ x, y, h }) {
  if (x == null) return null;
  return <div className="caret" style={{ left: x, top: y, height: h }} aria-hidden="true" />;
}
