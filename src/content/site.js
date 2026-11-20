// All copy for the site lives here. Edit strings; nothing else needs to change.

export const SITE = {
  file: {
    name: "a1.bin",
    magic: "A1.STORE",
    version: "ai memory bank",
  },

  windowTitle: "a1.bin - Notepad",

  // Deterministic document seed — same file on every visit.
  seed: 0xa1b1,

  // Document shape: total noise lines and target line width in chars.
  noise: {
    lines: 72,
    width: 190,
  },

  // The printable strings recovered from AI storage. Rendered readable
  // inside the noise; `href` makes a string a link.
  strings: [
    {
      id: "name",
      text: "mem 0x00 · albin shrestha — seattle, wa",
    },
    {
      id: "bio",
      text: "mem 0x01 · writes software. most of storage still empty.",
    },
    {
      id: "github",
      text: "ptr · github.com/Albisourous",
      href: "https://github.com/Albisourous",
    },
    {
      id: "x",
      text: "ptr · x.com/albinshr",
      href: "https://x.com/albinshr",
    },
  ],

  // Marker printed before the link strings, like a section in a dump.
  stringsMarker: "§ recoverable strings",

  eofMarker: "········ end of recoverable memory ········",

  // Ghost lines typed on the boot intertitle (Lily Chou-Chou layer).
  intertitle: [
    "mounting a1.bin …",
    "ai storage detected.",
    "integrity check failed — recovering printable strings.",
  ],

  about: [
    "a1bin.dev",
    "",
    "file type: ai storage (corrupt)",
    "strings recovered: yes",
    "owner: albin shrestha",
  ],
};
