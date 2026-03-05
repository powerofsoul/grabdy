import { useEffect, useRef } from 'react';

import { alpha, Box, Container, Typography, useTheme } from '@mui/material';
import {
  EyeSlashIcon,
  LockKeyIcon,
  ShieldCheckIcon,
  TrashIcon,
  UsersIcon,
} from '@phosphor-icons/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const SECURITY_ITEMS = [
  {
    Icon: LockKeyIcon,
    title: 'Encrypted everywhere',
    description: 'All data encrypted at rest (AES-256) and in transit (TLS 1.3).',
  },
  {
    Icon: UsersIcon,
    title: 'Tenant isolation',
    description: 'Each organization is fully isolated. No cross-tenant data access.',
  },
  {
    Icon: EyeSlashIcon,
    title: 'Never used for training',
    description: 'Your documents are never used to train AI models. Your data stays yours.',
  },
  {
    Icon: TrashIcon,
    title: 'Full data control',
    description: 'Delete your data at any time. Full control over what you upload and retain.',
  },
] as const;

export function SecuritySection() {
  const theme = useTheme();
  const sectionRef = useRef<HTMLDivElement>(null);
  const ct = theme.palette.text.primary;

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion || !sectionRef.current) return;

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        scrollTrigger: { trigger: sectionRef.current, start: 'top 75%' },
      });

      tl.from('.security-title', { y: 30, opacity: 0, duration: 0.6 });
      tl.from(
        '.security-item',
        { y: 20, opacity: 0, duration: 0.4, stagger: 0.1, ease: 'power2.out' },
        '-=0.3'
      );
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <Box ref={sectionRef} sx={{ py: { xs: 10, md: 14 }, bgcolor: 'background.default' }}>
      <Container maxWidth="lg">
        <Box sx={{ textAlign: 'center', mb: { xs: 5, md: 7 } }}>
          <Box
            className="security-title"
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 1.5,
              mb: 1.5,
            }}
          >
            <ShieldCheckIcon size={28} weight="light" />
            <Typography
              variant="h2"
              sx={{ fontSize: { xs: '1.75rem', md: '2.25rem' }, fontWeight: 600 }}
            >
              Built for sensitive documents
            </Typography>
          </Box>
          <Typography
            className="security-title"
            sx={{ color: 'text.secondary', fontSize: '1.05rem', maxWidth: 560, mx: 'auto' }}
          >
            Your contracts, compliance filings, and legal documents deserve enterprise-grade
            security from day one.
          </Typography>
        </Box>

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: 'repeat(4, 1fr)' },
            gap: 3,
          }}
        >
          {SECURITY_ITEMS.map((item) => (
            <Box
              key={item.title}
              className="security-item"
              sx={{
                p: 3,
                border: '1px solid',
                borderColor: alpha(ct, 0.08),
                transition: 'border-color 0.2s',
                '&:hover': { borderColor: alpha(ct, 0.15) },
              }}
            >
              <item.Icon size={24} weight="light" style={{ marginBottom: 12, opacity: 0.7 }} />
              <Typography
                sx={{ fontSize: '0.95rem', fontWeight: 600, mb: 0.75, color: 'text.primary' }}
              >
                {item.title}
              </Typography>
              <Typography sx={{ fontSize: '0.82rem', color: 'text.secondary', lineHeight: 1.6 }}>
                {item.description}
              </Typography>
            </Box>
          ))}
        </Box>
      </Container>
    </Box>
  );
}
