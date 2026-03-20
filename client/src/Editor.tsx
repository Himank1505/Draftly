import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyle } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import { Table, TableRow, TableCell, TableHeader } from "@tiptap/extension-table";
import { useState } from "react";

interface EditorProps {
  initialValue: string;
  onChange: (html: string) => void;
  readOnly?: boolean;
}

export default function Editor({ initialValue, onChange, readOnly = false }: EditorProps) {
  const [pasteWarning, setPasteWarning] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextStyle,
      Color,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: initialValue || "<p></p>",
    editable: !readOnly,
    editorProps: {
      handlePaste: readOnly ? undefined : () => {
        setPasteWarning(true);
        setTimeout(() => setPasteWarning(false), 3000);
        return true; // block paste
      },
      handleDrop: () => readOnly ? false : true, // block drop for students
      attributes: { style: editorBodyStyle(readOnly) },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  if (!editor) return null;

  return (
    <div style={s.wrapper}>
      {pasteWarning && (
        <div style={s.pasteWarning}>
          Copy-paste is disabled — please type your work directly.
        </div>
      )}

      {!readOnly && <Toolbar editor={editor} />}

      <EditorContent editor={editor} />
    </div>
  );
}

function editorBodyStyle(readOnly: boolean): string {
  return [
    "background: " + (readOnly ? "#f8fafc" : "#fff"),
    "border-radius: 0 0 8px 8px",
    "box-shadow: 0 4px 24px rgba(15,23,42,0.08)",
    "padding: 2.5rem 3rem",
    "min-height: 70vh",
    "font-size: 1.05rem",
    "line-height: 1.75",
    "color: #1e293b",
    "outline: none",
    "cursor: " + (readOnly ? "default" : "text"),
  ].join(";");
}

function Toolbar({ editor }: { editor: ReturnType<typeof useEditor> }) {
  if (!editor) return null;

  const btn = (active: boolean, onClick: () => void, label: string, title?: string) => (
    <button
      key={label}
      title={title ?? label}
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      style={{ ...s.btn, ...(active ? s.btnActive : {}) }}
    >
      {label}
    </button>
  );

  const sep = <span style={s.sep} />;

  return (
    <div style={s.toolbar}>
      {/* History */}
      {btn(false, () => editor.chain().focus().undo().run(), "↩", "Undo")}
      {btn(false, () => editor.chain().focus().redo().run(), "↪", "Redo")}
      {sep}

      {/* Headings */}
      <select
        style={s.select}
        value={
          editor.isActive("heading", { level: 1 }) ? "1" :
          editor.isActive("heading", { level: 2 }) ? "2" :
          editor.isActive("heading", { level: 3 }) ? "3" : "0"
        }
        onChange={(e) => {
          const val = e.target.value;
          if (val === "0") editor.chain().focus().setParagraph().run();
          else editor.chain().focus().toggleHeading({ level: Number(val) as 1|2|3 }).run();
        }}
      >
        <option value="0">Paragraph</option>
        <option value="1">Heading 1</option>
        <option value="2">Heading 2</option>
        <option value="3">Heading 3</option>
      </select>
      {sep}

      {/* Inline styles */}
      {btn(editor.isActive("bold"),          () => editor.chain().focus().toggleBold().run(),          "B",  "Bold")}
      {btn(editor.isActive("italic"),        () => editor.chain().focus().toggleItalic().run(),        "I",  "Italic")}
      {btn(editor.isActive("underline"),     () => editor.chain().focus().toggleUnderline().run(),     "U",  "Underline")}
      {btn(editor.isActive("strike"),        () => editor.chain().focus().toggleStrike().run(),        "S̶",  "Strikethrough")}
      {btn(editor.isActive("code"),          () => editor.chain().focus().toggleCode().run(),          "<>", "Inline code")}
      {sep}

      {/* Alignment */}
      {btn(editor.isActive({ textAlign: "left" }),    () => editor.chain().focus().setTextAlign("left").run(),    "⬅", "Align left")}
      {btn(editor.isActive({ textAlign: "center" }),  () => editor.chain().focus().setTextAlign("center").run(),  "≡", "Align center")}
      {btn(editor.isActive({ textAlign: "right" }),   () => editor.chain().focus().setTextAlign("right").run(),   "⮕", "Align right")}
      {btn(editor.isActive({ textAlign: "justify" }), () => editor.chain().focus().setTextAlign("justify").run(), "☰", "Justify")}
      {sep}

      {/* Lists */}
      {btn(editor.isActive("bulletList"),  () => editor.chain().focus().toggleBulletList().run(),  "• List",  "Bullet list")}
      {btn(editor.isActive("orderedList"), () => editor.chain().focus().toggleOrderedList().run(), "1. List", "Ordered list")}
      {btn(editor.isActive("blockquote"),  () => editor.chain().focus().toggleBlockquote().run(),  "❝",       "Blockquote")}
      {sep}

      {/* Table */}
      {btn(false, () => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(), "⊞ Table", "Insert table")}
      {editor.isActive("table") && <>
        {btn(false, () => editor.chain().focus().addColumnAfter().run(),  "+ Col",  "Add column")}
        {btn(false, () => editor.chain().focus().addRowAfter().run(),     "+ Row",  "Add row")}
        {btn(false, () => editor.chain().focus().deleteColumn().run(),    "− Col",  "Delete column")}
        {btn(false, () => editor.chain().focus().deleteRow().run(),       "− Row",  "Delete row")}
        {btn(false, () => editor.chain().focus().deleteTable().run(),     "✕ Table","Delete table")}
      </>}
      {sep}

      {/* Extras */}
      {btn(editor.isActive("codeBlock"),  () => editor.chain().focus().toggleCodeBlock().run(),    "{ } Block", "Code block")}
      {btn(false, () => editor.chain().focus().setHorizontalRule().run(), "― HR", "Horizontal rule")}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  wrapper: { width: "100%", maxWidth: 860 },
  pasteWarning: {
    position: "fixed",
    bottom: "1.5rem",
    left: "50%",
    transform: "translateX(-50%)",
    background: "#1e293b",
    color: "#fff",
    padding: "0.6rem 1.25rem",
    borderRadius: 8,
    fontSize: "0.875rem",
    zIndex: 100,
    pointerEvents: "none",
  },
  toolbar: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: "0.15rem",
    padding: "0.5rem 0.75rem",
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderBottom: "none",
    borderRadius: "8px 8px 0 0",
  },
  btn: {
    padding: "0.25rem 0.45rem",
    background: "none",
    border: "1px solid transparent",
    borderRadius: 4,
    cursor: "pointer",
    fontSize: "0.8rem",
    fontWeight: 600,
    color: "#475569",
    lineHeight: 1.4,
    whiteSpace: "nowrap",
  },
  btnActive: {
    background: "#e0f2fe",
    border: "1px solid #bae6fd",
    color: "#0369a1",
  },
  sep: {
    width: 1,
    height: 18,
    background: "#e2e8f0",
    margin: "0 0.25rem",
    flexShrink: 0,
  },
  select: {
    fontSize: "0.8rem",
    padding: "0.2rem 0.35rem",
    border: "1px solid #e2e8f0",
    borderRadius: 4,
    background: "#fff",
    color: "#475569",
    cursor: "pointer",
  },
};
