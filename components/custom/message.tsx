"use client";

import { getToolName, isToolUIPart, type UIMessage } from "ai";
import { motion } from "framer-motion";

import {
  type CalendarEvent,
  CalendarEventCard,
  CalendarEventCardSkeleton,
  CalendarEventsList,
  CalendarEventsListSkeleton,
} from "./calendar-events";
import { BotIcon, UserIcon } from "./icons";
import { Markdown } from "./markdown";
import { PreviewAttachment } from "./preview-attachment";
import { Weather } from "./weather";
import { AuthorizePayment } from "../flights/authorize-payment";
import { DisplayBoardingPass } from "../flights/boarding-pass";
import { CreateReservation } from "../flights/create-reservation";
import { FlightStatus } from "../flights/flight-status";
import { ListFlights } from "../flights/list-flights";
import { SelectSeats } from "../flights/select-seats";
import { VerifyPayment } from "../flights/verify-payment";

export const Message = ({
  chatId,
  message,
}: {
  chatId: string;
  message: UIMessage;
}) => {
  const { role, parts } = message;

  // Filter out empty text parts and check if message has any visible content
  const visibleParts = parts.filter((part) => {
    if (part.type === "text") {
      return typeof part.text === "string" && part.text.trim().length > 0;
    }
    return true; // Keep non-text parts (files, tools, etc.)
  });

  // Don't render messages with no visible content
  if (visibleParts.length === 0) {
    return null;
  }

  return (
    <motion.div
      className={`flex flex-row gap-4 px-4 w-full md:w-[500px] md:px-0 first-of-type:pt-20`}
      initial={{ y: 5, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
    >
      <div className="size-[24px] border rounded-sm p-1 flex flex-col justify-center items-center shrink-0 text-zinc-500">
        {role === "assistant" ? <BotIcon /> : <UserIcon />}
      </div>

      <div className="flex flex-col gap-2 w-full">
        {visibleParts.map((part, index) => {
          switch (part.type) {
            case "text":
              return (
                <div
                  key={index}
                  className="text-zinc-800 dark:text-zinc-300 flex flex-col gap-4"
                >
                  <Markdown>{part.text}</Markdown>
                </div>
              );

            case "file":
              return (
                <PreviewAttachment
                  key={index}
                  attachment={{
                    type: "file",
                    url: part.url,
                    filename: part.filename,
                    mediaType: part.mediaType,
                  }}
                />
              );

            default:
              // Handle tool invocations
              if (isToolUIPart(part)) {
                const toolName = getToolName(part);
                const { toolCallId, state, output } = part;

                if (state === "output-available" && output !== undefined && output !== null) {
                  return (
                    <div key={toolCallId}>
                      {toolName === "getWeather" ? (
                        <Weather weatherAtLocation={output as any} />
                      ) : toolName === "displayFlightStatus" ? (
                        <FlightStatus flightStatus={output as any} />
                      ) : toolName === "searchFlights" ? (
                        <ListFlights chatId={chatId} results={output as any} />
                      ) : toolName === "selectSeats" ? (
                        <SelectSeats chatId={chatId} availability={output as any} />
                      ) : toolName === "createReservation" ? (
                        Object.keys(output).includes("error") ? null : (
                          <CreateReservation reservation={output as any} />
                        )
                      ) : toolName === "authorizePayment" ? (
                        <AuthorizePayment intent={output as any} />
                      ) : toolName === "displayBoardingPass" ? (
                        <DisplayBoardingPass boardingPass={output as any} />
                      ) : toolName === "verifyPayment" ? (
                        <VerifyPayment result={output as any} />
                      ) : toolName === "listEvents" ? (
                        <CalendarEventsList data={output as any} />
                      ) : toolName === "createEvent" ? (
                        renderCalendarEventCard(output as any, "Event Scheduled", "created")
                      ) : toolName === "updateEvent" ? (
                        renderCalendarEventCard(output as any, "Event Updated", "updated")
                      ) : toolName === "deleteEvent" ? (
                        renderDeleteEvent(output as any)
                      ) : (
                        <div>{JSON.stringify(output, null, 2)}</div>
                      )}
                    </div>
                  );
                } else {
                  // Tool is still loading/calling
                  return (
                    <div key={toolCallId} className="skeleton">
                      {toolName === "getWeather" ? (
                        <Weather />
                      ) : toolName === "displayFlightStatus" ? (
                        <FlightStatus />
                      ) : toolName === "searchFlights" ? (
                        <ListFlights chatId={chatId} />
                      ) : toolName === "selectSeats" ? (
                        <SelectSeats chatId={chatId} />
                      ) : toolName === "createReservation" ? (
                        <CreateReservation />
                      ) : toolName === "authorizePayment" ? (
                        <AuthorizePayment />
                      ) : toolName === "displayBoardingPass" ? (
                        <DisplayBoardingPass />
                      ) : toolName === "verifyPayment" ? (
                        <VerifyPayment />
                      ) : toolName === "listEvents" ? (
                        <CalendarEventsListSkeleton />
                      ) : toolName === "createEvent" || toolName === "updateEvent" ? (
                        <CalendarEventCardSkeleton />
                      ) : null}
                    </div>
                  );
                }
              }
              return null;
          }
        })}
      </div>
    </motion.div>
  );
};

function renderCalendarEventCard(
  output: any,
  heading: string,
  status: "created" | "updated",
) {
  if (!output) {
    return <CalendarEventCard event={null} heading={heading} statusIcon={status} />;
  }

  if (output?.error) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
        {output.error}
      </div>
    );
  }

  const event = (output?.event ?? output) as CalendarEvent | undefined;
  const attendees = Array.isArray(event?.attendees) ? event?.attendees : undefined;
  const subtitle =
    output?.success === false
      ? undefined
      : status === "created"
        ? "Created successfully"
        : "Latest event details";

  return (
    <CalendarEventCard
      event={event}
      heading={heading}
      subtitle={subtitle}
      statusIcon={status === "created" ? "created" : "updated"}
      footer={renderAttendees(attendees)}
    />
  );
}

function renderDeleteEvent(output: any) {
  if (!output) {
    return null;
  }

  if (output?.error) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
        {output.error}
      </div>
    );
  }

  if (output?.success) {
    return (
      <div className="rounded-xl border border-emerald-400/40 bg-emerald-500/10 p-4 text-sm text-emerald-500">
        Event deleted successfully.
      </div>
    );
  }

  return <div>{JSON.stringify(output, null, 2)}</div>;
}

function renderAttendees(attendees?: CalendarEvent["attendees"]) {
  if (!attendees || attendees.length === 0) {
    return undefined;
  }

  const summary = attendees
    .map((attendee) => attendee?.displayName || attendee?.email)
    .filter(Boolean)
    .join(", ");

  if (!summary) {
    return undefined;
  }

  return <span>Attendees: {summary}</span>;
}
