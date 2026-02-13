import { Fragment } from 'react';

import { Box, Card, CardContent, Collapse, IconButton, Tooltip, Typography } from '@mui/material';
import { CaretDown, CaretUp } from '@phosphor-icons/react';

import type { ColumnConfig, HeaderConfig, InteractionConfig, RenderConfig } from './types';

interface MobileCardProps<T> {
  item: T;
  itemKey: string;
  isExpanded: boolean;
  header: HeaderConfig;
  columns: ColumnConfig;
  render: RenderConfig<T>;
  interaction: InteractionConfig<T>;
  onToggleExpand: (key: string) => void;
}

export function MobileCard<T>({
  item,
  itemKey,
  isExpanded,
  header,
  columns,
  render,
  interaction,
  onToggleExpand,
}: MobileCardProps<T>) {
  const handleClick = () => {
    if (interaction.expandable) {
      onToggleExpand(itemKey);
    } else {
      interaction.onRowClick?.(item);
    }
  };

  return (
    <Card
      onClick={handleClick}
      sx={{
        cursor: interaction.expandable || interaction.onRowClick ? 'pointer' : 'default',
        '&:hover':
          interaction.expandable || interaction.onRowClick
            ? { borderColor: 'grey.400' }
            : undefined,
        transition: 'border-color 0.2s ease',
      }}
    >
      <CardContent sx={{ p: 2.5, '&:last-child': { pb: interaction.expandable ? 0 : 2.5 } }}>
        {/* Card Header */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 1,
            mb: 2,
          }}
        >
          <Typography
            variant="subtitle1"
            component="div"
            sx={{
              color: 'text.primary',
              wordBreak: 'break-word',
              overflowWrap: 'break-word',
              flex: 1,
            }}
          >
            {render.rowTitle(item)}
          </Typography>
          {interaction.expandable && (
            <Tooltip title={isExpanded ? 'Collapse' : 'Expand'}>
              <IconButton size="small" sx={{ p: 0.5, flexShrink: 0 }}>
                {isExpanded ? <CaretUp size={18} weight="light" color="currentColor" /> : <CaretDown size={18} weight="light" color="currentColor" />}
              </IconButton>
            </Tooltip>
          )}
        </Box>

        {/* Card Data */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'auto 1fr',
            gap: 1.5,
            rowGap: 1,
            alignItems: 'start',
          }}
        >
          {Object.entries(render.items).map(([key, renderFn]) => {
            const headerName = header.names[key];
            const headerIcon = header.icons?.[key];
            const hasLabel = headerName || headerIcon;

            // Skip rendering if no label and no icon (e.g., actions column)
            if (!hasLabel) {
              return (
                <Box
                  key={`${key}-value`}
                  sx={{ gridColumn: '1 / -1', minWidth: 0, overflow: 'hidden' }}
                >
                  <Typography
                    variant="body2"
                    sx={{
                      color: 'text.primary',
                      fontSize: '0.875rem',
                      wordBreak: columns.noWrap?.includes(key) ? 'normal' : 'break-word',
                      overflowWrap: columns.noWrap?.includes(key) ? 'normal' : 'break-word',
                      whiteSpace: columns.noWrap?.includes(key) ? 'nowrap' : 'normal',
                    }}
                    component="div"
                  >
                    {renderFn(item)}
                  </Typography>
                </Box>
              );
            }

            return (
              <Fragment key={key}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  {headerIcon && (
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        color: 'text.secondary',
                        fontSize: '0.875rem',
                      }}
                    >
                      {headerIcon}
                    </Box>
                  )}
                  {headerName && (
                    <Typography
                      variant="caption"
                      sx={{
                        fontWeight: 500,
                        color: 'text.secondary',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {headerName}:
                    </Typography>
                  )}
                </Box>
                <Box sx={{ minWidth: 0, overflow: 'hidden' }}>
                  <Typography
                    variant="body2"
                    sx={{
                      color: 'text.primary',
                      fontSize: '0.875rem',
                      wordBreak: columns.noWrap?.includes(key) ? 'normal' : 'break-word',
                      overflowWrap: columns.noWrap?.includes(key) ? 'normal' : 'break-word',
                      whiteSpace: columns.noWrap?.includes(key) ? 'nowrap' : 'normal',
                    }}
                    component="div"
                  >
                    {renderFn(item)}
                  </Typography>
                </Box>
              </Fragment>
            );
          })}
        </Box>
      </CardContent>

      {/* Expandable Content */}
      {interaction.expandable && (
        <Collapse in={isExpanded}>
          <Box
            sx={{
              px: 2.5,
              pb: 2.5,
              pt: 1,
              borderTop: '1px solid',
              borderColor: 'divider',
              bgcolor: 'transparent',
            }}
          >
            {interaction.expandable.renderExpanded(item)}
          </Box>
        </Collapse>
      )}
    </Card>
  );
}
