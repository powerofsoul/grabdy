import { ComponentType, createContext, ReactNode, useCallback, useContext, useState } from 'react';

import {
  Box,
  Dialog,
  Drawer,
  IconButton,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { X } from 'lucide-react';

export interface DrawerProps {
  onClose: () => void;
}

export type DrawerMode = 'drawer' | 'dialog';

interface DrawerStackItem {
  id: string;
  Component: ComponentType<DrawerProps & Record<string, unknown>>;
  props: Record<string, unknown>;
  title?: string;
  mode: DrawerMode;
  width?: number | string;
  maxWidth?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | false;
}

interface DrawerOptions {
  title?: string;
  mode?: DrawerMode;
  width?: number | string;
  maxWidth?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | false;
}

interface DrawerContextValue {
  pushDrawer: <P extends DrawerProps>(
    Component: ComponentType<P>,
    props?: Omit<P, 'onClose'> & DrawerOptions
  ) => void;
  popDrawer: () => void;
  closeAllDrawers: () => void;
  drawerCount: number;
}

const DrawerContext = createContext<DrawerContextValue | null>(null);

export function useDrawer() {
  const context = useContext(DrawerContext);
  if (!context) {
    throw new Error('useDrawer must be used within a DrawerProvider');
  }
  return context;
}

interface DrawerProviderProps {
  children: ReactNode;
}

const DRAWER_BASE_Z = 1300;
const DRAWER_Z_STEP = 100;

export function DrawerProvider({ children }: DrawerProviderProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [drawerStack, setDrawerStack] = useState<DrawerStackItem[]>([]);

  const pushDrawer = useCallback(
    <P extends DrawerProps>(
      Component: ComponentType<P>,
      props?: Omit<P, 'onClose'> & DrawerOptions
    ) => {
      const { title, mode = 'drawer', width, maxWidth, ...restProps } = props || {};
      const id = `drawer-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      setDrawerStack((prev) => [
        ...prev,
        {
          id,
          Component: Component as ComponentType<DrawerProps & Record<string, unknown>>,
          props: restProps,
          title,
          mode,
          width,
          maxWidth,
        },
      ]);
    },
    []
  );

  const popDrawer = useCallback(() => {
    setDrawerStack((prev) => prev.slice(0, -1));
  }, []);

  const closeAllDrawers = useCallback(() => {
    setDrawerStack([]);
  }, []);

  return (
    <DrawerContext.Provider
      value={{
        pushDrawer,
        popDrawer,
        closeAllDrawers,
        drawerCount: drawerStack.length,
      }}
    >
      {children}
      {drawerStack.map((item, index) => {
        const headerContent = (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              p: 2,
              borderBottom: '1px solid',
              borderColor: 'divider',
              bgcolor: 'background.paper',
              position: 'sticky',
              top: 0,
              zIndex: 1,
            }}
          >
            <Typography variant="h6" className="font-serif" sx={{ fontWeight: 700, color: 'text.primary' }}>
              {item.title || 'Details'}
            </Typography>
            <Tooltip title="Close">
              <IconButton onClick={popDrawer} size="small" sx={{ color: 'grey.500' }}>
                <X size={20} />
              </IconButton>
            </Tooltip>
          </Box>
        );

        const bodyContent = (
          <Box sx={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
            <item.Component onClose={popDrawer} {...item.props} />
          </Box>
        );

        const drawerZ = DRAWER_BASE_Z + index * DRAWER_Z_STEP;

        if (item.mode === 'dialog') {
          return (
            <Dialog
              key={item.id}
              open={true}
              onClose={popDrawer}
              fullScreen={isMobile}
              maxWidth={item.maxWidth ?? 'lg'}
              fullWidth
              sx={{
                zIndex: drawerZ,
                '& .MuiDialog-paper': {
                  ...(isMobile ? { borderRadius: 0 } : { maxHeight: '90vh' }),
                },
              }}
            >
              {headerContent}
              {bodyContent}
            </Dialog>
          );
        }

        return (
          <Drawer
            key={item.id}
            anchor="right"
            open={true}
            onClose={popDrawer}
            sx={{
              zIndex: drawerZ,
              '& .MuiDrawer-paper': {
                width: item.width ?? { xs: '100%', sm: 480, md: 560 },
                boxShadow: '-4px 0 24px rgba(0,0,0,0.08)',
              },
            }}
          >
            {headerContent}
            {bodyContent}
          </Drawer>
        );
      })}
    </DrawerContext.Provider>
  );
}
