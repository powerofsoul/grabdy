import { alpha, Box, IconButton, Tooltip, Typography, useTheme } from '@mui/material';
import { FolderIcon, PencilSimpleIcon } from '@phosphor-icons/react';
import { useNavigate } from '@tanstack/react-router';

interface FolderCardProps {
  id: string;
  name: string;
  sourceCount: number;
  onRename?: (id: string, name: string) => void;
}

export function FolderCard({ id, name, sourceCount, onRename }: FolderCardProps) {
  const navigate = useNavigate();
  const theme = useTheme();
  const ct = theme.palette.text.primary;

  return (
    <Box
      onClick={() =>
        navigate({
          to: '/dashboard/sources/$collectionId',
          params: { collectionId: id },
        })
      }
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        px: 2,
        py: 1.5,
        border: '1px solid',
        borderColor: 'divider',
        cursor: 'pointer',
        transition: 'all 120ms ease',
        '&:hover': {
          bgcolor: alpha(ct, 0.02),
          borderColor: alpha(ct, 0.2),
        },
        '&:hover .folder-actions': { opacity: 1 },
      }}
    >
      <Box sx={{ color: 'text.secondary' }}>
        <FolderIcon size={20} weight="light" color="currentColor" />
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontSize: 14, fontWeight: 500 }} noWrap>
          {name}
        </Typography>
        <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
          {sourceCount} {sourceCount === 1 ? 'file' : 'files'}
        </Typography>
      </Box>
      {onRename && (
        <Box className="folder-actions" sx={{ opacity: 0, transition: 'opacity 120ms ease' }}>
          <Tooltip title="Rename">
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                onRename(id, name);
              }}
            >
              <PencilSimpleIcon size={14} weight="light" />
            </IconButton>
          </Tooltip>
        </Box>
      )}
    </Box>
  );
}
