import { alpha, Box, Container, Typography, useTheme } from '@mui/material';

import { Logo } from '../ui/Logo';

interface FooterColumn {
  title: string;
  links: ReadonlyArray<{ label: string; href: string }>;
}

const COLUMNS = [
  {
    title: 'Product',
    links: [
      { label: 'Features', href: '#features' },
      { label: 'Pricing', href: '#pricing' },
      { label: 'Integrations', href: '#features' },
    ],
  },
  {
    title: 'Developers',
    links: [
      { label: 'Documentation', href: '/developers' },
      { label: 'API Reference', href: '/developers' },
      { label: 'SDKs', href: '/developers' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About', href: '/about' },
      { label: 'Blog', href: '/blog' },
      { label: 'Contact', href: 'mailto:hello@grabdy.com' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Privacy', href: '/privacy' },
      { label: 'Terms', href: '/terms' },
    ],
  },
] satisfies ReadonlyArray<FooterColumn>;

export function Footer() {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const linkSx = {
    color: isDark ? 'text.secondary' : alpha(theme.palette.common.white, 0.5),
    cursor: 'pointer',
    fontSize: '0.85rem',
    transition: 'color 0.2s',
    textDecoration: 'none',
    display: 'block',
    '&:hover': { color: isDark ? 'text.primary' : alpha(theme.palette.common.white, 0.9) },
  };

  const headingSx = {
    fontSize: '0.72rem',
    fontWeight: 700,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.08em',
    color: isDark ? 'text.primary' : alpha(theme.palette.common.white, 0.7),
    mb: 1.5,
  };

  return (
    <Box
      component="footer"
      sx={{
        py: 5,
        bgcolor: isDark ? 'grey.50' : 'grey.900',
        borderTop: '1px solid',
        borderColor: isDark ? 'divider' : alpha(theme.palette.common.white, 0.05),
      }}
    >
      <Container maxWidth="lg">
        {/* Logo + tagline */}
        <Box sx={{ mb: 4, color: isDark ? 'text.primary' : alpha(theme.palette.common.white, 0.9) }}>
          <Logo size="sm" />
          <Typography
            sx={{
              mt: 1,
              fontSize: '0.8rem',
              color: isDark ? 'text.secondary' : alpha(theme.palette.common.white, 0.4),
              maxWidth: 240,
            }}
          >
            Smart document search for your entire organization.
          </Typography>
        </Box>

        {/* 4-column grid */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' },
            gap: { xs: 3, md: 6 },
            mb: 4,
          }}
        >
          {COLUMNS.map((col) => (
            <Box key={col.title}>
              <Typography sx={headingSx}>{col.title}</Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {col.links.map((link) => (
                  <Typography
                    key={link.label}
                    component="a"
                    href={link.href}
                    sx={linkSx}
                  >
                    {link.label}
                  </Typography>
                ))}
              </Box>
            </Box>
          ))}
        </Box>

        {/* Bottom bar */}
        <Box
          sx={{
            pt: 3,
            borderTop: '1px solid',
            borderColor: isDark ? 'divider' : alpha(theme.palette.common.white, 0.08),
          }}
        >
          <Typography
            sx={{
              fontSize: '0.78rem',
              color: isDark ? 'text.secondary' : alpha(theme.palette.common.white, 0.35),
            }}
          >
            &copy; {new Date().getFullYear()} grabdy. All rights reserved.
          </Typography>
        </Box>
      </Container>
    </Box>
  );
}
