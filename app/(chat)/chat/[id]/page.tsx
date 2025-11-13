import { Chat as PreviewChat } from "@/components/custom/chat";

// No database - always start with empty chat
export default async function Page({ params }: { params: any }) {
  const { id } = params;
  return <PreviewChat id={id} initialMessages={[]} />;
}
