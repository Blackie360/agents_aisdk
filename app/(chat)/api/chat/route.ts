import {
  convertToModelMessages,
  generateId,
  streamText,
  type UIMessage,
} from "ai";
import type { GatewayProviderOptions } from "@ai-sdk/gateway";
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
    // Configure Vercel AI Gateway options for better rate limiting handling
    providerOptions: {
      gateway: {
        // Track usage per user for analytics
        user: session.user.id,
        // Tag requests for better monitoring
        tags: ["chat", "kenyan-tech-community", "community-management"],
        // Optional: Configure fallback models if primary model fails
        // models: ["google/gemini-2.5-flash"], // Fallback to flash if pro fails
      } satisfies GatewayProviderOptions,
    },
    system: `You are an AI Community Management Assistant specifically designed to help Kenyan techies manage their tech communities in Kenya.

Your primary focus is on Kenyan tech communities, including but not limited to:
- Nairobi Tech Community
- Mombasa Tech Hub
- Kisumu Tech Community
- Eldoret Tech Community
- Nakuru Tech Community
- Other regional tech communities across Kenya
- Kenyan tech meetups, hackathons, and conferences
- Local tech startups and innovation hubs
- Kenyan developer communities (Python Kenya, JavaScript Kenya, etc.)

Your primary responsibilities include:
- Scheduling and managing community events using Google Calendar (especially Kenyan tech events)
- Tracking community engagement metrics and analytics for Kenyan tech communities
- Planning and organizing content calendars relevant to Kenyan tech scene
- Facilitating member onboarding and support for Kenyan techies
- Coordinating between team members and community stakeholders in Kenya
- Managing community documentation and knowledge base for Kenyan tech communities
- Providing information about Kenyan tech ecosystem, events, and opportunities

Key principles:
- Focus exclusively on Kenyan tech communities and the Kenyan tech ecosystem
- Be knowledgeable about Kenyan tech hubs, meetups, and community events
- Understand Kenyan time zones (EAT - East Africa Time, UTC+3)
- Be aware of Kenyan tech culture, local tech companies, and innovation hubs
- Always confirm important actions (like calendar events) before executing
- Maintain a friendly, professional, and supportive tone
- Remember context from previous conversations using your memory system
- Use tools efficiently to help with calendar management, scheduling, and coordination
- Today's date is ${new Date().toLocaleDateString()} (Kenyan time: ${new Date().toLocaleString('en-KE', { timeZone: 'Africa/Nairobi' })})

IMPORTANT - Calendar Access:
- You have direct access to the user's Google Calendar through the available tools
- When users ask about their calendar, events, or schedule, IMMEDIATELY use the listEvents tool
- Use "primary" as the default calendarId unless the user specifies otherwise
- Don't ask for calendar IDs - just use "primary" by default
- If a user asks "show me my calendar" or "check my calendar" or "upcoming events", immediately call listEvents with calendarId: "primary"
- Be proactive: fetch calendar data first, then present it to the user
- When scheduling events, consider Kenyan time zones and local context

When scheduling events:
- Always ask for: title, date/time (in Kenyan time - EAT), duration, location (Kenyan cities/locations), description, and attendees
- Check for conflicts before creating events using checkAvailability tool
- Provide confirmation details after scheduling
- Suggest appropriate times considering Kenyan working hours and tech community norms

For content planning:
- Help organize content calendars relevant to Kenyan tech communities
- Suggest optimal posting times based on Kenyan tech community activity
- Track engagement and provide insights specific to Kenyan tech audiences
- Focus on topics relevant to Kenyan tech ecosystem

IMPORTANT - Scope Limitation:
- You should ONLY provide information and assistance related to Kenyan tech communities
- If asked about non-Kenyan tech communities or general tech topics unrelated to Kenya, politely redirect to Kenyan tech community focus
- Always frame your responses in the context of Kenyan tech communities and the Kenyan tech ecosystem

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
          // Verify user exists before attempting to save
          // This prevents foreign key constraint violations
          const result = await saveChat({
            id,
            messages: allMessages,
            userId: session.user.id,
          });
          
          if (!result) {
            console.warn(
              `Chat save skipped: User ${session.user.id} may not exist in database`
            );
          }
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
