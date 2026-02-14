import type { Icon } from '@phosphor-icons/react';
import {
  ArrowRightIcon,
  ArrowsOutCardinalIcon,
  MagnifyingGlassIcon,
  PencilSimpleIcon,
  PlusIcon,
  ScissorsIcon,
  TrashIcon,
} from '@phosphor-icons/react';

interface ToolDisplay {
  activeLabel: string;
  icon: Icon;
}

type ToolName = 'rag-search' | 'canvas_add_card' | 'canvas_remove_card' | 'canvas_move_card' | 'canvas_update_component' | 'canvas_add_edge' | 'canvas_remove_edge';

const TOOL_DISPLAY_MAP: Record<ToolName, ToolDisplay> = {
  'rag-search': {
    activeLabel: 'Searching knowledge base',
    icon: MagnifyingGlassIcon,
  },
  canvas_add_card: {
    activeLabel: 'Creating canvas card',
    icon: PlusIcon,
  },
  canvas_remove_card: {
    activeLabel: 'Removing card',
    icon: TrashIcon,
  },
  canvas_move_card: {
    activeLabel: 'Repositioning card',
    icon: ArrowsOutCardinalIcon,
  },
  canvas_update_component: {
    activeLabel: 'Updating card',
    icon: PencilSimpleIcon,
  },
  canvas_add_edge: {
    activeLabel: 'Connecting cards',
    icon: ArrowRightIcon,
  },
  canvas_remove_edge: {
    activeLabel: 'Removing connection',
    icon: ScissorsIcon,
  },
};

const DEFAULT_DISPLAY: ToolDisplay = {
  activeLabel: 'Processing',
  icon: MagnifyingGlassIcon,
};

function isToolName(name: string): name is ToolName {
  return name in TOOL_DISPLAY_MAP;
}

export function getToolDisplay(toolName: string): ToolDisplay {
  return isToolName(toolName) ? TOOL_DISPLAY_MAP[toolName] : DEFAULT_DISPLAY;
}
