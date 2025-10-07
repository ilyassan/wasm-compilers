"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

interface RuntimeLoadingProgressProps {
  language: string;
  isLoading: boolean;
  progress: number; // 0-100
  message?: string;
}

export default function RuntimeLoadingProgress({
  language,
  isLoading,
  progress,
}: RuntimeLoadingProgressProps) {
  const [dots, setDots] = useState("");

  useEffect(() => {
    if (!isLoading) return;

    const interval = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? "" : prev + "."));
    }, 500);

    return () => clearInterval(interval);
  }, [isLoading]);

  if (!isLoading) return null;

  const languageName = language.charAt(0).toUpperCase() + language.slice(1);

  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-accent/10 rounded-lg border border-accent/20">
      {/* Spinning icon */}
      <Loader2 className="w-4 h-4 text-accent animate-spin flex-shrink-0" />

      {/* Loading text */}
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-gress text-sm truncate">
          Downloading {languageName} compiler{dots}
        </span>

        {/* Progress percentage */}
        <span className="text-light font-semibold text-sm flex-shrink-0">
          {progress.toFixed(0)}%
        </span>
      </div>
    </div>
  );
}
