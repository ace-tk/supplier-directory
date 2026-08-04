"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import { TextStyle } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import TextAlign from "@tiptap/extension-text-align";
import Link from "@tiptap/extension-link";
import TiptapImage from "@tiptap/extension-image";
import { Table } from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import Placeholder from "@tiptap/extension-placeholder";
import { Node, mergeAttributes } from "@tiptap/core";
import {
  Bold,
  Italic,
  UnderlineIcon,
  Strikethrough,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  List,
  ListOrdered,
  Quote,
  Code,
  Link2,
  ImageIcon,
  Video as VideoIcon,
  Table as TableIcon,
  Undo2,
  Redo2,
  Maximize2,
  Minimize2,
  Palette,
  Highlighter,
} from "lucide-react";
import { fileToDataUrl } from "@/lib/file-to-data-url";
import { validateImage } from "@/lib/file-validation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// Minimal custom node for embedding a video by URL (YouTube/Vimeo/direct mp4).
function toEmbedUrl(url: string): string {
  const yt = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/.exec(url);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
  const vimeo = /vimeo\.com\/(\d+)/.exec(url);
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`;
  return url;
}

const VideoEmbed = Node.create({
  name: "videoEmbed",
  group: "block",
  atom: true,
  draggable: true,
  addAttributes() {
    return { src: { default: null } };
  },
  parseHTML() {
    return [{ tag: "div[data-video-embed]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      { "data-video-embed": "", class: "relative w-full aspect-video my-2 rounded-lg overflow-hidden bg-black" },
      [
        "iframe",
        mergeAttributes(
          { src: HTMLAttributes.src, class: "absolute inset-0 w-full h-full", frameborder: "0", allowfullscreen: "true" }
        ),
      ],
    ];
  },
});

const HEADING_LEVELS = [
  { label: "Paragraph", value: "0" },
  { label: "Heading 1", value: "1" },
  { label: "Heading 2", value: "2" },
  { label: "Heading 3", value: "3" },
] as const;

const TEXT_COLORS = ["#111827", "#dc2626", "#ea580c", "#16a34a", "#2563eb", "#7c3aed", "#db2777"];
const HIGHLIGHT_COLORS = ["#fef08a", "#bbf7d0", "#bfdbfe", "#fbcfe8", "#fed7aa", "#e9d5ff"];

function ToolbarButton({
  onClick,
  active,
  disabled,
  label,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={cn(
        "flex items-center justify-center w-8 h-8 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-40 disabled:pointer-events-none",
        active && "bg-primary/10 text-primary"
      )}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <div className="w-px h-5 bg-border mx-1 shrink-0" />;
}

function Toolbar({ editor, fullScreen, onToggleFullScreen }: { editor: Editor; fullScreen: boolean; onToggleFullScreen: () => void }) {
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [colorOpen, setColorOpen] = useState(false);
  const [highlightOpen, setHighlightOpen] = useState(false);

  async function handleImagePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const validation = validateImage(file.type, file.size);
    if (!validation.valid) {
      toast.error(validation.error);
      return;
    }
    const dataUrl = await fileToDataUrl(file);
    editor.chain().focus().setImage({ src: dataUrl }).run();
  }

  function handleLink() {
    const previous = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Enter URL", previous ?? "https://");
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }

  function handleVideo() {
    const url = window.prompt("Paste a YouTube, Vimeo, or direct video URL");
    if (!url) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- custom node command not in the base ChainedCommands type
    (editor.chain().focus() as any).insertContent({ type: "videoEmbed", attrs: { src: toEmbedUrl(url) } }).run();
  }

  function handleTable() {
    editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  }

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-border px-2 py-1.5 bg-muted/30">
      <ToolbarButton label="Undo" onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()}>
        <Undo2 className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton label="Redo" onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()}>
        <Redo2 className="h-4 w-4" />
      </ToolbarButton>

      <Divider />

      <select
        value={
          editor.isActive("heading", { level: 1 })
            ? "1"
            : editor.isActive("heading", { level: 2 })
              ? "2"
              : editor.isActive("heading", { level: 3 })
                ? "3"
                : "0"
        }
        onChange={(e) => {
          const level = Number(e.target.value);
          if (level === 0) editor.chain().focus().setParagraph().run();
          else editor.chain().focus().toggleHeading({ level: level as 1 | 2 | 3 }).run();
        }}
        className="h-8 rounded-md border border-border bg-background text-xs px-1.5 text-foreground"
      >
        {HEADING_LEVELS.map((h) => (
          <option key={h.value} value={h.value}>
            {h.label}
          </option>
        ))}
      </select>

      <Divider />

      <ToolbarButton label="Bold" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}>
        <Bold className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton label="Italic" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}>
        <Italic className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton label="Underline" active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()}>
        <UnderlineIcon className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton label="Strikethrough" active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()}>
        <Strikethrough className="h-4 w-4" />
      </ToolbarButton>

      <Divider />

      <div className="relative">
        <ToolbarButton label="Text color" onClick={() => setColorOpen((v) => !v)}>
          <Palette className="h-4 w-4" />
        </ToolbarButton>
        {colorOpen && (
          <div className="absolute z-20 top-9 left-0 flex gap-1 p-2 rounded-lg border border-border bg-popover shadow-elevated">
            {TEXT_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => {
                  editor.chain().focus().setColor(c).run();
                  setColorOpen(false);
                }}
                style={{ backgroundColor: c }}
                className="w-5 h-5 rounded-full border border-border/60"
                aria-label={`Text color ${c}`}
              />
            ))}
          </div>
        )}
      </div>

      <div className="relative">
        <ToolbarButton label="Background color" onClick={() => setHighlightOpen((v) => !v)}>
          <Highlighter className="h-4 w-4" />
        </ToolbarButton>
        {highlightOpen && (
          <div className="absolute z-20 top-9 left-0 flex gap-1 p-2 rounded-lg border border-border bg-popover shadow-elevated">
            {HIGHLIGHT_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => {
                  editor.chain().focus().toggleHighlight({ color: c }).run();
                  setHighlightOpen(false);
                }}
                style={{ backgroundColor: c }}
                className="w-5 h-5 rounded-full border border-border/60"
                aria-label={`Highlight ${c}`}
              />
            ))}
          </div>
        )}
      </div>

      <Divider />

      <ToolbarButton label="Align left" active={editor.isActive({ textAlign: "left" })} onClick={() => editor.chain().focus().setTextAlign("left").run()}>
        <AlignLeft className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton label="Align center" active={editor.isActive({ textAlign: "center" })} onClick={() => editor.chain().focus().setTextAlign("center").run()}>
        <AlignCenter className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton label="Align right" active={editor.isActive({ textAlign: "right" })} onClick={() => editor.chain().focus().setTextAlign("right").run()}>
        <AlignRight className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton label="Justify" active={editor.isActive({ textAlign: "justify" })} onClick={() => editor.chain().focus().setTextAlign("justify").run()}>
        <AlignJustify className="h-4 w-4" />
      </ToolbarButton>

      <Divider />

      <ToolbarButton label="Bullet list" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}>
        <List className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton label="Numbered list" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
        <ListOrdered className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton label="Quote" active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
        <Quote className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton label="Code block" active={editor.isActive("codeBlock")} onClick={() => editor.chain().focus().toggleCodeBlock().run()}>
        <Code className="h-4 w-4" />
      </ToolbarButton>

      <Divider />

      <ToolbarButton label="Link" active={editor.isActive("link")} onClick={handleLink}>
        <Link2 className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton label="Image" onClick={() => imageInputRef.current?.click()}>
        <ImageIcon className="h-4 w-4" />
      </ToolbarButton>
      <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImagePick} />
      <ToolbarButton label="Video" onClick={handleVideo}>
        <VideoIcon className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton label="Table" onClick={handleTable}>
        <TableIcon className="h-4 w-4" />
      </ToolbarButton>

      <Divider />

      <ToolbarButton label={fullScreen ? "Exit full screen" : "Full screen"} onClick={onToggleFullScreen}>
        {fullScreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
      </ToolbarButton>
    </div>
  );
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = "Start writing...",
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}) {
  const [fullScreen, setFullScreen] = useState(false);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ link: false }),
      Underline,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Link.configure({ openOnClick: false, autolink: true }),
      TiptapImage.configure({ HTMLAttributes: { class: "rounded-lg max-w-full" } }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      Placeholder.configure({ placeholder }),
      VideoEmbed,
    ],
    content: value,
    editorProps: {
      attributes: {
        class: "tiptap-content focus:outline-none min-h-[300px] px-4 py-3",
      },
    },
    onUpdate: ({ editor }) => onChangeRef.current(editor.getHTML()),
  });

  const escHandler = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") setFullScreen(false);
  }, []);

  useEffect(() => {
    if (!fullScreen) return;
    document.addEventListener("keydown", escHandler);
    return () => document.removeEventListener("keydown", escHandler);
  }, [fullScreen, escHandler]);

  if (!editor) {
    return <div className="rounded-xl border border-border bg-card min-h-[360px] animate-pulse" />;
  }

  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card overflow-hidden",
        fullScreen && "fixed inset-0 z-50 rounded-none flex flex-col"
      )}
    >
      <Toolbar editor={editor} fullScreen={fullScreen} onToggleFullScreen={() => setFullScreen((v) => !v)} />
      <div className={cn("overflow-y-auto scrollbar-thin", fullScreen && "flex-1")}>
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
