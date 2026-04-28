'use client';

import React, { useEffect, useState } from 'react';
import { listProviders, fetchProviderModels } from '@/lib/api';
import type { ProviderCatalogItem } from '@/lib/types';
import { useI18n } from '@/contexts/I18nContext';

interface ProviderModelSelectorProps {
  selectedProvider: string;
  selectedModel: string;
  onProviderChange: (provider: string) => void;
  onModelChange: (model: string) => void;
  disabled?: boolean;
}

export const ProviderModelSelector: React.FC<ProviderModelSelectorProps> = ({
  selectedProvider,
  selectedModel,
  onProviderChange,
  onModelChange,
  disabled = false,
}) => {
  const { t } = useI18n();
  const [providers, setProviders] = useState<ProviderCatalogItem[]>([]);
  const [models, setModels] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  // Load providers on mount
  useEffect(() => {
    const loadProviders = async () => {
      try {
        setLoading(true);
        const data = await listProviders();
        setProviders(data);
        // Set default provider if none selected
        if (!selectedProvider && data.length > 0) {
          onProviderChange(data[0].id);
        }
      } catch (error) {
        console.error('Failed to load providers:', error);
      } finally {
        setLoading(false);
      }
    };
    loadProviders();
  }, [selectedProvider, onProviderChange]);

  // Load models when provider changes
  useEffect(() => {
    const loadModels = async () => {
      if (!selectedProvider) return;
      try {
        setLoading(true);
        const data = await fetchProviderModels(selectedProvider);
        setModels(data);
        // Set default model if none selected
        if (!selectedModel && data.length > 0) {
          onModelChange(data[0]);
        }
      } catch (error) {
        console.error('Failed to load models:', error);
      } finally {
        setLoading(false);
      }
    };
    loadModels();
  }, [selectedProvider, selectedModel, onModelChange]);

  const handleProviderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newProvider = e.target.value;
    onProviderChange(newProvider);
    // Reset model when provider changes
    const provider = providers.find((p) => p.id === newProvider);
    if (provider?.default_model) {
      onModelChange(provider.default_model);
    }
  };

  return (
    <div className="flex items-center gap-3 rounded-lg ">
      {/* Provider Selector */}
      <div className="flex flex-col gap-1">
        {/* <label htmlFor="provider-select" className="text-xs font-medium text-gray-400">
          {t('chat.provider', 'Provider')}
        </label> */}
        <select
          id="provider-select"
          value={selectedProvider}
          onChange={handleProviderChange}
          disabled={disabled || loading || providers.length === 0}
          className="px-2 py-1 text-sm bg-gray-700 text-white border border-gray-600 rounded focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <option value="">
            {loading ? t('common.loading', 'Loading...') : t('chat.selectProvider', 'Select Provider')}
          </option>
          {providers.map((provider) => (
            <option key={provider.id} value={provider.id}>
              {t(`providers.${provider.id}`, provider.name)}
            </option>
          ))}
        </select>
      </div>

      {/* Model Selector */}
      <div className="flex flex-col gap-1">
        {/* <label htmlFor="model-select" className="text-xs font-medium text-gray-400">
          {t('chat.model', 'Model')}
        </label> */}
        <select
          id="model-select"
          value={selectedModel}
          onChange={(e) => onModelChange(e.target.value)}
          disabled={disabled || loading || models.length === 0 || !selectedProvider}
          className="px-2 py-1 text-sm bg-gray-700 text-white border border-gray-600 rounded focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <option value="">
            {loading ? t('common.loading', 'Loading...') : t('chat.selectModel', 'Select Model')}
          </option>
          {models.map((model) => (
            <option key={model} value={model}>
              {t(`models.${model}`, model)}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};
