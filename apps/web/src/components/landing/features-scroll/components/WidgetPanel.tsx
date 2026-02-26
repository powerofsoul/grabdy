import { Box } from '@mui/material';

import { MockBrowserFrame } from '../../widget-showcase/components/MockBrowserFrame';

export function WidgetPanel() {
  return (
    <Box sx={{ maxWidth: 560 }}>
      <MockBrowserFrame />
    </Box>
  );
}
