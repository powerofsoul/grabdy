import { alpha, Box, Typography, useTheme } from '@mui/material';
import { ChatCircleIcon } from '@phosphor-icons/react';

interface EmbedWelcomeProps {
  message?: string;
}

export function EmbedWelcome({ message }: EmbedWelcomeProps) {
  const theme = useTheme();

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        flex: 1,
        gap: 1.5,
        p: 3,
        textAlign: 'center',
      }}
    >
      <ChatCircleIcon size={40} weight="light" color={alpha(theme.palette.text.primary, 0.2)} />
      {message ? (
        <Typography
          variant="body2"
          sx={{ color: 'text.secondary', maxWidth: 300, lineHeight: 1.6 }}
        >
          {message}
        </Typography>
      ) : (
        <Typography variant="body2" sx={{ color: 'text.disabled' }}>
          Ask a question to get started
        </Typography>
      )}
    </Box>
  );
}
