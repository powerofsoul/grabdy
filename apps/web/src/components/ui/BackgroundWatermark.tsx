import { Box, useTheme } from '@mui/material';
import { useLocation } from '@tanstack/react-router';

import svg1 from '@/assets/watermarks/svg-1.svg';
import svg2 from '@/assets/watermarks/svg-2.svg';
import svg3 from '@/assets/watermarks/svg-3.svg';
import svg4 from '@/assets/watermarks/svg-4.svg';
import svg5 from '@/assets/watermarks/svg-5.svg';
import svg6 from '@/assets/watermarks/svg-6.svg';
import svg7 from '@/assets/watermarks/svg-7.svg';
import svg8 from '@/assets/watermarks/svg-8.svg';
import svg9 from '@/assets/watermarks/svg-9.svg';

const ALL_SVGS = [svg1, svg2, svg3, svg4, svg5, svg6, svg7, svg8, svg9];

function pickSvg(pathname: string): string {
  let hash = 0;
  for (let i = 0; i < pathname.length; i++) {
    hash = ((hash << 5) - hash + pathname.charCodeAt(i)) | 0;
  }
  return ALL_SVGS[Math.abs(hash) % ALL_SVGS.length];
}

export function BackgroundWatermark() {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const location = useLocation();
  const svg = pickSvg(location.pathname);

  return (
    <Box
      component="img"
      src={svg}
      alt=""
      sx={{
        position: 'fixed',
        bottom: -60,
        right: -60,
        width: 600,
        height: 600,
        maxWidth: '100vw',
        mixBlendMode: isDark ? 'screen' : 'multiply',
        opacity: isDark ? 0.05 : 0.07,
        filter: isDark ? 'invert(1)' : 'none',
        pointerEvents: 'none',
        userSelect: 'none',
        zIndex: 0,
        display: { xs: 'none', sm: 'block' },
      }}
    />
  );
}
