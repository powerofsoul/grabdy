import { useCallback, useMemo } from 'react';

import {
  type Contract,
  CONTRACT_TYPE_LABELS,
  type ContractType,
  contractTypeEnum,
  type RenewalType,
  renewalTypeEnum,
} from '@grabdy/contracts';
import { alpha, Box, Tab, Tabs, Typography } from '@mui/material';
import { FileTextIcon } from '@phosphor-icons/react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { parseAsString, parseAsStringLiteral, useQueryState, useQueryStates } from 'nuqs';

import { ContractsToolbar } from './components/ContractsToolbar';
import { computeExpiringDates, formatContractDate } from './helpers';

import { formatDaysLeft } from '@/components/dashboard/helpers';
import { DashboardPage } from '@/components/ui/DashboardPage';
import { EmptyState } from '@/components/ui/EmptyState';
import { MainTable } from '@/components/ui/main-table';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';

type ContractRow = Contract & { daysLeft: number | null };
type ExpiringRange = '' | '30' | '60' | '90' | 'year';

const headerNames = {
  title: 'Contract',
  counterparty: 'Counterparty',
  contract_type: 'Type',
  expiration_date: 'Expiration',
  days_left: 'Days Left',
} as const;

const STATUS_OPTIONS = ['active', 'past'] as const;
const EXPIRING_OPTIONS = ['30', '60', '90', 'year'] as const;

type ContractQueryKey =
  | 'search'
  | 'counterparty'
  | 'contractType'
  | 'renewalType'
  | 'status'
  | 'expiringAfter'
  | 'expiringBefore';

export function ContractsListPage() {
  const { selectedOrgId } = useAuth();
  const navigate = useNavigate();

  const [search, setSearch] = useQueryState(
    'search',
    parseAsString.withDefault('').withOptions({ throttleMs: 300 })
  );
  const [counterparty, setCounterparty] = useQueryState(
    'counterparty',
    parseAsString.withDefault('')
  );
  const [filters, setFilters] = useQueryStates({
    status: parseAsStringLiteral(STATUS_OPTIONS).withDefault('active'),
    contractType: parseAsStringLiteral(contractTypeEnum.options),
    renewalType: parseAsStringLiteral(renewalTypeEnum.options),
    expiring: parseAsStringLiteral(EXPIRING_OPTIONS),
  });

  const status = filters.status;
  const contractType: ContractType | '' = filters.contractType ?? '';
  const renewalType: RenewalType | '' = filters.renewalType ?? '';
  const expiringRange: ExpiringRange = filters.expiring ?? '';

  const { data: counterpartiesData } = useQuery({
    queryKey: ['counterparties', selectedOrgId],
    queryFn: () => api.contracts.counterparties({ params: { orgId: selectedOrgId ?? '' } }),
    enabled: !!selectedOrgId,
  });
  const counterpartyOptions =
    counterpartiesData?.status === 200 ? counterpartiesData.body.data : [];

  const queryParams = useMemo(() => {
    const params: Partial<Record<ContractQueryKey, string>> = {};
    if (search) params.search = search;
    if (counterparty) params.counterparty = counterparty;
    if (contractType) params.contractType = contractType;
    if (renewalType) params.renewalType = renewalType;
    params.status = status;
    if (status === 'active') {
      const { expiringAfter, expiringBefore } = computeExpiringDates(expiringRange);
      if (expiringAfter) params.expiringAfter = expiringAfter;
      if (expiringBefore) params.expiringBefore = expiringBefore;
    }
    return params;
  }, [search, counterparty, contractType, renewalType, status, expiringRange]);

  const handleRowClick = useCallback(
    (row: ContractRow) => {
      navigate({ to: '/dashboard/contracts/$contractId', params: { contractId: row.id } });
    },
    [navigate]
  );

  const handleTabChange = useCallback(
    (_: React.SyntheticEvent, newValue: 'active' | 'past') => {
      setFilters({ status: newValue, expiring: null });
    },
    [setFilters]
  );

  const handleContractTypeChange = useCallback(
    (value: ContractType | '') => {
      setFilters({ contractType: value || null });
    },
    [setFilters]
  );

  const handleRenewalTypeChange = useCallback(
    (value: RenewalType | '') => {
      setFilters({ renewalType: value || null });
    },
    [setFilters]
  );

  const handleExpiringRangeChange = useCallback(
    (value: ExpiringRange) => {
      setFilters({ expiring: value || null });
    },
    [setFilters]
  );

  const handleCounterpartyChange = useCallback(
    (value: string) => {
      setCounterparty(value || null);
    },
    [setCounterparty]
  );

  const hasFilters = !!(search || counterparty || contractType || renewalType || expiringRange);

  return (
    <DashboardPage title="Contracts" subtitle="All contracts in your portfolio.">
      <Tabs
        value={status}
        onChange={handleTabChange}
        sx={{ mb: 3, borderBottom: '1px solid', borderColor: 'divider' }}
      >
        <Tab label="Active" value="active" />
        <Tab label="Past" value="past" />
      </Tabs>

      <ContractsToolbar
        search={search}
        onSearchChange={setSearch}
        counterparty={counterparty}
        onCounterpartyChange={handleCounterpartyChange}
        counterpartyOptions={counterpartyOptions}
        contractType={contractType}
        onContractTypeChange={handleContractTypeChange}
        renewalType={renewalType}
        onRenewalTypeChange={handleRenewalTypeChange}
        expiringRange={status === 'active' ? expiringRange : undefined}
        onExpiringRangeChange={status === 'active' ? handleExpiringRangeChange : undefined}
      />

      <MainTable
        endpoint={api.contracts.list}
        endpointParams={{ orgId: selectedOrgId ?? '' }}
        queryKey={['contracts', selectedOrgId, queryParams]}
        queryParams={queryParams}
        enabled={!!selectedOrgId}
        sortableColumns={
          ['title', 'counterparty', 'contract_type', 'expiration_date', 'days_left'] as const
        }
        defaultSortBy="expiration_date"
        defaultSortOrder="asc"
        defaultLimit={25}
        headerNames={headerNames}
        columnWidths={{
          title: '1fr',
          counterparty: 180,
          contract_type: 140,
          expiration_date: 130,
          days_left: 100,
        }}
        noWrap={['title', 'counterparty']}
        keyExtractor={(row: ContractRow) => row.id}
        rowTitle={(row: ContractRow) => row.title}
        onRowClick={handleRowClick}
        renderItems={{
          title: (row: ContractRow) => (
            <Typography variant="body2" noWrap sx={{ fontWeight: 500 }}>
              {row.title}
            </Typography>
          ),
          counterparty: (row: ContractRow) => (
            <Typography variant="body2" noWrap sx={{ color: 'text.secondary' }}>
              {row.counterparty ?? '-'}
            </Typography>
          ),
          contract_type: (row: ContractRow) => (
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              {row.contractType ? CONTRACT_TYPE_LABELS[row.contractType] : '-'}
            </Typography>
          ),
          expiration_date: (row: ContractRow) => formatContractDate(row.expirationDate),
          days_left: (row: ContractRow) => {
            if (row.daysLeft === null) return '-';
            const palette =
              row.daysLeft <= 30
                ? 'error'
                : row.daysLeft <= 60
                  ? 'warning'
                  : row.daysLeft <= 90
                    ? 'success'
                    : undefined;
            return (
              <Box
                sx={{
                  display: 'inline-flex',
                  px: 1,
                  py: 0.25,
                  bgcolor: palette
                    ? (t) => alpha(t.palette[palette].main, 0.1)
                    : (t) => alpha(t.palette.text.secondary, 0.1),
                }}
              >
                <Typography
                  sx={{
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: palette ? `${palette}.main` : 'text.secondary',
                  }}
                >
                  {formatDaysLeft(row.daysLeft)}
                </Typography>
              </Box>
            );
          },
        }}
        emptyState={
          hasFilters ? (
            <Box sx={{ py: 6, textAlign: 'center' }}>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                No contracts match your filters.
              </Typography>
            </Box>
          ) : (
            <EmptyState
              icon={<FileTextIcon size={48} weight="light" />}
              message="No contracts yet"
              description="Upload contracts to automatically extract deadlines, counterparties, and key terms."
              actionLabel="Go to dashboard"
              onAction={() => navigate({ to: '/dashboard' })}
            />
          )
        }
      />
    </DashboardPage>
  );
}
