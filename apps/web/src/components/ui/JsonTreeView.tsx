import { useState } from 'react';

import { alpha, Box, Typography, useTheme } from '@mui/material';
import { CaretDownIcon, CaretRightIcon } from '@phosphor-icons/react';

function JsonNode({ keyName, value, depth }: { keyName?: string; value: unknown; depth: number }) {
  const theme = useTheme();
  const [collapsed, setCollapsed] = useState(depth > 2);

  const isObject = value !== null && typeof value === 'object' && !Array.isArray(value);
  const isArray = Array.isArray(value);
  const isExpandable = isObject || isArray;

  const renderValue = () => {
    if (value === null) {
      return (
        <Typography
          component="span"
          sx={{ fontSize: 12, fontFamily: 'monospace', color: 'text.secondary' }}
        >
          null
        </Typography>
      );
    }
    if (typeof value === 'boolean') {
      return (
        <Typography
          component="span"
          sx={{ fontSize: 12, fontFamily: 'monospace', color: 'info.main' }}
        >
          {value ? 'true' : 'false'}
        </Typography>
      );
    }
    if (typeof value === 'number') {
      return (
        <Typography
          component="span"
          sx={{ fontSize: 12, fontFamily: 'monospace', color: 'warning.main' }}
        >
          {String(value)}
        </Typography>
      );
    }
    if (typeof value === 'string') {
      return (
        <Typography
          component="span"
          sx={{ fontSize: 12, fontFamily: 'monospace', color: 'success.main' }}
        >
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
            <Typography
              component="span"
              sx={{ fontSize: 12, fontFamily: 'monospace', color: 'primary.main', fontWeight: 600 }}
            >
              {keyName}
            </Typography>
            <Typography
              component="span"
              sx={{ fontSize: 12, fontFamily: 'monospace', color: 'text.secondary' }}
            >
              :
            </Typography>
          </>
        )}
        {renderValue()}
      </Box>
    );
  }

  const entries = isArray
    ? value.map((v, i) => ({ key: String(i), value: v }))
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
          <CaretRightIcon size={12} weight="light" color={theme.palette.text.secondary} />
        ) : (
          <CaretDownIcon size={12} weight="light" color={theme.palette.text.secondary} />
        )}
        {keyName !== undefined && (
          <>
            <Typography
              component="span"
              sx={{ fontSize: 12, fontFamily: 'monospace', color: 'primary.main', fontWeight: 600 }}
            >
              {keyName}
            </Typography>
            <Typography
              component="span"
              sx={{ fontSize: 12, fontFamily: 'monospace', color: 'text.secondary', mr: 0.5 }}
            >
              :
            </Typography>
          </>
        )}
        <Typography
          component="span"
          sx={{ fontSize: 12, fontFamily: 'monospace', color: 'text.secondary' }}
        >
          {bracketOpen}
        </Typography>
        {collapsed && (
          <Typography
            component="span"
            sx={{ fontSize: 11, fontFamily: 'monospace', color: 'text.secondary' }}
          >
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

interface JsonTreeViewProps {
  value: unknown;
}

export function JsonTreeView({ value }: JsonTreeViewProps) {
  return <JsonNode value={value} depth={0} />;
}
