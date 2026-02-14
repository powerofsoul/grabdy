import { useCallback, useState } from 'react';

import { alpha, Box, IconButton, TextField, Typography, useTheme } from '@mui/material';
import { PlusIcon, TrashIcon } from '@phosphor-icons/react';

import { useEditMode } from '../hooks/useEditMode';

interface FunnelComponentProps {
  data: {
    steps: Array<{ label: string; value: number; color?: string }>;
  };
  onSave?: (data: Record<string, unknown>) => void;
}

export function FunnelComponent({ data, onSave }: FunnelComponentProps) {
  const theme = useTheme();
  const [isEditing, setIsEditing] = useState(false);
  const [draftSteps, setDraftSteps] = useState(data.steps);

  const maxValue = data.steps.reduce((max, s) => Math.max(max, s.value), 0);

  const handleSave = useCallback(() => {
    onSave?.({ steps: draftSteps });
    setIsEditing(false);
  }, [draftSteps, onSave]);

  const handleCancel = useCallback(() => {
    setIsEditing(false);
  }, []);

  const { endEdit } = useEditMode(handleSave, handleCancel, () => {
    setDraftSteps(data.steps.map((s) => ({ ...s })));
    setIsEditing(true);
  });

  const handleStepChange = (index: number, field: 'label' | 'value', val: string) => {
    setDraftSteps((prev) =>
      prev.map((s, i) => (i === index ? { ...s, [field]: val } : s)),
    );
  };

  const handleAddStep = () => {
    setDraftSteps((prev) => [...prev, { label: '', value: 0 }]);
  };

  const handleDeleteStep = (index: number) => {
    setDraftSteps((prev) => prev.filter((_, i) => i !== index));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleCancel();
      endEdit();
    }
  };

  if (isEditing) {
    return (
      <Box
        className="nodrag nowheel nopan"
        onKeyDown={handleKeyDown}
        sx={{ p: 1.5 }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          {draftSteps.map((step, i) => (
            <Box key={i} sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
              <TextField
                size="small"
                value={step.label}
                onChange={(e) => handleStepChange(i, 'label', e.target.value)}
                placeholder="Label"
                autoFocus={i === 0}
                sx={{ flex: 1, '& .MuiInputBase-input': { fontSize: 12, py: 0.25 } }}
              />
              <TextField
                size="small"
                type="number"
                value={String(step.value)}
                onChange={(e) => handleStepChange(i, 'value', e.target.value)}
                placeholder="Value"
                sx={{ width: 80, '& .MuiInputBase-input': { fontSize: 12, py: 0.25 } }}
              />
              <IconButton
                size="small"
                onClick={() => handleDeleteStep(i)}
                sx={{ width: 20, height: 20, color: alpha(theme.palette.text.primary, 0.3) }}
              >
                <TrashIcon size={12} weight="light" color="currentColor" />
              </IconButton>
            </Box>
          ))}
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
          <IconButton size="small" onClick={handleAddStep} sx={{ color: 'primary.main' }}>
            <PlusIcon size={14} weight="light" color="currentColor" />
          </IconButton>
        </Box>
      </Box>
    );
  }

  return (
    <Box
      sx={{ p: 1.5, position: 'relative' }}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        {data.steps.map((step, i) => {
          const widthPercent = maxValue > 0 ? (step.value / maxValue) * 100 : 0;
          const barColor = step.color ?? theme.palette.primary.main;
          return (
            <Box key={i} sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography sx={{ fontSize: 12, fontWeight: 500 }}>{step.label}</Typography>
                <Typography sx={{ fontSize: 11, color: 'text.secondary', fontWeight: 500 }}>
                  {step.value}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex' }}>
                <Box
                  sx={{
                    height: 8,
                    width: `${Math.max(widthPercent, 2)}%`,
                    bgcolor: barColor,
                    borderRadius: 1,
                    transition: 'width 400ms ease',
                  }}
                />
              </Box>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
