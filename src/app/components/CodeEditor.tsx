"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useCodeExecutor, type Language } from "../hooks/useCodeExecutor";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { HiPlay, HiTrash, HiChevronLeft, HiChevronRight, HiPlus, HiX } from "react-icons/hi";
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

const createDefaultTab = (language: Language, index: number = 1): Tab => ({
  id: `${language}-${Date.now()}-${index}`,
  name: `${language === "javascript" ? "script" : language === "php" ? "index.php" : language === "python" ? "main.py" : language === "java" ? "Main.java" : language === "c" ? "main.c" : "file"}`,
  content: DEFAULT_CODE[language],
  consoleOutput: [],
});

export default function CodeEditor() {
  // Get language from URL query parameter, default to javascript
  const searchParams = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
  const urlLanguage = searchParams.get('language') as Language | null;
  const initialLanguage = urlLanguage && ["javascript", "php", "python", "java", "c"].includes(urlLanguage)
    ? urlLanguage
    : "javascript";

  const [language, setLanguage] = useState<Language>(initialLanguage);
  const [tabs, setTabs] = useState<LanguageTabs>({
    javascript: [createDefaultTab("javascript")],
    php: [createDefaultTab("php")],
    python: [createDefaultTab("python")],
    java: [createDefaultTab("java")],
    c: [createDefaultTab("c")],
  });
  const [activeTabId, setActiveTabId] = useState<Record<Language, string>>({
    javascript: tabs.javascript[0].id,
    php: tabs.php[0].id,
    python: tabs.python[0].id,
    java: tabs.java[0].id,
    c: tabs.c[0].id,
  });
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
        },
        currentActiveTab.name
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

  return (
    <div className="space-y-4">
      {/* Language Selector and Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-secondary/50 rounded-lg border border-secondary-light">
        <div className="flex items-center gap-3 flex-wrap">
          <label className="text-light text-sm font-medium">Language:</label>
          <Select value={language} onValueChange={handleLanguageChange}>
            <SelectTrigger className="w-40 bg-secondary border-secondary-light text-light">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="javascript">JavaScript</SelectItem>
              <SelectItem value="php">PHP</SelectItem>
              <SelectItem value="python">Python</SelectItem>
              <SelectItem value="java">Java</SelectItem>
              <SelectItem value="c">C</SelectItem>
            </SelectContent>
          </Select>

          {/* Runtime Loading Progress Inline */}
          <RuntimeLoadingProgress
            language={language}
            isLoading={isLoadingRuntime}
            progress={loadingProgress}
            message={loadingMessage}
          />
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={clearConsole}
            variant="outline"
            size="sm"
            className="gap-2"
          >
            <HiTrash className="w-4 h-4" />
            Clear
          </Button>

          <Button
            onClick={handleRunCode}
            disabled={isRunning || isLoadingRuntime}
            className="gap-2 bg-accent hover:bg-accent/90"
            size="sm"
          >
            <HiPlay className="w-4 h-4" />
            {isLoadingRuntime ? "Loading Runtime..." : isRunning ? "Running..." : "Run"}
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto bg-secondary/30 p-2 rounded-lg border border-secondary-light">
        {currentTabs.map((tab) => (
          <div
            key={tab.id}
            onClick={() => handleTabChange(tab.id)}
            onDoubleClick={() => setEditingTabId(tab.id)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded cursor-pointer transition-colors group ${
              activeTabId[language] === tab.id
                ? "bg-accent text-white"
                : "bg-secondary hover:bg-secondary-light text-gress"
            }`}
          >
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
                className={`bg-transparent border-none outline-none text-sm w-24 ${
                  activeTabId[language] === tab.id ? "text-white" : "text-gress"
                }`}
              />
            ) : (
              <span className="text-sm select-none">{tab.name}</span>
            )}
            {currentTabs.length > 1 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleCloseTab(tab.id);
                }}
                className="opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-400"
              >
                <HiX className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        ))}
        <button
          onClick={handleAddTab}
          className="flex items-center gap-1 px-3 py-1.5 rounded bg-secondary hover:bg-secondary-light text-gress transition-colors text-sm"
        >
          <HiPlus className="w-4 h-4" />
          New Tab
        </button>
      </div>

      {/* Editor and Console */}
      <div
        ref={containerRef}
        className="hidden lg:flex h-[600px] relative"
        style={{ userSelect: isResizing ? 'none' : 'auto' }}
      >
        {/* Editor Panel */}
        <div style={{ width: `${editorWidth}%` }} className="h-full">
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
          className="w-1 bg-secondary-light hover:bg-accent transition-colors cursor-col-resize flex items-center justify-center group relative"
        >
          <div className="absolute inset-y-0 -left-1 -right-1 flex items-center justify-center">
            <div className="bg-secondary-light group-hover:bg-accent transition-colors rounded-full p-1">
              <div className="flex items-center">
                <HiChevronLeft className="w-3 h-3 text-light -mr-1" />
                <HiChevronRight className="w-3 h-3 text-light -ml-1" />
              </div>
            </div>
          </div>
        </div>

        {/* Console Panel */}
        <div style={{ width: `${100 - editorWidth}%` }} className="h-full">
          <ConsolePanel outputs={currentActiveTab.consoleOutput} />
        </div>
      </div>

      {/* Mobile Layout - Stack vertically */}
      <div className="flex lg:hidden flex-col gap-4 h-[600px]">
        <div className="h-1/2">
          <EditorPanel
            language={language}
            code={currentActiveTab.content}
            onChange={handleCodeChange}
            onMount={handleEditorDidMount}
          />
        </div>
        <div className="h-1/2">
          <ConsolePanel outputs={currentActiveTab.consoleOutput} />
        </div>
      </div>
    </div>
  );
}
