import type { BotSourceConfig } from '@grabdy/contracts';

export function formatSourceConfigSummary(config: BotSourceConfig): string {
  if (config.length === 0) return 'all sources';

  const folders = config.filter((e) => e.type === 'COLLECTION').length;
  const files = config.filter((e) => e.type === 'DATA_SOURCE').length;
  const integrations = config.filter(
    (e) => e.type === 'CONNECTION' || e.type === 'CONNECTION_RESOURCE'
  ).length;

  const parts: string[] = [];
  if (folders > 0) parts.push(`${folders} folder${folders === 1 ? '' : 's'}`);
  if (files > 0) parts.push(`${files} file${files === 1 ? '' : 's'}`);
  if (integrations > 0) parts.push(`${integrations} integration${integrations === 1 ? '' : 's'}`);

  return parts.join(', ');
}
