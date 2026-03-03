import { FolderIcon } from '@phosphor-icons/react';

import { PickerRow } from './PickerRow';

import type { TreeNode } from '@/components/ui/Sidebar/helpers';

interface FolderItem {
  id: string;
  name: string;
  parentId: string | null;
}

interface PickerNodeProps {
  node: TreeNode<FolderItem>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  ct: string;
  depth: number;
}

export function PickerNode({ node, selectedId, onSelect, ct, depth }: PickerNodeProps) {
  return (
    <>
      <PickerRow
        label={node.name}
        icon={<FolderIcon size={14} weight="light" color="currentColor" />}
        selected={selectedId === node.id}
        onClick={() => onSelect(node.id)}
        ct={ct}
        depth={depth}
      />
      {node.children.map((child) => (
        <PickerNode
          key={child.id}
          node={child}
          selectedId={selectedId}
          onSelect={onSelect}
          ct={ct}
          depth={depth + 1}
        />
      ))}
    </>
  );
}
