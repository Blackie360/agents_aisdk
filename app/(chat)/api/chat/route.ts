import {
  convertToModelMessages,
  generateId,
  streamText,
  type UIMessage,
} from "ai";
import { z } from "zod";

import { geminiProModel } from "@/ai";
import { auth } from "@/app/(auth)/auth";
import {
  deleteChatById,
  getChatById,
  saveChat,
} from "@/db/queries";
import { googleCalendarTools } from "@/lib/tools/google-calendar";

export async function POST(request: Request) {
  const { id, messages }: { id: string; messages: Array<UIMessage> } =
    await request.json();

  const session = await auth();

  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  const modelMessages = convertToModelMessages(messages);

  const result = streamText({
    model: geminiProModel as any,
    system: `You are an AI Community Management Assistant designed to help community managers efficiently manage their communities.

Your primary responsibilities include:
- Scheduling and managing community events using Google Calendar
- Tracking community engagement metrics and analytics
- Planning and organizing content calendars
- Facilitating member onboarding and support
- Coordinating between team members and community stakeholders
- Managing community documentation and knowledge base

Key principles:
- Be proactive in suggesting best practices for community management
- Always confirm important actions (like calendar events) before executing
- Maintain a friendly, professional, and supportive tone
- Remember context from previous conversations using your memory system
- Use tools efficiently to help with calendar management, scheduling, and coordination
- Today's date is ${new Date().toLocaleDateString()}

IMPORTANT - Calendar Access:
- You have direct access to the user's Google Calendar through the available tools
- When users ask about their calendar, events, or schedule, IMMEDIATELY use the listEvents tool
- Use "primary" as the default calendarId unless the user specifies otherwise
- Don't ask for calendar IDs - just use "primary" by default
- If a user asks "show me my calendar" or "check my calendar" or "upcoming events", immediately call listEvents with calendarId: "primary"
- Be proactive: fetch calendar data first, then present it to the user

When scheduling events:
- Always ask for: title, date/time, duration, location (if applicable), description, and attendees
- Check for conflicts before creating events using checkAvailability tool
- Provide confirmation details after scheduling

For content planning:
- Help organize content calendars
- Suggest optimal posting times based on community activity
- Track engagement and provide insights

Be concise but thorough in your responses, and always ask clarifying questions when needed.`,
    messages: modelMessages,
    tools: {
      ...googleCalendarTools,
      getWeather: {
        description: "Get the current weather at a location",
        inputSchema: z.object({
          latitude: z.number().describe("Latitude coordinate"),
          longitude: z.number().describe("Longitude coordinate"),
        }),
        execute: async ({ latitude, longitude }) => {
          const response = await fetch(
            `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m&hourly=temperature_2m&daily=sunrise,sunset&timezone=auto`,
          );

          const weatherData = await response.json();
          return weatherData;
        },
      },
    },
  });

  return result.toUIMessageStreamResponse({
    originalMessages: messages,
    generateMessageId: () => generateId(),
    onFinish: async ({ messages: allMessages, responseMessage }) => {
      if (session.user && session.user.id) {
        try {
          await saveChat({
            id,
            messages: allMessages,
            userId: session.user.id,
          });
        } catch (error) {
          console.error("Failed to save chat:", error);
          // Don't throw - chat functionality should continue even if saving fails
        }
      }
    },
  });
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return new Response("Not Found", { status: 404 });
  }

  const session = await auth();

  if (!session || !session.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const chat = await getChatById({ id });

    if (chat.userId !== session.user.id) {
      return new Response("Unauthorized", { status: 401 });
    }

    await deleteChatById({ id });

    return new Response("Chat deleted", { status: 200 });
  } catch (error) {
    return new Response("An error occurred while processing your request", {
      status: 500,
    });
  }
}
