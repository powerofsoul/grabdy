import { useRef, useState } from 'react';

import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  TextField,
  Typography,
} from '@mui/material';
import { createFileRoute } from '@tanstack/react-router';
import { Send } from 'lucide-react';
import { toast } from 'sonner';

import { PageHeader } from '@/components/ui/PageHeader';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';

import type { DbId } from '@fastdex/common';

interface Source {
  content: string;
  score: number;
  dataSourceName: string;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  sources?: Source[];
}

export const Route = createFileRoute('/dashboard/chat')({
  component: ChatPage,
});

function ChatPage() {
  const { selectedOrgId } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [threadId, setThreadId] = useState<DbId<'ChatThread'> | undefined>();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSend = async () => {
    if (!selectedOrgId || !input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      const res = await api.retrieval.chat({
        params: { orgId: selectedOrgId },
        body: {
          message: userMessage,
          threadId,
        },
      });

      if (res.status === 200) {
        setThreadId(res.body.data.threadId);
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: res.body.data.answer,
            sources: res.body.data.sources.map((s) => ({
              content: s.content,
              score: s.score,
              dataSourceName: s.dataSourceName,
            })),
          },
        ]);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send message');
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setIsLoading(false);
      setTimeout(scrollToBottom, 100);
    }
  };

  return (
    <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', height: '100%' }}>
      <PageHeader title="Chat" />

      <Box
        sx={{
          flex: 1,
          overflow: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          mb: 2,
        }}
      >
        {messages.length === 0 && (
          <Box
            sx={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'text.secondary',
            }}
          >
            <Typography>Ask a question about your data to get started.</Typography>
          </Box>
        )}

        {messages.map((msg, i) => (
          <Box
            key={i}
            sx={{
              display: 'flex',
              justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
            }}
          >
            <Box
              sx={{
                maxWidth: '70%',
                p: 2,
                borderRadius: 2,
                bgcolor: msg.role === 'user' ? 'primary.main' : 'grey.100',
                color: msg.role === 'user' ? 'primary.contrastText' : 'text.primary',
              }}
            >
              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                {msg.content}
              </Typography>
              {msg.sources && msg.sources.length > 0 && (
                <Box sx={{ mt: 1.5, display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <Typography variant="caption" sx={{ opacity: 0.7 }}>
                    Sources:
                  </Typography>
                  {msg.sources.map((source, j) => (
                    <Card key={j} variant="outlined" sx={{ bgcolor: 'background.paper' }}>
                      <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                        <Typography variant="caption" display="block" sx={{ color: 'text.primary' }}>
                          {source.content.substring(0, 120)}...
                        </Typography>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
                          <Typography variant="caption" color="text.secondary">
                            {source.dataSourceName}
                          </Typography>
                          <Chip label={source.score.toFixed(2)} size="small" sx={{ height: 20, fontSize: '0.7rem' }} />
                        </Box>
                      </CardContent>
                    </Card>
                  ))}
                </Box>
              )}
            </Box>
          </Box>
        ))}

        {isLoading && (
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', color: 'text.secondary' }}>
            <CircularProgress size={16} />
            <Typography variant="body2">Thinking...</Typography>
          </Box>
        )}

        <div ref={messagesEndRef} />
      </Box>

      <Box sx={{ display: 'flex', gap: 1 }}>
        <TextField
          fullWidth
          placeholder="Ask a question about your data..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
          disabled={isLoading}
        />
        <Button
          variant="contained"
          onClick={handleSend}
          disabled={isLoading || !input.trim()}
          sx={{ minWidth: 48, px: 2 }}
        >
          <Send size={20} />
        </Button>
      </Box>
    </Box>
  );
}
