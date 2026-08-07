// Sanitizes AI-produced HTML before it ever reaches the client or gets
// persisted — the model's output is treated as untrusted input. Strips
// scripts/event handlers/unsafe URL schemes while preserving the tags and
// attributes the Tiptap editor (RichTextEditor.tsx) actually renders, so
// formatting round-trips cleanly.

import sanitizeHtml, { type IOptions } from "sanitize-html";

const ALLOWED_TAGS = [
  "p",
  "br",
  "hr",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "s",
  "strike",
  "mark",
  "blockquote",
  "pre",
  "code",
  "ul",
  "ol",
  "li",
  "a",
  "img",
  "table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
  "span",
  "div",
  "iframe",
];

const COLOR_STYLE_VALUES = [/^#[0-9a-fA-F]{3,8}$/, /^rgba?\([\d\s.,%]+\)$/];

const ALLOWED_ATTRIBUTES: IOptions["allowedAttributes"] = {
  a: ["href", "target", "rel"],
  img: ["src", "alt", "class", "width", "height"],
  span: ["style", "class"],
  mark: ["style", "class", "data-color"],
  div: ["class", "data-video-embed"],
  iframe: ["src", "frameborder", "allowfullscreen", "class"],
  th: ["colspan", "rowspan"],
  td: ["colspan", "rowspan"],
};

export function sanitizeEditorHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: ALLOWED_ATTRIBUTES,
    allowedStyles: {
      span: { color: COLOR_STYLE_VALUES, "background-color": COLOR_STYLE_VALUES },
      mark: { color: COLOR_STYLE_VALUES, "background-color": COLOR_STYLE_VALUES },
    },
    allowedSchemes: ["http", "https", "mailto", "tel"],
    allowedSchemesByTag: { img: ["http", "https", "data"] },
    allowProtocolRelative: false,
    allowedIframeHostnames: ["www.youtube.com", "player.vimeo.com"],
    allowIframeRelativeUrls: false,
    disallowedTagsMode: "discard",
  });
}
