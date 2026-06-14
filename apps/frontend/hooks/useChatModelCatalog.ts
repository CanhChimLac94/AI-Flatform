"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { GUEST_SETTINGS_UPDATED_EVENT, loadChatModelCatalog } from "@/lib/providerModelCatalog";
import type { ProviderModelGroup } from "@/lib/types";

export function useChatModelCatalog() {
  const { isAuthenticated, isAuthReady } = useAuth();
  const [groups, setGroups] = useState<ProviderModelGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    const onGuestSettingsUpdated = () => setRefreshToken((n) => n + 1);
    window.addEventListener(GUEST_SETTINGS_UPDATED_EVENT, onGuestSettingsUpdated);
    return () => window.removeEventListener(GUEST_SETTINGS_UPDATED_EVENT, onGuestSettingsUpdated);
  }, []);

  useEffect(() => {
    if (!isAuthReady) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    loadChatModelCatalog(isAuthenticated)
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
  }, [isAuthenticated, isAuthReady, refreshToken]);

  return { groups, loading, error };
}
