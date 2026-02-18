import { useMemo } from 'react';

import type { CanvasState } from '@grabdy/contracts';
import { alpha, Box, Stack, Typography, useTheme } from '@mui/material';
import type { Edge, Node } from '@xyflow/react';

import { Canvas } from '@/components/canvas';
import { ChatMessages } from '@/components/chat/components/ChatMessages';
import type { ChatMessage } from '@/components/chat/types';
import { ResizablePanel } from '@/components/ui/ResizablePanel';

interface SharedChatViewProps {
  title: string | null;
  messages: ChatMessage[];
  canvasState: CanvasState | null;
}

function canvasToReactFlow(canvasState: CanvasState): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = canvasState.cards.map((card) => ({
    id: card.id,
    type: 'card',
    position: card.position,
    width: card.width,
    height: card.height,
    data: { ...card },
    zIndex: card.zIndex,
  }));

  const edges: Edge[] = canvasState.edges.map((edge) => ({
    id: edge.id,
    type: 'custom',
    source: edge.source,
    target: edge.target,
    label: edge.label,
    data: { strokeWidth: edge.strokeWidth },
  }));

  return { nodes, edges };
}

export function SharedChatView({ title, messages, canvasState }: SharedChatViewProps) {
  const theme = useTheme();
  const ct = theme.palette.text.primary;

  const hasCanvas = canvasState !== null && canvasState.cards.length > 0;
  const { nodes, edges } = useMemo(
    () => (hasCanvas ? canvasToReactFlow(canvasState) : { nodes: [], edges: [] }),
    [hasCanvas, canvasState]
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', bgcolor: 'background.default' }}>
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 2.5,
          height: 56,
          flexShrink: 0,
          borderBottom: '1px solid',
          borderColor: alpha(ct, 0.06),
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Typography variant="h5" sx={{ fontSize: 18, color: 'text.primary' }}>
            grabdy.
          </Typography>
          {title && (
            <>
              <Box sx={{ width: '1px', height: 20, bgcolor: alpha(ct, 0.1) }} />
              <Typography sx={{ fontSize: 13, color: 'text.secondary', fontWeight: 500 }} noWrap>
                {title}
              </Typography>
            </>
          )}
        </Box>
        <Typography sx={{ fontSize: 12, color: alpha(ct, 0.35) }}>
          Shared conversation snapshot
        </Typography>
      </Box>

      {/* Content */}
      {hasCanvas ? (
        <Box sx={{ display: 'flex', flex: 1, minHeight: 0 }}>
          <ResizablePanel
            direction="horizontal"
            defaultSize={Math.round(window.innerWidth * 0.4)}
            minSize={320}
            maxSize={900}
            resizeFrom="end"
            storageKey="shared-chat-panel-width"
            sx={{ minWidth: 0 }}
          >
            <ChatMessages messages={messages} isLoading={false} isStreaming={false} />
          </ResizablePanel>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Canvas readOnly nodes={nodes} edges={edges} />
          </Box>
        </Box>
      ) : (
        <Stack sx={{ flex: 1, minHeight: 0 }}>
          <ChatMessages messages={messages} isLoading={false} isStreaming={false} />
        </Stack>
      )}
    </Box>
  );
}
