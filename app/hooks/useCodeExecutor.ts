import { useCallback } from "react";
import { useJsExecutor } from "./useJsExecutor";

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
          return [
            {
              type: "error",
              content: `PHP support not yet implemented`,
            },
          ];
        case "python":
          return [
            {
              type: "error",
              content: `Python support not yet implemented`,
            },
          ];
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
    [executeJs]
  );

  const isLoading = useCallback(
    (language: Language): boolean => {
      return false;
    },
    []
  );

  return { execute, isLoading };
}
