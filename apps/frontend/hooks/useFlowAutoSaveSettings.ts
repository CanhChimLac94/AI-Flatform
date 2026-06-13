"use client";

import { useCallback, useEffect, useState } from "react";
import {
  type FlowAutoSaveSettings,
  loadFlowAutoSaveSettings,
  saveFlowAutoSaveSettings,
} from "@/lib/flowAutoSaveSettings";

export function useFlowAutoSaveSettings() {
  const [settings, setSettingsState] = useState<FlowAutoSaveSettings>(loadFlowAutoSaveSettings);

  useEffect(() => {
    setSettingsState(loadFlowAutoSaveSettings());
  }, []);

  const setSettings = useCallback((next: FlowAutoSaveSettings) => {
    setSettingsState(next);
    saveFlowAutoSaveSettings(next);
  }, []);

  return { settings, setSettings };
}
