import { useEffect, useRef } from 'react';

import { alpha, Box, Container, Typography, useTheme } from '@mui/material';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { FileText, Image, Search, Sheet } from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

// ── Brand icons ──

function SlackLogo({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313z" fill="#E01E5A" />
      <path d="M8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312z" fill="#36C5F0" />
      <path d="M18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312z" fill="#2EB67D" />
      <path d="M15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" fill="#ECB22E" />
    </svg>
  );
}

function GoogleDriveLogo({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M12.01 1.485c-2.082 0-3.754.02-3.743.047.01.02 1.708 3.001 3.774 6.62l3.76 6.574h3.76c2.081 0 3.753-.02 3.742-.047-.005-.02-1.708-3.001-3.775-6.62l-3.76-6.574z" fill="#4688F4" />
      <path d="M7.25 3.214a789.828 789.861 0 0 0-3.63 6.319L0 15.868l1.89 3.298 1.885 3.297 3.62-6.335 3.618-6.33-1.88-3.287C8.1 4.704 7.255 3.22 7.25 3.214z" fill="#1FA463" />
      <path d="M9.509 16.468l-.203.348c-.114.198-.96 1.672-1.88 3.287a423.93 423.948 0 0 1-1.698 2.97c-.01.026 3.24.042 7.222.042h7.244l1.796-3.157c.992-1.734 1.85-3.23 1.906-3.323l.104-.167h-7.249z" fill="#FFD04B" />
    </svg>
  );
}

function LinearLogo({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M2.886 4.18A11.982 11.982 0 0 1 11.99 0C18.624 0 24 5.376 24 12.009c0 3.64-1.62 6.903-4.18 9.105L2.887 4.18ZM1.817 5.626l16.556 16.556c-.524.33-1.075.62-1.65.866L.951 7.277c.247-.575.537-1.126.866-1.65ZM.322 9.163l14.515 14.515c-.71.172-1.443.282-2.195.322L0 11.358a12 12 0 0 1 .322-2.195Zm-.17 4.862 9.823 9.824a12.02 12.02 0 0 1-9.824-9.824Z" fill="#5E6AD2" />
    </svg>
  );
}

function NotionLogo({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" opacity={0.85}>
      <path d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.968c-.42-.326-.98-.7-2.055-.607L2.84 2.298c-.466.046-.56.28-.373.466zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.84-.046.933-.56.933-1.167V6.354c0-.606-.233-.933-.746-.886l-15.177.886c-.56.047-.747.327-.747.934zm14.337.745c.093.42 0 .84-.42.886l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.746 0-.933-.234-1.495-.933l-4.577-7.186v6.952l1.448.327s0 .84-1.168.84l-3.222.186c-.093-.186 0-.653.327-.746l.84-.233V9.854L7.822 9.76c-.094-.42.14-1.026.793-1.073l3.456-.233 4.764 7.279v-6.44l-1.215-.14c-.093-.514.28-.886.747-.933zM1.936 1.035l13.31-.98c1.634-.14 2.055-.047 3.082.7l4.249 2.986c.7.513.933.653.933 1.213v16.378c0 1.026-.373 1.634-1.68 1.726l-15.458.933c-.98.047-1.448-.093-1.962-.747l-3.129-4.06c-.56-.747-.793-1.306-.793-1.96V2.667c0-.84.373-1.54 1.448-1.632z" />
    </svg>
  );
}

function ConfluenceLogo({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M.87 18.257c-.248.382-.53.875-.763 1.245a.764.764 0 0 0 .255 1.04l4.965 3.054a.764.764 0 0 0 1.058-.26c.199-.332.49-.834.79-1.358 2.188-3.823 4.376-3.263 8.397-1.368l4.588 2.16a.764.764 0 0 0 1.015-.39l2.27-5.186a.764.764 0 0 0-.378-1.003c-1.397-.66-4.195-1.98-6.588-3.107-8.167-3.853-12.162-1.578-15.61 5.173z" fill="#1868DB" />
      <path d="M23.131 5.743c.249-.382.53-.875.764-1.245a.764.764 0 0 0-.256-1.04L18.674.404a.764.764 0 0 0-1.058.26c-.2.332-.49.834-.79 1.358-2.188 3.823-4.377 3.263-8.397 1.369L3.84 1.23a.764.764 0 0 0-1.015.39L.555 6.806a.764.764 0 0 0 .378 1.003c1.397.66 4.195 1.98 6.588 3.107 8.167 3.853 12.162 1.578 15.61-5.173z" fill="#1868DB" />
    </svg>
  );
}

function GmailLogo({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.145C21.69 2.28 24 3.434 24 5.457z" fill="#EA4335" />
    </svg>
  );
}

function PdfIcon({ size = 24 }: { size?: number }) {
  return <FileText size={size} color="#E5322D" strokeWidth={1.8} />;
}

function DocxIcon({ size = 24 }: { size?: number }) {
  return <Sheet size={size} color="#2B579A" strokeWidth={1.8} />;
}

function ImageIcon({ size = 24 }: { size?: number }) {
  return <Image size={size} color="#16A34A" strokeWidth={1.8} />;
}

const SOURCES = [
  { name: 'Slack', desc: 'Channels & threads', Logo: SlackLogo, color: '#E01E5A' },
  { name: 'Google Drive', desc: 'Docs, Sheets, PDFs', Logo: GoogleDriveLogo, color: '#4688F4' },
  { name: 'Linear', desc: 'Issues & projects', Logo: LinearLogo, color: '#5E6AD2' },
  { name: 'Notion', desc: 'Pages & databases', Logo: NotionLogo, color: '#787878' },
  { name: 'Confluence', desc: 'Spaces & pages', Logo: ConfluenceLogo, color: '#1868DB' },
  { name: 'Gmail', desc: 'Emails & attachments', Logo: GmailLogo, color: '#EA4335' },
  { name: 'PDFs', desc: 'Contracts, reports, manuals', Logo: PdfIcon, color: '#E5322D' },
  { name: 'Documents', desc: 'DOCX, CSV, TXT, JSON', Logo: DocxIcon, color: '#2B579A' },
  { name: 'Images', desc: 'Screenshots & diagrams', Logo: ImageIcon, color: '#16A34A' },
] satisfies Array<{ name: string; desc: string; Logo: typeof SlackLogo; color: string }>;

const EXAMPLE_QUERIES = [
  { query: 'What was decided about the pricing change?', sources: 'Slack #product + Google Drive Pricing.docx', time: '1.2s' },
  { query: 'Show me all open blockers for the launch', sources: 'Linear Sprint 24 + Slack #engineering', time: '0.8s' },
  { query: 'Summarize last quarter customer feedback', sources: 'Gmail Support threads + Notion CX Database', time: '2.1s' },
];

export function PipelineSection() {
  const theme = useTheme();
  const sectionRef = useRef<HTMLDivElement>(null);
  const isDark = theme.palette.mode === 'dark';

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion || !sectionRef.current) return;

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        scrollTrigger: { trigger: sectionRef.current, start: 'top 70%' },
      });

      tl.from('.pl-title', { y: 30, opacity: 0, duration: 0.6 });
      tl.from('.pl-subtitle', { y: 20, opacity: 0, duration: 0.4 }, '-=0.3');

      // Source cards stagger in
      tl.from('.pl-source-card', {
        y: 30, opacity: 0, duration: 0.5, stagger: 0.07, ease: 'power2.out',
      }, '-=0.2');

      // Connector + hub
      tl.from('.pl-connector', { scaleY: 0, opacity: 0, duration: 0.4, transformOrigin: 'top center' }, '-=0.1');
      tl.from('.pl-hub', { scale: 0.8, opacity: 0, duration: 0.5, ease: 'back.out(1.5)' }, '-=0.2');

      // Query cards
      tl.from('.pl-query-card', {
        y: 20, opacity: 0, duration: 0.4, stagger: 0.1, ease: 'power2.out',
      }, '-=0.2');
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <Box ref={sectionRef} id="pipeline" sx={{ py: { xs: 10, md: 14 }, bgcolor: 'background.default' }}>
      <Container maxWidth="lg">
        {/* Title */}
        <Typography
          className="pl-title"
          variant="h2"
          sx={{ textAlign: 'center', mb: 2, fontWeight: 800, fontSize: { xs: '2rem', md: '2.75rem' }, letterSpacing: '-0.02em' }}
        >
          Connect everything{' '}
          <Box component="span" sx={{ color: 'primary.main' }}>your team</Box>{' '}
          uses.
        </Typography>
        <Typography
          className="pl-subtitle"
          variant="body1"
          color="text.secondary"
          sx={{ textAlign: 'center', mb: { xs: 5, md: 7 }, maxWidth: 520, mx: 'auto', fontSize: '1.05rem', lineHeight: 1.6 }}
        >
          Slack threads, Google Docs, Linear issues — all searchable in one place.
          Every answer cites the original source.
        </Typography>

        {/* Source cards: 3×2 grid */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr' },
            gap: 2,
            maxWidth: 780,
            mx: 'auto',
            mb: 5,
          }}
        >
          {SOURCES.map((src) => (
            <Box
              key={src.name}
              className="pl-source-card"
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                p: 2.5,
                borderRadius: 2,
                bgcolor: isDark ? alpha(src.color, 0.06) : alpha(src.color, 0.03),
                border: '1px solid',
                borderColor: isDark ? alpha(src.color, 0.15) : alpha(src.color, 0.1),
                transition: 'transform 0.2s, box-shadow 0.2s, border-color 0.2s',
                '&:hover': {
                  transform: 'translateY(-2px)',
                  borderColor: alpha(src.color, 0.3),
                  boxShadow: `0 8px 24px ${alpha(src.color, 0.12)}`,
                },
              }}
            >
              <Box
                sx={{
                  width: 44,
                  height: 44,
                  borderRadius: 1.5,
                  bgcolor: isDark ? alpha(src.color, 0.1) : alpha(src.color, 0.06),
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <src.Logo size={24} />
              </Box>
              <Box>
                <Typography sx={{ fontWeight: 700, fontSize: '0.9rem', color: 'text.primary' }}>
                  {src.name}
                </Typography>
                <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary' }}>
                  {src.desc}
                </Typography>
              </Box>
            </Box>
          ))}
        </Box>

        {/* Vertical connector line */}
        <Box
          className="pl-connector"
          sx={{
            width: 2,
            height: 48,
            mx: 'auto',
            mb: 2,
            background: `linear-gradient(180deg, ${alpha(theme.palette.primary.main, 0.3)}, ${alpha(theme.palette.primary.main, 0.08)})`,
            borderRadius: 1,
          }}
        />

        {/* Central hub */}
        <Box
          className="pl-hub"
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 1.5,
            mx: 'auto',
            mb: 2,
            px: 4,
            py: 1.5,
            width: 'fit-content',
            borderRadius: 3,
            bgcolor: isDark ? alpha(theme.palette.primary.main, 0.08) : alpha(theme.palette.primary.main, 0.04),
            border: '2px solid',
            borderColor: alpha(theme.palette.primary.main, 0.2),
            boxShadow: `0 0 30px ${alpha(theme.palette.primary.main, 0.08)}`,
          }}
        >
          <Box sx={{ display: 'flex', gap: 0.75, mr: 0.5 }}>
            {SOURCES.slice(0, 3).map((src) => (
              <Box key={src.name} sx={{ opacity: 0.7 }}>
                <src.Logo size={14} />
              </Box>
            ))}
          </Box>
          <Typography sx={{ fontWeight: 700, fontSize: '0.95rem', color: 'text.primary' }}>
            grabdy
            <Box component="span" sx={{ color: 'primary.main' }}>.</Box>
          </Typography>
        </Box>

        {/* Vertical connector line */}
        <Box
          className="pl-connector"
          sx={{
            width: 2,
            height: 48,
            mx: 'auto',
            mb: 5,
            background: `linear-gradient(180deg, ${alpha(theme.palette.primary.main, 0.08)}, ${alpha(theme.palette.primary.main, 0.3)})`,
            borderRadius: 1,
          }}
        />

        {/* Example queries */}
        <Box sx={{ maxWidth: 640, mx: 'auto', display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {EXAMPLE_QUERIES.map((q, i) => (
            <Box
              key={i}
              className="pl-query-card"
              sx={{
                p: 2.5,
                borderRadius: 2,
                bgcolor: isDark ? alpha(theme.palette.common.white, 0.03) : 'background.paper',
                border: '1px solid',
                borderColor: isDark ? alpha(theme.palette.common.white, 0.06) : 'divider',
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                transition: 'transform 0.2s, box-shadow 0.2s',
                '&:hover': {
                  transform: 'translateY(-1px)',
                  boxShadow: `0 4px 16px ${alpha(theme.palette.common.black, isDark ? 0.3 : 0.06)}`,
                },
              }}
            >
              <Box
                sx={{
                  width: 36,
                  height: 36,
                  borderRadius: 1.5,
                  bgcolor: alpha(theme.palette.primary.main, 0.1),
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Search size={16} color={theme.palette.primary.main} />
              </Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontSize: '0.88rem', fontWeight: 600, color: 'text.primary', mb: 0.25 }}>
                  {q.query}
                </Typography>
                <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                  {q.sources}
                </Typography>
              </Box>
              <Typography
                sx={{
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  color: 'success.main',
                  flexShrink: 0,
                  fontFamily: 'monospace',
                }}
              >
                {q.time}
              </Typography>
            </Box>
          ))}
        </Box>
      </Container>
    </Box>
  );
}
