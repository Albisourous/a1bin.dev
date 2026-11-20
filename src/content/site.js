// All copy for the site lives here. Edit strings; nothing else needs to change.

export const SITE = {
  file: {
    name: "a1.bin",
    magic: "A1BINDATA",
    version: "v2.0.4",
  },

  windowTitle: "a1.bin - Notepad",

  // Deterministic document seed — same file on every visit.
  seed: 0xa1b1,

  // Document shape: total noise lines and target line width in chars.
  noise: {
    lines: 72,
    width: 190,
  },

  // The printable strings recovered from the binary. Rendered readable
  // inside the noise; `href` makes a string a link.
  strings: [
    {
      id: "name",
      text: "albin shrestha — seattle, wa",
    },
    {
      id: "bio",
      text: "writes software. file under construction — more strings soon.",
    },
    {
      id: "github",
      text: "github.com/Albisourous",
      href: "https://github.com/Albisourous",
    },
    {
      id: "x",
      text: "x.com/albinshr",
      href: "https://x.com/albinshr",
    },
  ],

  // Marker printed before the link strings, like a section in a dump.
  stringsMarker: "§ strings",

  // Ghost lines typed on the boot intertitle (Lily Chou-Chou layer).
  intertitle: [
    "opening a1.bin …",
    "the file is in an unsupported format.",
    "showing raw text below.",
  ],

  about: [
    "a1bin.dev",
    "",
    "file type: corrupted binary",
    "strings recovered: yes",
    "owner: albin shrestha",
  ],
};
