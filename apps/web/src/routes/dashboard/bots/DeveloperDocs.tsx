import { useState } from 'react';

import { Box, Button, MenuItem, TextField, Typography } from '@mui/material';
import { DownloadIcon } from '@phosphor-icons/react';

import type { IntegrationLanguage } from './constants';
import {
  getConfigReference,
  getIntegrationGuide,
  INTEGRATION_LANGUAGES,
  isIntegrationLanguage,
} from './constants';
import { downloadDemoProject } from './demo-project';

import { CodeBlock } from '@/components/ui/code-block';
import { CopyButton } from '@/components/ui/CopyButton';
import { FONT_MONO } from '@/theme';

export function DeveloperDocs({ botId }: { botId?: string }) {
  const [lang, setLang] = useState<IntegrationLanguage>('JavaScript / TypeScript');
  const [isDownloading, setIsDownloading] = useState(false);
  const id = botId ?? 'YOUR_CHAT_ID';

  const guide = getIntegrationGuide(lang, id);
  const config = getConfigReference();

  const handleDownload = async () => {
    if (!botId) return;
    setIsDownloading(true);
    try {
      await downloadDemoProject(botId);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <Box>
      {/* Chat ID */}
      {botId && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            mb: 3,
            p: 1.5,
            bgcolor: 'action.hover',
            borderRadius: 1,
            border: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Typography variant="body2" color="text.secondary">
            Chat ID:
          </Typography>
          <Typography variant="body2" sx={{ fontFamily: FONT_MONO, fontWeight: 500 }}>
            {botId}
          </Typography>
          <CopyButton text={botId} />
        </Box>
      )}

      {/* Language selector + Demo download */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 4 }}>
        <TextField
          select
          value={lang}
          onChange={(e) => {
            const val = e.target.value;
            if (isIntegrationLanguage(val)) setLang(val);
          }}
          size="small"
          sx={{ minWidth: 220 }}
        >
          {INTEGRATION_LANGUAGES.map((l) => (
            <MenuItem key={l} value={l}>
              {l}
            </MenuItem>
          ))}
        </TextField>

        {botId && lang === 'JavaScript / TypeScript' && (
          <Button
            variant="outlined"
            startIcon={<DownloadIcon size={16} weight="light" color="currentColor" />}
            onClick={handleDownload}
            disabled={isDownloading}
            sx={{ height: 40, whiteSpace: 'nowrap' }}
          >
            {isDownloading ? 'Generating...' : 'Download Demo Project'}
          </Button>
        )}
      </Box>

      {/* Step 1: Backend */}
      <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1 }}>
        1. Backend: Sign JWTs
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Your backend signs RS256 JWTs with a private key. The JWT must include a <code>sub</code>{' '}
        claim (your user's ID), the <code>chatId</code>, and the <code>keyid</code> header (your key
        fingerprint from the Signing Keys tab).
      </Typography>
      <CodeBlock
        code={guide.backendInstall.code}
        language={guide.backendInstall.language}
        filename={guide.backendInstall.filename}
      />
      <Box sx={{ mt: 1 }}>
        <CodeBlock
          code={guide.backendCode.code}
          language={guide.backendCode.language}
          filename={guide.backendCode.filename}
        />
      </Box>

      {/* JWT claims box */}
      <Box
        sx={{
          mt: 2,
          mb: 4,
          p: 2,
          bgcolor: 'action.hover',
          borderRadius: 1,
          border: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
          JWT Claims
        </Typography>
        <Typography variant="body2" color="text.secondary" component="div">
          <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
            <li>
              <code>sub</code> (required): Your user's unique ID
            </li>
            <li>
              <code>chatId</code> (required): The SDK Chat ID
            </li>
            <li>
              <code>kid</code> header (required): Your signing key fingerprint
            </li>
            <li>
              <code>exp</code> (recommended): Expiration timestamp (e.g. 1 hour)
            </li>
          </Box>
        </Typography>
      </Box>

      {/* Step 2: Frontend */}
      <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1 }}>
        2. Frontend: Add the Widget
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Load the SDK script and initialize the widget. The SDK calls your <code>getToken</code>{' '}
        callback automatically when it needs a fresh token.
      </Typography>
      <CodeBlock
        code={guide.frontendInstall.code}
        language={guide.frontendInstall.language}
        filename={guide.frontendInstall.filename}
      />

      <Typography variant="subtitle2" sx={{ mt: 3, mb: 1 }}>
        Option A: Floating button
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        Shows a chat bubble in the corner of the page. Click it to open/close.
      </Typography>
      <CodeBlock
        code={guide.frontendFloating.code}
        language={guide.frontendFloating.language}
        filename={guide.frontendFloating.filename}
      />

      <Typography variant="subtitle2" sx={{ mt: 3, mb: 1 }}>
        Option B: Inline container
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        Renders the chat directly inside a DOM element. No floating button.
      </Typography>
      <CodeBlock
        code={guide.frontendInline.code}
        language={guide.frontendInline.language}
        filename={guide.frontendInline.filename}
      />

      {/* Step 3: Reference */}
      <Typography variant="subtitle1" fontWeight={600} sx={{ mt: 4, mb: 1 }}>
        3. Configuration Reference
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        All available options and methods.
      </Typography>
      <CodeBlock code={config.code} language={config.language} filename={config.filename} />
    </Box>
  );
}
