import { useCallback, useState } from 'react';

import {
  alpha,
  Box,
  Button,
  Chip,
  CircularProgress,
  Typography,
  useTheme,
} from '@mui/material';
import { CloudArrowUpIcon, GitBranchIcon, LockSimpleIcon } from '@phosphor-icons/react';

import { useAvailableRepos } from './hooks/useAvailableRepos';
import { useIndexRepo } from './hooks/useIndexRepo';

import { useAuth } from '@/context/AuthContext';

function formatSize(kb: number): string {
  if (kb < 1024) return `${kb} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

interface RepoPickerProps {
  indexedRepoNames?: string[];
}

export function RepoPicker({ indexedRepoNames }: RepoPickerProps) {
  const theme = useTheme();
  const { selectedOrgId } = useAuth();
  const { repos, loading, error } = useAvailableRepos(selectedOrgId);
  const { indexRepo, loading: indexing } = useIndexRepo(selectedOrgId);
  const [indexingRepoId, setIndexingRepoId] = useState<number | null>(null);

  const handleIndex = useCallback(
    async (repoFullName: string, repoId: number) => {
      setIndexingRepoId(repoId);
      try {
        await indexRepo({ repoFullName });
      } finally {
        setIndexingRepoId(null);
      }
    },
    [indexRepo]
  );

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress size={28} />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ py: 3 }}>
        <Typography variant="body2" color="text.secondary">
          {error}
        </Typography>
      </Box>
    );
  }

  if (repos.length === 0) {
    return (
      <Box sx={{ py: 3 }}>
        <Typography variant="body2" color="text.secondary">
          No repositories found. Make sure your GitHub connection has access to at least one
          repository.
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Typography
        variant="caption"
        sx={{
          fontWeight: 600,
          fontSize: 11,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          color: 'text.secondary',
        }}
      >
        Available Repositories ({repos.length})
      </Typography>

      <Box
        sx={{
          maxHeight: 420,
          overflow: 'auto',
          border: 1,
          borderColor: 'divider',
          borderRadius: 1.5,
        }}
      >
        {repos.map((repo) => {
          const isCurrentlyIndexing = indexing && indexingRepoId === repo.id;
          const isAlreadyIndexed = indexedRepoNames?.includes(repo.fullName) ?? false;
          return (
            <Box
              key={repo.id}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                px: 2,
                py: 1.5,
                borderBottom: 1,
                borderColor: 'divider',
                '&:last-child': { borderBottom: 0 },
                '&:hover': { bgcolor: alpha(theme.palette.text.primary, 0.02) },
              }}
            >
              {/* Repo info */}
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="body2" sx={{ fontWeight: 500 }} noWrap>
                    {repo.fullName}
                  </Typography>
                  {repo.isPrivate && (
                    <LockSimpleIcon
                      size={14}
                      weight="light"
                      color={theme.palette.text.disabled}
                    />
                  )}
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                  {repo.language && (
                    <Chip label={repo.language} size="small" variant="outlined" sx={{ height: 20, fontSize: 11 }} />
                  )}
                  <Typography variant="caption" color="text.secondary">
                    {formatSize(repo.size)}
                  </Typography>
                </Box>
              </Box>

              {isAlreadyIndexed ? (
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500, flexShrink: 0 }}>
                  Already indexed
                </Typography>
              ) : (
                <>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
                    <GitBranchIcon size={14} weight="light" color={theme.palette.text.secondary} />
                    <Typography variant="caption" color="text.secondary">
                      {repo.defaultBranch}
                    </Typography>
                  </Box>
                  <Button
                    variant="outlined"
                    size="small"
                    disabled={isCurrentlyIndexing}
                    onClick={() => handleIndex(repo.fullName, repo.id)}
                    startIcon={
                      isCurrentlyIndexing ? (
                        <CircularProgress size={14} />
                      ) : (
                        <CloudArrowUpIcon size={15} weight="light" />
                      )
                    }
                    sx={{
                      textTransform: 'none',
                      fontWeight: 600,
                      fontSize: 13,
                      px: 2,
                      flexShrink: 0,
                    }}
                  >
                    {isCurrentlyIndexing ? 'Starting...' : 'Index'}
                  </Button>
                </>
              )}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
