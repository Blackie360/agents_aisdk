"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Streamdown } from "streamdown";
import { Card, CardContent } from "@/components/ui/card";

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
        "w-full max-w-4xl",
        "text-foreground",
        className
      )} 
      {...props}
    >
      <Card className="shadow-md border-2">
        <CardContent className="p-6 sm:p-8">
          <Streamdown 
            className="prose prose-sm sm:prose-base dark:prose-invert max-w-none"
            parseIncompleteMarkdown={true}
            controls={true}
          >
            {content}
          </Streamdown>
        </CardContent>
      </Card>
    </div>
  );
}

