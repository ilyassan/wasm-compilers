import { useCallback } from "react";
import { useJsExecutor } from "./useJsExecutor";
import { usePhpExecutor } from "./usePhpExecutor";
import { usePythonExecutor } from "./usePythonExecutor";

export interface CodeOutput {
  type: "output" | "error" | "info" | "image";
  content: string;
}

export type Language = "javascript" | "php" | "python" | "java" | "c";

export interface LanguageExecutor {
  execute: (code: string) => Promise<CodeOutput[]>;
  isLoading?: boolean;
}

export function useCodeExecutor() {
  const { executeJs } = useJsExecutor();
  const { executePhp, isLoading: phpLoading } = usePhpExecutor();
  const { executePython, isLoading: pythonLoading } = usePythonExecutor();

  const execute = useCallback(
    async (
      language: Language,
      code: string,
      onProgress?: (message: string, type: "info" | "error") => void,
      onLoadProgress?: (progress: number, message: string) => void,
      filename?: string
    ): Promise<CodeOutput[]> => {
      switch (language) {
        case "javascript":
          return executeJs(code);
        case "php":
          return executePhp(code, onLoadProgress);
        case "python":
          return executePython(code, onProgress, onLoadProgress);
        case "java":
          return [
            {
              type: "error",
              content: `Java support not yet implemented`,
            },
          ];
        case "c":
          return [
            {
              type: "error",
              content: `C support not yet implemented`,
            },
          ];
        default:
          return [
            {
              type: "error",
              content: `Unsupported language: ${language}`,
            },
          ];
      }
    },
    [executeJs, executePhp, executePython]
  );

  const isLoading = useCallback(
    (language: Language): boolean => {
      switch (language) {
        case "php":
          return phpLoading;
        case "python":
          return pythonLoading;
        default:
          return false;
      }
    },
    [phpLoading, pythonLoading]
  );

  return { execute, isLoading };
}
