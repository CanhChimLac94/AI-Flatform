"use client";

import {
  catalogOptionValue,
  catalogSelectValue,
  displayModelLabel,
  groupDisplayName,
  parseCatalogOptionValue,
} from "@/lib/providerModelCatalog";
import type { ProviderModelGroup } from "@/lib/types";

interface GroupedModelSelectProps {
  groups: ProviderModelGroup[];
  value: string;
  valueProvider?: string;
  onChange: (modelId: string, provider?: string) => void;
  emptyOption?: string;
  allowEmpty?: boolean;
  disabled?: boolean;
  loading?: boolean;
  className?: string;
  id?: string;
}

export function GroupedModelSelect({
  groups,
  value,
  valueProvider,
  onChange,
  emptyOption,
  allowEmpty = true,
  disabled = false,
  loading = false,
  className = "",
  id,
}: GroupedModelSelectProps) {
  const selected = catalogSelectValue(groups, value, valueProvider);

  const handleChange = (next: string) => {
    if (!next) {
      onChange("", undefined);
      return;
    }
    const parsed = parseCatalogOptionValue(next);
    if (parsed) {
      onChange(parsed.modelId, parsed.provider);
      return;
    }
    onChange(next, undefined);
  };

  return (
    <select
      id={id}
      value={selected}
      onChange={(e) => handleChange(e.target.value)}
      disabled={disabled || loading || groups.length === 0}
      className={className}
    >
      {allowEmpty && emptyOption !== undefined && (
        <option value="">{emptyOption}</option>
      )}
      {groups.map((group) => (
        <optgroup key={group.provider} label={groupDisplayName(group)}>
          {group.models.map((entry) => (
            <option
              key={entry.id}
              value={catalogOptionValue(group.provider, entry.model_id)}
            >
              {displayModelLabel(entry)}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}
