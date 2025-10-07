"use client";

import CodeEditor from "./components/CodeEditor";
import { HiCode } from "react-icons/hi";

export default function Home() {
  return (
    <div className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center gap-3 mb-8">
          <HiCode className="w-10 h-10 text-accent" />
          <div>
            <h1 className="text-4xl font-bold text-light">WASM Compilers</h1>
            <p className="text-gress mt-2">
              Write and execute JavaScript, PHP, Python, Java, and C code directly in your browser
            </p>
          </div>
        </div>

        <CodeEditor />
      </div>
    </div>
  );
}
