import { createContext, useCallback, useContext, useEffect, useState } from 'react';

import { useLocation } from '@tanstack/react-router';

interface MobileSidebarState {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
}

const MobileSidebarContext = createContext<MobileSidebarState>({
  open: false,
  setOpen: () => {},
  toggle: () => {},
});

export function MobileSidebarProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  // Close on route change
  useEffect(() => {
    queueMicrotask(() => setOpen(false));
  }, [location.pathname]);

  const toggle = useCallback(() => setOpen((prev) => !prev), []);

  return (
    <MobileSidebarContext.Provider value={{ open, setOpen, toggle }}>
      {children}
    </MobileSidebarContext.Provider>
  );
}

export function useMobileSidebar() {
  return useContext(MobileSidebarContext);
}
