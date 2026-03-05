import { useCallback, useState } from 'react';

import type { Contract } from '@grabdy/contracts';
import { alpha, Box, Button, TextField, Typography, useTheme } from '@mui/material';
import {
  ArrowCounterClockwiseIcon,
  ArrowRightIcon,
  CalendarIcon,
  ChatCircleIcon,
  CurrencyDollarIcon,
  FileTextIcon,
  GavelIcon,
  HandshakeIcon,
  LightbulbIcon,
  PencilSimpleIcon,
  ScalesIcon,
  ShieldCheckIcon,
  TrashIcon,
  WarningCircleIcon,
} from '@phosphor-icons/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { toast } from 'sonner';

import {
  formatBool,
  formatCurrency,
  formatDetailDate,
  formatDisputeMechanism,
  formatIndemnificationType,
  formatIpOwnership,
  formatLiabilityCapType,
  formatMonths,
  formatRenewalType,
} from '../helpers';

import { DatesBadge } from './DatesBadge';
import { MetadataField } from './MetadataField';
import { MetadataSection } from './MetadataSection';

import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';

interface MetadataSidebarProps {
  contract: Contract & { daysLeft: number | null };
}

export function MetadataSidebar({ contract }: MetadataSidebarProps) {
  const theme = useTheme();
  const ct = theme.palette.text.primary;
  const navigate = useNavigate();
  const { selectedOrgId } = useAuth();
  const queryClient = useQueryClient();

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState(contract.title);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // When not editing, always show the server value
  const displayTitle = isEditingTitle ? editTitle : contract.title;

  const updateTitleMutation = useMutation({
    mutationFn: async (title: string) => {
      if (!selectedOrgId) return;
      await api.contracts.update({
        params: { orgId: selectedOrgId, contractId: contract.id },
        body: { title },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contract'] });
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      setIsEditingTitle(false);
    },
    onError: () => {
      toast.error('Failed to update title');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!selectedOrgId) return;
      await api.contracts.remove({
        params: { orgId: selectedOrgId, contractId: contract.id },
        body: {},
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      queryClient.invalidateQueries({ queryKey: ['deadlines'] });
      navigate({ to: '/dashboard/contracts' });
    },
    onError: () => {
      toast.error('Failed to delete contract');
    },
  });

  const { mutate: updateTitle } = updateTitleMutation;
  const handleTitleSave = useCallback(() => {
    const trimmed = editTitle.trim();
    if (trimmed && trimmed !== contract.title) {
      updateTitle(trimmed);
    } else {
      setEditTitle(contract.title);
      setIsEditingTitle(false);
    }
  }, [editTitle, contract.title, updateTitle]);

  const handleTitleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleTitleSave();
      } else if (e.key === 'Escape') {
        setEditTitle(contract.title);
        setIsEditingTitle(false);
      }
    },
    [handleTitleSave, contract.title]
  );

  const actionSx = {
    display: 'flex',
    alignItems: 'center',
    gap: 1,
    py: 1.25,
    px: 1.5,
    cursor: 'pointer',
    border: '1px solid',
    borderColor: 'divider',
    transition: 'all 0.15s',
    '&:hover': {
      borderColor: alpha(ct, 0.3),
      bgcolor: alpha(ct, 0.02),
    },
  };

  return (
    <Box
      sx={{
        overflow: 'auto',
        p: 3,
        borderLeft: '1px solid',
        borderColor: 'divider',
        flex: 1,
      }}
    >
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
          <FileTextIcon size={22} weight="light" />
          {isEditingTitle ? (
            <TextField
              inputRef={(input: HTMLInputElement | null) => {
                if (input) {
                  input.focus();
                  input.select();
                }
              }}
              size="small"
              value={displayTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onBlur={handleTitleSave}
              onKeyDown={handleTitleKeyDown}
              sx={{ flex: 1 }}
              slotProps={{
                input: { sx: { fontWeight: 500, fontSize: '1.25rem' } },
              }}
            />
          ) : (
            <>
              <Typography variant="h6" sx={{ fontWeight: 500, flex: 1 }}>
                {contract.title}
              </Typography>
              <Box
                onClick={() => {
                  setEditTitle(contract.title);
                  setIsEditingTitle(true);
                }}
                sx={{
                  cursor: 'pointer',
                  color: 'text.secondary',
                  '&:hover': { color: 'text.primary' },
                }}
              >
                <PencilSimpleIcon size={16} weight="light" />
              </Box>
            </>
          )}
        </Box>
        <DatesBadge daysLeft={contract.daysLeft} />
      </Box>

      <MetadataSection title="Overview" icon={<HandshakeIcon size={16} weight="light" />}>
        <MetadataField label="Counterparty" value={contract.counterparty} />
        <MetadataField label="Contract type" value={contract.contractType} />
        <MetadataField label="Governing law" value={contract.governingLaw} />
        <MetadataField label="Jurisdiction" value={contract.jurisdiction} />
      </MetadataSection>

      <MetadataSection title="Key dates" icon={<CalendarIcon size={16} weight="light" />}>
        <MetadataField label="Effective date" value={formatDetailDate(contract.effectiveDate)} />
        <MetadataField label="Expiration date" value={formatDetailDate(contract.expirationDate)} />
        <MetadataField label="Execution date" value={formatDetailDate(contract.executionDate)} />
      </MetadataSection>

      <MetadataSection
        title="Renewal"
        icon={<ArrowCounterClockwiseIcon size={16} weight="light" />}
      >
        <MetadataField label="Renewal type" value={formatRenewalType(contract.renewalType)} />
        <MetadataField label="Renewal date" value={formatDetailDate(contract.renewalDate)} />
        <MetadataField label="Renewal term" value={formatMonths(contract.renewalTermMonths)} />
        <MetadataField
          label="Notice period"
          value={contract.noticePeriodDays != null ? `${contract.noticePeriodDays} days` : null}
        />
        <MetadataField label="Notice by date" value={formatDetailDate(contract.noticeByDate)} />
      </MetadataSection>

      <MetadataSection
        title="Financial"
        icon={<CurrencyDollarIcon size={16} weight="light" />}
        defaultOpen={false}
      >
        <MetadataField
          label="Payable value"
          value={formatCurrency(contract.payableValue, contract.currency)}
        />
        <MetadataField
          label="Receivable value"
          value={formatCurrency(contract.receivableValue, contract.currency)}
        />
        <MetadataField label="Payment terms" value={contract.paymentTerms} />
        <MetadataField label="Payment frequency" value={contract.paymentFrequency} />
      </MetadataSection>

      <MetadataSection
        title="Liability"
        icon={<ScalesIcon size={16} weight="light" />}
        defaultOpen={false}
      >
        <MetadataField
          label="Cap amount"
          value={formatCurrency(contract.liabilityCapAmount, contract.currency)}
        />
        <MetadataField label="Cap type" value={formatLiabilityCapType(contract.liabilityCapType)} />
        <MetadataField
          label="Indemnification"
          value={formatIndemnificationType(contract.indemnificationType)}
        />
      </MetadataSection>

      <MetadataSection
        title="Termination"
        icon={<WarningCircleIcon size={16} weight="light" />}
        defaultOpen={false}
      >
        <MetadataField label="For cause" value={formatBool(contract.terminationForCause)} />
        <MetadataField
          label="For convenience"
          value={formatBool(contract.terminationForConvenience)}
        />
        <MetadataField
          label="Notice period"
          value={
            contract.terminationNoticeDays != null ? `${contract.terminationNoticeDays} days` : null
          }
        />
      </MetadataSection>

      <MetadataSection
        title="IP & confidentiality"
        icon={<LightbulbIcon size={16} weight="light" />}
        defaultOpen={false}
      >
        <MetadataField label="IP ownership" value={formatIpOwnership(contract.ipOwnership)} />
        <MetadataField label="Work for hire" value={formatBool(contract.workForHire)} />
        <MetadataField
          label="Confidentiality term"
          value={formatMonths(contract.confidentialityTermMonths)}
        />
        <MetadataField label="Non-compete" value={formatBool(contract.nonCompete)} />
        {contract.nonCompete && (
          <MetadataField
            label="Non-compete term"
            value={formatMonths(contract.nonCompeteTermMonths)}
          />
        )}
        <MetadataField label="Non-solicitation" value={formatBool(contract.nonSolicitation)} />
      </MetadataSection>

      <MetadataSection
        title="Insurance"
        icon={<ShieldCheckIcon size={16} weight="light" />}
        defaultOpen={false}
      >
        <MetadataField label="Required" value={formatBool(contract.insuranceRequired)} />
        <MetadataField
          label="Minimum amount"
          value={formatCurrency(contract.insuranceMinimumAmount, contract.currency)}
        />
      </MetadataSection>

      <MetadataSection
        title="Dispute resolution"
        icon={<GavelIcon size={16} weight="light" />}
        defaultOpen={false}
      >
        <MetadataField
          label="Mechanism"
          value={formatDisputeMechanism(contract.disputeMechanism)}
        />
        <MetadataField label="Venue" value={contract.disputeVenue} />
      </MetadataSection>

      <Box
        sx={{
          mt: 3,
          pt: 2,
          borderTop: '1px solid',
          borderColor: 'divider',
          display: 'flex',
          flexDirection: 'column',
          gap: 1.5,
        }}
      >
        <Box onClick={() => navigate({ to: '/dashboard/chat' })} sx={actionSx}>
          <ChatCircleIcon size={16} weight="light" />
          <Typography sx={{ fontSize: '0.875rem', flex: 1 }}>Ask a question</Typography>
          <ArrowRightIcon size={14} weight="light" />
        </Box>

        {showDeleteConfirm ? (
          <Box sx={{ border: '1px solid', borderColor: 'error.main', p: 2 }}>
            <Typography sx={{ fontSize: '0.875rem', mb: 1.5 }}>
              Are you sure? This cannot be undone.
            </Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                size="small"
                variant="outlined"
                onClick={() => setShowDeleteConfirm(false)}
                sx={{ flex: 1 }}
              >
                Cancel
              </Button>
              <Button
                size="small"
                variant="contained"
                color="error"
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
                sx={{ flex: 1 }}
              >
                {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
              </Button>
            </Box>
          </Box>
        ) : (
          <Box
            onClick={() => setShowDeleteConfirm(true)}
            sx={{
              ...actionSx,
              borderColor: alpha(theme.palette.error.main, 0.3),
              '&:hover': {
                borderColor: theme.palette.error.main,
                bgcolor: alpha(theme.palette.error.main, 0.04),
              },
            }}
          >
            <TrashIcon size={16} weight="light" color={theme.palette.error.main} />
            <Typography sx={{ fontSize: '0.875rem', flex: 1, color: 'error.main' }}>
              Delete contract
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
}
