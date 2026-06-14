'use client';

import React from 'react';
import { GroupedModelSelect } from '@/components/common/GroupedModelSelect';
import { useChatModelCatalog } from '@/hooks/useChatModelCatalog';
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
  const { groups: modelGroups, loading } = useChatModelCatalog();

  const handleModelChange = (modelId: string, provider?: string) => {
    if (provider) onProviderChange(provider);
    onModelChange(modelId);
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 w-full min-w-0">
      <div className="flex flex-col gap-1 flex-1 min-w-0">
        <GroupedModelSelect
          groups={modelGroups}
          value={selectedModel}
          valueProvider={selectedProvider}
          onChange={handleModelChange}
          allowEmpty={false}
          emptyOption={t('common.loading', 'Loading...')}
          loading={loading}
          disabled={disabled}
          className="w-full sm:w-auto min-w-0 px-2 py-1 text-sm bg-gray-700 text-white border border-gray-600 rounded focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-50 disabled:cursor-not-allowed"
        />
      </div>
    </div>
  );
};
