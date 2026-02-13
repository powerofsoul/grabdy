import { alpha, Box, Typography, useTheme } from '@mui/material';

import type { IntegrationProvider } from '@grabdy/contracts';

import { IntegrationCard } from './IntegrationCard';

const ALL_PROVIDERS = [
  'LINEAR',
  'GITHUB',
  'NOTION',
  'SLACK',
  'JIRA',
  'CONFLUENCE',
  'GOOGLE_DRIVE',
  'ASANA',
  'FIGMA',
  'TRELLO',
] as const satisfies readonly IntegrationProvider[];

export interface ConnectionSummary {
  provider: IntegrationProvider;
  status: string;
  lastSyncedAt: string | null;
  syncEnabled: boolean;
  syncIntervalMinutes: number;
  externalAccountName: string | null;
}

interface IntegrationGridProps {
  connections: ConnectionSummary[];
  onConnect: (provider: IntegrationProvider) => void;
  onManage: (provider: IntegrationProvider, connection: ConnectionSummary) => void;
}

const gridColumns = {
  xs: '1fr',
  sm: 'repeat(2, 1fr)',
  md: 'repeat(3, 1fr)',
  lg: 'repeat(4, 1fr)',
};

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <Typography
      variant="caption"
      sx={{
        textTransform: 'uppercase',
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: '0.06em',
        color: 'text.secondary',
      }}
    >
      {children}
    </Typography>
  );
}

export function IntegrationGrid({ connections, onConnect, onManage }: IntegrationGridProps) {
  const theme = useTheme();
  const ct = theme.palette.text.primary;

  const connectionsByProvider = new Map<IntegrationProvider, ConnectionSummary>();
  for (const conn of connections) {
    if (conn.status !== 'REVOKED') {
      connectionsByProvider.set(conn.provider, conn);
    }
  }

  const connectedProviders = ALL_PROVIDERS.filter((p) => connectionsByProvider.has(p));
  const availableProviders = ALL_PROVIDERS.filter((p) => !connectionsByProvider.has(p));
  const activeCount = connections.filter((c) => c.status === 'ACTIVE').length;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Summary bar */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          px: 2,
          py: 1.5,
          borderRadius: 2,
          bgcolor: alpha(ct, 0.02),
        }}
      >
        <Typography variant="body2" color="text.secondary">
          {activeCount === 0
            ? 'No integrations connected yet'
            : `${activeCount} of ${ALL_PROVIDERS.length} integrations connected`}
        </Typography>
      </Box>

      {/* Connected section */}
      {connectedProviders.length > 0 && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <SectionLabel>Connected</SectionLabel>
          <Box sx={{ display: 'grid', gridTemplateColumns: gridColumns, gap: 2 }}>
            {connectedProviders.map((provider) => (
              <IntegrationCard
                key={provider}
                provider={provider}
                connection={connectionsByProvider.get(provider) ?? null}
                onConnect={onConnect}
                onManage={onManage}
              />
            ))}
          </Box>
        </Box>
      )}

      {/* Available section */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        <SectionLabel>Available</SectionLabel>
        <Box sx={{ display: 'grid', gridTemplateColumns: gridColumns, gap: 2 }}>
          {availableProviders.map((provider) => (
            <IntegrationCard
              key={provider}
              provider={provider}
              connection={null}
              onConnect={onConnect}
              onManage={onManage}
            />
          ))}
        </Box>
      </Box>
    </Box>
  );
}
