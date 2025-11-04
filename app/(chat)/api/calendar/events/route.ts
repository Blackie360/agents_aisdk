import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/app/(auth)/auth";
import { getCalendarConnectionStatus } from "@/db/queries";
import { googleCalendarTools } from "@/lib/tools/google-calendar";

const querySchema = z.object({
  maxResults: z
    .string()
    .transform((value) => Number.parseInt(value, 10))
    .refine((value) => Number.isFinite(value) && value > 0, {
      message: "maxResults must be a positive number",
    })
    .optional(),
  calendarId: z.string().optional(),
  timeMin: z.string().optional(),
});

export async function GET(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);

  const parseResult = querySchema.safeParse({
    maxResults: searchParams.get("maxResults") ?? undefined,
    calendarId: searchParams.get("calendarId") ?? undefined,
    timeMin: searchParams.get("timeMin") ?? undefined,
  });

  if (!parseResult.success) {
    return NextResponse.json(
      { error: "Invalid query parameters", details: parseResult.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const isConnected = await getCalendarConnectionStatus({
      userId: session.user.id,
    });

    if (!isConnected) {
      return NextResponse.json({
        error: "Calendar not connected",
        events: [],
      });
    }

    const { maxResults, calendarId, timeMin } = parseResult.data;
    const response = await googleCalendarTools.listEvents.execute({
      maxResults: maxResults ?? 50,
      calendarId: calendarId ?? "primary",
      timeMin: timeMin ?? new Date().toISOString(),
    });

    if ("error" in response) {
      return NextResponse.json(response, { status: 500 });
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error("Failed to fetch calendar events", error);
    return NextResponse.json(
      { error: "Failed to fetch calendar events" },
      { status: 500 },
    );
  }
}


