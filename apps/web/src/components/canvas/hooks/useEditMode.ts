import { createContext, useCallback, useContext, useEffect, useMemo, useRef } from 'react';

interface EditModeContextValue {
  /** Whether any component in this card is currently being edited */
  isEditing: boolean;
  /** Register as the active editor. Provide save/discard refs that always point to current functions. */
  enterEdit: (saveRef: React.RefObject<() => void>, discardRef: React.RefObject<() => void>) => void;
  /** Unregister the active editor */
  exitEdit: () => void;
  /** Ref that the card toolbar calls to trigger edit mode */
  editTriggerRef: React.MutableRefObject<(() => void) | null>;
}

export const EditModeContext = createContext<EditModeContextValue>({
  isEditing: false,
  enterEdit: () => {},
  exitEdit: () => {},
  editTriggerRef: { current: null },
});

/**
 * Hook for canvas components to participate in card-level edit mode.
 *
 * Components call `startEdit` when entering edit mode and `endEdit` when done.
 * The CardNode renders Save/Discard buttons below the card and handles click-outside.
 *
 * Use `editHandlerRef` to register the component's edit handler
 * so the card toolbar can trigger edit mode:
 *
 *   const { startEdit, editHandlerRef } = useEditMode(handleSave, handleCancel);
 *   const handleStartEdit = () => { ... startEdit(); };
 *   editHandlerRef.current = handleStartEdit;
 */
export function useEditMode(onSave: () => void, onDiscard: () => void) {
  const ctx = useContext(EditModeContext);

  // Keep refs that always point to the latest callbacks (avoids stale closures)
  const saveRef = useRef(onSave);
  const discardRef = useRef(onDiscard);
  useEffect(() => { saveRef.current = onSave; });
  useEffect(() => { discardRef.current = onDiscard; });

  // Stable wrappers that read from refs
  const stableSaveRef = useRef(() => { saveRef.current(); });
  const stableDiscardRef = useRef(() => { discardRef.current(); });

  const startEdit = useCallback(() => {
    ctx.enterEdit(stableSaveRef, stableDiscardRef);
  }, [ctx]);

  const endEdit = useCallback(() => {
    ctx.exitEdit();
  }, [ctx]);

  // Edit trigger bridge — components assign to editHandlerRef, card toolbar invokes via context
  const editHandlerRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    ctx.editTriggerRef.current = () => editHandlerRef.current?.();
    return () => { ctx.editTriggerRef.current = null; };
  }, [ctx.editTriggerRef]);

  return useMemo(() => ({ startEdit, endEdit, editHandlerRef }), [startEdit, endEdit]);
}
