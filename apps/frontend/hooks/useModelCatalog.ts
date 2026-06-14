"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { loadModelCatalog } from "@/lib/providerModelCatalog";
import type { ProviderModelGroup } from "@/lib/types";

export function useModelCatalog() {
  const { isAuthenticated, isAuthReady } = useAuth();
  const [groups, setGroups] = useState<ProviderModelGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthReady) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    loadModelCatalog(isAuthenticated)
      .then((data) => {
        if (!cancelled) setGroups(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setGroups([]);
          setError(err instanceof Error ? err.message : "Failed to load models");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, isAuthReady]);

  return { groups, loading, error };
}
