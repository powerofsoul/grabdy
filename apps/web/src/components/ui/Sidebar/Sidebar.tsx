import { useCallback, useState } from 'react';

import { Box, useMediaQuery } from '@mui/material';

import { STORAGE_KEYS } from '@/lib/storage-keys';

import { SidebarFull } from './SidebarFull';
import { SidebarStrip } from './SidebarStrip';

function getInitialCollapsed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEYS.SIDEBAR_COLLAPSED) === 'true';
  } catch {
    return false;
  }
}

export function Sidebar() {
  // Desktop: >= 1024px, Tablet: 768-1023px, Mobile: < 768px
  const isDesktop = useMediaQuery('(min-width:1024px)');
  const isTablet = useMediaQuery('(min-width:768px)');
  const [collapsed, setCollapsed] = useState(getInitialCollapsed);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEYS.SIDEBAR_COLLAPSED, String(next));
      return next;
    });
  }, []);

  // Mobile: hidden entirely
  if (!isTablet) {
    return null;
  }

  // Tablet: always strip
  if (!isDesktop) {
    return (
      <Box sx={{ width: 56, flexShrink: 0, height: '100%' }}>
        <SidebarStrip onExpand={toggleCollapsed} />
      </Box>
    );
  }

  // Desktop: toggleable
  if (collapsed) {
    return (
      <Box sx={{ width: 56, flexShrink: 0, height: '100%' }}>
        <SidebarStrip onExpand={toggleCollapsed} />
      </Box>
    );
  }

  return (
    <Box sx={{ width: 240, flexShrink: 0, height: '100%' }}>
      <SidebarFull onCollapse={toggleCollapsed} />
    </Box>
  );
}
