"use client";

import Editor from "@monaco-editor/react";
import { HiCode } from "react-icons/hi";

type Language = "javascript" | "php" | "python" | "java" | "c";

interface EditorPanelProps {
  language: Language;
  code: string;
  onChange: (value: string) => void;
  onMount: (editor: unknown) => void;
}

const getMonacoLanguage = (language: Language): string => {
  switch (language) {
    case "python":
      return "python";
    case "php":
      return "php";
    case "java":
      return "java";
    case "c":
      return "c";
    case "javascript":
    default:
      return "javascript";
  }
};

export default function EditorPanel({ language, code, onChange, onMount }: EditorPanelProps) {
  return (
    <div className="h-full w-full">
      <Editor
        height="100%"
        language={getMonacoLanguage(language)}
        value={code}
        onChange={(value) => onChange(value || "")}
        onMount={onMount}
        theme="vs-dark"
        options={{
          minimap: { enabled: true },
          fontSize: 14,
          fontFamily: "'Fira Code', 'Cascadia Code', Consolas, monospace",
          lineNumbers: "on",
          roundedSelection: true,
          scrollBeyondLastLine: false,
          automaticLayout: true,
          tabSize: 2,
          wordWrap: "on",
          formatOnPaste: true,
          formatOnType: true,
          suggestOnTriggerCharacters: true,
          quickSuggestions: true,
          parameterHints: { enabled: true },
        }}
        loading={
          <div className="flex items-center justify-center w-full h-full bg-[#1e1e1e]">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 mb-4">
                <HiCode className="w-12 h-12 text-accent animate-pulse" />
              </div>
              <p className="text-light text-sm font-medium mb-1">Loading Editor...</p>
            </div>
          </div>
        }
      />
    </div>
  );
}
