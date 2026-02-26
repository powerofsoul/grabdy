import { alpha, Box, Typography, useTheme } from '@mui/material';
import {
  FileCsvIcon,
  FileDocIcon,
  FilePdfIcon,
  FileTextIcon,
  FileXlsIcon,
} from '@phosphor-icons/react';

import {
  ConfluenceLogo,
  GmailLogo,
  GoogleDriveLogo,
  LinearLogo,
  NotionLogo,
  SlackLogo,
} from '../../IntegrationLogos';

const FILE_TYPES = [
  { name: 'PDF', Icon: FilePdfIcon },
  { name: 'Excel', Icon: FileXlsIcon },
  { name: 'Word', Icon: FileDocIcon },
  { name: 'CSV', Icon: FileCsvIcon },
  { name: 'Text', Icon: FileTextIcon },
] as const;

const CURRENT_INTEGRATIONS = [
  { name: 'Slack', Logo: SlackLogo },
  { name: 'GitHub', Logo: GitHubLogo },
  { name: 'Notion', Logo: NotionLogo },
  { name: 'Linear', Logo: LinearLogo },
] as const;

const UPCOMING_INTEGRATIONS = [
  { name: 'Google Drive', Logo: GoogleDriveLogo },
  { name: 'Gmail', Logo: GmailLogo },
  { name: 'Confluence', Logo: ConfluenceLogo },
  { name: 'Jira', Logo: JiraLogo },
  { name: 'Figma', Logo: FigmaLogo },
  { name: 'Trello', Logo: TrelloLogo },
] as const;

export function IntegrationsPanel() {
  const theme = useTheme();
  const ct = theme.palette.text.primary;

  return (
    <Box sx={{ maxWidth: 480 }}>
      {/* File uploads */}
      <SectionLabel>File uploads</SectionLabel>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 1.5, mb: 3 }}>
        {FILE_TYPES.map((file) => (
          <Box
            key={file.name}
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 1,
              p: 2,
              borderRadius: 2,
              bgcolor: alpha(ct, 0.03),
              border: '1px solid',
              borderColor: alpha(ct, 0.06),
              transition: 'background-color 0.2s ease',
              '&:hover': { bgcolor: alpha(ct, 0.06) },
            }}
          >
            <file.Icon size={28} weight="light" />
            <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary', fontWeight: 500 }}>
              {file.name}
            </Typography>
          </Box>
        ))}
      </Box>

      {/* Current integrations */}
      <SectionLabel>Connected</SectionLabel>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1.5, mb: 3 }}>
        {CURRENT_INTEGRATIONS.map((integration) => (
          <IntegrationTile key={integration.name} name={integration.name} Logo={integration.Logo} />
        ))}
      </Box>

      {/* Upcoming */}
      <SectionLabel muted>Coming soon</SectionLabel>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1.5, opacity: 0.5 }}>
        {UPCOMING_INTEGRATIONS.map((integration) => (
          <IntegrationTile
            key={integration.name}
            name={integration.name}
            Logo={integration.Logo}
            muted
          />
        ))}
      </Box>
    </Box>
  );
}

function SectionLabel({ children, muted = false }: { children: React.ReactNode; muted?: boolean }) {
  const theme = useTheme();
  const ct = theme.palette.text.primary;

  return (
    <Typography
      sx={{
        fontSize: '0.7rem',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        color: muted ? alpha(ct, 0.35) : 'text.secondary',
        mb: 1.5,
      }}
    >
      {children}
    </Typography>
  );
}

function IntegrationTile({
  name,
  Logo,
  muted = false,
}: {
  name: string;
  Logo: ({ size }: { size?: number }) => React.JSX.Element;
  muted?: boolean;
}) {
  const theme = useTheme();
  const ct = theme.palette.text.primary;

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 1,
        p: 2,
        borderRadius: 2,
        bgcolor: alpha(ct, 0.03),
        border: '1px solid',
        borderColor: alpha(ct, 0.06),
        transition: 'background-color 0.2s ease',
        ...(!muted && { '&:hover': { bgcolor: alpha(ct, 0.06) } }),
      }}
    >
      <Logo size={28} />
      <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary', fontWeight: 500 }}>
        {name}
      </Typography>
    </Box>
  );
}

/* Inline logo components for providers not in IntegrationLogos */

function GitHubLogo({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" opacity={0.85}>
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
    </svg>
  );
}

function JiraLogo({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="#2684FF">
      <path d="M11.571 11.513H0a5.218 5.218 0 0 0 5.232 5.215h2.13v2.057A5.215 5.215 0 0 0 12.575 24V12.518a1.005 1.005 0 0 0-1.005-1.005zm5.723-5.756H5.736a5.215 5.215 0 0 0 5.215 5.214h2.129v2.058a5.218 5.218 0 0 0 5.215 5.214V6.758a1.001 1.001 0 0 0-1.001-1.001zM23.013 0H11.455a5.215 5.215 0 0 0 5.215 5.215h2.129v2.057A5.215 5.215 0 0 0 24 12.483V1.005A1.001 1.001 0 0 0 23.013 0Z" />
    </svg>
  );
}

function FigmaLogo({ size = 24 }: { size?: number }) {
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
