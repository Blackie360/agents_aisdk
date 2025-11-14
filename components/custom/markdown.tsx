import Link from "next/link";
import React, { memo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

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
        <>
          <h1 className="text-2xl font-bold mt-8 mb-6 text-foreground" {...props}>
            {children}
          </h1>
          <Separator className="mb-6" />
        </>
      );
    },
    h2: ({ node, children, ...props }: any) => {
      return (
        <>
          <h2 className="text-xl font-semibold mt-8 mb-4 text-foreground flex items-center gap-2" {...props}>
            <span className="w-1 h-6 bg-primary rounded-full"></span>
            {children}
          </h2>
        </>
      );
    },
    h3: ({ node, children, ...props }: any) => {
      return (
        <h3 className="text-lg font-semibold mt-6 mb-3 text-foreground flex items-center gap-2" {...props}>
          <Badge variant="outline" className="text-xs px-2 py-0">Section</Badge>
          {children}
        </h3>
      );
    },
    h4: ({ node, children, ...props }: any) => {
      return (
        <h4 className="text-base font-semibold mt-5 mb-2 text-foreground" {...props}>
          {children}
        </h4>
      );
    },
    p: ({ node, children, ...props }: any) => {
      return (
        <p className="leading-relaxed mb-4 text-foreground/90 text-base" {...props}>
          {children}
        </p>
      );
    },
    code: ({ node, inline, className, children, ...props }: any) => {
      const match = /language-(\w+)/.exec(className || "");
      return !inline && match ? (
        <Card className="my-6 overflow-hidden">
          <CardContent className="p-0">
            <pre
              {...props}
              className="text-sm w-full overflow-x-auto bg-muted/50 p-4 m-0"
            >
              <code className={match[1]}>{children}</code>
            </pre>
          </CardContent>
        </Card>
      ) : (
        <code
          className="text-sm bg-muted border border-border py-1 px-2 rounded font-mono text-foreground"
          {...props}
        >
          {children}
        </code>
      );
    },
    ol: ({ node, children, ...props }: any) => {
      return (
        <ol className="list-decimal list-outside ml-6 mb-6 space-y-3 text-foreground/90 flex flex-col" {...props}>
          {children}
        </ol>
      );
    },
    li: ({ node, children, ...props }: any) => {
      return (
        <li className="leading-relaxed pl-2 block text-base" {...props}>
          {children}
        </li>
      );
    },
    ul: ({ node, children, ...props }: any) => {
      return (
        <ul className="list-disc list-outside ml-6 mb-6 space-y-3 text-foreground/90 flex flex-col" {...props}>
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
          className="border-l-4 border-primary bg-muted/50 pl-6 py-4 my-6 italic text-foreground/80 rounded-r-lg"
          {...props}
        >
          {children}
        </blockquote>
      );
    },
    hr: ({ node, ...props }: any) => {
      return <Separator className="my-8" {...props} />;
    },
    table: ({ node, children, ...props }: any) => {
      return (
        <Card className="my-6 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse" {...props}>
              {children}
            </table>
          </div>
        </Card>
      );
    },
    thead: ({ node, children, ...props }: any) => {
      return <thead className="bg-muted" {...props}>{children}</thead>;
    },
    th: ({ node, children, ...props }: any) => {
      return (
        <th className="border border-border px-4 py-3 text-left font-semibold text-foreground text-sm" {...props}>
          {children}
        </th>
      );
    },
    td: ({ node, children, ...props }: any) => {
      return (
        <td className="border border-border px-4 py-3 text-foreground/90 text-sm" {...props}>
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
      <div className="space-y-6">
        {sections.map((section, index) => {
          const isFirst = index === 0;
          const headingMatch = section.match(/^##\s+(.+)$/m);
          const heading = headingMatch ? headingMatch[1] : `Section ${index + 1}`;
          const isExpanded = expandedSections.has(index) || isFirst;

          if (isFirst) {
            // Always show first section (usually intro)
            return (
              <Card key={index} className="bg-muted/30">
                <CardContent className="pt-6">
                  <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
                    {section}
                  </ReactMarkdown>
                </CardContent>
              </Card>
            );
          }

          return (
            <Card key={index} className="overflow-hidden">
              <CardHeader className="pb-3">
                <button
                  onClick={() => toggleSection(index)}
                  className="w-full flex items-center justify-between hover:opacity-80 transition-opacity text-left"
                >
                  <CardTitle className="text-lg m-0">{heading}</CardTitle>
                  {isExpanded ? (
                    <ChevronUp className="size-5 text-muted-foreground shrink-0" />
                  ) : (
                    <ChevronDown className="size-5 text-muted-foreground shrink-0" />
                  )}
                </button>
              </CardHeader>
              {isExpanded && (
                <CardContent className="pt-0">
                  <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
                    {section}
                  </ReactMarkdown>
                </CardContent>
              )}
            </Card>
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
