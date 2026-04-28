"use client";

// Reads daily quota from localStorage key set by the done SSE event.
// Shows a simple progress bar (Schema Group D / Business Rule #1).

import { useEffect, useState } from "react";

const DAILY_LIMIT = 50_000;
const STORAGE_KEY = "omni_daily_tokens";

export function QuotaMeter() {
  const [used, setUsed] = useState(0);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) setUsed(parseInt(stored, 10));

    const handler = () => {
      const v = localStorage.getItem(STORAGE_KEY);
      if (v) setUsed(parseInt(v, 10));
    };
    window.addEventListener("omni:quota_updated", handler);
    return () => window.removeEventListener("omni:quota_updated", handler);
  }, []);

  const pct = Math.min(100, Math.round((used / DAILY_LIMIT) * 100));
  const remaining = Math.max(0, DAILY_LIMIT - used).toLocaleString();

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-gray-500">
        <span>Daily quota</span>
        <span>{remaining} tokens left</span>
      </div>
      <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            pct > 80 ? "bg-red-500" : pct > 50 ? "bg-yellow-500" : "bg-accent"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
