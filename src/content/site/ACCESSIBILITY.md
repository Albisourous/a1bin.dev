# accessibility

target: wcag 2.2 aa. this site should work for everyone, not just people who use ides.

the good:

- every control is keyboard reachable — explorer, tabs, editor, chat, terminal, status bar
- text is real text. it selects, zooms, and reads through a screen reader
- two themes with checked contrast — the status-bar toggle remembers your pick
- animation only runs when your system allows it (prefers-reduced-motion)
- icon-only buttons carry aria-labels, and the panels are named landmarks

the gaps — a fake ide has some:

- game is an ascii game. a wall of characters with no screen-reader story
- GRAPH is a visual map. every link in it is also a plain file in the explorer
- Resume is a pdf. the text extracts fine, but it's still a pdf
- edits you make in the editor are session-only and aren't announced

status: partially conformant. last checked november 2026.

spot something broken? [email me](mailto:albinshrestha01@gmail.com) — accessibility bugs get fixed first

plain-html version, no ide required: [a1bin.dev/accessibility.html](/accessibility.html)
