import { useCallback } from "react";
import { useJsExecutor } from "./useJsExecutor";
import { usePhpExecutor } from "./usePhpExecutor";
import { usePythonExecutor } from "./usePythonExecutor";
import { useJavaExecutor } from "./useJavaExecutor";
import { useCExecutor } from "./useCExecutor";

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
  const { executeJava, isLoading: javaLoading } = useJavaExecutor();
  const { executeC, isLoading: cLoading } = useCExecutor();

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
          return executeJava(code, onProgress, onLoadProgress, filename);
        case "c":
          return executeC(code, onProgress, onLoadProgress);
        default:
          return [
            {
              type: "error",
              content: `Unsupported language: ${language}`,
            },
          ];
      }
    },
    [executeJs, executePhp, executePython, executeJava, executeC]
  );

  const isLoading = useCallback(
    (language: Language): boolean => {
      switch (language) {
        case "php":
          return phpLoading;
        case "python":
          return pythonLoading;
        case "java":
          return javaLoading;
        case "c":
          return cLoading;
        default:
          return false;
      }
    },
    [phpLoading, pythonLoading, javaLoading, cLoading]
  );

  return { execute, isLoading };
}
