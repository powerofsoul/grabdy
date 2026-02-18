import { alpha, Box, Typography, useTheme } from '@mui/material';
import { FileIcon } from '@phosphor-icons/react';

interface DocumentLinkComponentProps {
  data: {
    documents: Array<{
      name: string;
      dataSourceId?: string;
    }>;
  };
}

export function DocumentLinkComponent({ data }: DocumentLinkComponentProps) {
  const theme = useTheme();

  return (
    <Box sx={{ p: 1.5, display: 'flex', flexDirection: 'column', gap: 0.75 }}>
      {data.documents.map((doc, i) => (
        <Box
          key={i}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            p: 1,
            borderRadius: 1,
            bgcolor: alpha(theme.palette.text.primary, 0.04),
            cursor: 'pointer',
            '&:hover': { bgcolor: alpha(theme.palette.text.primary, 0.08) },
          }}
        >
          <FileIcon
            size={14}
            weight="light"
            color="currentColor"
            style={{ flexShrink: 0, opacity: 0.5 }}
          />
          <Typography sx={{ fontSize: 12 }} noWrap>
            {doc.name}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}
