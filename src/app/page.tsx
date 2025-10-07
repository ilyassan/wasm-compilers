"use client";

import CodeEditor from "./components/CodeEditor";
import { Code2 } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-dark via-secondary to-dark p-4 md:p-8">
      <div className="max-w-[1600px] mx-auto space-y-6">
        <div className="flex items-center gap-4 mb-8 bg-secondary/50 backdrop-blur-sm p-6 rounded-xl border border-secondary-light shadow-xl">
          <div className="p-3 bg-gradient-to-br from-accent to-blue-600 rounded-lg shadow-lg">
            <Code2 className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-light via-gray to-light bg-clip-text text-transparent">
              WASM Compilers
            </h1>
            <p className="text-gress mt-2 text-sm md:text-base">
              Write and execute JavaScript, PHP, Python, Java, and C code directly in your browser
            </p>
          </div>
        </div>

        <CodeEditor />
      </div>
    </div>
  );
}
