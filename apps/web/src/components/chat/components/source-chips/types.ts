import type { ReactNode } from 'react';
import type { ComponentType } from 'react';

import type { ChatSource, ChunkMetaType } from '@grabdy/contracts';
import type { IconProps } from '@phosphor-icons/react';

export type SourceGroupType = ChunkMetaType | 'UPLOAD';

export interface SourceGroup {
  type: SourceGroupType;
  label: string;
  icon: ReactNode;
  count: number;
  sources: ChatSource[];
}

export interface SourceItemProps {
  source: ChatSource;
  onOpen: (source: ChatSource) => void;
  /** When true, show only the location (e.g. "p. 5") instead of the full filename. */
  compact?: boolean;
}

export interface SourceChipsProps {
  sources: ChatSource[];
}

export type IconComponent = ComponentType<IconProps>;
