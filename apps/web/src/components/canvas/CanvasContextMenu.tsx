import { alpha, Box, ListItemIcon, ListItemText, MenuItem, MenuList, Popover, useTheme } from '@mui/material';
import { ArrowLineDown, ArrowLineUp, Copy, Trash } from '@phosphor-icons/react';

interface CanvasContextMenuProps {
  anchorPosition: { x: number; y: number } | null;
  onClose: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onBringToFront?: () => void;
  onSendToBack?: () => void;
}

export function CanvasContextMenu({
  anchorPosition,
  onClose,
  onDelete,
  onDuplicate,
  onBringToFront,
  onSendToBack,
}: CanvasContextMenuProps) {
  const theme = useTheme();

  const itemSx = {
    fontSize: 13,
    py: 0.75,
    px: 1.5,
    minHeight: 0,
    '& .MuiListItemIcon-root': { minWidth: 28 },
  };

  return (
    <Popover
      open={anchorPosition !== null}
      onClose={onClose}
      anchorReference="anchorPosition"
      anchorPosition={anchorPosition ? { top: anchorPosition.y, left: anchorPosition.x } : undefined}
      slotProps={{
        paper: {
          sx: {
            borderRadius: 2,
            border: '1px solid',
            borderColor: alpha(theme.palette.text.primary, 0.1),
            boxShadow: `0 4px 16px ${alpha(theme.palette.text.primary, 0.1)}`,
            minWidth: 180,
          },
        },
      }}
    >
      <MenuList dense sx={{ py: 0.5 }}>
        <MenuItem onClick={() => { onDuplicate(); onClose(); }} sx={itemSx}>
          <ListItemIcon><Copy size={14} weight="light" color="currentColor" /></ListItemIcon>
          <ListItemText primaryTypographyProps={{ fontSize: 13 }}>Duplicate</ListItemText>
        </MenuItem>

        {(onBringToFront || onSendToBack) && (
          <Box sx={{ my: 0.5, borderTop: '1px solid', borderColor: alpha(theme.palette.text.primary, 0.08) }} />
        )}
        {onBringToFront && (
          <MenuItem onClick={() => { onBringToFront(); onClose(); }} sx={itemSx}>
            <ListItemIcon><ArrowLineUp size={14} weight="light" color="currentColor" /></ListItemIcon>
            <ListItemText primaryTypographyProps={{ fontSize: 13 }}>Bring to Front</ListItemText>
          </MenuItem>
        )}
        {onSendToBack && (
          <MenuItem onClick={() => { onSendToBack(); onClose(); }} sx={itemSx}>
            <ListItemIcon><ArrowLineDown size={14} weight="light" color="currentColor" /></ListItemIcon>
            <ListItemText primaryTypographyProps={{ fontSize: 13 }}>Send to Back</ListItemText>
          </MenuItem>
        )}

        <Box sx={{ my: 0.5, borderTop: '1px solid', borderColor: alpha(theme.palette.text.primary, 0.08) }} />

        <MenuItem
          onClick={() => { onDelete(); onClose(); }}
          sx={{
            ...itemSx,
            color: 'error.main',
            '& .MuiListItemIcon-root': { minWidth: 28, color: 'inherit' },
          }}
        >
          <ListItemIcon><Trash size={14} weight="light" color="currentColor" /></ListItemIcon>
          <ListItemText primaryTypographyProps={{ fontSize: 13 }}>Delete</ListItemText>
        </MenuItem>
      </MenuList>
    </Popover>
  );
}
