import { useCallback, useMemo, useState } from 'react';

import type { DataSourceConfig } from '@grabdy/contracts';

import { formatSourceConfigSummary } from './formatSourceConfigSummary';

export function useChatSourceConfig() {
  const [config, setConfig] = useState<DataSourceConfig>([]);

  const isEmpty = config.length === 0;
  const summary = useMemo(() => formatSourceConfigSummary(config), [config]);
  const reset = useCallback(() => setConfig([]), []);

  return { config, setConfig, isEmpty, summary, reset };
}
