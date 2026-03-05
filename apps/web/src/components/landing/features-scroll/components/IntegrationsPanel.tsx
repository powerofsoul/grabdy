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
  { name: 'Google Drive', Logo: GoogleDriveLogo },
  { name: 'Gmail', Logo: GmailLogo },
  { name: 'Notion', Logo: NotionLogo },
  { name: 'Confluence', Logo: ConfluenceLogo },
] as const;

const UPCOMING_INTEGRATIONS = [
  { name: 'SharePoint', Logo: SharePointLogo },
  { name: 'Box', Logo: BoxLogo },
  { name: 'Slack', Logo: SlackLogo },
  { name: 'Jira', Logo: JiraLogo },
  { name: 'DocuSign', Logo: DocuSignLogo },
  { name: 'Dropbox', Logo: DropboxLogo },
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

function JiraLogo({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="#2684FF">
      <path d="M11.571 11.513H0a5.218 5.218 0 0 0 5.232 5.215h2.13v2.057A5.215 5.215 0 0 0 12.575 24V12.518a1.005 1.005 0 0 0-1.005-1.005zm5.723-5.756H5.736a5.215 5.215 0 0 0 5.215 5.214h2.129v2.058a5.218 5.218 0 0 0 5.215 5.214V6.758a1.001 1.001 0 0 0-1.001-1.001zM23.013 0H11.455a5.215 5.215 0 0 0 5.215 5.215h2.129v2.057A5.215 5.215 0 0 0 24 12.483V1.005A1.001 1.001 0 0 0 23.013 0Z" />
    </svg>
  );
}

function SharePointLogo({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="8" r="7" fill="#038387" />
      <circle cx="7" cy="15" r="5.5" fill="#37A0A4" />
      <circle cx="14" cy="18" r="4" fill="#7DCBCF" />
    </svg>
  );
}

function BoxLogo({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="#0061D5">
      <path d="M2.5 8.4L12 14.4l9.5-6L12 2.4 2.5 8.4zm0 2.4v4.8L12 21.6l9.5-6V10.8L12 16.8 2.5 10.8z" />
    </svg>
  );
}

function DocuSignLogo({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="#FFCD00">
      <path d="M4 4h16v16H4V4zm2 2v12h12V6H6zm3 3h6v2H9V9zm0 4h4v2H9v-2z" />
    </svg>
  );
}

function DropboxLogo({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="#0061FF">
      <path d="M7.1 2L1 6l5.1 4L12 6 7.1 2zM17 2l-5 4 6.1 4L23 6l-6-4zM1 14l6.1 4L12 14l-5.9-4L1 14zm16.9-4L12 14l5.1 4L23 14l-5.1-4zM12 15.4L6.1 19.4l1 .6 4.9-3.2 4.9 3.2 1-.6L12 15.4z" />
    </svg>
  );
}
