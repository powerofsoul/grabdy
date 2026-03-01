import type { IntegrationProvider } from '@grabdy/contracts';

/** Providers where individual data sources can be selected (not just "All"). */
export const INDIVIDUALLY_SELECTABLE_PROVIDERS = [
  'SLACK',
  'NOTION',
  'GITHUB',
] as const satisfies readonly IntegrationProvider[];

export type IndividuallySelectableProvider = (typeof INDIVIDUALLY_SELECTABLE_PROVIDERS)[number];

/** Human-readable noun [singular, plural] for what a provider's data sources represent. */
export const PROVIDER_SOURCE_NOUN: Record<IntegrationProvider, [string, string]> = {
  SLACK: ['channel', 'channels'],
  NOTION: ['page', 'pages'],
  GITHUB: ['repo', 'repos'],
  LINEAR: ['issue', 'issues'],
};

export function isIndividuallySelectable(
  provider: IntegrationProvider
): provider is IndividuallySelectableProvider {
  return (INDIVIDUALLY_SELECTABLE_PROVIDERS as readonly string[]).includes(provider);
}
