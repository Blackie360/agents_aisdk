import { google } from "googleapis";
import { z } from "zod";
import { auth } from "@/app/(auth)/auth";

// Initialize Google Calendar API client
async function getCalendarClient() {
  const session = await auth();
  
  if (!session?.user) {
    throw new Error("User not authenticated");
  }

  // Get OAuth2 credentials from environment variables
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || "http://localhost:3000/api/auth/callback/google";

  if (!clientId || !clientSecret) {
    throw new Error("Google Calendar API credentials not configured");
  }

  const oauth2Client = new google.auth.OAuth2(
    clientId,
    clientSecret,
    redirectUri
  );

  // In a real implementation, you'd store and retrieve refresh tokens per user
  // For now, we'll use a shared refresh token from env
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
  if (refreshToken) {
    oauth2Client.setCredentials({
      refresh_token: refreshToken,
    });
  }

  return google.calendar({ version: "v3", auth: oauth2Client });
}

export const googleCalendarTools = {
  listEvents: {
    description: "List upcoming events from Google Calendar",
    inputSchema: z.object({
      maxResults: z.number().optional().default(10).describe("Maximum number of events to return"),
      timeMin: z.string().optional().describe("Lower bound (exclusive) for an event's start time in RFC3339 format"),
      calendarId: z.string().optional().default("primary").describe("Calendar ID to list events from"),
    }),
    execute: async ({ maxResults = 10, timeMin, calendarId = "primary" }) => {
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
    inputSchema: z.object({
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
    }),
    execute: async (eventData) => {
      try {
        const calendar = await getCalendarClient();
        const response = await calendar.events.insert({
          calendarId: eventData.calendarId || "primary",
          requestBody: {
            summary: eventData.summary,
            description: eventData.description,
            start: eventData.start,
            end: eventData.end,
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
    inputSchema: z.object({
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
    }),
    execute: async ({ eventId, calendarId = "primary", ...updates }) => {
      try {
        const calendar = await getCalendarClient();
        
        // First, get the existing event
        const existingEvent = await calendar.events.get({
          calendarId,
          eventId,
        });

        // Merge updates with existing event
        const response = await calendar.events.update({
          calendarId,
          eventId,
          requestBody: {
            ...existingEvent.data,
            ...updates,
            start: updates.start || existingEvent.data.start,
            end: updates.end || existingEvent.data.end,
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
    inputSchema: z.object({
      eventId: z.string().describe("ID of the event to delete"),
      calendarId: z.string().optional().default("primary"),
    }),
    execute: async ({ eventId, calendarId = "primary" }) => {
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
    inputSchema: z.object({
      timeMin: z.string().describe("Start time in RFC3339 format"),
      timeMax: z.string().describe("End time in RFC3339 format"),
      calendarId: z.string().optional().default("primary"),
    }),
    execute: async ({ timeMin, timeMax, calendarId = "primary" }) => {
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

