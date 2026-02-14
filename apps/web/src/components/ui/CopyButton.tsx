import { useState } from 'react';

import { IconButton, Tooltip } from '@mui/material';
import { CheckIcon, CopyIcon } from '@phosphor-icons/react';

interface CopyButtonProps {
  text: string;
  size?: number;
}

export function CopyButton({ text, size = 16 }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Tooltip title={copied ? 'Copied!' : 'CopyIcon'}>
      <IconButton onClick={handleCopy} size="small" sx={{ color: 'text.secondary' }}>
        {copied ? <CheckIcon size={size} weight="light" color="currentColor" /> : <CopyIcon size={size} weight="light" color="currentColor" />}
      </IconButton>
    </Tooltip>
  );
}
