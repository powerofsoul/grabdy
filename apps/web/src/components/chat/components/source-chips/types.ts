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
}

export interface SourceChipsProps {
  sources: ChatSource[];
}

export type IconComponent = ComponentType<IconProps>;
