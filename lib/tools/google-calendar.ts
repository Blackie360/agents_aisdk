import { google } from "googleapis";
import { z } from "zod";

import { auth } from "@/app/(auth)/auth";
import { getGoogleRefreshToken } from "@/db/queries";

const DEFAULT_CALENDAR_TIME_ZONE = "Africa/Nairobi";

function normalizeEventDateTime(
  block?: {
    dateTime?: string | null;
    date?: string | null;
    timeZone?: string | null;
  } | null,
) {
  if (!block) {
    return undefined;
  }

  const normalized = { ...block } as {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };

  if (!normalized.timeZone) {
    if (normalized.dateTime || normalized.date) {
      normalized.timeZone = DEFAULT_CALENDAR_TIME_ZONE;
    }
  }

  return normalized;
}

// Initialize Google Calendar API client
async function getCalendarClient() {
  const session = await auth();
  
  if (!session?.user?.id) {
    throw new Error("User not authenticated");
  }

  // Get user's stored refresh token from database
  const userToken = await getGoogleRefreshToken({
    userId: session.user.id,
  });

  if (!userToken) {
    throw new Error("Google Calendar not connected. Please connect your Google account.");
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || 
    (process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}/api/auth/callback/google`
      : process.env.NEXT_PUBLIC_APP_URL 
        ? `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback/google`
        : "http://localhost:3000/api/auth/callback/google");

  if (!clientId || !clientSecret) {
    throw new Error("Google Calendar API credentials not configured");
  }

  const oauth2Client = new google.auth.OAuth2(
    clientId,
    clientSecret,
    redirectUri
  );

  oauth2Client.setCredentials({
    refresh_token: userToken,
  });

  return google.calendar({ version: "v3", auth: oauth2Client });
}

const listEventsSchema = z.object({
  maxResults: z.number().optional().default(10).describe("Maximum number of events to return (default: 10)"),
  timeMin: z.string().optional().describe("Lower bound (exclusive) for an event's start time in RFC3339 format. If not provided, defaults to current time."),
  calendarId: z.string().optional().default("primary").describe("Calendar ID - use 'primary' for the user's main calendar (this is the default and should be used unless user specifies otherwise)"),
});

const createEventSchema = z.object({
  summary: z.string().describe("Event title/summary"),
  description: z.string().optional().describe("Event description"),
  start: z.object({
    dateTime: z.string().optional().describe("Start time in RFC3339 format (e.g., 2024-12-25T10:00:00-08:00)"),
    date: z.string().optional().describe("Start date in YYYY-MM-DD format for all-day events"),
    timeZone: z.string().optional().describe("Time zone (e.g., America/Los_Angeles)"),
  }),
  end: z.object({
    dateTime: z.string().optional().describe("End time in RFC3339 format"),
    date: z.string().optional().describe("End date in YYYY-MM-DD format for all-day events"),
    timeZone: z.string().optional().describe("Time zone"),
  }),
  location: z.string().optional().describe("Event location"),
  attendees: z.array(z.object({
    email: z.string().email(),
    displayName: z.string().optional(),
  })).optional().describe("List of attendees"),
  calendarId: z.string().optional().default("primary").describe("Calendar ID to create event in"),
});

const updateEventSchema = z.object({
  eventId: z.string().describe("ID of the event to update"),
  summary: z.string().optional().describe("New event title/summary"),
  description: z.string().optional().describe("New event description"),
  start: z.object({
    dateTime: z.string().optional(),
    date: z.string().optional(),
    timeZone: z.string().optional(),
  }).optional(),
  end: z.object({
    dateTime: z.string().optional(),
    date: z.string().optional(),
    timeZone: z.string().optional(),
  }).optional(),
  location: z.string().optional().describe("New event location"),
  attendees: z.array(z.object({
    email: z.string().email(),
    displayName: z.string().optional(),
  })).optional(),
  calendarId: z.string().optional().default("primary"),
});

const deleteEventSchema = z.object({
  eventId: z.string().describe("ID of the event to delete"),
  calendarId: z.string().optional().default("primary"),
});

const checkAvailabilitySchema = z.object({
  timeMin: z.string().describe("Start time in RFC3339 format"),
  timeMax: z.string().describe("End time in RFC3339 format"),
  calendarId: z.string().optional().default("primary"),
});

export const googleCalendarTools = {
  listEvents: {
    description: "List upcoming events from the user's Google Calendar. Use this tool immediately when users ask about their calendar, events, or schedule. Defaults to 'primary' calendar - use this unless user specifies a different calendar.",
    inputSchema: listEventsSchema,
    execute: async ({ maxResults = 10, timeMin, calendarId = "primary" }: z.infer<typeof listEventsSchema>) => {
      try {
        const calendar = await getCalendarClient();
        const response = await calendar.events.list({
          calendarId,
          timeMin: timeMin || new Date().toISOString(),
          maxResults,
          singleEvents: true,
          orderBy: "startTime",
        });

        const events = response.data.items || [];
        return {
          events: events.map((event) => ({
            id: event.id,
            summary: event.summary,
            description: event.description,
            start: event.start?.dateTime || event.start?.date,
            end: event.end?.dateTime || event.end?.date,
            location: event.location,
            attendees: event.attendees?.map((a) => ({
              email: a.email,
              displayName: a.displayName,
              responseStatus: a.responseStatus,
            })),
            status: event.status,
          })),
          count: events.length,
        };
      } catch (error: any) {
        return {
          error: error.message || "Failed to list calendar events",
        };
      }
    },
  },

  createEvent: {
    description: "Create a new event in Google Calendar",
    inputSchema: createEventSchema,
    execute: async (eventData: z.infer<typeof createEventSchema>) => {
      try {
        const calendar = await getCalendarClient();
        const response = await calendar.events.insert({
          calendarId: eventData.calendarId || "primary",
          requestBody: {
            summary: eventData.summary,
            description: eventData.description,
            start: normalizeEventDateTime(eventData.start) ?? undefined,
            end: normalizeEventDateTime(eventData.end) ?? undefined,
            location: eventData.location,
            attendees: eventData.attendees,
          },
        });

        return {
          success: true,
          event: {
            id: response.data.id,
            summary: response.data.summary,
            description: response.data.description,
            start: response.data.start?.dateTime || response.data.start?.date,
            end: response.data.end?.dateTime || response.data.end?.date,
            location: response.data.location,
            htmlLink: response.data.htmlLink,
            attendees: response.data.attendees?.map((a) => ({
              email: a.email,
              displayName: a.displayName,
              responseStatus: a.responseStatus,
            })),
          },
        };
      } catch (error: any) {
        return {
          error: error.message || "Failed to create calendar event",
        };
      }
    },
  },

  updateEvent: {
    description: "Update an existing event in Google Calendar",
    inputSchema: updateEventSchema,
    execute: async ({ eventId, calendarId = "primary", ...updates }: z.infer<typeof updateEventSchema>) => {
      try {
        const calendar = await getCalendarClient();
        
        // First, get the existing event
        const existingEvent = await calendar.events.get({
          calendarId,
          eventId,
        });

        // Merge updates with existing event
        const normalizedStart = normalizeEventDateTime(updates.start) ?? existingEvent.data.start;
        const normalizedEnd = normalizeEventDateTime(updates.end) ?? existingEvent.data.end;

        const response = await calendar.events.update({
          calendarId,
          eventId,
          requestBody: {
            ...existingEvent.data,
            ...updates,
            start: normalizedStart,
            end: normalizedEnd,
          },
        });

        return {
          success: true,
          event: {
            id: response.data.id,
            summary: response.data.summary,
            description: response.data.description,
            start: response.data.start?.dateTime || response.data.start?.date,
            end: response.data.end?.dateTime || response.data.end?.date,
            location: response.data.location,
            htmlLink: response.data.htmlLink,
          },
        };
      } catch (error: any) {
        return {
          error: error.message || "Failed to update calendar event",
        };
      }
    },
  },

  deleteEvent: {
    description: "Delete an event from Google Calendar",
    inputSchema: deleteEventSchema,
    execute: async ({ eventId, calendarId = "primary" }: z.infer<typeof deleteEventSchema>) => {
      try {
        const calendar = await getCalendarClient();
        await calendar.events.delete({
          calendarId,
          eventId,
        });

        return {
          success: true,
          message: "Event deleted successfully",
        };
      } catch (error: any) {
        return {
          error: error.message || "Failed to delete calendar event",
        };
      }
    },
  },

  checkAvailability: {
    description: "Check calendar availability for a given time range",
    inputSchema: checkAvailabilitySchema,
    execute: async ({ timeMin, timeMax, calendarId = "primary" }: z.infer<typeof checkAvailabilitySchema>) => {
      try {
        const calendar = await getCalendarClient();
        const response = await calendar.events.list({
          calendarId,
          timeMin,
          timeMax,
          singleEvents: true,
          orderBy: "startTime",
        });

        const events = response.data.items || [];
        const busySlots = events.map((event) => ({
          start: event.start?.dateTime || event.start?.date,
          end: event.end?.dateTime || event.end?.date,
          summary: event.summary,
        }));

        return {
          available: events.length === 0,
          busySlots,
          eventCount: events.length,
        };
      } catch (error: any) {
        return {
          error: error.message || "Failed to check calendar availability",
        };
      }
    },
  },
};

