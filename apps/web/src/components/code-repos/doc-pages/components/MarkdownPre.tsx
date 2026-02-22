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
  ...props
}: React.ComponentProps<'pre'> & { node?: unknown }) {
  const { node: _node, ...rest } = props;

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
