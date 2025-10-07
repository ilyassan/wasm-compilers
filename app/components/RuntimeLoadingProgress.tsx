"use client";

import { useEffect, useState } from "react";
import { HiRefresh } from "react-icons/hi";

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
    <div className="flex items-center gap-2 text-sm">
      {/* Spinning icon */}
      <HiRefresh className="w-4 h-4 text-accent animate-spin" />

      {/* Loading text */}
      <span className="text-gress">
        Downloading {languageName} compiler{dots}
      </span>

      {/* Progress percentage */}
      <span className="text-light font-medium">
        {progress.toFixed(0)}%
      </span>
    </div>
  );
}
