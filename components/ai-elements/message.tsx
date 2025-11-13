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
        "flex flex-row gap-2 sm:gap-4 w-full animate-in fade-in-50 duration-300",
        from === "user" ? "justify-end slide-in-from-right-2" : "justify-start slide-in-from-left-2",
        className
      )}
      {...props}
    >
      {from === "assistant" && (
        <Avatar className="size-7 sm:size-8 shrink-0 border shadow-sm">
          <AvatarFallback className="bg-primary/10">
            <BotIcon />
          </AvatarFallback>
        </Avatar>
      )}
      <div className={cn("flex flex-col gap-2 max-w-[90%] sm:max-w-[85%] md:max-w-[80%]", from === "user" && "items-end")}>
        {children}
      </div>
      {from === "user" && (
        <Avatar className="size-7 sm:size-8 shrink-0 border shadow-sm">
          <AvatarFallback className="bg-secondary font-semibold">
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
        "rounded-lg px-3 sm:px-4 py-2 sm:py-3 text-sm leading-relaxed",
        "border shadow-sm relative",
        variant === "contained"
          ? "bg-card"
          : "bg-transparent",
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

