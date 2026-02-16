import { useCallback, useState } from 'react';

import { packNonDbId } from '@grabdy/common';
import type { Card } from '@grabdy/contracts';
import { alpha, Box, IconButton, Popover, Tooltip, Typography, useTheme } from '@mui/material';
import { GridNineIcon } from '@phosphor-icons/react';
import { Panel } from '@xyflow/react';

import { useAuth } from '../../context/AuthContext';

import type { ComponentType } from './toolbar-constants';
import {
  COMPONENT_TEMPLATES,
  PRIMARY_ITEMS,
  SECONDARY_ITEMS,
  SMALL_TYPES,
  WIDE_TYPES,
} from './toolbar-constants';

interface CanvasToolbarProps {
  onStartPlacement: (card: Card) => void;
}

export function CanvasToolbar({ onStartPlacement }: CanvasToolbarProps) {
  const theme = useTheme();
  const { user, selectedOrgId } = useAuth();
  const [moreAnchor, setMoreAnchor] = useState<HTMLButtonElement | null>(null);

  const handleAdd = useCallback(
    (type: ComponentType) => {
      if (!selectedOrgId) return;
      const template = COMPONENT_TEMPLATES[type];

      const cardId = packNonDbId('CanvasCard', selectedOrgId);
      const componentId = packNonDbId('CanvasComponent', selectedOrgId);

      const width = SMALL_TYPES.has(type) ? 200 : WIDE_TYPES.has(type) ? 500 : 400;
      const height = SMALL_TYPES.has(type) ? 120 : 300;

      const card: Card = {
        id: cardId,
        position: { x: 0, y: 0 },
        width,
        height,
        title: undefined,
        component: { id: componentId, ...template },
        sources: [],
        metadata: {
          createdBy: user ? { userId: user.id, name: user.name } : 'ai',
          locked: false,
          tags: [],
        },
      };

      onStartPlacement(card);
    },
    [onStartPlacement, user, selectedOrgId]
  );

  const handleSecondaryAdd = useCallback(
    (type: ComponentType) => {
      setMoreAnchor(null);
      handleAdd(type);
    },
    [handleAdd]
  );

  return (
    <Panel position="bottom-center">
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.25,
          px: 1,
          py: 0.5,
          borderRadius: 3,
          bgcolor: 'background.paper',
          border: '1px solid',
          borderColor: alpha(theme.palette.text.primary, 0.12),
          boxShadow: `0 2px 8px ${alpha(theme.palette.text.primary, 0.1)}`,
        }}
      >
        {PRIMARY_ITEMS.map(({ type, icon: Icon, label }) => (
          <Tooltip key={type} title={label}>
            <IconButton
              size="small"
              onClick={() => handleAdd(type)}
              sx={{
                width: 30,
                height: 30,
                color: alpha(theme.palette.text.primary, 0.5),
                '&:hover': {
                  color: 'primary.main',
                  bgcolor: alpha(theme.palette.primary.main, 0.08),
                },
              }}
            >
              <Icon size={15} weight="light" />
            </IconButton>
          </Tooltip>
        ))}

        <Box
          sx={{
            width: '1px',
            height: 20,
            bgcolor: alpha(theme.palette.text.primary, 0.12),
            mx: 0.5,
          }}
        />

        <Tooltip title="More components">
          <IconButton
            size="small"
            onClick={(e) => setMoreAnchor(e.currentTarget)}
            sx={{
              width: 30,
              height: 30,
              color: moreAnchor ? 'primary.main' : alpha(theme.palette.text.primary, 0.5),
              bgcolor: moreAnchor ? alpha(theme.palette.primary.main, 0.08) : 'transparent',
              '&:hover': {
                color: 'primary.main',
                bgcolor: alpha(theme.palette.primary.main, 0.08),
              },
            }}
          >
            <GridNineIcon size={15} weight="light" />
          </IconButton>
        </Tooltip>
      </Box>

      <Popover
        open={Boolean(moreAnchor)}
        anchorEl={moreAnchor}
        onClose={() => setMoreAnchor(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        slotProps={{
          paper: {
            sx: {
              mt: -1,
              p: 1.5,
              borderRadius: 2,
              bgcolor: 'background.paper',
              border: '1px solid',
              borderColor: alpha(theme.palette.text.primary, 0.12),
              boxShadow: `0 4px 16px ${alpha(theme.palette.text.primary, 0.12)}`,
            },
          },
        }}
      >
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(5, 1fr)',
            gap: 0.5,
          }}
        >
          {SECONDARY_ITEMS.map(({ type, icon: Icon, label }) => (
            <Box
              key={type}
              onClick={() => handleSecondaryAdd(type)}
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 0.5,
                px: 1.5,
                py: 1,
                borderRadius: 1.5,
                cursor: 'pointer',
                color: alpha(theme.palette.text.primary, 0.6),
                '&:hover': {
                  color: 'primary.main',
                  bgcolor: alpha(theme.palette.primary.main, 0.08),
                },
              }}
            >
              <Icon size={18} weight="light" />
              <Typography
                variant="caption"
                sx={{
                  fontSize: '0.65rem',
                  lineHeight: 1,
                  color: 'inherit',
                  whiteSpace: 'nowrap',
                }}
              >
                {label}
              </Typography>
            </Box>
          ))}
        </Box>
      </Popover>
    </Panel>
  );
}
