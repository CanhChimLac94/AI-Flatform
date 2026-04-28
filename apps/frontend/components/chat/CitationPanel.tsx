"use client";

// US03 AC2: Side panel that opens when user clicks a [n] citation number.
// Does not interrupt the chat flow.

import { XMarkIcon, ArrowTopRightOnSquareIcon } from "@heroicons/react/24/outline";
import type { Citation } from "@/lib/types";

interface CitationPanelProps {
  citation: Citation;
  onClose: () => void;
}

export function CitationPanel({ citation, onClose }: CitationPanelProps) {
  return (
    <aside className="w-80 shrink-0 h-full bg-gray-800 border-l border-gray-700 flex flex-col animate-slide-in">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
        <span className="text-sm font-medium text-gray-200">Source [{citation.id}]</span>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
        >
          <XMarkIcon className="w-4 h-4" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        <p className="text-sm font-medium text-gray-200 leading-snug">
          {citation.title ?? citation.url}
        </p>
        <a
          href={citation.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-accent hover:text-accent-hover transition-colors"
        >
          Open source <ArrowTopRightOnSquareIcon className="w-3 h-3" />
        </a>
        <iframe
          src={citation.url}
          title={`Source ${citation.id}`}
          className="w-full h-64 rounded-lg border border-gray-700 bg-gray-900"
          sandbox="allow-scripts allow-same-origin"
        />
      </div>
    </aside>
  );
}
