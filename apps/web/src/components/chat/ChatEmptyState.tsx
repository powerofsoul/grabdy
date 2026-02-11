import { Box, Chip, Typography } from '@mui/material';
import { FileSearch, HelpCircle, MessageSquare } from 'lucide-react';

const STARTER_PROMPTS = [
  { label: 'What data do I have available?', icon: <FileSearch size={14} /> },
  { label: 'Summarize my most recent documents', icon: <MessageSquare size={14} /> },
  { label: 'Help me find specific information', icon: <HelpCircle size={14} /> },
];

interface ChatEmptyStateProps {
  onPromptClick: (prompt: string) => void;
}

export function ChatEmptyState({ onPromptClick }: ChatEmptyStateProps) {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 3,
      }}
    >
      <Typography
        variant="h5"
        className="font-serif"
        sx={{ color: 'text.primary', fontWeight: 700, fontSize: '1.5rem' }}
      >
        What can I help you find?
      </Typography>

      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          gap: 1,
        }}
      >
        {STARTER_PROMPTS.map((prompt, index) => (
          <Chip
            key={index}
            icon={<Box sx={{ display: 'flex', color: 'text.secondary' }}>{prompt.icon}</Box>}
            label={prompt.label}
            variant="outlined"
            onClick={() => onPromptClick(prompt.label)}
            sx={{
              borderRadius: 3,
              py: 0.5,
              fontSize: '0.82rem',
              '&:hover': {
                bgcolor: 'action.hover',
              },
            }}
          />
        ))}
      </Box>
    </Box>
  );
}
