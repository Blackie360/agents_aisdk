import Link from "next/link";
import React, { memo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

const NonMemoizedMarkdown = ({ children }: { children: string }) => {
  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set([0])); // First section expanded by default

  const toggleSection = (index: number) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedSections(newExpanded);
  };

  const components = {
    h1: ({ node, children, ...props }: any) => {
      return (
        <h1 className="text-2xl font-bold mt-8 mb-4 pb-2 border-b border-border text-foreground" {...props}>
          {children}
        </h1>
      );
    },
    h2: ({ node, children, ...props }: any) => {
      return (
        <h2 className="text-xl font-semibold mt-6 mb-3 text-foreground flex items-center gap-2" {...props}>
          <span className="w-1 h-6 bg-primary rounded-full"></span>
          {children}
        </h2>
      );
    },
    h3: ({ node, children, ...props }: any) => {
      return (
        <h3 className="text-lg font-semibold mt-5 mb-2 text-foreground" {...props}>
          {children}
        </h3>
      );
    },
    h4: ({ node, children, ...props }: any) => {
      return (
        <h4 className="text-base font-semibold mt-4 mb-2 text-foreground" {...props}>
          {children}
        </h4>
      );
    },
    p: ({ node, children, ...props }: any) => {
      return (
        <p className="leading-relaxed mb-4 text-foreground/90" {...props}>
          {children}
        </p>
      );
    },
    code: ({ node, inline, className, children, ...props }: any) => {
      const match = /language-(\w+)/.exec(className || "");
      return !inline && match ? (
        <pre
          {...props}
          className="text-sm w-full overflow-x-auto bg-muted border border-border p-4 rounded-lg my-4 shadow-sm"
        >
          <code className={match[1]}>{children}</code>
        </pre>
      ) : (
        <code
          className="text-sm bg-muted border border-border py-0.5 px-1.5 rounded font-mono text-foreground"
          {...props}
        >
          {children}
        </code>
      );
    },
    ol: ({ node, children, ...props }: any) => {
      return (
        <ol className="list-decimal list-outside ml-6 mb-4 space-y-2 text-foreground/90" {...props}>
          {children}
        </ol>
      );
    },
    li: ({ node, children, ...props }: any) => {
      return (
        <li className="leading-relaxed pl-2" {...props}>
          {children}
        </li>
      );
    },
    ul: ({ node, children, ...props }: any) => {
      return (
        <ul className="list-disc list-outside ml-6 mb-4 space-y-2 text-foreground/90" {...props}>
          {children}
        </ul>
      );
    },
    strong: ({ node, children, ...props }: any) => {
      return (
        <strong className="font-semibold text-foreground" {...props}>
          {children}
        </strong>
      );
    },
    em: ({ node, children, ...props }: any) => {
      return (
        <em className="italic text-foreground/80" {...props}>
          {children}
        </em>
      );
    },
    a: ({ node, children, ...props }: any) => {
      return (
        <Link
          className="text-primary hover:text-primary/80 underline underline-offset-2 transition-colors"
          target="_blank"
          rel="noreferrer"
          {...props}
        >
          {children}
        </Link>
      );
    },
    blockquote: ({ node, children, ...props }: any) => {
      return (
        <blockquote
          className="border-l-4 border-primary bg-muted/50 pl-4 py-2 my-4 italic text-muted-foreground rounded-r"
          {...props}
        >
          {children}
        </blockquote>
      );
    },
    hr: ({ node, ...props }: any) => {
      return <hr className="my-6 border-border" {...props} />;
    },
    table: ({ node, children, ...props }: any) => {
      return (
        <div className="overflow-x-auto my-4 rounded-lg border border-border">
          <table className="w-full border-collapse" {...props}>
            {children}
          </table>
        </div>
      );
    },
    thead: ({ node, children, ...props }: any) => {
      return <thead className="bg-muted" {...props}>{children}</thead>;
    },
    th: ({ node, children, ...props }: any) => {
      return (
        <th className="border border-border px-4 py-2 text-left font-semibold text-foreground" {...props}>
          {children}
        </th>
      );
    },
    td: ({ node, children, ...props }: any) => {
      return (
        <td className="border border-border px-4 py-2 text-foreground/90" {...props}>
          {children}
        </td>
      );
    },
  };

  // Split content by major headings (##) to create collapsible sections for long content
  const content = String(children);
  // Split by ## headings, but keep the heading with its content
  const sections = content.split(/(?=^##\s+)/m).filter(Boolean);
  const isLongContent = sections.length > 2 || content.length > 2000;

  if (isLongContent && sections.length > 1) {
    return (
      <div className="space-y-4">
        {sections.map((section, index) => {
          const isFirst = index === 0;
          const headingMatch = section.match(/^##\s+(.+)$/m);
          const heading = headingMatch ? headingMatch[1] : `Section ${index + 1}`;
          const isExpanded = expandedSections.has(index) || isFirst;

          if (isFirst) {
            // Always show first section (usually intro)
            return (
              <div key={index} className="prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
                  {section}
                </ReactMarkdown>
              </div>
            );
          }

          return (
            <div
              key={index}
              className="border border-border rounded-lg bg-card shadow-sm overflow-hidden"
            >
              <button
                onClick={() => toggleSection(index)}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-muted/50 transition-colors text-left"
              >
                <h3 className="text-lg font-semibold text-foreground m-0">{heading}</h3>
                {isExpanded ? (
                  <ChevronUp className="size-5 text-muted-foreground" />
                ) : (
                  <ChevronDown className="size-5 text-muted-foreground" />
                )}
              </button>
              {isExpanded && (
                <div className="px-4 pb-4 prose prose-sm dark:prose-invert max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
                    {section}
                  </ReactMarkdown>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
      {children}
    </ReactMarkdown>
  );
};

export const Markdown = memo(
  NonMemoizedMarkdown,
  (prevProps, nextProps) => prevProps.children === nextProps.children,
);
