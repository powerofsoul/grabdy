import { CheckCircleIcon, CircleIcon, RadioButtonIcon } from '@phosphor-icons/react';

export type StatusType = 'success' | 'warning' | 'error' | 'info' | 'neutral';

export interface StatusItem {
  label: string;
  status: StatusType;
  description?: string;
  date?: string;
}

export const STATUS_OPTIONS = [
  { value: 'success', label: 'Success' },
  { value: 'warning', label: 'WarningIcon' },
  { value: 'error', label: 'Error' },
  { value: 'info', label: 'InfoIcon' },
  { value: 'neutral', label: 'Neutral' },
] as const;

export const TIMELINE_ICONS = {
  success: CheckCircleIcon,
  info: RadioButtonIcon,
  warning: RadioButtonIcon,
  neutral: CircleIcon,
  error: CircleIcon,
} as const;
