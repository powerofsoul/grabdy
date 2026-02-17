import { Box } from '@mui/material';

import {
  ConfluenceLogo,
  GoogleDriveLogo,
  LinearLogo,
  NotionLogo,
  SlackLogo,
} from '../landing/IntegrationLogos';

/* ── Brand SVGs not on the landing page ─────────────────────────── */

function JiraLogo({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="#2684FF">
      <path d="M11.571 11.513H0a5.218 5.218 0 0 0 5.232 5.215h2.13v2.057A5.215 5.215 0 0 0 12.575 24V12.518a1.005 1.005 0 0 0-1.005-1.005zm5.723-5.756H5.736a5.215 5.215 0 0 0 5.215 5.214h2.129v2.058a5.218 5.218 0 0 0 5.215 5.214V6.758a1.001 1.001 0 0 0-1.001-1.001zM23.013 0H11.455a5.215 5.215 0 0 0 5.215 5.215h2.129v2.057A5.215 5.215 0 0 0 24 12.483V1.005A1.001 1.001 0 0 0 23.013 0Z" />
    </svg>
  );
}

function GitHubLogo({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" opacity={0.85}>
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
    </svg>
  );
}

function AsanaLogo({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <defs>
        <radialGradient id="asana-g" cx="50%" cy="57.5%" r="50%" fx="50%" fy="57.5%">
          <stop offset="0%" stopColor="#FFB900" />
          <stop offset="60%" stopColor="#F95353" />
          <stop offset="100%" stopColor="#F95353" />
        </radialGradient>
      </defs>
      <circle cx="12" cy="6.08" r="5.22" fill="url(#asana-g)" />
      <circle cx="5.22" cy="17.78" r="5.22" fill="url(#asana-g)" />
      <circle cx="18.78" cy="17.78" r="5.22" fill="url(#asana-g)" />
    </svg>
  );
}

function FigmaLogo({ size = 24 }: { size?: number }) {
  // Official Figma paths scaled to fit 24x24 viewBox (original 100x150 scaled by 0.24/0.16)
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
      <path
        d="M33.33 100a16.67 16.67 0 0 0 16.67-16.67V66.67H33.33a16.67 16.67 0 0 0 0 33.33z"
        fill="#0ACF83"
      />
      <path
        d="M16.67 50a16.67 16.67 0 0 1 16.67-16.67H50V66.67H33.33A16.67 16.67 0 0 1 16.67 50z"
        fill="#A259FF"
      />
      <path
        d="M16.67 16.67A16.67 16.67 0 0 1 33.33 0H50v33.33H33.33A16.67 16.67 0 0 1 16.67 16.67z"
        fill="#F24E1E"
      />
      <path d="M50 0h16.67a16.67 16.67 0 0 1 0 33.33H50V0z" fill="#FF7262" />
      <path d="M83.33 50A16.67 16.67 0 1 1 50 50a16.67 16.67 0 0 1 33.33 0z" fill="#1ABCFE" />
    </svg>
  );
}

function TrelloLogo({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect width="24" height="24" rx="3.6" fill="#0079BF" />
      <rect x="3.6" y="3.6" width="7.2" height="16.8" rx="1.2" fill="#fff" />
      <rect x="13.2" y="3.6" width="7.2" height="10.8" rx="1.2" fill="#fff" />
    </svg>
  );
}

/* ── Provider config ────────────────────────────────────────────── */

/** Display-only key for all providers (including coming-soon ones). */
export type ProviderKey =
  | 'SLACK'
  | 'JIRA'
  | 'GITHUB'
  | 'NOTION'
  | 'CONFLUENCE'
  | 'GOOGLE_DRIVE'
  | 'ASANA'
  | 'LINEAR'
  | 'FIGMA'
  | 'TRELLO';

export const COMING_SOON_PROVIDERS = [
  'NOTION',
  'JIRA',
  'CONFLUENCE',
  'GOOGLE_DRIVE',
  'ASANA',
  'FIGMA',
  'TRELLO',
] as const satisfies readonly ProviderKey[];

type LogoComponent = ({ size }: { size?: number }) => React.JSX.Element;

interface ProviderConfig {
  icon: LogoComponent;
  label: string;
  color: string;
  description: string;
  details: string;
}

const PROVIDER_CONFIG: Record<ProviderKey, ProviderConfig> = {
  SLACK: {
    icon: SlackLogo,
    label: 'Slack',
    color: '#611f69',
    description: 'Messages, threads & bot',
    details:
      'Syncs channel history into searchable documents. @mention the bot in any channel to get instant answers from your knowledge base.',
  },
  JIRA: {
    icon: JiraLogo,
    label: 'Jira',
    color: '#0052CC',
    description: 'Issues & comments',
    details: 'Imports issues, comments & epics for contextual project search',
  },
  GITHUB: {
    icon: GitHubLogo,
    label: 'GitHub',
    color: '#181717',
    description: 'Issues, PRs & discussions',
    details: 'Imports issues, pull requests & discussions for contextual search',
  },
  NOTION: {
    icon: NotionLogo,
    label: 'Notion',
    color: '#000000',
    description: 'Pages & databases',
    details: 'Indexes pages & databases so your team knowledge is always findable',
  },
  CONFLUENCE: {
    icon: ConfluenceLogo,
    label: 'Confluence',
    color: '#1868DB',
    description: 'Pages & spaces',
    details: 'Syncs documentation spaces & pages into searchable knowledge',
  },
  GOOGLE_DRIVE: {
    icon: GoogleDriveLogo,
    label: 'Google Drive',
    color: '#4285F4',
    description: 'Docs, Sheets & Slides',
    details: 'Indexes documents, spreadsheets & presentations for full-text search',
  },
  ASANA: {
    icon: AsanaLogo,
    label: 'Asana',
    color: '#F06A6A',
    description: 'Tasks & projects',
    details: 'Syncs tasks, projects & comments so work context is searchable',
  },
  LINEAR: {
    icon: LinearLogo,
    label: 'Linear',
    color: '#5E6AD2',
    description: 'Issues & projects',
    details: 'Imports issues, projects & comments for engineering context search',
  },
  FIGMA: {
    icon: FigmaLogo,
    label: 'Figma',
    color: '#F24E1E',
    description: 'Files & comments',
    details: 'Indexes design files & comments to bridge design and development',
  },
  TRELLO: {
    icon: TrelloLogo,
    label: 'Trello',
    color: '#0079BF',
    description: 'Cards & boards',
    details: 'Syncs cards, boards & checklists into searchable project data',
  },
};

interface ProviderIconProps {
  provider: ProviderKey;
  size?: number;
}

export function ProviderIcon({ provider, size = 24 }: ProviderIconProps) {
  const config = PROVIDER_CONFIG[provider];
  if (!config) return null;

  const Icon = config.icon;

  return (
    <Box
      sx={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
    >
      <Icon size={size} />
    </Box>
  );
}

export function getProviderLabel(provider: ProviderKey): string {
  return PROVIDER_CONFIG[provider].label;
}

export function getProviderColor(provider: ProviderKey): string {
  return PROVIDER_CONFIG[provider].color;
}

export function getProviderDescription(provider: ProviderKey): string {
  return PROVIDER_CONFIG[provider].description;
}

export function getProviderDetails(provider: ProviderKey): string {
  return PROVIDER_CONFIG[provider].details;
}
