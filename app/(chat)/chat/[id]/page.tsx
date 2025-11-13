import { Chat as PreviewChat } from "@/components/custom/chat";

export default async function Page({ params }: { params: any }) {
  const { id } = params;
  return <PreviewChat id={id} initialMessages={[]} />;
}
