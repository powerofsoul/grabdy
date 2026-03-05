import { Box, Typography } from '@mui/material';

import { FEATURE_TABS, TAB_COUNT } from '../constants';

import { ApiPanel } from './ApiPanel';
import { DeviationPanel } from './DeviationPanel';
import { IntegrationsPanel } from './IntegrationsPanel';
import { InterfacePanel } from './InterfacePanel';
import { McpPanel } from './McpPanel';
import { SearchPanel } from './SearchPanel';

const PANELS = [
  SearchPanel,
  InterfacePanel,
  IntegrationsPanel,
  DeviationPanel,
  ApiPanel,
  McpPanel,
] as const;

interface FeaturePanelProps {
  activeIndex: number;
  scrollProgress: number;
}

/**
 * Each tab's segment is split into three phases:
 *   enter (0-35%)  |  hold (35-65%)  |  exit (65-100%)
 *
 * Enter: opacity 0 -> 1, y slides from +40 -> 0
 * Hold:  fully visible
 * Exit:  opacity 1 -> 0, y slides from 0 -> -30
 *
 * The first panel starts fully visible (no enter).
 * The last panel stays fully visible (no exit).
 */
function getPanelTransform(panelIndex: number, scrollProgress: number) {
  const seg = 1 / TAB_COUNT;
  const start = panelIndex * seg;
  const end = start + seg;

  // Normalized position within this panel's segment (0..1)
  const local = Math.max(0, Math.min(1, (scrollProgress - start) / seg));

  const enterEnd = 0.35;
  const exitStart = 0.65;

  // Before this segment
  if (scrollProgress < start) {
    // First panel: visible before scroll starts
    if (panelIndex === 0) return { opacity: 1, y: 0 };
    return { opacity: 0, y: 40 };
  }

  // After this segment
  if (scrollProgress >= end) {
    if (panelIndex === TAB_COUNT - 1) return { opacity: 1, y: 0 };
    return { opacity: 0, y: -30 };
  }

  // Within segment: enter phase
  if (local < enterEnd) {
    // First panel doesn't need enter animation
    if (panelIndex === 0) return { opacity: 1, y: 0 };
    const t = local / enterEnd; // 0..1
    const eased = easeOutCubic(t);
    return { opacity: eased, y: 40 * (1 - eased) };
  }

  // Within segment: hold phase
  if (local < exitStart) {
    return { opacity: 1, y: 0 };
  }

  // Within segment: exit phase
  // Last panel doesn't exit
  if (panelIndex === TAB_COUNT - 1) return { opacity: 1, y: 0 };
  const t = (local - exitStart) / (1 - exitStart); // 0..1
  const eased = easeInCubic(t);
  return { opacity: 1 - eased, y: -30 * eased };
}

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

function easeInCubic(t: number) {
  return t * t * t;
}

export function FeaturePanel({ activeIndex, scrollProgress }: FeaturePanelProps) {
  const tab = FEATURE_TABS[activeIndex];

  // Compute text opacity: fade out heading during exit, fade in during enter
  const seg = 1 / TAB_COUNT;
  const localProgress = (scrollProgress - activeIndex * seg) / seg;
  const exitStart = 0.65;
  const enterEnd = 0.35;

  let textOpacity = 1;
  if (activeIndex > 0 && localProgress < enterEnd) {
    textOpacity = easeOutCubic(localProgress / enterEnd);
  }
  if (activeIndex < TAB_COUNT - 1 && localProgress > exitStart) {
    textOpacity = 1 - easeInCubic((localProgress - exitStart) / (1 - exitStart));
  }

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        justifyContent: 'center',
      }}
    >
      {/* Heading + description area */}
      <Box sx={{ mb: 3, minHeight: 90, opacity: textOpacity }}>
        <Typography
          variant="h3"
          sx={{
            fontSize: { xs: '1.5rem', md: '2rem' },
            fontWeight: 600,
            mb: 1.5,
            color: 'text.primary',
          }}
        >
          {tab.heading}
        </Typography>
        <Typography
          sx={{
            fontSize: { xs: '0.9rem', md: '1rem' },
            color: 'text.secondary',
            lineHeight: 1.7,
            maxWidth: 500,
          }}
        >
          {tab.description}
        </Typography>
      </Box>

      {/* Visual area with scroll-driven crossfade */}
      <Box sx={{ position: 'relative', minHeight: { xs: 280, md: 360 } }}>
        {PANELS.map((Panel, i) => {
          const { opacity, y } = getPanelTransform(i, scrollProgress);
          const isNearActive = Math.abs(i - activeIndex) <= 1;

          return (
            <Box
              key={i}
              sx={{
                position: i === 0 ? 'relative' : 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                opacity,
                transform: `translateY(${y}px)`,
                willChange: isNearActive ? 'transform, opacity' : 'auto',
                pointerEvents: i === activeIndex ? 'auto' : 'none',
                visibility: isNearActive ? 'visible' : 'hidden',
              }}
            >
              <Panel />
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
