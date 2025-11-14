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
        "w-full",
        "text-foreground",
        className
      )} 
      {...props}
    >
      <div className="bg-card border border-border rounded-lg p-4 sm:p-6 shadow-sm">
        <Markdown>{content}</Markdown>
      </div>
    </div>
  );
}

