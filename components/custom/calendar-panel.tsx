"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import {
  addMonths,
  eachDayOfInterval,
  endOfDay,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subDays,
} from "date-fns";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Loader2,
  RefreshCw,
  X,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type CalendarAPIPayload = {
  events: Array<CalendarEvent>;
  count: number;
  error?: string;
};

type CalendarEvent = {
  id: string;
  summary?: string | null;
  description?: string | null;
  start?: string | null;
  end?: string | null;
  location?: string | null;
  attendees?: Array<{
    email?: string | null;
    displayName?: string | null;
    responseStatus?: string | null;
  }>;
  status?: string | null;
};

type NormalizedEvent = CalendarEvent & {
  startDate: Date;
  endDate: Date;
  isAllDay: boolean;
};

interface CalendarPanelProps {
  className?: string;
  onClose?: () => void;
  initialSelectedDate?: Date;
  headerTitle?: string;
}

const fetcher = async (url: string): Promise<CalendarAPIPayload> => {
  const response = await fetch(url, { cache: "no-store" });

  const payload = (await response.json()) as CalendarAPIPayload;

  if (!response.ok) {
    throw new Error(payload?.error || "Failed to fetch calendar events");
  }

  return payload;
};

function parseEventDate(value?: string | null): Date | null {
  if (!value) {
    return null;
  }

  try {
    return parseISO(value.length === 10 ? `${value}T00:00:00` : value);
  } catch (_error) {
    return null;
  }
}

function normaliseEvents(events: Array<CalendarEvent>): Array<NormalizedEvent> {
  return events
    .map((event) => {
      const startDate = parseEventDate(event.start) ?? new Date();
      const endDateRaw = parseEventDate(event.end) ?? startDate;
      const isAllDay = Boolean(
        event.start && event.start.length === 10 && event.end && event.end.length === 10,
      );
      const endDate = isAllDay ? subDays(endOfDay(endDateRaw), 1) : endDateRaw;

      return {
        ...event,
        startDate: startOfDay(startDate),
        endDate: endOfDay(endDate),
        isAllDay,
      };
    })
    .sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
}

function buildEventsByDate(events: Array<NormalizedEvent>) {
  const map = new Map<string, Array<NormalizedEvent>>();

  events.forEach((event) => {
    if (event.endDate < event.startDate) {
      return;
    }

    const interval = eachDayOfInterval({
      start: event.startDate,
      end: event.endDate,
    });

    interval.forEach((date) => {
      const key = format(date, "yyyy-MM-dd");
      const bucket = map.get(key) ?? [];
      bucket.push(event);
      map.set(key, bucket);
    });
  });

  return map;
}

export function CalendarPanel({
  className,
  onClose,
  initialSelectedDate,
  headerTitle = "Upcoming Events",
}: CalendarPanelProps) {
  const today = initialSelectedDate ?? new Date();
  const [currentMonth, setCurrentMonth] = useState(startOfMonth(today));
  const [selectedDate, setSelectedDate] = useState(startOfDay(today));

  const { data, error, isLoading, isValidating, mutate } = useSWR(
    "/api/calendar/events",
    fetcher,
    {
      revalidateOnFocus: true,
    },
  );

  const normalizedEvents = useMemo(
    () => normaliseEvents(data?.events ?? []),
    [data?.events],
  );

  const eventsByDate = useMemo(
    () => buildEventsByDate(normalizedEvents),
    [normalizedEvents],
  );

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const selectedKey = format(selectedDate, "yyyy-MM-dd");
  const agendaEvents = (eventsByDate.get(selectedKey) ?? []).sort(
    (a, b) => a.startDate.getTime() - b.startDate.getTime(),
  );

  const calendarError = error || (data?.error ? new Error(data.error) : null);

  return (
    <div
      className={cn(
        "flex h-full flex-col gap-4 rounded-2xl border border-border/60 bg-background/80 p-4 shadow-sm backdrop-blur",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{headerTitle}</p>
          <h2 className="text-lg font-semibold text-foreground">
            {format(currentMonth, "MMMM yyyy")}
          </h2>
        </div>

        <div className="flex items-center gap-1">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={() => {
              setCurrentMonth(startOfMonth(today));
              setSelectedDate(startOfDay(today));
            }}
            aria-label="Jump to today"
          >
            <CalendarDays className="h-4 w-4" />
          </Button>
          {onClose ? (
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={onClose}
              aria-label="Close calendar"
            >
              <X className="h-4 w-4" />
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {"MTWTFSS".split("").map((day, index) => (
          <span key={`${day}-${index}`} className="rounded-md py-2">
            {day}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {calendarDays.map((day) => {
          const key = format(day, "yyyy-MM-dd");
          const dayEvents = eventsByDate.get(key) ?? [];
          const isSelected = isSameDay(day, selectedDate);
          const isCurrentMonth = isSameMonth(day, currentMonth);

          return (
            <button
              type="button"
              key={key}
              onClick={() => setSelectedDate(startOfDay(day))}
              className={cn(
                "group flex h-16 flex-col items-center justify-center gap-1 rounded-md border border-transparent p-1 text-sm transition",
                !isCurrentMonth && "text-muted-foreground/50",
                isSelected && "border-primary/40 bg-primary/10 text-primary-foreground",
                !isSelected && dayEvents.length > 0 && "border-primary/20",
              )}
            >
              <span className="font-medium">{format(day, "d")}</span>
              <div className="flex w-full flex-wrap justify-center gap-0.5">
                {dayEvents.slice(0, 3).map((event) => (
                  <span
                    key={`${event.id}-${key}`}
                    className={cn(
                      "h-1.5 w-1.5 rounded-full bg-primary/70",
                      isSelected && "bg-primary",
                    )}
                  />
                ))}
                {dayEvents.length > 3 ? (
                  <span className="text-[10px] text-muted-foreground">
                    +{dayEvents.length - 3}
                  </span>
                ) : null}
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Agenda — {format(selectedDate, "EEEE, MMM d")}
          </p>
          <p className="text-sm text-muted-foreground">
            {agendaEvents.length} event{agendaEvents.length === 1 ? "" : "s"}
          </p>
        </div>

        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          {isValidating ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={() => mutate()}
            aria-label="Refresh events"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden rounded-xl border border-border/40 bg-muted/40">
        <div className="max-h-72 overflow-y-auto p-3">
          {isLoading ? (
            <div className="flex flex-col gap-3">
              {[1, 2, 3].map((skeleton) => (
                <div key={skeleton} className="animate-pulse space-y-2">
                  <div className="h-3 w-1/3 rounded bg-muted" />
                  <div className="h-2 w-2/3 rounded bg-muted" />
                </div>
              ))}
            </div>
          ) : calendarError ? (
            <div className="flex h-32 flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
              <p>{calendarError.message}</p>
              <Button variant="outline" onClick={() => mutate()}>
                Try again
              </Button>
            </div>
          ) : data?.error === "Calendar not connected" ? (
            <div className="flex h-32 flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
              <p>Connect your calendar to see upcoming events.</p>
            </div>
          ) : agendaEvents.length === 0 ? (
            <div className="flex h-32 flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
              <p>No events scheduled for this day.</p>
              <p className="text-xs">Use the assistant to add a new event.</p>
            </div>
          ) : (
            <ul className="space-y-3 text-sm">
              {agendaEvents.map((event) => {
                const startLabel = event.isAllDay
                  ? "All day"
                  : format(event.startDate, "p");
                const endLabel = event.isAllDay
                  ? undefined
                  : format(event.endDate, "p");

                return (
                  <li
                    key={`${event.id}-${event.start}`}
                    className="rounded-lg border border-border/40 bg-background/70 p-3 shadow-sm"
                  >
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <h3 className="text-sm font-medium text-foreground">
                        {event.summary ?? "Untitled event"}
                      </h3>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      <p>
                        {startLabel}
                        {endLabel ? ` – ${endLabel}` : ""}
                      </p>
                      {event.location ? <p>{event.location}</p> : null}
                    </div>
                    {event.description ? (
                      <p className="mt-2 line-clamp-3 text-xs text-muted-foreground">
                        {event.description}
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}


