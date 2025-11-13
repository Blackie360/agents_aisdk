"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { BotIcon, UserIcon } from "@/components/custom/icons";

export function Message({
  from,
  className,
  children,
  ...props
}: {
  from: "user" | "assistant";
  className?: string;
  children: React.ReactNode;
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex flex-row gap-4 w-full",
        from === "user" ? "justify-end" : "justify-start",
        className
      )}
      {...props}
    >
      {from === "assistant" && (
        <Avatar className="size-8 shrink-0">
          <AvatarFallback className="bg-muted">
            <BotIcon />
          </AvatarFallback>
        </Avatar>
      )}
      <div className={cn("flex flex-col gap-2 max-w-[80%]", from === "user" && "items-end")}>
        {children}
      </div>
      {from === "user" && (
        <Avatar className="size-8 shrink-0">
          <AvatarFallback className="bg-primary text-primary-foreground">
            <UserIcon />
          </AvatarFallback>
        </Avatar>
      )}
    </div>
  );
}

export function MessageContent({
  variant = "contained",
  className,
  children,
  ...props
}: {
  variant?: "contained" | "flat";
  className?: string;
  children: React.ReactNode;
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-lg px-4 py-2 text-sm",
        variant === "contained"
          ? "bg-muted text-foreground"
          : "text-foreground",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function MessageAvatar({
  src,
  name,
  className,
  ...props
}: {
  src?: string;
  name?: string;
  className?: string;
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <Avatar className={cn("size-8", className)} {...props}>
      {src && <AvatarImage src={src} alt={name} />}
      <AvatarFallback>{name?.[0]?.toUpperCase() || "?"}</AvatarFallback>
    </Avatar>
  );
}

