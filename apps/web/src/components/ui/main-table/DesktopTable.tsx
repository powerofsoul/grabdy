import { Fragment } from 'react';

import {
  Box,
  Collapse,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TableSortLabel,
  Tooltip,
} from '@mui/material';
import { ChevronDown, ChevronUp } from 'lucide-react';

import type {
  ColumnConfig,
  ExpansionState,
  HeaderConfig,
  InteractionConfig,
  PaginationState,
  RenderConfig,
  SortingState,
} from './types';

interface DesktopTableProps<T> {
  data: T[];
  header: HeaderConfig;
  columns: ColumnConfig;
  render: RenderConfig<T>;
  interaction: InteractionConfig<T>;
  sorting: SortingState;
  pagination: PaginationState;
  expansion: ExpansionState;
}

export function DesktopTable<T>({
  data,
  header,
  columns,
  render,
  interaction,
  sorting,
  pagination,
  expansion,
}: DesktopTableProps<T>) {
  return (
    <Paper
      sx={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <TableContainer sx={{ flex: 1, overflow: 'auto' }}>
        <Table aria-label="main table">
          <TableHead>
            <TableRow>
              {interaction.expandable && (
                <TableCell
                  sx={{
                    width: 48,
                    py: 1.5,
                    backgroundColor: 'grey.50',
                    position: 'sticky',
                    top: 0,
                    zIndex: 1,
                  }}
                />
              )}
              {Object.entries(header.names).map(([key, headerName]) => {
                const isSortable = sorting.sortableColumns.includes(key);
                const isActive = sorting.column === key;

                return (
                  <TableCell
                    key={key}
                    sortDirection={isActive ? sorting.direction : false}
                    sx={{
                      whiteSpace: 'nowrap',
                      py: 1.5,
                      backgroundColor: 'grey.50',
                      width: columns.widths?.[key],
                      position: 'sticky',
                      top: 0,
                      zIndex: 1,
                    }}
                  >
                    {isSortable ? (
                      <TableSortLabel
                        active={isActive}
                        direction={isActive ? sorting.direction : 'asc'}
                        onClick={() => sorting.onSort(key)}
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 0.75,
                          '& .MuiTableSortLabel-icon': {
                            opacity: isActive ? 1 : 0.3,
                          },
                        }}
                        hideSortIcon={false}
                      >
                        {header.icons?.[key]}
                        {headerName}
                      </TableSortLabel>
                    ) : (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                        {header.icons?.[key]}
                        {headerName}
                      </Box>
                    )}
                  </TableCell>
                );
              })}
            </TableRow>
          </TableHead>
          <TableBody>
            {data.map((item) => {
              const itemKey = render.keyExtractor(item);
              const isExpanded = expansion.expandedRows.has(itemKey);
              const columnCount =
                Object.keys(header.names).length + (interaction.expandable ? 1 : 0);

              return (
                <Fragment key={itemKey}>
                  <TableRow
                    onClick={() => {
                      if (interaction.expandable) {
                        expansion.toggleExpanded(itemKey);
                      } else {
                        interaction.onRowClick?.(item);
                      }
                    }}
                    sx={{
                      cursor:
                        interaction.expandable || interaction.onRowClick ? 'pointer' : 'default',
                      transition: 'background-color 0.15s ease',
                      '&:hover':
                        interaction.expandable || interaction.onRowClick
                          ? {
                              backgroundColor: 'grey.50',
                            }
                          : undefined,
                      '& > td': {
                        borderBottom: isExpanded ? 'none' : undefined,
                      },
                    }}
                  >
                    {interaction.expandable && (
                      <TableCell sx={{ py: 1, px: 1, width: 48 }}>
                        <Tooltip title={isExpanded ? 'Collapse' : 'Expand'}>
                          <IconButton size="small" sx={{ p: 0.5 }}>
                            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    )}
                    {Object.entries(render.items).map(([key, renderFn]) => (
                      <TableCell
                        key={key}
                        sx={{
                          py: 2,
                          whiteSpace: columns.noWrap?.includes(key) ? 'nowrap' : 'normal',
                        }}
                      >
                        {renderFn(item)}
                      </TableCell>
                    ))}
                  </TableRow>
                  {interaction.expandable && (
                    <TableRow>
                      <TableCell colSpan={columnCount} sx={{ p: 0 }}>
                        <Collapse in={isExpanded}>
                          <Box sx={{ p: 2, bgcolor: 'grey.50' }}>
                            {interaction.expandable.renderExpanded(item)}
                          </Box>
                        </Collapse>
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      {pagination.hasPagination && (
        <TablePagination
          rowsPerPageOptions={[5, 10, 25, 50]}
          component="div"
          count={pagination.totalCount}
          rowsPerPage={pagination.rowsPerPage}
          page={pagination.page}
          onPageChange={pagination.onPageChange}
          onRowsPerPageChange={(event) =>
            pagination.onRowsPerPageChange(parseInt(event.target.value, 10))
          }
          sx={{ borderTop: 1, borderColor: 'divider' }}
        />
      )}
    </Paper>
  );
}
