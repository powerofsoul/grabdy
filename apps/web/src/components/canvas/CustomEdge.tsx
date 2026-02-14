import { useCallback, useState } from 'react';

import { alpha, Box, IconButton, Popover, Tooltip, Typography, useTheme } from '@mui/material';
import { TrashIcon } from '@phosphor-icons/react';
import {
  BaseEdge,
  type EdgeProps,
  getBezierPath,
  useReactFlow,
} from '@xyflow/react';

const STROKE_OPTIONS = [2, 3, 4, 6] as const;

export function CustomEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
}: EdgeProps) {
  const theme = useTheme();
  const reactFlow = useReactFlow();
  const [anchorEl, setAnchorEl] = useState<SVGPathElement | null>(null);

  const strokeWidth = typeof data?.strokeWidth === 'number' ? data.strokeWidth : 2;

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  const handlePathClick = useCallback((e: React.MouseEvent<SVGPathElement>) => {
    e.stopPropagation();
    setAnchorEl(e.currentTarget);
  }, []);

  const handleDotClick = useCallback((e: React.MouseEvent<SVGCircleElement>) => {
    e.stopPropagation();
    // Use closest path sibling for Popover anchor
    const path = e.currentTarget.previousElementSibling?.previousElementSibling;
    if (path instanceof SVGPathElement) {
      setAnchorEl(path);
    }
  }, []);

  const handleClose = useCallback(() => {
    setAnchorEl(null);
  }, []);

  const updateEdgeData = useCallback((newData: Record<string, unknown>) => {
    if (typeof data?.onEdgeDataChange === 'function') {
      data.onEdgeDataChange(newData);
    }
  }, [data]);

  const handleStrokeChange = useCallback((width: number) => {
    updateEdgeData({ strokeWidth: width });
  }, [updateEdgeData]);

  const handleDelete = useCallback(() => {
    setAnchorEl(null);
    reactFlow.setEdges((edges) => edges.filter((e) => e.id !== id));
  }, [id, reactFlow]);

  const open = Boolean(anchorEl);
  const edgeColor = selected ? theme.palette.primary.main : alpha(theme.palette.text.primary, 0.3);

  return (
    <>
      {/* Invisible wide path for easier clicking */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={20}
        style={{ cursor: 'pointer' }}
        onClick={handlePathClick}
      />
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: edgeColor,
          strokeWidth,
          cursor: 'pointer',
        }}
      />
      {/* Click area on edge path */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={Math.max(12, strokeWidth + 8)}
        style={{ cursor: 'pointer' }}
        onClick={handlePathClick}
      />

      {/* Small dot at center of edge to indicate interactivity */}
      {selected && (
        <circle
          cx={labelX}
          cy={labelY}
          r={4}
          fill={theme.palette.primary.main}
          style={{ cursor: 'pointer' }}
          onClick={handleDotClick}
        />
      )}

      {/* Popover for editing edge properties */}
      {open && (
        <foreignObject x={labelX - 1} y={labelY - 1} width={2} height={2} style={{ overflow: 'visible' }}>
          <Popover
            open
            onClose={handleClose}
            anchorEl={anchorEl}
            anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
            transformOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            slotProps={{
              paper: {
                sx: {
                  p: 1.5,
                  borderRadius: 2,
                  boxShadow: `0 4px 20px ${alpha(theme.palette.text.primary, 0.15)}`,
                  minWidth: 160,
                },
              },
            }}
          >
            {/* Stroke width */}
            <Typography sx={{ fontSize: 11, fontWeight: 600, color: 'text.secondary', mb: 0.75 }}>
              Thickness
            </Typography>
            <Box sx={{ display: 'flex', gap: 0.5, mb: 1 }}>
              {STROKE_OPTIONS.map((w) => (
                <Box
                  key={w}
                  onClick={() => handleStrokeChange(w)}
                  sx={{
                    width: 28,
                    height: 28,
                    borderRadius: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    border: '1px solid',
                    borderColor: strokeWidth === w ? 'primary.main' : alpha(theme.palette.text.primary, 0.12),
                    bgcolor: strokeWidth === w ? alpha(theme.palette.primary.main, 0.08) : 'transparent',
                    '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.06) },
                  }}
                >
                  <Box
                    sx={{
                      width: 14,
                      height: w,
                      bgcolor: strokeWidth === w ? 'primary.main' : 'text.secondary',
                      borderRadius: 0.5,
                    }}
                  />
                </Box>
              ))}
            </Box>

            {/* Delete */}
            <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Tooltip title="Delete connection">
                <IconButton
                  size="small"
                  onClick={handleDelete}
                  sx={{
                    color: alpha(theme.palette.text.primary, 0.4),
                    '&:hover': { color: 'error.main', bgcolor: alpha(theme.palette.error.main, 0.08) },
                  }}
                >
                  <TrashIcon size={14} weight="light" color="currentColor" />
                </IconButton>
              </Tooltip>
            </Box>
          </Popover>
        </foreignObject>
      )}
    </>
  );
}
