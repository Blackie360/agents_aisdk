"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Markdown } from "@/components/custom/markdown";

export function Response({
  className,
  children,
  ...props
}: {
  className?: string;
  children: React.ReactNode;
} & React.HTMLAttributes<HTMLDivElement>) {
  const content =
    typeof children === "string" ? children : String(children ?? "");

  return (
    <div 
      className={cn(
        "prose prose-sm dark:prose-invert max-w-none",
        "[&_strong]:font-semibold",
        "[&_a]:text-primary [&_a]:underline",
        "[&_code]:font-mono [&_code]:bg-muted [&_code]:px-1 [&_code]:rounded",
        "[&_pre]:bg-muted [&_pre]:border [&_pre]:shadow-sm",
        "[&_ul]:list-disc [&_ol]:list-decimal",
        "[&_blockquote]:border-l-4 [&_blockquote]:border-primary [&_blockquote]:pl-4 [&_blockquote]:italic",
        className
      )} 
      {...props}
    >
      <Markdown>{content}</Markdown>
    </div>
  );
}

