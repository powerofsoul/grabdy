import { useCallback, useMemo, useState } from 'react';

import { Box, Typography } from '@mui/material';

import { FileIcon } from './FileIcon';
import { groupSources } from './helpers';
import { SourceItem } from './SourceItem';
import type { SourceChipsProps, SourceGroup, SourceGroupType } from './types';
import { useOpenSource } from './useOpenSource';

export function SourceChips({ sources }: SourceChipsProps) {
  const openSource = useOpenSource();
  const groups = useMemo(() => groupSources(sources, FileIcon), [sources]);
  const [expandedType, setExpandedType] = useState<SourceGroupType | null>(null);

  const handleGroupClick = useCallback(
    (group: SourceGroup) => {
      if (group.count === 1) {
        openSource(group.sources[0]);
        return;
      }
      setExpandedType((prev) => (prev === group.type ? null : group.type));
    },
    [openSource],
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
              '&:hover .source-label': { textDecoration: 'underline' },
            }}
          >
            {group.icon}
            <Typography
              className="source-label"
              sx={{ fontSize: '0.7rem', color: 'text.disabled', lineHeight: 1 }}
              noWrap
            >
              {group.label}
            </Typography>
          </Box>
        ))}
      </Box>

      {expandedType && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, pl: 0.25 }}>
          {groups
            .find((g) => g.type === expandedType)
            ?.sources.map((source) => (
              <SourceItem key={source.dataSourceId} source={source} onOpen={openSource} />
            ))}
        </Box>
      )}
    </Box>
  );
}
