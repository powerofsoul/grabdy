import { useState } from 'react';

import type { BotSourceConfig } from '@grabdy/contracts';
import { Box, Collapse, Stack, Typography } from '@mui/material';
import { CaretDownIcon, CaretRightIcon } from '@phosphor-icons/react';

import { isIndividuallySelectable, PROVIDER_SOURCE_NOUN } from '../constants';
import type { IntegrationSection } from '../types';

import { SourceChip } from './SourceChip';

import { getProviderLabel, ProviderIcon } from '@/components/integrations/ProviderIcon';

interface IntegrationChipsProps {
  sections: IntegrationSection[];
  value: BotSourceConfig;
  onChange: (config: BotSourceConfig) => void;
}

export function IntegrationChips({ sections, value, onChange }: IntegrationChipsProps) {
  if (sections.length === 0) return null;

  return (
    <Stack spacing={1}>
      {sections.map((section) => (
        <IntegrationRow
          key={section.connectionId}
          section={section}
          value={value}
          onChange={onChange}
        />
      ))}
    </Stack>
  );
}

function IntegrationRow({
  section,
  value,
  onChange,
}: {
  section: IntegrationSection;
  value: BotSourceConfig;
  onChange: (config: BotSourceConfig) => void;
}) {
  const hasResources = section.resources.length > 0;
  const isIndividual = isIndividuallySelectable(section.provider) || hasResources;
  const [expanded, setExpanded] = useState(false);

  const allSelected = value.some(
    (s) => s.type === 'CONNECTION' && s.connectionId === section.connectionId
  );

  const providerLabel = getProviderLabel(section.provider);
  const [, noun] = PROVIDER_SOURCE_NOUN[section.provider];

  // Data source selections (Slack, Notion)
  const selectedDsIds = new Set(
    value
      .filter(
        (s): s is Extract<BotSourceConfig[number], { type: 'DATA_SOURCE' }> =>
          s.type === 'DATA_SOURCE'
      )
      .map((s) => s.dataSourceId)
  );

  // Resource selections (GitHub repos)
  const selectedResourceIds = new Set(
    value
      .filter(
        (s): s is Extract<BotSourceConfig[number], { type: 'CONNECTION_RESOURCE' }> =>
          s.type === 'CONNECTION_RESOURCE' && s.connectionId === section.connectionId
      )
      .map((s) => s.githubRepo)
  );

  const selectedDsCount = section.dataSources.filter((ds) => selectedDsIds.has(ds.id)).length;
  const selectedResourceCount = section.resources.filter((r) =>
    selectedResourceIds.has(r.id)
  ).length;
  const selectedCount = selectedDsCount + selectedResourceCount;
  const totalCount = section.dataSources.length + section.resources.length;
  const hasSelection = allSelected || selectedCount > 0;

  const handleAllToggle = () => {
    if (allSelected) {
      onChange(
        value.filter((s) => !(s.type === 'CONNECTION' && s.connectionId === section.connectionId))
      );
    } else {
      const dsIds = new Set(section.dataSources.map((ds) => ds.id));
      const resourceIds = new Set(section.resources.map((r) => r.id));
      const filtered = value.filter((s) => {
        if (s.type === 'DATA_SOURCE' && dsIds.has(s.dataSourceId)) return false;
        if (
          s.type === 'CONNECTION_RESOURCE' &&
          s.connectionId === section.connectionId &&
          resourceIds.has(s.githubRepo)
        )
          return false;
        return true;
      });
      onChange([...filtered, { type: 'CONNECTION', connectionId: section.connectionId }]);
    }
  };

  const handleDsToggle = (dsId: IntegrationSection['dataSources'][number]['id']) => {
    if (selectedDsIds.has(dsId)) {
      onChange(value.filter((s) => !(s.type === 'DATA_SOURCE' && s.dataSourceId === dsId)));
    } else {
      onChange([...value, { type: 'DATA_SOURCE', dataSourceId: dsId }]);
    }
  };

  const handleResourceToggle = (githubRepo: string) => {
    if (selectedResourceIds.has(githubRepo)) {
      onChange(
        value.filter(
          (s) =>
            !(
              s.type === 'CONNECTION_RESOURCE' &&
              s.connectionId === section.connectionId &&
              s.githubRepo === githubRepo
            )
        )
      );
    } else {
      onChange([
        ...value,
        { type: 'CONNECTION_RESOURCE', connectionId: section.connectionId, githubRepo },
      ]);
    }
  };

  // Non-individually-selectable providers: header + chip underneath
  if (!isIndividual) {
    return (
      <Box>
        <Stack direction="row" alignItems="center" spacing={0.75} sx={{ py: 0.5 }}>
          <ProviderIcon provider={section.provider} size={15} />
          <Typography variant="body2" fontWeight={500}>
            {providerLabel}
          </Typography>
        </Stack>
        <Box sx={{ pl: 2.5, pt: 0.75 }}>
          <SourceChip label={`All ${noun}`} selected={allSelected} onClick={handleAllToggle} />
        </Box>
      </Box>
    );
  }

  const Caret = expanded ? CaretDownIcon : CaretRightIcon;

  return (
    <Box>
      <Stack
        direction="row"
        alignItems="center"
        spacing={0.75}
        onClick={() => setExpanded((p) => !p)}
        sx={{ cursor: 'pointer', py: 0.5, '&:hover': { opacity: 0.8 } }}
      >
        <Caret size={12} weight="bold" />
        <ProviderIcon provider={section.provider} size={15} />
        <Typography variant="body2" fontWeight={500} sx={{ flex: 1 }}>
          {providerLabel}
        </Typography>
        {hasSelection && (
          <Typography variant="caption" color="text.secondary">
            {allSelected ? 'All' : `${selectedCount}/${totalCount}`}
          </Typography>
        )}
      </Stack>

      <Collapse in={expanded}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, pt: 0.75, pl: 2.5 }}>
          <SourceChip label={`All ${noun}`} selected={allSelected} onClick={handleAllToggle} />
          {section.dataSources.map((ds) => (
            <SourceChip
              key={ds.id}
              label={ds.title}
              selected={allSelected || selectedDsIds.has(ds.id)}
              disabled={allSelected}
              onClick={() => handleDsToggle(ds.id)}
            />
          ))}
          {section.resources.map((resource) => (
            <SourceChip
              key={resource.id}
              label={resource.name}
              selected={allSelected || selectedResourceIds.has(resource.id)}
              disabled={allSelected}
              onClick={() => handleResourceToggle(resource.id)}
            />
          ))}
        </Box>
      </Collapse>
    </Box>
  );
}
