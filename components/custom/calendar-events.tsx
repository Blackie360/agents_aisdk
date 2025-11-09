"use client";

import type { ReactNode } from "react";
import { format, parseISO } from "date-fns";
import { CalendarDays, Check, Clock3, ExternalLink, MapPin, Pencil } from "lucide-react";

import { cn } from "@/lib/utils";

export type CalendarEvent = {
  id?: string | null;
  summary?: string | null;
  description?: string | null;
  start?: string | null;
  end?: string | null;
  location?: string | null;
  status?: string | null;
  htmlLink?: string | null;
  attendees?: Array<{
    email?: string | null;
    displayName?: string | null;
    responseStatus?: string | null;
  }> | null;
};

export interface CalendarEventsPayload {
  events?: Array<CalendarEvent>;
  count?: number;
  error?: string;
}

interface CalendarEventsProps {
  data: CalendarEventsPayload;
  className?: string;
}

export function CalendarEventsList({ data, className }: CalendarEventsProps) {
  if (data?.error) {
    return (
      <div
        className={cn(
          "rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive",
          className,
        )}
      >
        {data.error}
      </div>
    );
  }

  const events = data?.events ?? [];

  if (events.length === 0) {
    return (
      <div
        className={cn(
          "rounded-xl border border-border/40 bg-muted/30 p-4 text-sm text-muted-foreground",
          className,
        )}
      >
        No upcoming events found for the selected calendar.
      </div>
    );
  }

  return (
    <div className={cn("flex w-full flex-col gap-3", className)}>
      {events.map((event) => (
        <article
          key={event.id ?? `${event.summary}-${event.start}`}
          className="rounded-2xl border border-border/40 bg-background/80 p-4 shadow-sm backdrop-blur"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-base font-medium text-foreground">
              {event.summary ?? "Untitled event"}
            </h3>
            <span className="flex items-center gap-1 text-xs uppercase tracking-wide text-muted-foreground">
              <CalendarDays className="h-3.5 w-3.5" />
              {formatEventDate(event.start)}
            </span>
          </div>

          <div className="mt-2 flex flex-col gap-1 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Clock3 className="h-4 w-4 opacity-70" />
              <span>{formatEventTimeRange(event.start, event.end)}</span>
            </div>

            {event.location ? (
              <div className="flex items-start gap-2">
                <MapPin className="mt-0.5 h-4 w-4 opacity-70" />
                <span className="text-foreground/80">{event.location}</span>
              </div>
            ) : null}
          </div>

          {event.description ? (
            <p className="mt-3 line-clamp-3 text-sm leading-6 text-muted-foreground">
              {event.description}
            </p>
          ) : null}
        </article>
      ))}
    </div>
  );
}

export function CalendarEventsListSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("flex w-full flex-col gap-3", className)}>
      {[1, 2].map((item) => (
        <div
          key={item}
          className="animate-pulse rounded-2xl border border-border/30 bg-muted/20 p-4"
        >
          <div className="h-4 w-1/3 rounded bg-muted" />
          <div className="mt-3 h-3 w-1/2 rounded bg-muted" />
          <div className="mt-2 h-12 w-full rounded bg-muted" />
        </div>
      ))}
    </div>
  );
}

interface CalendarEventCardProps {
  event?: CalendarEvent | null;
  heading?: string;
  subtitle?: string;
  footer?: ReactNode;
  statusIcon?: "created" | "updated" | "default";
}

export function CalendarEventCard({
  event,
  heading = "Event",
  subtitle,
  footer,
  statusIcon = "default",
}: CalendarEventCardProps) {
  if (!event) {
    return (
      <div className="rounded-xl border border-border/40 bg-muted/30 p-4 text-sm text-muted-foreground">
        No event details available.
      </div>
    );
  }

  const Icon = statusIcon === "created" ? Check : statusIcon === "updated" ? Pencil : CalendarDays;

  return (
    <div className="flex w-full flex-col gap-3 rounded-2xl border border-border/40 bg-background/85 p-5 shadow-sm backdrop-blur">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-primary">
            <Icon className="h-3.5 w-3.5" />
            {heading}
          </p>
          {subtitle ? (
            <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
          ) : null}
        </div>
        {event?.htmlLink ? (
          <a
            href={event.htmlLink}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-full border border-border/40 bg-muted/20 px-2.5 py-1 text-xs text-muted-foreground transition hover:border-primary/40 hover:text-primary"
          >
            View
            <ExternalLink className="h-3 w-3" />
          </a>
        ) : null}
      </div>

      <div className="space-y-2">
        <h3 className="text-base font-medium text-foreground">
          {event.summary ?? "Untitled event"}
        </h3>
        <div className="flex flex-col gap-1 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 opacity-70" />
            <span>
              {formatEventDate(event.start)} · {formatEventTimeRange(event.start, event.end)}
            </span>
          </div>
          {event.location ? (
            <div className="flex items-start gap-2">
              <MapPin className="mt-0.5 h-4 w-4 opacity-70" />
              <span className="text-foreground/80">{event.location}</span>
            </div>
          ) : null}
        </div>
      </div>

      {event.description ? (
        <p className="text-sm leading-6 text-muted-foreground">{event.description}</p>
      ) : null}

      {footer ? <div className="mt-2 text-xs text-muted-foreground">{footer}</div> : null}
    </div>
  );
}

export function CalendarEventCardSkeleton() {
  return (
    <div className="animate-pulse rounded-2xl border border-border/30 bg-muted/20 p-5">
      <div className="h-3 w-24 rounded bg-muted" />
      <div className="mt-3 h-5 w-2/3 rounded bg-muted" />
      <div className="mt-2 h-3 w-1/2 rounded bg-muted" />
      <div className="mt-2 h-12 w-full rounded bg-muted" />
    </div>
  );
}

function parseEventDate(value?: string | null): Date | null {
  if (!value) {
    return null;
  }

  try {
    return parseISO(value.length === 10 ? `${value}T00:00:00` : value);
  } catch (error) {
    console.warn("Failed to parse calendar event date", error);
    return null;
  }
}

function formatEventDate(value?: string | null): string {
  const parsed = parseEventDate(value);
  if (!parsed) {
    return "Unknown date";
  }

  return format(parsed, "EEE, MMM d");
}

function formatEventTimeRange(start?: string | null, end?: string | null): string {
  const startDate = parseEventDate(start);
  const endDate = parseEventDate(end);

  if (!startDate && !endDate) {
    return "Date to be determined";
  }

  const isAllDay = isAllDayEvent(start, end);

  if (isAllDay) {
    if (!endDate) {
      return "All day";
    }

    if (format(startDate!, "yyyy-MM-dd") === format(endDate, "yyyy-MM-dd")) {
      return "All day";
    }

    return `All day · ends ${format(endDate, "EEE, MMM d")}`;
  }

  if (startDate && endDate) {
    const sameDay = format(startDate, "yyyy-MM-dd") === format(endDate, "yyyy-MM-dd");
    const startLabel = format(startDate, "p");
    const endLabel = format(endDate, sameDay ? "p" : "EEE, MMM d · p");
    return `${startLabel} – ${endLabel}`;
  }

  if (startDate) {
    return format(startDate, "p");
  }

  return endDate ? format(endDate, "p") : "Time to be decided";
}

function isAllDayEvent(start?: string | null, end?: string | null): boolean {
  return Boolean(
    (start && start.length === 10) || (end && end.length === 10),
  );
}

