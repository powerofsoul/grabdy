import { z } from 'zod';

import { MermaidBlock } from './MermaidBlock';

const codeChildSchema = z.object({
  props: z.object({
    className: z.string().optional(),
    children: z.string().optional(),
  }),
});

export function MarkdownPre({
  children,
  node: _,
  ...rest
}: React.ComponentProps<'pre'> & { node?: unknown }) {
  // Check if the child <code> element has language-mermaid class
  const parsed = codeChildSchema.safeParse(children);
  if (parsed.success) {
    const { className, children: codeContent } = parsed.data.props;
    if (className && /language-mermaid/.test(className)) {
      return <MermaidBlock code={codeContent?.trim() ?? ''} />;
    }
  }

  return <pre {...rest}>{children}</pre>;
}
