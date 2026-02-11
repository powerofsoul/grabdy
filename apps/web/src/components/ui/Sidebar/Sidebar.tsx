import { Box, useMediaQuery } from '@mui/material';

import { SidebarFull } from './SidebarFull';
import { SidebarStrip } from './SidebarStrip';

export function Sidebar() {
  // Desktop: >= 1024px, Tablet: 768-1023px, Mobile: < 768px
  const isDesktop = useMediaQuery('(min-width:1024px)');
  const isTablet = useMediaQuery('(min-width:768px)');

  // Mobile: hidden entirely
  if (!isTablet) {
    return null;
  }

  // Tablet: 56px strip
  if (!isDesktop) {
    return (
      <Box sx={{ width: 56, flexShrink: 0, height: '100%' }}>
        <SidebarStrip />
      </Box>
    );
  }

  // Desktop: full 240px
  return (
    <Box sx={{ width: 240, flexShrink: 0, height: '100%' }}>
      <SidebarFull />
    </Box>
  );
}
