// Single source for Albin's address and the prefilled mailto draft.
// Imported by site.js (browser) and api/chat.js (serverless) — keep it
// plain ESM: no JSX, no import.meta.glob, no Vite-only APIs.
export const email = "albinshrestha01@gmail.com";
export const mailto = `mailto:${email}?subject=${encodeURIComponent(
  "[URGENT] Title",
)}&body=${encodeURIComponent(
  "Hi Albin,\n\n[Write your message here]\n\nBest,\n[Your Name]\n[Your Contact Info]\n[An app/tool you think more people should know about?]",
)}`;
