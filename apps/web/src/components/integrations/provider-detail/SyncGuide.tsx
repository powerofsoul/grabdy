import type { IntegrationProvider } from '@grabdy/contracts';
import { alpha, Box, Typography, useTheme } from '@mui/material';
import {
  ArrowsClockwiseIcon,
  ChatCircleDotsIcon,
  ClockIcon,
  GearIcon,
  HashIcon,
  type IconProps,
  LightbulbIcon,
} from '@phosphor-icons/react';

interface GuideStep {
  icon: React.ComponentType<IconProps>;
  text: string;
}

const GUIDE: Record<IntegrationProvider, GuideStep[]> = {
  SLACK: [
    { icon: HashIcon, text: 'Select which public channels to sync below.' },
    {
      icon: ClockIcon,
      text: 'The initial import may take a few minutes. New messages sync automatically.',
    },
    {
      icon: GearIcon,
      text: 'Only public channels are supported. Private channels cannot be synced.',
    },
    {
      icon: ChatCircleDotsIcon,
      text: 'Tag @Grabdy in any synced channel to ask questions using the default chat.',
    },
  ],
  GITHUB: [
    { icon: GearIcon, text: 'Select which repos to sync below.' },
    {
      icon: ArrowsClockwiseIcon,
      text: 'Issues, pull requests, and discussions are imported and kept up to date via webhooks.',
    },
    {
      icon: LightbulbIcon,
      text: 'Source code is not indexed yet, only issues, PRs, and discussions.',
    },
  ],
  NOTION: [
    { icon: ArrowsClockwiseIcon, text: 'Pages shared with Grabdy are synced automatically.' },
    {
      icon: ClockIcon,
      text: 'The initial import may take a few minutes. Changes are picked up on the next sync.',
    },
    {
      icon: GearIcon,
      text: 'Control which pages are synced from your Notion integration settings.',
    },
  ],
  LINEAR: [
    { icon: ArrowsClockwiseIcon, text: 'All issues from your workspace are synced automatically.' },
    {
      icon: ClockIcon,
      text: 'The initial import may take a few minutes. Updates sync on a regular schedule.',
    },
  ],
};

export function SyncGuide({ provider }: { provider: IntegrationProvider }) {
  const theme = useTheme();
  const steps = GUIDE[provider];

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 1.5,
        p: 2.5,
        borderRadius: 0,
        bgcolor: alpha(theme.palette.primary.main, 0.04),
        border: '1px solid',
        borderColor: alpha(theme.palette.primary.main, 0.1),
      }}
    >
      <Typography
        variant="caption"
        sx={{
          fontWeight: 600,
          fontSize: 11,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          color: 'primary.main',
          opacity: 0.7,
        }}
      >
        How it works
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
        {steps.map((step) => (
          <Box key={step.text} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.25 }}>
            <Box
              sx={{
                mt: '1px',
                width: 22,
                height: 22,
                borderRadius: 0,
                bgcolor: alpha(theme.palette.primary.main, 0.08),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <step.icon size={13} weight="bold" color={theme.palette.primary.main} />
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.55, pt: '1px' }}>
              {step.text}
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
