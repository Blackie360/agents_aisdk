"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ArrowUp, Paperclip, Loader2 } from "lucide-react";

export type PromptInputMessage = {
  text?: string;
  files?: Array<{ url: string; name: string; contentType: string }>;
};

export function PromptInput({
  onSubmit,
  className,
  children,
  ...props
}: {
  onSubmit: (message: PromptInputMessage) => void;
  className?: string;
  children: React.ReactNode;
} & React.HTMLAttributes<HTMLFormElement>) {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget as HTMLFormElement);
    onSubmit({
      text: formData.get("text") as string,
    });
  };

  return (
    <form onSubmit={handleSubmit} className={cn("relative", className)} {...props}>
      {children}
    </form>
  );
}

export function PromptInputTextarea({
  value,
  onChange,
  placeholder = "Send a message...",
  className,
  ...props
}: {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  className?: string;
} & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [value]);

  return (
    <Textarea
      ref={textareaRef}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className={cn("min-h-[60px] max-h-[200px] resize-none pr-12", className)}
      rows={1}
      {...props}
    />
  );
}

export function PromptInputSubmit({
  status = "ready",
  disabled,
  className,
  ...props
}: {
  status?: "ready" | "streaming";
  disabled?: boolean;
  className?: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <Button
      type="submit"
      disabled={disabled || status === "streaming"}
      className={cn(
        "absolute bottom-2 right-2 size-8 p-0 rounded-full",
        className
      )}
      {...props}
    >
      {status === "streaming" ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <ArrowUp className="size-4" />
      )}
    </Button>
  );
}

export function PromptInputAttachments({
  children,
  className,
  ...props
}: {
  children: (attachment: { url: string; name: string; contentType: string }) => React.ReactNode;
  className?: string;
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("flex gap-2 mb-2", className)} {...props}>
      {children}
    </div>
  );
}

export function PromptInputAttachment({
  data,
  className,
  ...props
}: {
  data: { url: string; name: string; contentType: string };
  className?: string;
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "relative size-16 rounded-md overflow-hidden border bg-muted",
        className
      )}
      {...props}
    >
      {data.contentType?.startsWith("image/") ? (
        <img
          src={data.url}
          alt={data.name}
          className="size-full object-cover"
        />
      ) : (
        <div className="flex items-center justify-center size-full text-xs">
          {data.name}
        </div>
      )}
    </div>
  );
}

export function PromptInputActionAddAttachments({
  onFileSelect,
  ...props
}: {
  onFileSelect?: (files: FileList) => void;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files && onFileSelect) {
            onFileSelect(e.target.files);
          }
        }}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => fileInputRef.current?.click()}
        {...props}
      >
        <Paperclip className="size-4" />
      </Button>
    </>
  );
}

