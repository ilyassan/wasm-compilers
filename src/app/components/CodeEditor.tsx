"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useCodeExecutor, type Language } from "../hooks/useCodeExecutor";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Play, Trash2, ChevronLeft, ChevronRight, Plus, X } from "lucide-react";
import EditorPanel from "./EditorPanel";
import ConsolePanel from "./ConsolePanel";
import RuntimeLoadingProgress from "./RuntimeLoadingProgress";

interface ConsoleOutput {
  type: "output" | "error" | "info" | "image";
  content: string;
  timestamp: number;
}

interface Tab {
  id: string;
  name: string;
  content: string;
  consoleOutput: ConsoleOutput[];
}

interface LanguageTabs {
  javascript: Tab[];
  php: Tab[];
  python: Tab[];
  java: Tab[];
  c: Tab[];
}

const DEFAULT_CODE: Record<Language, string> = {
  javascript: `// JavaScript Playground
console.log("Hello from JavaScript!");

// Try some code
function fibonacci(n) {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}

console.log("Fibonacci(10):", fibonacci(10));`,

  php: `<?php
// PHP Playground
echo "Hello from PHP!\\n";

// Try some code
function factorial($n) {
    if ($n <= 1) return 1;
    return $n * factorial($n - 1);
}

echo "Factorial(5): " . factorial(5);
?>`,

  python: `# Python Playground
print("Hello from Python!")

# Try some code
def fibonacci(n):
    if n <= 1:
        return n
    return fibonacci(n-1) + fibonacci(n-2)

print(f"Fibonacci(10): {fibonacci(10)}")`,

  java: `// Java Playground
public class Main {
    public static void main(String[] args) {
        System.out.println("Hello from Java!");

        // Try some code
        System.out.println("Fibonacci(10): " + fibonacci(10));
    }

    public static int fibonacci(int n) {
        if (n <= 1) return n;
        return fibonacci(n - 1) + fibonacci(n - 2);
    }
}`,

  c: `// C Playground
#include <stdio.h>

int fibonacci(int n) {
    if (n <= 1) return n;
    return fibonacci(n - 1) + fibonacci(n - 2);
}

int main() {
    printf("Hello from C!\\n");

    // Try some code
    printf("Fibonacci(10): %d\\n", fibonacci(10));

    return 0;
}`,
};

const getFileName = (language: Language): string => {
  switch (language) {
    case "javascript": return "script.js";
    case "php": return "index.php";
    case "python": return "main.py";
    case "java": return "Main.java";
    case "c": return "main.c";
    default: return "file";
  }
};

const createDefaultTab = (language: Language, index: number = 1): Tab => ({
  id: `${language}-${Date.now()}-${index}`,
  name: getFileName(language),
  content: DEFAULT_CODE[language],
  consoleOutput: [],
});

const STORAGE_KEY = 'wasm-compiler-state';

export default function CodeEditor() {
  // Get language from URL query parameter, default to javascript
  const searchParams = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
  const urlLanguage = searchParams.get('language') as Language | null;
  const initialLanguage = urlLanguage && ["javascript", "php", "python", "java", "c"].includes(urlLanguage)
    ? urlLanguage
    : "javascript";

  // Load saved state from localStorage or use defaults
  const loadInitialState = () => {
    if (typeof window === 'undefined') {
      return {
        tabs: {
          javascript: [createDefaultTab("javascript")],
          php: [createDefaultTab("php")],
          python: [createDefaultTab("python")],
          java: [createDefaultTab("java")],
          c: [createDefaultTab("c")],
        },
        activeTabId: {} as Record<Language, string>,
        language: initialLanguage,
      };
    }

    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          tabs: parsed.tabs,
          activeTabId: parsed.activeTabId,
          language: urlLanguage || parsed.language || initialLanguage,
        };
      }
    } catch (error) {
      console.error('Failed to load saved state:', error);
    }

    const defaultTabs = {
      javascript: [createDefaultTab("javascript")],
      php: [createDefaultTab("php")],
      python: [createDefaultTab("python")],
      java: [createDefaultTab("java")],
      c: [createDefaultTab("c")],
    };

    return {
      tabs: defaultTabs,
      activeTabId: {
        javascript: defaultTabs.javascript[0].id,
        php: defaultTabs.php[0].id,
        python: defaultTabs.python[0].id,
        java: defaultTabs.java[0].id,
        c: defaultTabs.c[0].id,
      },
      language: initialLanguage,
    };
  };

  const initialState = loadInitialState();

  const [language, setLanguage] = useState<Language>(initialState.language);
  const [tabs, setTabs] = useState<LanguageTabs>(initialState.tabs);
  const [activeTabId, setActiveTabId] = useState<Record<Language, string>>(initialState.activeTabId);
  const [isRunning, setIsRunning] = useState(false);
  const [isLoadingRuntime, setIsLoadingRuntime] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState("");
  const [editorWidth, setEditorWidth] = useState(50); // Percentage
  const [isResizing, setIsResizing] = useState(false);
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const editorRef = useRef<unknown>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Unified code executor
  const { execute } = useCodeExecutor();

  const handleEditorDidMount = (editor: unknown) => {
    editorRef.current = editor;
  };

  const addOutput = useCallback((content: string, type: ConsoleOutput["type"] = "output") => {
    setTabs(prev => ({
      ...prev,
      [language]: prev[language].map(tab =>
        tab.id === activeTabId[language]
          ? {
              ...tab,
              consoleOutput: [...tab.consoleOutput, {
                type,
                content,
                timestamp: Date.now(),
              }]
            }
          : tab
      ),
    }));
  }, [language, activeTabId]);

  const clearConsole = useCallback(() => {
    setTabs(prev => ({
      ...prev,
      [language]: prev[language].map(tab =>
        tab.id === activeTabId[language]
          ? { ...tab, consoleOutput: [] }
          : tab
      ),
    }));
  }, [language, activeTabId]);

  // Get current active tab for the current language
  const currentTabs = tabs[language];
  const currentActiveTab = currentTabs.find(tab => tab.id === activeTabId[language]) || currentTabs[0];

  const handleLanguageChange = (newLang: Language) => {
    setLanguage(newLang);
    // Update URL with language query parameter
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('language', newLang);
      window.history.pushState({}, '', url.toString());
    }
  };

  const handleTabChange = (tabId: string) => {
    setActiveTabId(prev => ({ ...prev, [language]: tabId }));
  };

  const handleCodeChange = (newCode: string) => {
    setTabs(prev => ({
      ...prev,
      [language]: prev[language].map(tab =>
        tab.id === activeTabId[language] ? { ...tab, content: newCode } : tab
      ),
    }));
  };

  const handleAddTab = () => {
    const newTab = createDefaultTab(language, tabs[language].length + 1);
    setTabs(prev => ({
      ...prev,
      [language]: [...prev[language], newTab],
    }));
    setActiveTabId(prev => ({ ...prev, [language]: newTab.id }));
  };

  const handleCloseTab = (tabId: string) => {
    const currentLanguageTabs = tabs[language];

    // Don't allow closing the last tab
    if (currentLanguageTabs.length === 1) return;

    const tabIndex = currentLanguageTabs.findIndex(tab => tab.id === tabId);
    const newTabs = currentLanguageTabs.filter(tab => tab.id !== tabId);

    // If we're closing the active tab, switch to another one
    if (activeTabId[language] === tabId) {
      const newActiveTab = newTabs[Math.max(0, tabIndex - 1)];
      setActiveTabId(prev => ({ ...prev, [language]: newActiveTab.id }));
    }

    setTabs(prev => ({
      ...prev,
      [language]: newTabs,
    }));
  };

  const handleRenameTab = (tabId: string, newName: string) => {
    setTabs(prev => ({
      ...prev,
      [language]: prev[language].map(tab =>
        tab.id === tabId ? { ...tab, name: newName } : tab
      ),
    }));
  };

  const formatExecutionTime = (milliseconds: number): string => {
    if (milliseconds < 1) {
      return `${(milliseconds * 1000).toFixed(2)}μs`;
    } else if (milliseconds < 1000) {
      return `${milliseconds.toFixed(2)}ms`;
    } else if (milliseconds < 60000) {
      return `${(milliseconds / 1000).toFixed(2)}s`;
    } else {
      const minutes = Math.floor(milliseconds / 60000);
      const seconds = ((milliseconds % 60000) / 1000).toFixed(2);
      return `${minutes}m ${seconds}s`;
    }
  };

  const handleRunCode = async () => {
    setIsRunning(true);
    clearConsole();
    const startTime = performance.now();
    const codeToRun = currentActiveTab.content;

    try {
      addOutput(`Running ${language.charAt(0).toUpperCase() + language.slice(1)}...`, "info");

      // Execute code using unified executor with progress callbacks
      const result = await execute(
        language,
        codeToRun,
        (message, type) => {
          // Real-time progress updates for package installation
          addOutput(message, type === "error" ? "error" : "info");
        },
        (progress, message) => {
          // Runtime loading progress - show the overlay
          if (progress < 100) {
            setIsLoadingRuntime(true);
          }
          setLoadingProgress(progress);
          setLoadingMessage(message);
        }
      );
      setIsLoadingRuntime(false);
      setLoadingProgress(0);
      setLoadingMessage("");

      // Add outputs (filtering out progress messages that were already added via callback)
      result.forEach(output => {
        // Skip progress messages as they were already added in real-time via callback
        const isProgressMessage = output.content.startsWith('Installing ') ||
                                  output.content.startsWith('✓ ') ||
                                  output.content.startsWith('⚠ ') ||
                                  output.content.startsWith('✗ ');

        if (!isProgressMessage) {
          addOutput(output.content, output.type);
        }
      });

      // Calculate and display execution time
      const endTime = performance.now();
      const executionTime = endTime - startTime;
      addOutput(`\nExecution completed in ${formatExecutionTime(executionTime)}`, "info");
    } catch (error) {
      setIsLoadingRuntime(false);
      const errorMessage = error instanceof Error ? error.message : "An error occurred";
      addOutput(errorMessage, "error");

      // Still show execution time even on error
      const endTime = performance.now();
      const executionTime = endTime - startTime;
      addOutput(`\nExecution failed after ${formatExecutionTime(executionTime)}`, "info");
    } finally {
      setIsRunning(false);
    }
  };

  const handleMouseDown = useCallback(() => {
    setIsResizing(true);
  }, []);

  const handleMouseUp = useCallback(() => {
    setIsResizing(false);
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing || !containerRef.current) return;

    const container = containerRef.current;
    const containerRect = container.getBoundingClientRect();
    const newWidth = ((e.clientX - containerRect.left) / containerRect.width) * 100;

    // Clamp between 20% and 80%
    const clampedWidth = Math.min(Math.max(newWidth, 20), 80);
    setEditorWidth(clampedWidth);
  }, [isResizing]);

  // Add and remove event listeners for resizing
  useEffect(() => {
    if (isResizing) {
      window.addEventListener('mousemove', handleMouseMove as never);
      window.addEventListener('mouseup', handleMouseUp);
    } else {
      window.removeEventListener('mousemove', handleMouseMove as never);
      window.removeEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove as never);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, handleMouseMove, handleMouseUp]);

  // Save state to localStorage whenever tabs, activeTabId, or language changes
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const stateToSave = {
        tabs,
        activeTabId,
        language,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
    } catch (error) {
      console.error('Failed to save state:', error);
    }
  }, [tabs, activeTabId, language]);

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Language Selector and Actions */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4 p-3 sm:p-5 bg-gradient-to-br from-secondary/80 to-secondary/50 rounded-xl border border-secondary-light shadow-lg backdrop-blur-sm transition-all duration-300 hover:shadow-xl">
        <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
          <label className="text-light text-xs sm:text-sm font-semibold tracking-wide">Language:</label>
          <Select value={language} onValueChange={handleLanguageChange}>
            <SelectTrigger className="w-32 sm:w-44 bg-gradient-to-r from-secondary to-secondary-light border-secondary-light text-light font-medium shadow-md transition-all duration-300 rounded-lg text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-lg shadow-xl border-secondary-light">
              <SelectItem value="javascript" className="cursor-pointer hover:bg-accent/20 rounded-md transition-colors">JavaScript</SelectItem>
              <SelectItem value="php" className="cursor-pointer hover:bg-accent/20 rounded-md transition-colors">PHP</SelectItem>
              <SelectItem value="python" className="cursor-pointer hover:bg-accent/20 rounded-md transition-colors">Python</SelectItem>
              <SelectItem value="java" className="cursor-pointer hover:bg-accent/20 rounded-md transition-colors">Java</SelectItem>
              <SelectItem value="c" className="cursor-pointer hover:bg-accent/20 rounded-md transition-colors">C</SelectItem>
            </SelectContent>
          </Select>

          {/* Runtime Loading Progress Inline */}
          <div className="hidden sm:block">
            <RuntimeLoadingProgress
              language={language}
              isLoading={isLoadingRuntime}
              progress={loadingProgress}
              message={loadingMessage}
            />
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <Button
            onClick={clearConsole}
            variant="outline"
            size="sm"
            className="gap-1 sm:gap-2 bg-gradient-to-r from-secondary to-secondary-light border-secondary-light hover:border-red-400/50 hover:bg-red-500/10 shadow-md hover:shadow-lg transition-all duration-300 hover:scale-105 rounded-lg font-medium text-xs sm:text-sm flex-1 sm:flex-none"
          >
            <Trash2 className="w-3 h-3 sm:w-4 sm:h-4" />
            <span className="hidden xs:inline">Clear</span>
          </Button>

          <Button
            onClick={handleRunCode}
            disabled={isRunning || isLoadingRuntime}
            className="gap-1 sm:gap-2 bg-gradient-to-r from-accent to-accent/80 hover:from-accent/90 hover:to-accent/70 shadow-md hover:shadow-lg transition-all duration-300 hover:scale-105 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 text-xs sm:text-sm flex-1 sm:flex-none"
            size="sm"
          >
            <Play className="w-3 h-3 sm:w-4 sm:h-4" />
            {isLoadingRuntime ? "Loading..." : isRunning ? "Running..." : "Run"}
          </Button>
        </div>

        {/* Mobile Runtime Loading Progress */}
        <div className="block sm:hidden w-full">
          <RuntimeLoadingProgress
            language={language}
            isLoading={isLoadingRuntime}
            progress={loadingProgress}
            message={loadingMessage}
          />
        </div>
      </div>

      {/* Files */}
      <div className="flex items-center gap-2 overflow-x-auto bg-gradient-to-r from-secondary/40 to-secondary/30 p-2 sm:p-3 rounded-xl border border-secondary-light shadow-md backdrop-blur-sm scrollbar-thin scrollbar-thumb-secondary-light scrollbar-track-transparent">
        {currentTabs.map((tab) => (
          <div
            key={tab.id}
            onClick={() => handleTabChange(tab.id)}
            onDoubleClick={() => setEditingTabId(tab.id)}
            className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg cursor-pointer transition-all duration-300 group relative overflow-hidden flex-shrink-0 ${
              activeTabId[language] === tab.id
                ? "bg-gradient-to-r from-accent to-accent/80 text-white shadow-lg scale-105 font-medium"
                : "bg-secondary/70 hover:bg-secondary-light text-gress hover:shadow-md hover:scale-102"
            }`}
          >
            <div className={`absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 ${
              activeTabId[language] === tab.id ? "opacity-100" : "opacity-50"
            }`}></div>
            {editingTabId === tab.id ? (
              <input
                type="text"
                value={tab.name}
                onChange={(e) => handleRenameTab(tab.id, e.target.value)}
                onBlur={() => setEditingTabId(null)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    setEditingTabId(null);
                  }
                }}
                autoFocus
                onClick={(e) => e.stopPropagation()}
                className={`bg-transparent border-none outline-none text-xs sm:text-sm w-20 sm:w-24 relative z-10 ${
                  activeTabId[language] === tab.id ? "text-white" : "text-gress"
                }`}
              />
            ) : (
              <span className="text-xs sm:text-sm select-none relative z-10 whitespace-nowrap">{tab.name}</span>
            )}
            {currentTabs.length > 1 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleCloseTab(tab.id);
                }}
                className="opacity-0 group-hover:opacity-100 transition-all duration-300 hover:text-red-400 hover:rotate-90 relative z-10 hover:scale-110"
              >
                <X className="w-3 h-3 sm:w-4 sm:h-4" />
              </button>
            )}
          </div>
        ))}
        <button
          onClick={handleAddTab}
          className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg bg-gradient-to-r from-secondary/70 to-secondary hover:from-secondary-light hover:to-secondary-light text-gress transition-all duration-300 text-xs sm:text-sm font-medium shadow-md hover:shadow-lg flex-shrink-0 whitespace-nowrap"
        >
          <Plus className="w-3 h-3 sm:w-4 sm:h-4" />
          <span className="hidden sm:inline">New File</span>
        </button>
      </div>

      {/* Editor and Console */}
      <div
        ref={containerRef}
        className="hidden lg:flex h-[600px] relative rounded-xl overflow-hidden shadow-2xl border border-secondary-light/50"
        style={{ userSelect: isResizing ? 'none' : 'auto' }}
      >
        {/* Editor Panel */}
        <div style={{ width: `${editorWidth}%` }} className="h-full rounded-l-xl overflow-hidden shadow-lg">
          <EditorPanel
            language={language}
            code={currentActiveTab.content}
            onChange={handleCodeChange}
            onMount={handleEditorDidMount}
          />
        </div>

        {/* Resizable Divider */}
        <div
          onMouseDown={handleMouseDown}
          className="w-1 bg-gradient-to-b from-secondary-light via-secondary to-secondary-light hover:bg-gradient-to-b hover:from-accent hover:via-accent/80 hover:to-accent transition-all duration-300 cursor-col-resize flex items-center justify-center group relative"
        >
          <div className="absolute inset-y-0 -left-2 -right-2 flex items-center justify-center">
            <div className="bg-gradient-to-r from-secondary-light to-secondary group-hover:from-accent group-hover:to-accent/80 transition-all duration-300 rounded-full p-1.5 shadow-lg group-hover:shadow-xl group-hover:scale-110">
              <div className="flex items-center">
                <ChevronLeft className="w-3 h-3 text-light -mr-1" />
                <ChevronRight className="w-3 h-3 text-light -ml-1" />
              </div>
            </div>
          </div>
        </div>

        {/* Console Panel */}
        <div style={{ width: `${100 - editorWidth}%` }} className="h-full rounded-r-xl overflow-hidden shadow-lg">
          <ConsolePanel outputs={currentActiveTab.consoleOutput} />
        </div>
      </div>

      {/* Mobile Layout - Stack vertically */}
      <div className="flex lg:hidden flex-col gap-3 sm:gap-4 h-[calc(100vh-400px)] min-h-[500px] max-h-[700px]">
        <div className="h-1/2 rounded-xl overflow-hidden shadow-xl border border-secondary-light/50">
          <EditorPanel
            language={language}
            code={currentActiveTab.content}
            onChange={handleCodeChange}
            onMount={handleEditorDidMount}
          />
        </div>
        <div className="h-1/2 rounded-xl overflow-hidden shadow-xl border border-secondary-light/50">
          <ConsolePanel outputs={currentActiveTab.consoleOutput} />
        </div>
      </div>
    </div>
  );
}
