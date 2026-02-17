import type { IntegrationProvider } from '@grabdy/contracts';
import { alpha, Box, Typography, useTheme } from '@mui/material';

import { IntegrationCard } from './IntegrationCard';
import type { ProviderKey } from './ProviderIcon';
import { COMING_SOON_PROVIDERS } from './ProviderIcon';

export interface ConnectionSummary {
  provider: IntegrationProvider;
  status: string;
  lastSyncedAt: string | null;
  externalAccountName: string | null;
  syncScheduleLabel: string | null;
}

interface IntegrationGridProps {
  connections: ConnectionSummary[];
  onConnect: (provider: ProviderKey) => void;
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
      variant="overline"
      sx={{
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

  const activeCount = connections.filter((c) => c.status === 'ACTIVE').length;
  const totalCount = connections.length + COMING_SOON_PROVIDERS.length;

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
            : `${activeCount} of ${totalCount} integrations connected`}
        </Typography>
      </Box>

      {/* Connected section */}
      {connections.length > 0 && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <SectionLabel>Connected</SectionLabel>
          <Box sx={{ display: 'grid', gridTemplateColumns: gridColumns, gap: 2 }}>
            {connections.map((conn) => (
              <IntegrationCard
                key={conn.provider}
                provider={conn.provider}
                connection={conn}
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
          {/* Available provider cards (not yet connected) */}
          {!connections.some((c) => c.provider === 'SLACK') && (
            <IntegrationCard
              provider="SLACK"
              connection={null}
              onConnect={onConnect}
              onManage={onManage}
            />
          )}
          {!connections.some((c) => c.provider === 'LINEAR') && (
            <IntegrationCard
              provider="LINEAR"
              connection={null}
              onConnect={onConnect}
              onManage={onManage}
            />
          )}
          {/* Coming soon cards */}
          {COMING_SOON_PROVIDERS.map((provider) => (
            <IntegrationCard
              key={provider}
              provider={provider}
              connection={null}
              onManage={onManage}
            />
          ))}
        </Box>
      </Box>
    </Box>
  );
}
