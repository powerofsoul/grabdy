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
    question: 'What file types does Grabdy support?',
    answer:
      'Grabdy supports PDF, CSV, DOCX, DOC, XLSX, XLS, TXT, JSON, images (PNG, JPEG, WebP, GIF), and email files (EML, MSG, PST). You can also connect integrations like Slack, Notion, GitHub, Google Drive, and Gmail.',
  },
  {
    question: 'Is my data secure?',
    answer:
      'Your data is encrypted at rest and in transit. Each organization is fully isolated with its own data silo. We never use your data to train models, and you can delete your data at any time.',
  },
  {
    question: 'Can I use Grabdy with my existing tools?',
    answer:
      'Yes. Grabdy integrates with Slack, Notion, GitHub, Google Drive, Gmail, and more. You can also use the REST API or MCP server to connect with any custom workflow.',
  },
  {
    question: 'What happens when the beta ends?',
    answer:
      'All data and configurations you create during the beta will carry over. We will provide advance notice before any pricing changes take effect.',
  },
  {
    question: 'How does the API work?',
    answer:
      'The REST API lets you search your knowledge base, manage collections, and upload documents programmatically. Authenticate with a simple API key and start querying in minutes.',
  },
  {
    question: 'Can I embed a chatbot on my website?',
    answer:
      'Yes. Grabdy provides an embeddable chat widget that you can add to any website with a single script tag. It connects to your knowledge base and answers visitor questions with cited sources.',
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
