interface HasParent {
  id: string;
  parentId: string | null;
}

export type TreeNode<T extends HasParent> = T & { children: TreeNode<T>[] };

export function buildTree<T extends HasParent>(items: T[]): TreeNode<T>[] {
  const childrenMap = new Map<string | null, T[]>();

  for (const item of items) {
    const key = item.parentId;
    const list = childrenMap.get(key);
    if (list) {
      list.push(item);
    } else {
      childrenMap.set(key, [item]);
    }
  }

  function buildChildren(parentId: string | null): TreeNode<T>[] {
    const children = childrenMap.get(parentId) ?? [];
    return children.map((item) => ({
      ...item,
      children: buildChildren(item.id),
    }));
  }

  return buildChildren(null);
}
