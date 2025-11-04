"use client";

import { type UIMessage, type FileUIPart, DefaultChatTransport } from "ai";
import { useChat } from "@ai-sdk/react";
import { useState } from "react";

import { Message as PreviewMessage } from "@/components/custom/message";
import { useScrollToBottom } from "@/components/custom/use-scroll-to-bottom";

import { MultimodalInput } from "./multimodal-input";
import { Overview } from "./overview";

export function Chat({
  id,
  initialMessages,
}: {
  id: string;
  initialMessages: Array<UIMessage>;
}) {
  const [input, setInput] = useState("");
  const { messages, sendMessage, status, stop } = useChat({
    id,
    transport: new DefaultChatTransport({
      api: "/api/chat",
      body: { id },
    }),
    messages: initialMessages,
    onFinish: () => {
      window.history.replaceState({}, "", `/chat/${id}`);
    },
  });

  const isLoading = status === "streaming" || status === "submitted";

  const handleSubmit = (e?: { preventDefault?: () => void }, options?: any) => {
    e?.preventDefault?.();
    if (input.trim()) {
      sendMessage(
        {
          text: input,
          files: attachments.length > 0 ? attachments : undefined,
        },
        {
          ...options,
          body: { id, ...options?.body },
        },
      );
      setInput("");
      setAttachments([]);
    }
  };

  const [messagesContainerRef, messagesEndRef] =
    useScrollToBottom<HTMLDivElement>();

  const [attachments, setAttachments] = useState<Array<FileUIPart>>([]);

  return (
    <div className="flex flex-row justify-center pb-4 md:pb-8 h-dvh bg-background">
      <div className="flex flex-col justify-between items-center gap-4">
        <div
          ref={messagesContainerRef}
          className="flex flex-col gap-4 h-full w-dvw items-center overflow-y-scroll"
        >
          {messages.length === 0 && <Overview />}

          {messages.map((message) => (
            <PreviewMessage key={message.id} chatId={id} message={message} />
          ))}

          <div
            ref={messagesEndRef}
            className="shrink-0 min-w-[24px] min-h-[24px]"
          />
        </div>

        <form className="flex flex-row gap-2 relative items-end w-full md:max-w-[500px] max-w-[calc(100dvw-32px) px-4 md:px-0">
          <MultimodalInput
            input={input}
            setInput={setInput}
            handleSubmit={handleSubmit}
            isLoading={isLoading}
            stop={stop}
            attachments={attachments}
            setAttachments={setAttachments}
            messages={messages}
            sendMessage={sendMessage as any}
          />
        </form>
      </div>
    </div>
  );
}
