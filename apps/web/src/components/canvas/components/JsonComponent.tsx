import { useCallback, useMemo, useState } from 'react';

import { alpha, Box, TextField, Typography, useTheme } from '@mui/material';
import { ChevronDown, ChevronRight } from 'lucide-react';

import { useEditMode } from '../hooks/useEditMode';

interface JsonComponentProps {
  data: {
    content: string;
  };
  onSave?: (data: Record<string, unknown>) => void;
}

function JsonNode({ keyName, value, depth }: { keyName?: string; value: unknown; depth: number }) {
  const theme = useTheme();
  const [collapsed, setCollapsed] = useState(depth > 2);

  const isObject = value !== null && typeof value === 'object' && !Array.isArray(value);
  const isArray = Array.isArray(value);
  const isExpandable = isObject || isArray;

  const renderValue = () => {
    if (value === null) {
      return (
        <Typography component="span" sx={{ fontSize: 12, fontFamily: 'monospace', color: 'text.secondary' }}>
          null
        </Typography>
      );
    }
    if (typeof value === 'boolean') {
      return (
        <Typography component="span" sx={{ fontSize: 12, fontFamily: 'monospace', color: 'info.main' }}>
          {value ? 'true' : 'false'}
        </Typography>
      );
    }
    if (typeof value === 'number') {
      return (
        <Typography component="span" sx={{ fontSize: 12, fontFamily: 'monospace', color: 'warning.main' }}>
          {String(value)}
        </Typography>
      );
    }
    if (typeof value === 'string') {
      return (
        <Typography component="span" sx={{ fontSize: 12, fontFamily: 'monospace', color: 'success.main' }}>
          &quot;{value}&quot;
        </Typography>
      );
    }
    return null;
  };

  if (!isExpandable) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, pl: depth * 1.5 }}>
        {keyName !== undefined && (
          <>
            <Typography component="span" sx={{ fontSize: 12, fontFamily: 'monospace', color: 'primary.main', fontWeight: 600 }}>
              {keyName}
            </Typography>
            <Typography component="span" sx={{ fontSize: 12, fontFamily: 'monospace', color: 'text.secondary' }}>
              :
            </Typography>
          </>
        )}
        {renderValue()}
      </Box>
    );
  }

  const entries = isArray
    ? (value).map((v, i) => ({ key: String(i), value: v }))
    : Object.entries(value).map(([k, v]) => ({ key: k, value: v }));

  const bracketOpen = isArray ? '[' : '{';
  const bracketClose = isArray ? ']' : '}';

  return (
    <Box>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.25,
          pl: depth * 1.5,
          cursor: 'pointer',
          '&:hover': { bgcolor: alpha(theme.palette.text.primary, 0.04) },
          borderRadius: 0.5,
        }}
        onClick={() => setCollapsed((prev) => !prev)}
      >
        {collapsed ? (
          <ChevronRight size={12} color={theme.palette.text.secondary} />
        ) : (
          <ChevronDown size={12} color={theme.palette.text.secondary} />
        )}
        {keyName !== undefined && (
          <>
            <Typography component="span" sx={{ fontSize: 12, fontFamily: 'monospace', color: 'primary.main', fontWeight: 600 }}>
              {keyName}
            </Typography>
            <Typography component="span" sx={{ fontSize: 12, fontFamily: 'monospace', color: 'text.secondary', mr: 0.5 }}>
              :
            </Typography>
          </>
        )}
        <Typography component="span" sx={{ fontSize: 12, fontFamily: 'monospace', color: 'text.secondary' }}>
          {bracketOpen}
        </Typography>
        {collapsed && (
          <Typography component="span" sx={{ fontSize: 11, fontFamily: 'monospace', color: 'text.secondary' }}>
            {entries.length} {entries.length === 1 ? 'item' : 'items'} {bracketClose}
          </Typography>
        )}
      </Box>
      {!collapsed && (
        <>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.15 }}>
            {entries.map((entry) => (
              <JsonNode
                key={entry.key}
                keyName={isArray ? undefined : entry.key}
                value={entry.value}
                depth={depth + 1}
              />
            ))}
          </Box>
          <Typography
            component="span"
            sx={{ fontSize: 12, fontFamily: 'monospace', color: 'text.secondary', pl: depth * 1.5 }}
          >
            {bracketClose}
          </Typography>
        </>
      )}
    </Box>
  );
}

export function JsonComponent({ data, onSave }: JsonComponentProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draftContent, setDraftContent] = useState(data.content);
  const [parseError, setParseError] = useState('');

  const handleSave = useCallback(() => {
    try {
      JSON.parse(draftContent);
      setParseError('');
      onSave?.({ content: draftContent });
      setIsEditing(false);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Invalid JSON';
      setParseError(message);
    }
  }, [draftContent, onSave]);

  const handleCancel = useCallback(() => {
    setIsEditing(false);
  }, []);

  const { startEdit, endEdit, editHandlerRef } = useEditMode(handleSave, handleCancel);

  const handleStartEdit = () => {
    setDraftContent(data.content);
    setParseError('');
    setIsEditing(true);
    startEdit();
  };
  editHandlerRef.current = handleStartEdit;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleCancel();
      endEdit();
    }
  };

  const parsedValue = useMemo(() => {
    try {
      return JSON.parse(data.content);
    } catch {
      return null;
    }
  }, [data.content]);

  if (isEditing) {
    return (
      <Box
        className="nodrag nowheel nopan"
        onKeyDown={handleKeyDown}
        sx={{ p: 1.5, display: 'flex', flexDirection: 'column', gap: 0.75 }}
      >
        <TextField
          multiline
          fullWidth
          minRows={3}
          maxRows={15}
          value={draftContent}
          onChange={(e) => setDraftContent(e.target.value)}
          autoFocus
          sx={{
            '& .MuiInputBase-root': { fontFamily: 'monospace', fontSize: 12 },
            '& .MuiInputBase-input': { py: 0.5 },
          }}
        />
        {parseError && (
          <Typography sx={{ fontSize: 11, color: 'error.main' }}>{parseError}</Typography>
        )}
      </Box>
    );
  }

  const parsed = parsedValue;

  return (
    <Box
      sx={{
        p: 1.5,
        position: 'relative',
        overflow: 'auto',
        maxHeight: 400,
      }}
    >
      {parsed !== null ? (
        <JsonNode value={parsed} depth={0} />
      ) : (
        <Typography sx={{ fontSize: 12, fontFamily: 'monospace', color: 'error.main' }}>
          Invalid JSON
        </Typography>
      )}
    </Box>
  );
}
