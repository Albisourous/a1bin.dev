// Weighted glyph tables sampled from real CP1252-misdecoded dumps.
// Tuning the weights reshapes the whole texture of the file.

const LATIN_HI =
  "àáâãäåæçèéêëìíîïðñòóôõöøùúûüýþÿÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞ";
const SYMBOLS = "±²³´µ¶·¸¹º»¼½¾¿×÷°§£¥¢©®¬¦¨«";
const BOX = "║╔╗╚╝╠╣═│┤├┬┴▀▄█▌▐░▒▓";
const PUNCT = "'\".,;:-_+*=<>()[]{}\\/|!?@#$%^&~`";
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const FRAGMENTS = [
  "bcdefgh",
  "aceg",
  "jklmnopqrstuvwxy",
  "pnmk",
  "igfeccb",
  "usrqpnmk",
  "ihgfecba",
  "ddggij",
];
const NULL_RUN = "····························";

const pick = (rng, s) => s[Math.floor(rng() * s.length)];

// Ascending or descending alphabet runs — the "IIJJGGFFEE" signature.
function alphaRun(rng) {
  const len = 4 + Math.floor(rng() * 16);
  const start = Math.floor(rng() * (ALPHABET.length - len));
  const run = ALPHABET.slice(start, start + len);
  return rng() < 0.5 ? run : run.split("").reverse().join("");
}

// One segment of noise. Weighted for the dense texture of a real dump:
// latin clusters ~55, punct ~12, space ~3, alpha run ~12, fragment ~8,
// box ~6, null-run ~4.
function segment(rng) {
  const r = rng();
  if (r < 0.55) {
    // Latin-hi comes in clusters of 1–4 — mojibake runs in packs.
    let s = "";
    const n = 1 + Math.floor(rng() * 4);
    for (let i = 0; i < n; i++) s += pick(rng, LATIN_HI);
    return s;
  }
  if (r < 0.67) return pick(rng, PUNCT);
  if (r < 0.7) return " ";
  if (r < 0.82) return alphaRun(rng);
  if (r < 0.9) return pick(rng, FRAGMENTS);
  if (r < 0.96) return pick(rng, BOX);
  return NULL_RUN.slice(0, 6 + Math.floor(rng() * 10));
}

export function noiseLine(rng, width) {
  let line = "";
  while (line.length < width) line += segment(rng);
  return line.slice(0, width);
}

export function noisePad(rng, min, max) {
  const width = min + Math.floor(rng() * (max - min));
  // Pads are mostly spaces with a little corruption at the edges.
  let pad = "";
  while (pad.length < width) {
    pad += rng() < 0.9 ? " " : pick(rng, "·.¸");
  }
  return pad;
}

// Mojibake pool for scramble animations — short, high-entropy looking.
export const SCRAMBLE_POOL = LATIN_HI + SYMBOLS + BOX;
