import {
  alpha,
  Box,
  Chip,
  IconButton,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material';
import {
  ClockCounterClockwiseIcon,
  FloppyDiskIcon,
  PencilSimpleIcon,
  XIcon,
} from '@phosphor-icons/react';

interface DocPageToolbarProps {
  title: string;
  isUserEdited: boolean;
  isSaving: boolean;
  isEditing: boolean;
  onEdit: () => void;
  onCloseEdit: () => void;
  onSave: () => void;
  showVersions: boolean;
  onToggleVersions: () => void;
}

export function DocPageToolbar({
  title,
  isUserEdited,
  isSaving,
  isEditing,
  onEdit,
  onCloseEdit,
  onSave,
  showVersions,
  onToggleVersions,
}: DocPageToolbarProps) {
  const theme = useTheme();

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        px: 2,
        py: 1,
        borderBottom: 1,
        borderColor: 'divider',
        bgcolor: alpha(theme.palette.background.default, 0.5),
      }}
    >
      <Typography
        variant="subtitle2"
        sx={{ fontWeight: 600, flex: 1, minWidth: 0 }}
        noWrap
      >
        {title}
      </Typography>

      {isUserEdited && (
        <Chip
          label="Edited"
          size="small"
          sx={{
            height: 20,
            fontSize: 11,
            fontWeight: 600,
            color: 'warning.main',
            bgcolor: alpha(theme.palette.warning.main, 0.08),
            border: 'none',
          }}
        />
      )}

      {isSaving && (
        <Typography variant="caption" color="text.secondary" sx={{ mr: 0.5 }}>
          Saving...
        </Typography>
      )}

      {isEditing ? (
        <>
          <Tooltip title="Save">
            <IconButton size="small" onClick={onSave} sx={{ color: 'text.secondary' }}>
              <FloppyDiskIcon size={18} weight="light" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Stop editing">
            <IconButton size="small" onClick={onCloseEdit} sx={{ color: 'text.secondary' }}>
              <XIcon size={18} weight="light" />
            </IconButton>
          </Tooltip>
        </>
      ) : (
        <Tooltip title="Edit">
          <IconButton size="small" onClick={onEdit} sx={{ color: 'text.secondary' }}>
            <PencilSimpleIcon size={18} weight="light" />
          </IconButton>
        </Tooltip>
      )}

      <Tooltip title={showVersions ? 'Hide versions' : 'Version history'}>
        <IconButton
          size="small"
          onClick={onToggleVersions}
          sx={{
            color: showVersions ? 'primary.main' : 'text.secondary',
          }}
        >
          <ClockCounterClockwiseIcon size={18} weight="light" />
        </IconButton>
      </Tooltip>
    </Box>
  );
}
