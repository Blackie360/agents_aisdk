import { auth } from "@/app/(auth)/auth";
import { Chat } from "@/components/custom/chat";
import { getCalendarConnectionStatus } from "@/db/queries";
import { generateUUID } from "@/lib/utils";

export default async function Page() {
  const id = generateUUID();
  const session = await auth();

  const hasCalendarIntegration = session?.user?.id
    ? await getCalendarConnectionStatus({ userId: session.user.id })
    : false;

  return (
    <Chat
      key={id}
      id={id}
      initialMessages={[]}
      hasCalendarIntegration={hasCalendarIntegration}
      initialCalendarVisible={hasCalendarIntegration}
    />
  );
}
