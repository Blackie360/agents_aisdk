"use client";

import { UIMessage } from "ai";
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
  const { messages, sendMessage, status, stop } =
    useChat({
      id,
      body: { id },
      initialMessages,
      onFinish: () => {
        window.history.replaceState({}, "", `/chat/${id}`);
      },
    });

  const isLoading = status === "streaming";

  const [messagesContainerRef, messagesEndRef] =
    useScrollToBottom<HTMLDivElement>();

  // In AI SDK v5, input state is managed locally
  const [input, setInput] = useState("");

  // In AI SDK v5, attachments are handled differently - using a simple array for now
  const [attachments, setAttachments] = useState<Array<{ url: string; name: string; contentType: string }>>([]);

  return (
    <div className="flex flex-row justify-center pb-4 md:pb-8 h-dvh bg-background">
      <div className="flex flex-col justify-between items-center gap-4">
        <div
          ref={messagesContainerRef}
          className="flex flex-col gap-4 h-full w-dvw items-center overflow-y-scroll"
        >
          {messages.length === 0 && <Overview />}

          {messages.map((message) => {
            // Extract content, attachments, and tool invocations from parts array (AI SDK v5)
            const textParts = message.parts.filter((part) => part.type === "text");
            const content = textParts.map((part) => (part as any).text).join("");
            const fileParts = message.parts.filter((part) => part.type === "file");
            const attachments = fileParts.map((part) => ({
              url: (part as any).url || "",
              name: (part as any).name || "",
              contentType: (part as any).contentType || "",
            }));
            const toolParts = message.parts.filter((part) => part.type === "tool");
            const toolInvocations = toolParts.map((part) => part as any);

            return (
              <PreviewMessage
                key={message.id}
                chatId={id}
                role={message.role}
                content={content}
                attachments={attachments.length > 0 ? attachments : undefined}
                toolInvocations={toolInvocations.length > 0 ? toolInvocations : undefined}
              />
            );
          })}

          <div
            ref={messagesEndRef}
            className="shrink-0 min-w-[24px] min-h-[24px]"
          />
        </div>

        <form className="flex flex-row gap-2 relative items-end w-full md:max-w-[500px] max-w-[calc(100dvw-32px) px-4 md:px-0">
          <MultimodalInput
            input={input}
            setInput={setInput}
            isLoading={isLoading}
            stop={stop}
            attachments={attachments}
            setAttachments={setAttachments}
            messages={messages}
            sendMessage={sendMessage}
          />
        </form>
      </div>
    </div>
  );
}
