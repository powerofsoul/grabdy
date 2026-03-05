import {
  CONTRACT_TYPE_LABELS,
  type ContractType,
  contractTypeEnum,
  type RenewalType,
} from '@grabdy/contracts';
import { Box, FormControl, InputAdornment, MenuItem, Select, TextField } from '@mui/material';
import { MagnifyingGlassIcon } from '@phosphor-icons/react';

type ExpiringRange = '' | '30' | '60' | '90' | 'year';

const contractTypes = contractTypeEnum.options;

const RENEWAL_TYPE_LABELS = {
  auto: 'Auto-renewal',
  manual: 'Manual',
  none: 'None',
} satisfies Record<RenewalType, string>;

const RENEWAL_TYPE_OPTIONS: RenewalType[] = ['auto', 'manual', 'none'];

const EXPIRING_RANGE_OPTIONS: { value: ExpiringRange; label: string }[] = [
  { value: '30', label: 'Next 30 days' },
  { value: '60', label: 'Next 60 days' },
  { value: '90', label: 'Next 90 days' },
  { value: 'year', label: 'This year' },
];

interface ContractsToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  counterparty: string;
  onCounterpartyChange: (value: string) => void;
  counterpartyOptions: string[];
  contractType: ContractType | '';
  onContractTypeChange: (value: ContractType | '') => void;
  renewalType: RenewalType | '';
  onRenewalTypeChange: (value: RenewalType | '') => void;
  expiringRange?: ExpiringRange;
  onExpiringRangeChange?: (value: ExpiringRange) => void;
}

export function ContractsToolbar({
  search,
  onSearchChange,
  counterparty,
  onCounterpartyChange,
  counterpartyOptions,
  contractType,
  onContractTypeChange,
  renewalType,
  onRenewalTypeChange,
  expiringRange,
  onExpiringRangeChange,
}: ContractsToolbarProps) {
  return (
    <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
      <TextField
        size="small"
        placeholder="Search contracts..."
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <MagnifyingGlassIcon size={16} weight="light" />
              </InputAdornment>
            ),
          },
        }}
        sx={{ minWidth: 260 }}
      />
      <FormControl size="small" sx={{ minWidth: 170 }}>
        <Select<string>
          value={counterparty}
          onChange={(e) => onCounterpartyChange(e.target.value)}
          displayEmpty
        >
          <MenuItem value="">All counterparties</MenuItem>
          {counterpartyOptions.map((name) => (
            <MenuItem key={name} value={name}>
              {name}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      <FormControl size="small" sx={{ minWidth: 160 }}>
        <Select<ContractType | ''>
          value={contractType}
          onChange={(e) => onContractTypeChange(e.target.value)}
          displayEmpty
        >
          <MenuItem value="">All types</MenuItem>
          {contractTypes.map((value) => (
            <MenuItem key={value} value={value}>
              {CONTRACT_TYPE_LABELS[value]}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      <FormControl size="small" sx={{ minWidth: 150 }}>
        <Select<RenewalType | ''>
          value={renewalType}
          onChange={(e) => onRenewalTypeChange(e.target.value)}
          displayEmpty
        >
          <MenuItem value="">All renewals</MenuItem>
          {RENEWAL_TYPE_OPTIONS.map((value) => (
            <MenuItem key={value} value={value}>
              {RENEWAL_TYPE_LABELS[value]}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      {expiringRange !== undefined && onExpiringRangeChange && (
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <Select<ExpiringRange>
            value={expiringRange}
            onChange={(e) => onExpiringRangeChange(e.target.value)}
            displayEmpty
          >
            <MenuItem value="">All expirations</MenuItem>
            {EXPIRING_RANGE_OPTIONS.map(({ value, label }) => (
              <MenuItem key={value} value={value}>
                {label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      )}
    </Box>
  );
}
