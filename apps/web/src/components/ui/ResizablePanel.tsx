import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';

import { Box, type SxProps, type Theme } from '@mui/material';

// Resize handle dimensions
const HANDLE_THICKNESS = 6;
const INDICATOR_LENGTH = 40;
const INDICATOR_THICKNESS = 4;

interface ResizablePanelProps {
  children: ReactNode;
  /** Resize direction */
  direction: 'horizontal' | 'vertical';
  /** Default size in pixels (used if no localStorage value) */
  defaultSize: number;
  /** Minimum size in pixels */
  minSize: number;
  /** Maximum size in pixels */
  maxSize: number;
  /** localStorage key for persistence */
  storageKey: string;
  /** Which edge has the resize handle */
  resizeFrom: 'start' | 'end';
  /** Additional styles for the panel container */
  sx?: SxProps<Theme>;
  /** Additional styles for the resize handle */
  handleSx?: SxProps<Theme>;
  /** Callback when resize ends (optional, for parent to know final size) */
  onResizeEnd?: (size: number) => void;
  /** Hide the panel (but keep the component mounted) */
  hidden?: boolean;
}

/** Read initial size from localStorage synchronously to avoid layout flash */
function getInitialSize(
  storageKey: string,
  defaultSize: number,
  minSize: number,
  maxSize: number
): number {
  try {
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (typeof parsed === 'number' && parsed >= minSize && parsed <= maxSize) {
        return parsed;
      }
    }
  } catch {
    // ignore
  }
  return defaultSize;
}

/**
 * A resizable panel that doesn't cause children to re-render during resize.
 * Uses direct DOM manipulation via refs instead of React state.
 */
export function ResizablePanel({
  children,
  direction,
  defaultSize,
  minSize,
  maxSize,
  storageKey,
  resizeFrom,
  sx,
  handleSx,
  onResizeEnd,
  hidden = false,
}: ResizablePanelProps) {
  // Read initial size synchronously to avoid layout flash
  const [initialSize] = useState(() => getInitialSize(storageKey, defaultSize, minSize, maxSize));

  const panelRef = useRef<HTMLDivElement>(null);
  const isResizingRef = useRef(false);
  const currentSizeRef = useRef(initialSize);
  const cleanupRef = useRef<(() => void) | null>(null);

  // Only used for handle active state styling - doesn't affect children
  const [isResizing, setIsResizing] = useState(false);

  // Cleanup event listeners on unmount
  useEffect(() => {
    return () => {
      cleanupRef.current?.();
    };
  }, []);

  const startResize = useCallback(
    (startPos: number) => {
      const panel = panelRef.current;
      if (!panel) return;

      isResizingRef.current = true;
      setIsResizing(true);

      const startSize = direction === 'horizontal' ? panel.offsetWidth : panel.offsetHeight;

      // Set cursor globally
      const cursor = direction === 'horizontal' ? 'col-resize' : 'row-resize';
      document.body.style.cursor = cursor;
      document.body.style.userSelect = 'none';

      const handleMove = (currentPos: number) => {
        if (!isResizingRef.current || !panel) return;

        const delta = currentPos - startPos;

        // Calculate new size based on resize direction
        let newSize: number;
        if (resizeFrom === 'end') {
          // Handle on right/bottom edge - dragging right/down increases size
          newSize = startSize + delta;
        } else {
          // Handle on left/top edge - dragging left/up increases size
          newSize = startSize - delta;
        }

        // Clamp to min/max
        newSize = Math.max(minSize, Math.min(maxSize, newSize));
        currentSizeRef.current = newSize;

        // Direct DOM manipulation - no React re-render!
        if (direction === 'horizontal') {
          panel.style.width = `${newSize}px`;
        } else {
          panel.style.height = `${newSize}px`;
        }
      };

      const handleMouseMove = (e: MouseEvent) => {
        handleMove(direction === 'horizontal' ? e.clientX : e.clientY);
      };

      const handleTouchMove = (e: TouchEvent) => {
        if (e.touches.length === 1) {
          handleMove(direction === 'horizontal' ? e.touches[0].clientX : e.touches[0].clientY);
        }
      };

      const handleEnd = () => {
        isResizingRef.current = false;
        setIsResizing(false);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';

        // Persist to localStorage only on end
        localStorage.setItem(storageKey, JSON.stringify(currentSizeRef.current));

        // Notify parent if callback provided
        onResizeEnd?.(currentSizeRef.current);

        // Remove all listeners
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleEnd);
        document.removeEventListener('touchmove', handleTouchMove);
        document.removeEventListener('touchend', handleEnd);
        document.removeEventListener('touchcancel', handleEnd);
        cleanupRef.current = null;
      };

      // Store cleanup function for unmount
      cleanupRef.current = handleEnd;

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleEnd);
      document.addEventListener('touchmove', handleTouchMove, { passive: true });
      document.addEventListener('touchend', handleEnd);
      document.addEventListener('touchcancel', handleEnd);
    },
    [direction, resizeFrom, minSize, maxSize, storageKey, onResizeEnd]
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      startResize(direction === 'horizontal' ? e.clientX : e.clientY);
    },
    [direction, startResize]
  );

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length === 1) {
        startResize(direction === 'horizontal' ? e.touches[0].clientX : e.touches[0].clientY);
      }
    },
    [direction, startResize]
  );

  // Don't render anything if hidden
  if (hidden) {
    return null;
  }

  // Resize handle styles
  const handleStyles: SxProps<Theme> = {
    width: direction === 'horizontal' ? HANDLE_THICKNESS : undefined,
    height: direction === 'vertical' ? HANDLE_THICKNESS : undefined,
    cursor: direction === 'horizontal' ? 'col-resize' : 'row-resize',
    bgcolor: isResizing ? 'grey.300' : 'transparent',
    '&:hover': { bgcolor: 'grey.300' },
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    touchAction: 'none', // Prevent scroll on touch
    ...handleSx,
  };

  // Handle indicator (the little bar in the middle)
  const handleIndicator =
    direction === 'horizontal' ? (
      <Box
        sx={{
          width: INDICATOR_THICKNESS,
          height: INDICATOR_LENGTH,
          bgcolor: isResizing ? 'grey.400' : 'grey.300',
          borderRadius: 1,
        }}
      />
    ) : (
      <Box
        sx={{
          width: INDICATOR_LENGTH,
          height: INDICATOR_THICKNESS,
          bgcolor: isResizing ? 'grey.400' : 'grey.300',
          borderRadius: 1,
        }}
      />
    );

  // Initial size style
  const sizeStyle: React.CSSProperties =
    direction === 'horizontal' ? { width: initialSize } : { height: initialSize };

  // Determine flex direction based on resize handle position
  const containerFlexDirection =
    resizeFrom === 'start'
      ? direction === 'horizontal'
        ? 'row'
        : 'column'
      : direction === 'horizontal'
        ? 'row-reverse'
        : 'column-reverse';

  return (
    <Box sx={{ display: 'flex', flexDirection: containerFlexDirection }}>
      {/* Resize Handle */}
      <Box onMouseDown={handleMouseDown} onTouchStart={handleTouchStart} sx={handleStyles}>
        {handleIndicator}
      </Box>

      {/* Panel Content */}
      <Box
        ref={panelRef}
        style={sizeStyle}
        sx={{
          flexShrink: 0,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          ...sx,
        }}
      >
        {children}
      </Box>
    </Box>
  );
}
