import { type ModelMessage } from "ai";
import { notFound } from "next/navigation";

import { auth } from "@/app/(auth)/auth";
import { Chat as PreviewChat } from "@/components/custom/chat";
import { getCalendarConnectionStatus, getChatById } from "@/db/queries";
import { Chat } from "@/db/schema";
import { convertToUIMessages } from "@/lib/utils";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const chatFromDb = await getChatById({ id });

  if (!chatFromDb) {
    notFound();
  }

  // type casting and converting messages to UI messages
  const chat: Chat = {
    ...chatFromDb,
    messages: convertToUIMessages(chatFromDb.messages as Array<ModelMessage>),
  };

  const session = await auth();

  if (!session || !session.user) {
    return notFound();
  }

  if (session.user.id !== chat.userId) {
    return notFound();
  }

  const hasCalendarIntegration = await getCalendarConnectionStatus({
    userId: session.user.id,
  });

  return (
    <PreviewChat
      id={chat.id}
      initialMessages={chat.messages}
      hasCalendarIntegration={hasCalendarIntegration}
      initialCalendarVisible={hasCalendarIntegration}
    />
  );
}
