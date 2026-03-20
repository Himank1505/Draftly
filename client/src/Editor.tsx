import { useState, useCallback, useMemo } from "react";
import { createEditor, Descendant } from "slate";
import { Slate, Editable, withReact } from "slate-react";
import { withHistory } from "slate-history";

interface EditorProps {
  initialValue: Descendant[];
  onChange: (value: Descendant[]) => void;
  readOnly?: boolean;
}

export default function Editor({ initialValue, onChange, readOnly = false }: EditorProps) {
  const editor = useMemo(() => withHistory(withReact(createEditor())), []);
  const [pasteWarning, setPasteWarning] = useState(false);

  const renderElement = useCallback(
    ({ attributes, children }: any) => (
      <p {...attributes} style={{ margin: "0 0 0.6em" }}>
        {children}
      </p>
    ),
    []
  );

  const renderLeaf = useCallback(
    ({ attributes, children }: any) => <span {...attributes}>{children}</span>,
    []
  );

  function blockPaste(e: React.ClipboardEvent | React.KeyboardEvent) {
    e.preventDefault();
    setPasteWarning(true);
    setTimeout(() => setPasteWarning(false), 3000);
  }

  return (
    <div style={s.wrapper}>
      {pasteWarning && (
        <div style={s.pasteWarning}>
          Copy-paste is disabled — please type your work directly.
        </div>
      )}

      <Slate editor={editor} initialValue={initialValue} onChange={onChange}>
        <Editable
          renderElement={renderElement}
          renderLeaf={renderLeaf}
          placeholder="Start writing…"
          style={{ ...s.editable, ...(readOnly ? s.editableReadOnly : {}) }}
          spellCheck
          autoFocus={!readOnly}
          readOnly={readOnly}
          onPaste={readOnly ? undefined : blockPaste}
          onDrop={(e) => { if (!readOnly) e.preventDefault(); }}
          onKeyDown={(e) => {
            if (!readOnly && (e.ctrlKey || e.metaKey) && e.key === "v") {
              blockPaste(e);
            }
          }}
        />
      </Slate>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  wrapper: { position: "relative", width: "100%", maxWidth: 720 },
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
  editable: {
    background: "#fff",
    borderRadius: 8,
    boxShadow: "0 4px 24px rgba(15,23,42,0.08)",
    padding: "3rem",
    width: "100%",
    minHeight: "70vh",
    fontSize: "1.05rem",
    lineHeight: 1.75,
    color: "#1e293b",
    outline: "none",
  },
  editableReadOnly: {
    background: "#f8fafc",
    cursor: "default",
  },
};
