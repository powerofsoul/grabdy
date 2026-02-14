import { createContext, useCallback, useContext, useEffect, useMemo, useRef } from 'react';

interface EditModeContextValue {
  /** Whether any component in this card is currently being edited */
  isEditing: boolean;
  /** Register as the active editor. Provide save/discard refs that always point to current functions. */
  enterEdit: (saveRef: React.RefObject<() => void>, discardRef: React.RefObject<() => void>) => void;
  /** Unregister the active editor */
  exitEdit: () => void;
  /** Set the edit trigger callback that the card toolbar invokes */
  setEditTrigger: (trigger: (() => void) | null) => void;
}

export const EditModeContext = createContext<EditModeContextValue>({
  isEditing: false,
  enterEdit: () => {},
  exitEdit: () => {},
  setEditTrigger: () => {},
});

/**
 * Hook for canvas components to participate in card-level edit mode.
 *
 * Components call `startEdit` when entering edit mode and `endEdit` when done.
 * The CardNode renders Save/Discard buttons below the card and handles click-outside.
 *
 * Pass `onEdit` to register the component's edit handler so the card toolbar
 * can trigger edit mode. The hook calls `onEdit()` then enters edit mode automatically.
 */
export function useEditMode(onSave: () => void, onDiscard: () => void, onEdit?: () => void) {
  const ctx = useContext(EditModeContext);

  // Keep refs that always point to the latest callbacks (avoids stale closures)
  const saveRef = useRef(onSave);
  const discardRef = useRef(onDiscard);
  const editRef = useRef(onEdit);
  useEffect(() => { saveRef.current = onSave; }, [onSave]);
  useEffect(() => { discardRef.current = onDiscard; }, [onDiscard]);
  useEffect(() => { editRef.current = onEdit; }, [onEdit]);

  // Stable wrappers that read from refs
  const stableSaveRef = useRef(() => { saveRef.current(); });
  const stableDiscardRef = useRef(() => { discardRef.current(); });

  const startEdit = useCallback(() => {
    ctx.enterEdit(stableSaveRef, stableDiscardRef);
  }, [ctx]);

  const endEdit = useCallback(() => {
    ctx.exitEdit();
  }, [ctx]);

  // Wire toolbar trigger: call onEdit (component setup) then enter edit mode
  useEffect(() => {
    ctx.setEditTrigger(() => {
      editRef.current?.();
      ctx.enterEdit(stableSaveRef, stableDiscardRef);
    });
    return () => { ctx.setEditTrigger(null); };
  }, [ctx]);

  return useMemo(() => ({ startEdit, endEdit }), [startEdit, endEdit]);
}
