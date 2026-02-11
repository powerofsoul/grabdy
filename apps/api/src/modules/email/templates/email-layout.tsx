import { Body, Container, Head, Html, Preview, Section, Text } from '@react-email/components';
import * as React from 'react';

interface EmailLayoutProps {
  preview: string;
  children: React.ReactNode;
}

const colors = {
  grey: {
    50: '#F8F7F4',
    100: '#F3F2EF',
    200: '#E5E5E2',
    300: '#D4D4D0',
    400: '#A3A39E',
    500: '#73736E',
    600: '#525250',
    700: '#404040',
    800: '#262626',
    900: '#111111',
  },
};

export function EmailLayout({ preview, children }: EmailLayoutProps) {
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={main}>
        <Container style={wrapper}>
          <Section style={header}>
            <Text style={logoText}>grabdy.</Text>
          </Section>

          <Container style={card}>{children}</Container>

          <Section style={footer}>
            <Text style={footerText}>grabdy.</Text>
            <Text style={footerSubtext}>Your documents, instantly searchable</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

const main = {
  backgroundColor: colors.grey[100],
  fontFamily:
    '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  padding: '40px 0',
};

const wrapper = {
  maxWidth: '560px',
  margin: '0 auto',
};

const header = {
  padding: '24px 20px 32px',
  textAlign: 'center' as const,
};

const logoText = {
  fontSize: '24px',
  fontWeight: '700' as const,
  color: colors.grey[900],
  letterSpacing: '-0.03em',
  margin: '0',
  fontFamily: '"Source Serif 4", Georgia, serif',
};

const card = {
  backgroundColor: '#FFFFFF',
  borderRadius: '16px',
  padding: '44px 36px',
  boxShadow:
    '0 4px 6px rgba(0, 0, 0, 0.04), 0 10px 24px rgba(0, 0, 0, 0.08), 0 20px 48px rgba(0, 0, 0, 0.04)',
  border: `1px solid ${colors.grey[200]}`,
};

const footer = {
  padding: '32px 20px 16px',
  textAlign: 'center' as const,
};

const footerText = {
  fontSize: '14px',
  fontWeight: '600' as const,
  color: colors.grey[500],
  margin: '0 0 4px',
  letterSpacing: '-0.01em',
  fontFamily: '"Source Serif 4", Georgia, serif',
};

const footerSubtext = {
  fontSize: '13px',
  color: colors.grey[400],
  margin: '0',
  lineHeight: '20px',
};

export const sharedStyles = {
  heading: {
    fontSize: '28px',
    fontWeight: '700' as const,
    color: colors.grey[900],
    textAlign: 'center' as const,
    margin: '0 0 8px',
    lineHeight: '34px',
    letterSpacing: '-0.02em',
  },
  subheading: {
    fontSize: '15px',
    color: colors.grey[500],
    textAlign: 'center' as const,
    margin: '0 0 32px',
    lineHeight: '22px',
  },
  text: {
    fontSize: '15px',
    lineHeight: '26px',
    color: colors.grey[700],
    margin: '0 0 16px',
  },
  button: {
    backgroundColor: colors.grey[900],
    borderRadius: '8px',
    color: '#FFFFFF',
    fontSize: '15px',
    fontWeight: '600' as const,
    textDecoration: 'none',
    padding: '14px 28px',
    display: 'block',
    textAlign: 'center' as const,
    margin: '28px 0',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
  },
  smallText: {
    fontSize: '13px',
    color: colors.grey[500],
    margin: '0 0 8px',
  },
  link: {
    fontSize: '12px',
    color: colors.grey[900],
    wordBreak: 'break-all' as const,
    textDecoration: 'underline',
  },
  divider: {
    borderTop: `1px solid ${colors.grey[200]}`,
    margin: '24px 0',
  },
  signature: {
    fontSize: '14px',
    color: colors.grey[500],
    marginTop: '28px',
    paddingTop: '24px',
    borderTop: `1px solid ${colors.grey[200]}`,
    lineHeight: '22px',
  },
  codeContainer: {
    backgroundColor: colors.grey[100],
    borderRadius: '12px',
    padding: '28px',
    textAlign: 'center' as const,
    margin: '24px 0',
    border: `1px solid ${colors.grey[200]}`,
  },
  code: {
    fontSize: '36px',
    fontWeight: '700' as const,
    letterSpacing: '8px',
    color: colors.grey[900],
    margin: '0',
    fontFamily: 'monospace',
  },
  highlightBox: {
    backgroundColor: colors.grey[50],
    borderRadius: '10px',
    padding: '18px 22px',
    margin: '24px 0',
    borderLeft: `4px solid ${colors.grey[900]}`,
  },
  highlightText: {
    fontSize: '14px',
    color: colors.grey[700],
    margin: '0',
    fontWeight: '500' as const,
    lineHeight: '22px',
  },
};
