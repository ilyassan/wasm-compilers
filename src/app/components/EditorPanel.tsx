"use client";

import Editor from "@monaco-editor/react";
import { Loader2 } from "lucide-react";

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
    <div className="h-full w-full rounded-lg overflow-hidden border border-secondary-light shadow-lg">
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
          fontFamily: "'Fira Code', 'JetBrains Mono', 'Cascadia Code', Consolas, monospace",
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
          padding: { top: 16, bottom: 16 },
        }}
        loading={
          <div className="flex items-center justify-center w-full h-full bg-[#1e1e1e]">
            <div className="text-center space-y-4">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-accent/10 rounded-full">
                <Loader2 className="w-8 h-8 text-accent animate-spin" />
              </div>
              <div className="space-y-2">
                <p className="text-light text-sm font-medium">Loading Editor...</p>
                <p className="text-gress text-xs">Preparing your coding environment</p>
              </div>
            </div>
          </div>
        }
      />
    </div>
  );
}
