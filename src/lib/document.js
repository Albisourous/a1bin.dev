import { SITE } from "../content/site.js";
import { mulberry32 } from "./rng.js";
import { noiseLine, noisePad } from "./charset.js";

// Builds the file as a flat list of line models.
//   { type: "noise",  text }
//   { type: "string", string, padBefore, padAfter }  — readable inside noise
//   { type: "marker", text }                          — section records
// Strings are spliced into the noise at jittered positions.
export function buildDocument(seed = SITE.seed) {
  const rng = mulberry32(seed);
  const { lines: total, width } = SITE.noise;
  const lines = [];

  const pushNoise = (n = 1) => {
    for (let i = 0; i < n; i++) lines.push({ type: "noise", text: noiseLine(rng, width) });
  };

  // Header record — the file's magic bytes, embedded mid-line.
  lines.push({
    type: "string",
    string: { text: `${SITE.file.magic}  |  ${SITE.file.version}`, href: null },
    padBefore: "",
    padAfter: noisePad(rng, 20, 60),
  });
  pushNoise(6 + Math.floor(rng() * 4));

  // Identity strings — name, then bio.
  const [name, bio, ...links] = SITE.strings;
  for (const s of [name, bio]) {
    if (!s) continue;
    lines.push({
      type: "string",
      string: s,
      padBefore: noisePad(rng, 24, 48),
      padAfter: noisePad(rng, 8, 24),
    });
    pushNoise(4 + Math.floor(rng() * 6));
  }

  // Strings section marker, then link strings.
  lines.push({ type: "marker", text: SITE.stringsMarker });
  pushNoise(2);
  for (const s of links) {
    lines.push({
      type: "string",
      string: s,
      padBefore: noisePad(rng, 30, 60),
      padAfter: noisePad(rng, 8, 20),
    });
    pushNoise(2 + Math.floor(rng() * 4));
  }

  // Pad out to target size, then the EOF record.
  pushNoise(Math.max(0, total - lines.length - 1));
  lines.push({ type: "marker", text: "········ EOF ········" });

  return lines;
}

export function documentText(lines) {
  return lines
    .map((l) => {
      if (l.type === "noise") return l.text;
      if (l.type === "marker") return l.text;
      return (l.padBefore || "") + l.string.text + (l.padAfter || "");
    })
    .join("\n");
}
