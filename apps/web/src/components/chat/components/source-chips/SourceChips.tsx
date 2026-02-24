import { useCallback, useMemo, useState } from 'react';

import type { ChatSource } from '@grabdy/contracts';
import { Box, Typography } from '@mui/material';

import { FileIcon } from './FileIcon';
import { expandGroupPages, groupSources } from './helpers';
import { SourceItem } from './SourceItem';
import type { SourceChipsProps, SourceGroup, SourceGroupType } from './types';
import { useOpenSource } from './useOpenSource';

/** Check if a source has multiple pages that should be expandable. */
function hasMultiplePages(source: ChatSource): boolean {
  return 'pages' in source && source.pages.length > 1;
}

export function SourceChips({ sources }: SourceChipsProps) {
  const openSource = useOpenSource();
  const groups = useMemo(() => groupSources(sources, FileIcon), [sources]);
  const [expandedType, setExpandedType] = useState<SourceGroupType | null>(null);

  const handleGroupClick = useCallback(
    (group: SourceGroup) => {
      // Multiple sources or a single source with multiple pages: expand
      if (group.count > 1 || (group.count === 1 && hasMultiplePages(group.sources[0]))) {
        setExpandedType((prev) => (prev === group.type ? null : group.type));
        return;
      }
      openSource(group.sources[0]);
    },
    [openSource]
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.25, alignItems: 'center' }}>
        {groups.map((group) => (
          <Box
            key={group.type}
            onClick={() => handleGroupClick(group)}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              cursor: 'pointer',
              minWidth: 0,
              maxWidth: '100%',
              '&:hover .source-label': { textDecoration: 'underline' },
            }}
          >
            {group.icon}
            <Typography
              className="source-label"
              sx={{ fontSize: '0.7rem', color: 'text.disabled', lineHeight: 1, minWidth: 0 }}
              noWrap
            >
              {group.label}
            </Typography>
          </Box>
        ))}
      </Box>

      {expandedType && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, pl: 0.25 }}>
          {expandGroupPages(groups.find((g) => g.type === expandedType)?.sources ?? []).map(
            (source, idx) => (
              <SourceItem
                key={`${source.dataSourceId}-${idx}`}
                source={source}
                onOpen={openSource}
                compact
              />
            )
          )}
        </Box>
      )}
    </Box>
  );
}
