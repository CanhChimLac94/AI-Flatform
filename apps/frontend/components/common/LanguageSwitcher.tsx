'use client';

import React from 'react';
import { useI18n } from '@/contexts/I18nContext';

export const LanguageSwitcher: React.FC = () => {
  const { locale, setLocale, t } = useI18n();

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="language-select" className="text-sm font-medium text-gray-700 dark:text-gray-300">
        {t('settings.language', 'Language')}:
      </label>
      <select
        id="language-select"
        value={locale}
        onChange={(e) => setLocale(e.target.value as 'en' | 'vi')}
        className="px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
      >
        <option value="vi">Tiếng Việt (Vietnamese)</option>
        <option value="en">English</option>
      </select>
    </div>
  );
};
