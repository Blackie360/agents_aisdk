import { auth } from "@/app/(auth)/auth";
import {
  getCalendarConnectionStatus,
  getGoogleRefreshToken,
} from "@/db/queries";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [token, isCalendarConnected] = await Promise.all([
      getGoogleRefreshToken({
        userId: session.user.id,
      }),
      getCalendarConnectionStatus({
        userId: session.user.id,
      }),
    ]);

    return NextResponse.json({
      connected: !!token,
      isCalendarConnected,
    });
  } catch (error) {
    console.error("Failed to check Google Calendar status:", error);
    return NextResponse.json({ connected: false });
  }
}

