"use client";

// US02 AC3: Copy, Like/Dislike, Re-generate buttons shown after streaming completes.

import { useState } from "react";
import {
  ClipboardIcon,
  HandThumbUpIcon,
  HandThumbDownIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline";
import { CheckIcon } from "@heroicons/react/20/solid";

interface ActionButtonsProps {
  content: string;
  onRegenerate?: () => void;
}

export function ActionButtons({ content, onRegenerate }: ActionButtonsProps) {
  const [copied, setCopied] = useState(false);
  const [vote, setVote] = useState<"up" | "down" | null>(null);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-center gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
      <button
        onClick={handleCopy}
        className="p-1 rounded hover:bg-gray-700 text-gray-500 hover:text-gray-300 transition-colors"
        title="Copy"
      >
        {copied ? (
          <CheckIcon className="w-3.5 h-3.5 text-green-400" />
        ) : (
          <ClipboardIcon className="w-3.5 h-3.5" />
        )}
      </button>
      <button
        onClick={() => setVote(vote === "up" ? null : "up")}
        className={`p-1 rounded hover:bg-gray-700 transition-colors ${
          vote === "up" ? "text-green-400" : "text-gray-500 hover:text-gray-300"
        }`}
        title="Like"
      >
        <HandThumbUpIcon className="w-3.5 h-3.5" />
      </button>
      <button
        onClick={() => setVote(vote === "down" ? null : "down")}
        className={`p-1 rounded hover:bg-gray-700 transition-colors ${
          vote === "down" ? "text-red-400" : "text-gray-500 hover:text-gray-300"
        }`}
        title="Dislike"
      >
        <HandThumbDownIcon className="w-3.5 h-3.5" />
      </button>
      {onRegenerate && (
        <button
          onClick={onRegenerate}
          className="p-1 rounded hover:bg-gray-700 text-gray-500 hover:text-gray-300 transition-colors"
          title="Re-generate"
        >
          <ArrowPathIcon className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
