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
    question: 'What document types does Grabdy support?',
    answer:
      'Grabdy supports PDF, DOCX, DOC, XLSX, XLS, CSV, TXT, JSON, images (PNG, JPEG, WebP, GIF), and email files (EML, MSG, PST). Upload contracts, NDAs, BAAs, compliance filings, and policy documents directly or sync from Google Drive, Gmail, and Notion.',
  },
  {
    question: 'Is my data secure enough for legal documents?',
    answer:
      'Your data is encrypted at rest (AES-256) and in transit (TLS 1.3). Each organization is fully isolated with its own data silo. We never use your data to train models, and you can delete your data at any time. Grabdy is built to handle sensitive legal documents.',
  },
  {
    question: 'Can Grabdy integrate with our CLM or billing systems?',
    answer:
      'Yes. The REST API lets you push deadline data to billing systems, sync contract terms to your CLM, and trigger alerts in your existing workflow tools. We also integrate with Google Drive, Gmail, Notion, and Confluence.',
  },
  {
    question: 'What happens after the free trial?',
    answer:
      'All documents and configurations you create during the trial carry over to your paid plan. We provide advance notice before any changes take effect.',
  },
  {
    question: 'How accurate are the cited answers?',
    answer:
      'Every answer includes citations pointing to the exact document and section. Grabdy uses vector search to find the most relevant clauses, then generates answers grounded in your actual contract language. You can always click through to verify the source.',
  },
  {
    question: 'Can I control who on my team can access specific documents?',
    answer:
      'Yes. Grabdy supports organization-level access controls. You can manage team members, set permissions, and ensure that sensitive documents are only visible to authorized users.',
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
