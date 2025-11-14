import { Chat as PreviewChat } from "@/components/custom/chat";
import { getChatById } from "@/db/queries";
import { auth } from "@/app/(auth)/auth";
import { redirect } from "next/navigation";

export default async function Page({ params }: { params: any }) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const { id } = params;
  
  // Load chat to get workspaceId if it exists
  let workspaceId: string | undefined;
  try {
    const chat = await getChatById({ id });
    if (chat?.workspaceId) {
      workspaceId = chat.workspaceId;
    }
  } catch (error) {
    console.error("Failed to load chat:", error);
  }

  return <PreviewChat id={id} initialMessages={[]} initialWorkspaceId={workspaceId} />;
}
