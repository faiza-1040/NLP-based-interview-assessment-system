//client/src/components/interview/CodeEditor.jsximport React from "react";
import Editor from "@monaco-editor/react";

export default function CodeEditor({
  value,
  language = "javascript",
  onChange,
  readOnly = false,
}) {
  return (
    <div
      style={{
        border: "1.5px solid #e2e8f0",
        borderRadius: 10,
        overflow: "hidden",
        background: "#0f172a",
      }}
    >
      <Editor
        height="360px"
        language={language}
        value={value}
        theme="vs-dark"
        onChange={(val) => onChange(val || "")}
        options={{
          readOnly,
          minimap: { enabled: false },
          fontSize: 14,
          tabSize: 4,
          insertSpaces: true,
          detectIndentation: false,
          automaticLayout: true,
          scrollBeyondLastLine: false,
          wordWrap: "on",
          formatOnPaste: false,
          formatOnType: false,
          quickSuggestions: false,
          suggestOnTriggerCharacters: false,
        }}
      />
    </div>
  );
}