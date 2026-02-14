import { useState } from 'react';

import { alpha, Box, Collapse, Typography, useTheme } from '@mui/material';
import { BrainIcon, CaretDownIcon, CaretRightIcon, CheckIcon } from '@phosphor-icons/react';

import type { ThinkingStep } from './MessageRow';
import { getToolDisplay } from './tool-display';

interface ThinkingStepsProps {
  steps: ThinkingStep[];
  live?: boolean;
}

export function ThinkingSteps({ steps, live = false }: ThinkingStepsProps) {
  const theme = useTheme();
  const primary = theme.palette.primary.main;
  const textColor = theme.palette.text.primary;
  const [expanded, setExpanded] = useState(false);

  if (steps.length === 0 && !live) return null;

  const allDone = steps.length > 0 && steps.every((s) => s.status === 'done');
  const showExpanded = (live && steps.length > 0) || expanded;

  return (
    <Box sx={{ maxWidth: '90%' }}>
      {/* BrainIcon pill */}
      <Box
        onClick={!live ? () => setExpanded((p) => !p) : undefined}
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.75,
          mb: showExpanded ? 0.5 : 0,
          px: 1.5,
          py: 0.5,
          borderRadius: 1.5,
          bgcolor: alpha(primary, 0.08),
          border: '1px solid',
          borderColor: alpha(primary, 0.15),
          cursor: !live ? 'pointer' : undefined,
          userSelect: 'none',
        }}
      >
        <BrainIcon size={12} color={primary} weight="light" />
        <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, color: primary }}>
          Thinking
        </Typography>
        {!live && allDone && (
          <CheckIcon size={10} color={primary} weight="light" />
        )}
        {!live && (
          expanded
            ? <CaretDownIcon size={10} color={primary} weight="light" />
            : <CaretRightIcon size={10} color={primary} weight="light" />
        )}
        {live && !allDone && (
          <Box sx={{ display: 'flex', gap: '3px', ml: 0.25 }}>
            {[0, 1, 2].map((d) => (
              <Box
                key={d}
                sx={{
                  width: 3,
                  height: 3,
                  borderRadius: '50%',
                  bgcolor: primary,
                  animation: `dotPulse 1.2s ease-in-out ${d * 0.2}s infinite`,
                }}
              />
            ))}
          </Box>
        )}
      </Box>

      {/* Steps list */}
      <Collapse in={showExpanded}>
        <Box
          sx={{
            ml: 1,
            pl: 1.5,
            borderLeft: '2px solid',
            borderColor: alpha(primary, 0.15),
          }}
        >
          {steps.map((step, i) => {
            const display = getToolDisplay(step.toolName);
            const IconComponent = display.icon;
            const isActive = step.status === 'active';

            return (
              <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 0.5, py: 0.15 }}>
                {step.status === 'done' ? (
                  <CheckIcon size={10} color={alpha(primary, 0.4)} weight="light" />
                ) : (
                  <IconComponent size={10} color={primary} weight="light" />
                )}
                <Typography
                  variant="caption"
                  sx={{
                    color: isActive ? alpha(textColor, 0.9) : alpha(textColor, 0.4),
                    fontSize: '0.68rem',
                    fontWeight: isActive ? 600 : 400,
                    lineHeight: 1.7,
                  }}
                >
                  {step.status === 'done' && step.summary ? step.summary : step.label}
                </Typography>
                {isActive && (
                  <Box sx={{ display: 'flex', gap: 0.3, ml: 0.25 }}>
                    {[0, 1, 2].map((d) => (
                      <Box
                        key={d}
                        sx={{
                          width: 3,
                          height: 3,
                          borderRadius: '50%',
                          bgcolor: primary,
                          animation: `dotPulse 1.2s ease-in-out ${d * 0.2}s infinite`,
                        }}
                      />
                    ))}
                  </Box>
                )}
              </Box>
            );
          })}
        </Box>
      </Collapse>
    </Box>
  );
}
