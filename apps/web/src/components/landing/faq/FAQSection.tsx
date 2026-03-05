import { useEffect, useRef } from 'react';

import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  alpha,
  Box,
  Container,
  Typography,
  useTheme,
} from '@mui/material';
import { CaretDownIcon } from '@phosphor-icons/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const FAQ_ITEMS = [
  {
    question: 'What file types do you support?',
    answer:
      'Grabdy supports PDF, DOCX, DOC, XLSX, XLS, CSV, TXT, and more. Upload contracts, NDAs, BAAs, compliance filings, and policy documents directly from your computer.',
  },
  {
    question: 'How does auto-renewal detection work?',
    answer:
      'When you upload a contract, Grabdy reads every page and extracts renewal terms, notice periods, and expiration dates. If a contract has an auto-renewal clause, you will get an alert before the notice deadline so you can decide whether to renew or terminate.',
  },
  {
    question: 'How accurate is the AI extraction?',
    answer:
      'Grabdy uses large language models to extract dates, counterparties, contract types, and values. Every extraction links back to the source page so you can verify. Accuracy improves as you upload more documents and the system learns your contract patterns.',
  },
  {
    question: 'Can I share dashboards with my team?',
    answer:
      'Yes. Grabdy supports multi-user organizations. Invite team members, and everyone sees the same portfolio dashboard, deadline alerts, and contract library. Organization-level access controls keep sensitive documents visible only to authorized users.',
  },
  {
    question: 'How is my data secured?',
    answer:
      'Your data is encrypted at rest (AES-256) and in transit (TLS 1.3). Each organization is fully isolated with its own data silo. We never use your data to train models, and you can delete your data at any time.',
  },
  {
    question: 'What happens when a contract expires?',
    answer:
      'Expired contracts remain in your library for reference. The dashboard shows an expired count badge, and expired contracts are clearly marked in the contract list. You can filter and search expired contracts just like active ones.',
  },
];

export function FAQSection() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const theme = useTheme();
  const ct = theme.palette.text.primary;

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion || !sectionRef.current) return;

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        scrollTrigger: { trigger: sectionRef.current, start: 'top 75%' },
      });

      tl.from('.faq-title', { y: 30, opacity: 0, duration: 0.6 });
      tl.from(
        '.faq-item',
        { y: 20, opacity: 0, duration: 0.4, stagger: 0.08, ease: 'power2.out' },
        '-=0.3'
      );
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <Box ref={sectionRef} sx={{ py: { xs: 10, md: 14 }, bgcolor: 'background.default' }}>
      <Container maxWidth="md">
        <Typography
          className="faq-title"
          variant="h2"
          sx={{
            textAlign: 'center',
            mb: { xs: 5, md: 7 },
            fontSize: { xs: '1.75rem', md: '2.25rem' },
            fontWeight: 600,
          }}
        >
          Frequently asked questions
        </Typography>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {FAQ_ITEMS.map((item) => (
            <Accordion
              key={item.question}
              className="faq-item"
              disableGutters
              elevation={0}
              sx={{
                bgcolor: 'transparent',
                borderBottom: `1px solid ${alpha(ct, 0.08)}`,
                '&::before': { display: 'none' },
                '&.Mui-expanded': { margin: 0 },
              }}
            >
              <AccordionSummary
                expandIcon={<CaretDownIcon size={18} weight="light" />}
                sx={{
                  px: 0,
                  py: 1,
                  '& .MuiAccordionSummary-content': { my: 1.5 },
                }}
              >
                <Typography
                  component="h3"
                  sx={{
                    fontSize: { xs: '0.95rem', md: '1.05rem' },
                    fontWeight: 500,
                    color: 'text.primary',
                  }}
                >
                  {item.question}
                </Typography>
              </AccordionSummary>
              <AccordionDetails sx={{ px: 0, pb: 3, pt: 0 }}>
                <Typography
                  sx={{
                    fontSize: '0.9rem',
                    color: 'text.secondary',
                    lineHeight: 1.7,
                  }}
                >
                  {item.answer}
                </Typography>
              </AccordionDetails>
            </Accordion>
          ))}
        </Box>
      </Container>
    </Box>
  );
}
