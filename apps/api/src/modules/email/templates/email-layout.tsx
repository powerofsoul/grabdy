import { Body, Container, Head, Html, Preview, Section, Text } from '@react-email/components';
import * as React from 'react';

interface EmailLayoutProps {
  preview: string;
  children: React.ReactNode;
}

const colors = {
  grey: {
    50: '#FAFAF9',
    100: '#F5F5F4',
    200: '#E5E5E5',
    300: '#D4D4D4',
    400: '#A3A3A3',
    500: '#737373',
    600: '#525252',
    700: '#404040',
    800: '#262626',
    900: '#171717',
  },
  text: '#000000',
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
  backgroundColor: colors.grey[50],
  fontFamily:
    '"Inter", "SF Pro", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
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
  fontWeight: '400' as const,
  color: colors.text,
  letterSpacing: '-0.03em',
  margin: '0',
  fontFamily: '"Instrument Serif", "Source Serif 4", Georgia, serif',
};

const card = {
  backgroundColor: '#FFFFFF',
  borderRadius: '0',
  padding: '44px 36px',
  border: `1px solid ${colors.grey[900]}`,
};

const footer = {
  padding: '32px 20px 16px',
  textAlign: 'center' as const,
};

const footerText = {
  fontSize: '14px',
  fontWeight: '400' as const,
  color: colors.grey[500],
  margin: '0 0 4px',
  letterSpacing: '-0.01em',
  fontFamily: '"Instrument Serif", "Source Serif 4", Georgia, serif',
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
    fontWeight: '400' as const,
    color: colors.text,
    textAlign: 'center' as const,
    margin: '0 0 8px',
    lineHeight: '34px',
    letterSpacing: '-0.02em',
    fontFamily: '"Instrument Serif", "Source Serif 4", Georgia, serif',
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
    backgroundColor: colors.text,
    borderRadius: '0',
    color: '#FFFFFF',
    fontSize: '15px',
    fontWeight: '500' as const,
    textDecoration: 'none',
    padding: '14px 28px',
    display: 'block',
    textAlign: 'center' as const,
    margin: '28px 0',
  },
  smallText: {
    fontSize: '13px',
    color: colors.grey[500],
    margin: '0 0 8px',
  },
  link: {
    fontSize: '12px',
    color: colors.text,
    wordBreak: 'break-all' as const,
    textDecoration: 'underline',
    textDecorationColor: colors.grey[200],
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
    borderRadius: '0',
    padding: '28px',
    textAlign: 'center' as const,
    margin: '24px 0',
    border: `1px solid ${colors.grey[200]}`,
  },
  code: {
    fontSize: '36px',
    fontWeight: '700' as const,
    letterSpacing: '8px',
    color: colors.text,
    margin: '0',
    fontFamily: '"Geist Mono", "JetBrains Mono", monospace',
  },
  highlightBox: {
    backgroundColor: colors.grey[50],
    borderRadius: '0',
    padding: '18px 22px',
    margin: '24px 0',
    borderLeft: `4px solid ${colors.text}`,
  },
  highlightText: {
    fontSize: '14px',
    color: colors.grey[700],
    margin: '0',
    fontWeight: '500' as const,
    lineHeight: '22px',
  },
};
