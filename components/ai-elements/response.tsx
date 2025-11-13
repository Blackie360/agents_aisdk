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
    <div className={cn("prose prose-sm dark:prose-invert max-w-none", className)} {...props}>
      <Markdown>{content}</Markdown>
    </div>
  );
}

