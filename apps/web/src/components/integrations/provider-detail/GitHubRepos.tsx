import type { DbId } from '@grabdy/common';
import { dbIdSchema } from '@grabdy/common';
import { Box, CircularProgress } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';

import { Section } from './Section';

import { IndexingStatusCard, RepoPicker } from '@/components/code-repos';
import { api } from '@/lib/api';

export function GitHubRepos({ orgId }: { orgId: DbId<'Org'> }) {
  const { data: indexedRepos = [], isLoading } = useQuery({
    queryKey: ['data-sources', 'code-repos', orgId],
    queryFn: async () => {
      const res = await api.dataSources.list({
        params: { orgId },
        query: { type: 'CODE_REPO' },
      });
      if (res.status === 200) {
        return res.body.data;
      }
      return [];
    },
  });

  if (isLoading) {
    return (
      <Section title="Repositories">
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
          <CircularProgress size={24} />
        </Box>
      </Section>
    );
  }

  return (
    <>
      {indexedRepos.length > 0 && (
        <Section title={`Indexed Repositories (${indexedRepos.length})`}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {indexedRepos.map((repo) => {
              const parsed = dbIdSchema('DataSource').safeParse(repo.id);
              if (!parsed.success) return null;
              return (
                <Link
                  key={repo.id}
                  to="/dashboard/code-repos/$dataSourceId"
                  params={{ dataSourceId: repo.id }}
                  style={{ textDecoration: 'none', color: 'inherit' }}
                >
                  <IndexingStatusCard orgId={orgId} dataSourceId={parsed.data} />
                </Link>
              );
            })}
          </Box>
        </Section>
      )}

      <RepoPicker indexedRepoNames={indexedRepos.map((r) => r.title)} />
    </>
  );
}
