import { alpha, Box, Card, CardContent, Typography, useTheme } from '@mui/material';
import { createFileRoute } from '@tanstack/react-router';

import { CopyButton } from '@/components/ui/CopyButton';
import { DashboardPage } from '@/components/ui/DashboardPage';
import { FONT_MONO } from '@/theme';

export const Route = createFileRoute('/dashboard/api/mcp')({
  component: McpPage,
});

function McpPage() {
  const theme = useTheme();
  const ct = theme.palette.text.primary;
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
  const mcpUrl = `${apiUrl}/v1/mcp`;

  const stdioConfig = JSON.stringify(
    {
      mcpServers: {
        grabdy: {
          command: 'npx',
          args: ['-y', 'mcp-remote', mcpUrl, '--header', 'Authorization:${GRABDY_AUTH}'],
          env: {
            GRABDY_AUTH: 'Bearer <YOUR_API_KEY>',
          },
        },
      },
    },
    null,
    2
  );

  const httpConfig = JSON.stringify(
    {
      mcpServers: {
        grabdy: {
          url: mcpUrl,
          headers: {
            Authorization: 'Bearer <YOUR_API_KEY>',
          },
        },
      },
    },
    null,
    2
  );

  return (
    <DashboardPage
      title="MCP"
      subtitle="Connect your AI tools to Grabdy using the Model Context Protocol (MCP)."
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <Card>
          <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
              <Typography variant="subtitle2">
                Server URL
              </Typography>
              <CopyButton text={mcpUrl} />
            </Box>
            <Box
              sx={{
                fontFamily: FONT_MONO,
                bgcolor: alpha(ct, 0.04),
                borderRadius: 1,
                p: 1.5,
                fontSize: '0.85rem',
              }}
            >
              {mcpUrl}
            </Box>
          </CardContent>
        </Card>

        <Card>
          <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
              <Typography variant="subtitle2">
                Claude Desktop / Claude Code (stdio)
              </Typography>
              <CopyButton text={stdioConfig} />
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              Add this to your Claude Desktop config (claude_desktop_config.json) or Claude Code project
              config (.mcp.json). Replace {'<YOUR_API_KEY>'} with your API key from the Keys page.
            </Typography>
            <Box
              component="pre"
              sx={{
                fontFamily: FONT_MONO,
                bgcolor: alpha(ct, 0.04),
                borderRadius: 1,
                p: 1.5,
                fontSize: '0.8rem',
                overflow: 'auto',
                m: 0,
              }}
            >
              {stdioConfig}
            </Box>
          </CardContent>
        </Card>

        <Card>
          <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
              <Typography variant="subtitle2">
                Cursor / Other MCP Clients (HTTP)
              </Typography>
              <CopyButton text={httpConfig} />
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              For clients that support HTTP-based MCP servers directly.
              Replace {'<YOUR_API_KEY>'} with your API key from the Keys page.
            </Typography>
            <Box
              component="pre"
              sx={{
                fontFamily: FONT_MONO,
                bgcolor: alpha(ct, 0.04),
                borderRadius: 1,
                p: 1.5,
                fontSize: '0.8rem',
                overflow: 'auto',
                m: 0,
              }}
            >
              {httpConfig}
            </Box>
          </CardContent>
        </Card>

        <Card>
          <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
            <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
              Available Tools
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box>
                <Typography variant="body2" fontWeight={600}>
                  search
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Search across your uploaded data for relevant content.
                  Accepts a query string, optional collectionIds array, and optional limit.
                </Typography>
              </Box>
              <Box>
                <Typography variant="body2" fontWeight={600}>
                  list_collections
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  List all available data collections in your organization.
                </Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>
      </Box>
    </DashboardPage>
  );
}
