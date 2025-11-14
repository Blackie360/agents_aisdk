"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

const ConversationContext = React.createContext<{
  scrollAreaRef: React.RefObject<HTMLDivElement>;
  showScrollButton: boolean;
  setShowScrollButton: (show: boolean) => void;
}>({
  scrollAreaRef: React.createRef(),
  showScrollButton: false,
  setShowScrollButton: () => {},
});

export function Conversation({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  const scrollAreaRef = React.useRef<HTMLDivElement>(null);
  const [showScrollButton, setShowScrollButton] = React.useState(false);

  React.useEffect(() => {
    const scrollArea = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]');
    if (!scrollArea) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = scrollArea;
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
      setShowScrollButton(!isNearBottom);
    };

    scrollArea.addEventListener("scroll", handleScroll);
    return () => scrollArea.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <ConversationContext.Provider
      value={{ scrollAreaRef, showScrollButton, setShowScrollButton }}
    >
      <div className={cn("flex flex-col h-full", className)} {...props}>
        {children}
      </div>
    </ConversationContext.Provider>
  );
}

export function ConversationContent({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  const { scrollAreaRef } = React.useContext(ConversationContext);
  const contentRef = React.useRef<HTMLDivElement>(null);

  // Expose content ref through context for scrolling
  React.useEffect(() => {
    if (scrollAreaRef.current && contentRef.current) {
      // Store content ref for external access
      (scrollAreaRef.current as any).contentRef = contentRef;
    }
  }, [scrollAreaRef]);

  return (
    <ScrollArea ref={scrollAreaRef} className={cn("flex-1", className)} {...props}>
      <div ref={contentRef} className="flex flex-col gap-3 sm:gap-4">{children}</div>
    </ScrollArea>
  );
}

export function ConversationEmptyState({
  icon,
  title,
  description,
  className,
  ...props
}: {
  icon?: React.ReactNode;
  title?: string;
  description?: string;
  className?: string;
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center h-full text-center p-8",
        className
      )}
      {...props}
    >
      {icon && <div className="mb-4 text-muted-foreground">{icon}</div>}
      {title && (
        <h3 className="text-lg font-semibold mb-2">{title}</h3>
      )}
      {description && (
        <p className="text-sm text-muted-foreground max-w-md">{description}</p>
      )}
    </div>
  );
}

export function ConversationScrollButton({
  className,
  ...props
}: React.HTMLAttributes<HTMLButtonElement>) {
  const { scrollAreaRef, showScrollButton, setShowScrollButton } =
    React.useContext(ConversationContext);

  const scrollToBottom = () => {
    const scrollArea = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]');
    if (scrollArea) {
      scrollArea.scrollTo({ top: scrollArea.scrollHeight, behavior: "smooth" });
      setShowScrollButton(false);
    }
  };

  if (!showScrollButton) return null;

  return (
    <Button
      onClick={scrollToBottom}
      className={cn(
        "absolute bottom-2 right-2 sm:bottom-4 sm:right-4 rounded-full size-8 sm:size-10 p-0",
        className
      )}
      {...props}
    >
      <ChevronDown className="size-3 sm:size-4" />
    </Button>
  );
}

