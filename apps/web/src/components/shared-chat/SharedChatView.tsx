import { alpha, Box, Stack, Typography, useTheme } from '@mui/material';

import { ChatMessages } from '@/components/chat/components/ChatMessages';
import type { ChatMessage } from '@/components/chat/types';

interface SharedChatViewProps {
  title: string | null;
  messages: ChatMessage[];
}

export function SharedChatView({ title, messages }: SharedChatViewProps) {
  const theme = useTheme();
  const ct = theme.palette.text.primary;

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100dvh',
        overflow: 'hidden',
        bgcolor: 'background.default',
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: { xs: 1.5, md: 2.5 },
          height: 56,
          flexShrink: 0,
          borderBottom: '1px solid',
          borderColor: alpha(ct, 0.06),
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
          <Typography variant="h5" sx={{ fontSize: 18, color: 'text.primary', flexShrink: 0 }}>
            grabdy.
          </Typography>
          {title && (
            <>
              <Box sx={{ width: '1px', height: 20, bgcolor: alpha(ct, 0.1), flexShrink: 0 }} />
              <Typography sx={{ fontSize: 13, color: 'text.secondary', fontWeight: 500 }} noWrap>
                {title}
              </Typography>
            </>
          )}
        </Box>
        <Typography
          sx={{
            fontSize: 12,
            color: alpha(ct, 0.35),
            flexShrink: 0,
            display: { xs: 'none', sm: 'block' },
          }}
        >
          Shared conversation snapshot
        </Typography>
      </Box>

      {/* Content */}
      <Stack sx={{ flex: 1, minHeight: 0 }}>
        <ChatMessages messages={messages} isLoading={false} isStreaming={false} />
      </Stack>
    </Box>
  );
}
