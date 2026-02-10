import { useEffect, useRef, useState } from 'react';

import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  TextField,
  Typography,
  useTheme,
} from '@mui/material';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Search } from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

const MOCK_RESULTS = [
  {
    content: 'Our refund policy allows returns within 30 days of purchase. Items must be in original condition with receipt.',
    score: 0.94,
    source: 'policies/refund-policy.pdf',
  },
  {
    content: 'For digital products, refunds are processed within 5-7 business days after the request is approved.',
    score: 0.89,
    source: 'faq/digital-refunds.docx',
  },
  {
    content: 'Subscription cancellations take effect at the end of the current billing period. Partial refunds are not available.',
    score: 0.82,
    source: 'terms/subscriptions.txt',
  },
];

export function DemoSection() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<typeof MOCK_RESULTS | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const theme = useTheme();

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion || !sectionRef.current) return;

    const ctx = gsap.context(() => {
      gsap.from('.demo-title', {
        y: 30,
        opacity: 0,
        duration: 0.6,
        scrollTrigger: {
          trigger: '.demo-title',
          start: 'top 80%',
        },
      });
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  useEffect(() => {
    if (!results || !resultsRef.current) return;
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    const ctx = gsap.context(() => {
      gsap.from('.result-card', {
        y: 20,
        opacity: 0,
        duration: 0.4,
        stagger: 0.12,
        ease: 'power2.out',
      });
    }, resultsRef);

    return () => ctx.revert();
  }, [results]);

  const handleSearch = () => {
    if (!query.trim()) return;
    setIsSearching(true);
    setResults(null);

    setTimeout(() => {
      setResults(MOCK_RESULTS);
      setIsSearching(false);
    }, 600);
  };

  return (
    <Box ref={sectionRef} id="demo" sx={{ py: 12, bgcolor: 'background.default' }}>
      <Container maxWidth="md">
        <Typography
          className="demo-title"
          variant="h2"
          sx={{
            textAlign: 'center',
            mb: 2,
            fontWeight: 800,
            fontSize: { xs: '2rem', md: '2.5rem' },
          }}
        >
          Try it yourself
        </Typography>
        <Typography
          variant="body1"
          color="text.secondary"
          sx={{ textAlign: 'center', mb: 5, maxWidth: 500, mx: 'auto' }}
        >
          Type a question and see how fast vector search retrieves relevant results from documents.
        </Typography>

        <Box sx={{ display: 'flex', gap: 1, mb: 4 }}>
          <TextField
            fullWidth
            placeholder="What is the refund policy?"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            slotProps={{
              input: {
                startAdornment: <Search size={20} style={{ marginRight: 8, opacity: 0.5 }} />,
              },
            }}
          />
          <Button
            variant="contained"
            onClick={handleSearch}
            disabled={isSearching || !query.trim()}
            sx={{ px: 3, whiteSpace: 'nowrap' }}
          >
            {isSearching ? 'Searching...' : 'Search'}
          </Button>
        </Box>

        {results && (
          <Box ref={resultsRef}>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
              <Chip
                label="Retrieved in 23ms"
                size="small"
                color="success"
                variant="outlined"
              />
            </Box>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {results.map((result, i) => (
                <Card key={i} className="result-card">
                  <CardContent sx={{ p: 2.5 }}>
                    <Typography variant="body2" sx={{ mb: 1.5 }}>
                      {result.content}
                    </Typography>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="caption" color="text.secondary">
                        {result.source}
                      </Typography>
                      <Chip
                        label={`Score: ${result.score}`}
                        size="small"
                        sx={{
                          bgcolor: theme.palette.mode === 'dark' ? 'grey.100' : 'grey.100',
                          fontWeight: 600,
                          fontSize: '0.75rem',
                        }}
                      />
                    </Box>
                  </CardContent>
                </Card>
              ))}
            </Box>
          </Box>
        )}
      </Container>
    </Box>
  );
}
