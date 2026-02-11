import { useCallback, useEffect, useRef, useState } from 'react';

import { Box, CircularProgress, Fab, Stack } from '@mui/material';
import { ChevronUp } from 'lucide-react';

import { MobileCard } from './MobileCard';
import type {
  ColumnConfig,
  ExpansionState,
  HeaderConfig,
  InteractionConfig,
  PaginationState,
  RenderConfig,
} from './types';

interface MobileLayoutProps<T> {
  data: T[];
  header: HeaderConfig;
  columns: ColumnConfig;
  render: RenderConfig<T>;
  interaction: InteractionConfig<T>;
  pagination: PaginationState;
  expansion: ExpansionState;
  isLoading?: boolean;
}

export function MobileLayout<T>({
  data,
  header,
  columns,
  render,
  interaction,
  pagination,
  expansion,
  isLoading,
}: MobileLayoutProps<T>) {
  const [showBackToTop, setShowBackToTop] = useState(false);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Track scroll position for back-to-top button
  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      setShowBackToTop(scrollTop > 300);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Infinite scroll - load more when sentinel is visible
  const hasMore =
    pagination.hasPagination &&
    (pagination.page + 1) * pagination.rowsPerPage < pagination.totalCount;

  const loadMore = useCallback(() => {
    if (hasMore && !isLoading) {
      pagination.onPageChange(null, pagination.page + 1);
    }
  }, [hasMore, isLoading, pagination]);

  useEffect(() => {
    const sentinel = loadMoreRef.current;
    if (!sentinel || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMore();
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loadMore]);

  return (
    <Box>
      <Stack spacing={2}>
        {data.map((item) => {
          const itemKey = render.keyExtractor(item);
          return (
            <MobileCard
              key={itemKey}
              item={item}
              itemKey={itemKey}
              isExpanded={expansion.expandedRows.has(itemKey)}
              header={header}
              columns={columns}
              render={render}
              interaction={interaction}
              onToggleExpand={expansion.toggleExpanded}
            />
          );
        })}
      </Stack>

      {/* Infinite scroll sentinel */}
      {hasMore && (
        <Box
          ref={loadMoreRef}
          sx={{
            display: 'flex',
            justifyContent: 'center',
            py: 3,
          }}
        >
          {isLoading && <CircularProgress size={24} />}
        </Box>
      )}

      {showBackToTop && (
        <Fab
          size="medium"
          color="primary"
          onClick={scrollToTop}
          sx={{
            position: 'fixed',
            bottom: 80,
            right: 24,
            zIndex: 1000,
            boxShadow: 3,
            '&:hover': { boxShadow: 6 },
          }}
        >
          <ChevronUp size={24} />
        </Fab>
      )}
    </Box>
  );
}
