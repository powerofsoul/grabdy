import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { type NonDbId, nonDbIdSchema } from '@grabdy/common';
import type { Card, CardMetadata, CardSource } from '@grabdy/contracts';
import { chatSourceSchema, type ChatSource } from '@grabdy/contracts';
import { alpha, Box, IconButton, Tooltip, Typography, useTheme } from '@mui/material';
import {
  DotsSixVerticalIcon,
  PencilSimpleIcon,
  SparkleIcon,
  TrashIcon,
} from '@phosphor-icons/react';
import { Handle, NodeResizeControl, Position, useStore } from '@xyflow/react';

import { SourceChips } from '../chat/components/source-chips';

const parseCardId = nonDbIdSchema('CanvasCard').parse;

import { EditActions } from './components/EditActions';
import { EditModeContext } from './hooks/useEditMode';
import { renderComponent } from './componentRegistry';

interface CardNodeData extends Record<string, unknown> {
  id: string;
  position: { x: number; y: number };
  width: number;
  height: number;
  title?: string;
  component: Card['component'];
  sources?: CardSource[];
  style?: { backgroundColor?: string; borderColor?: string };
  metadata?: CardMetadata;
  onDelete?: () => void;
  onComponentEdit?: (
    cardId: NonDbId<'CanvasCard'>,
    componentId: NonDbId<'CanvasComponent'>,
    data: Record<string, unknown>
  ) => void;
  onTitleEdit?: (cardId: string, title: string) => void;
  onResize?: (cardId: string, width: number) => void;
}

/** Selectors for elements that should block node dragging (text selection, inputs) */
const INTERACTIVE_SELECTOR = 'input, textarea, [contenteditable], .tiptap, .nodrag';

function cardSourcesToChat(sources: CardSource[]): ChatSource[] {
  const result: ChatSource[] = [];
  for (const s of sources) {
    if (!s.dataSourceId || !s.type) continue;
    const base = {
      dataSourceId: s.dataSourceId,
      dataSourceName: s.name,
      score: s.score ?? 0,
      type: s.type,
      sourceUrl: s.sourceUrl,
    };
    // Add type-specific metadata fields required by chatSourceSchema
    let full: Record<string, unknown> = base;
    if (s.type === 'PDF' || s.type === 'DOCX') {
      full = { ...base, pages: s.pages ?? [] };
    } else if (s.type === 'XLSX') {
      full = { ...base, sheet: s.sheet ?? '', rows: s.rows ?? [], columns: s.columns ?? [] };
    } else if (s.type === 'CSV') {
      full = { ...base, rows: s.rows ?? [], columns: s.columns ?? [] };
    }
    const parsed = chatSourceSchema.safeParse(full);
    if (parsed.success) result.push(parsed.data);
  }
  return result;
}

function CardNodeInner({ data }: { data: CardNodeData }) {
  const theme = useTheme();
  // Select only zoom — avoids re-rendering all cards on every pan
  const zoom = useStore((s) => s.transform[2]);
  const { onComponentEdit } = data;

  const contentRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  // Edit mode state
  const [isEditing, setIsEditing] = useState(false);
  const activeSaveRef = useRef<React.RefObject<() => void> | null>(null);
  const activeDiscardRef = useRef<React.RefObject<() => void> | null>(null);
  const editTriggerRef = useRef<(() => void) | null>(null);

  const setEditTrigger = useCallback((trigger: (() => void) | null) => {
    editTriggerRef.current = trigger;
  }, []);

  const enterEdit = useCallback(
    (saveRef: React.RefObject<() => void>, discardRef: React.RefObject<() => void>) => {
      activeSaveRef.current = saveRef;
      activeDiscardRef.current = discardRef;
      setIsEditing(true);
    },
    []
  );

  const exitEdit = useCallback(() => {
    activeSaveRef.current = null;
    activeDiscardRef.current = null;
    setIsEditing(false);
  }, []);

  const editContextValue = useMemo(
    () => ({ isEditing, enterEdit, exitEdit, setEditTrigger }),
    [isEditing, enterEdit, exitEdit, setEditTrigger]
  );

  // Bump z-index of the ReactFlow node wrapper when editing so card appears above others
  useEffect(() => {
    if (!isEditing || !cardRef.current) return;
    const nodeEl = cardRef.current.closest('.react-flow__node');
    if (!(nodeEl instanceof HTMLElement)) return;
    const prev = nodeEl.style.zIndex;
    nodeEl.style.zIndex = '1000';
    return () => {
      nodeEl.style.zIndex = prev;
    };
  }, [isEditing]);

  // Click outside the card to save (ignore MUI portals like Select/Popover)
  useEffect(() => {
    if (!isEditing) return;
    const handler = (e: MouseEvent) => {
      if (!(e.target instanceof HTMLElement)) return;
      if (cardRef.current && !cardRef.current.contains(e.target)) {
        // MUI renders Select/Popover/Menu in portals — don't treat those as "outside"
        const inPortal = e.target.closest(
          '.MuiPopover-root, .MuiPopper-root, .MuiModal-root, .MuiMenu-root'
        );
        if (inPortal) return;
        activeSaveRef.current?.current?.();
        exitEdit();
      }
    };
    // Use timeout to avoid catching the same click that triggered edit mode
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handler);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handler);
    };
  }, [isEditing, exitEdit]);

  const handleSave = useCallback(() => {
    activeSaveRef.current?.current?.();
    exitEdit();
  }, [exitEdit]);

  const handleDiscard = useCallback(() => {
    activeDiscardRef.current?.current?.();
    exitEdit();
  }, [exitEdit]);

  // Dynamically toggle nodrag class when pointer lands on an interactive element.
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    const target = e.target;
    if (!(target instanceof HTMLElement)) return;
    const isInteractive = target.closest(INTERACTIVE_SELECTOR) !== null;
    if (isInteractive && contentRef.current) {
      contentRef.current.classList.add('nodrag', 'nopan');
    }
  }, []);

  const handlePointerUp = useCallback(() => {
    if (contentRef.current) {
      contentRef.current.classList.remove('nodrag', 'nopan');
    }
  }, []);

  return (
    <EditModeContext.Provider value={editContextValue}>
      <Box
        ref={cardRef}
        sx={{
          width: '100%',
          borderRadius: 2,
          overflow: 'visible',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          bgcolor: 'background.paper',
          border: '1px solid',
          borderColor: isEditing
            ? alpha(theme.palette.primary.main, 0.4)
            : alpha(theme.palette.text.primary, 0.08),
          // Selection outline (ReactFlow adds .selected class)
          '&.selected, &:has(.react-flow__node.selected)': {
            outline: `2px dashed ${alpha(theme.palette.primary.main, 0.5)}`,
            outlineOffset: 4,
          },
          // Hover hint
          '&:hover': {
            borderColor: isEditing
              ? alpha(theme.palette.primary.main, 0.4)
              : alpha(theme.palette.text.primary, 0.15),
          },
          // Text cursor in editable areas (override ReactFlow's grab cursor)
          '& .tiptap, & input, & textarea, & .nodrag': {
            cursor: 'text',
          },
          // Handles
          '& .canvas-handle': {
            width: 16,
            height: 16,
            background: theme.palette.primary.main,
            border: `2.5px solid ${theme.palette.background.paper}`,
            borderRadius: '50%',
            opacity: 0,
            transition: 'opacity 200ms ease',
          },
          '&:hover .canvas-handle': {
            opacity: 1,
            cursor: 'crosshair',
          },
          '&:hover .drag-handle': {
            opacity: 1,
          },
          '& .resize-handle-icon': {
            opacity: 0.3,
            color: alpha(theme.palette.text.primary, 0.4),
            cursor: 'ew-resize',
          },
          '&:hover .resize-handle-icon': {
            opacity: 0.6,
          },
          '&:hover .card-toolbar': {
            opacity: 1,
          },
        }}
      >
        {/* Drag handle */}
        <Box
          className="drag-handle"
          sx={{
            position: 'absolute',
            top: 4,
            right: 4,
            zIndex: 5,
            opacity: 0,
            transition: 'opacity 200ms ease',
            cursor: 'grab',
            color: alpha(theme.palette.text.primary, 0.3),
            '&:hover': { color: alpha(theme.palette.text.primary, 0.5) },
            '&:active': { cursor: 'grabbing' },
          }}
        >
          <DotsSixVerticalIcon size={14} weight="light" color="currentColor" />
        </Box>

        {/* Content */}
        <Box
          ref={contentRef}
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          sx={{ overflow: 'visible', borderRadius: 'inherit' }}
        >
          {renderComponent(data.component, parseCardId(data.id), onComponentEdit)}
          {data.sources && data.sources.length > 0 && (
            <Box sx={{ px: 1.5, pb: 1, pt: 1.5 }}>
              <SourceChips sources={cardSourcesToChat(data.sources)} />
            </Box>
          )}
        </Box>

        {/* Connection handles */}
        <Handle type="source" position={Position.Top} id="top" className="canvas-handle" />
        <Handle type="source" position={Position.Right} id="right" className="canvas-handle" />
        <Handle type="source" position={Position.Bottom} id="bottom" className="canvas-handle" />
        <Handle type="source" position={Position.Left} id="left" className="canvas-handle" />

        {/* Width resize handle (bottom-right corner) */}
        <NodeResizeControl
          minWidth={200}
          position="bottom-right"
          onResize={() => {
            // LockIcon height during resize by resetting it to auto
            const nodeEl = cardRef.current?.closest('.react-flow__node');
            if (nodeEl instanceof HTMLElement) {
              nodeEl.style.height = 'auto';
            }
          }}
          onResizeEnd={(_event, params) => {
            if (data.onResize) {
              data.onResize(data.id, params.width);
            }
          }}
          style={{
            background: 'transparent',
            border: 'none',
          }}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            style={{
              position: 'absolute',
              right: 2,
              bottom: 2,
            }}
            className="resize-handle-icon"
          >
            <path
              d="M11 1L1 11M11 5L5 11M11 9L9 11"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </NodeResizeControl>

        {/* Floating toolbar below card — zoom-independent */}
        <Box
          className="card-toolbar nodrag nopan"
          sx={{
            position: 'absolute',
            bottom: 0,
            left: '50%',
            zIndex: 10,
            transform: `translateX(-50%) translateY(calc(100% + ${8 / zoom}px)) scale(${1 / zoom})`,
            transformOrigin: 'top center',
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            px: 1,
            py: 0.5,
            borderRadius: 3,
            bgcolor: 'background.paper',
            border: '1px solid',
            borderColor: alpha(theme.palette.text.primary, 0.12),
            boxShadow: `0 2px 8px ${alpha(theme.palette.text.primary, 0.1)}`,
            opacity: isEditing ? 1 : 0,
            transition: 'opacity 200ms ease',
            whiteSpace: 'nowrap',
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {/* Creator badge */}
          {data.metadata?.createdBy === 'ai' && (
            <>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                  px: 0.5,
                  color: 'primary.main',
                }}
              >
                <SparkleIcon size={14} weight="light" color="currentColor" />
                <Typography sx={{ fontSize: 12, fontWeight: 600, lineHeight: 1 }}>AI</Typography>
              </Box>
              <Box
                sx={{ width: '1px', height: 20, bgcolor: alpha(theme.palette.text.primary, 0.12) }}
              />
            </>
          )}

          {/* Actions */}
          {isEditing ? (
            <EditActions onDiscard={handleDiscard} onSave={handleSave} />
          ) : (
            <>
              {data.onComponentEdit && (
                <Tooltip title="Edit">
                  <IconButton
                    size="small"
                    onClick={() => editTriggerRef.current?.()}
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
                    <PencilSimpleIcon size={15} weight="light" color="currentColor" />
                  </IconButton>
                </Tooltip>
              )}
              {data.onDelete && (
                <Tooltip title="Delete">
                  <IconButton
                    size="small"
                    onClick={data.onDelete}
                    sx={{
                      width: 30,
                      height: 30,
                      color: alpha(theme.palette.text.primary, 0.5),
                      '&:hover': {
                        color: 'error.main',
                        bgcolor: alpha(theme.palette.error.main, 0.08),
                      },
                    }}
                  >
                    <TrashIcon size={15} weight="light" color="currentColor" />
                  </IconButton>
                </Tooltip>
              )}
            </>
          )}
        </Box>
      </Box>
    </EditModeContext.Provider>
  );
}

export const CardNode = memo(CardNodeInner);
