"use client";

import { type UIMessage, type FileUIPart, DefaultChatTransport } from "ai";
import { useChat } from "@ai-sdk/react";
import { useEffect, useMemo, useState } from "react";

import { CalendarPanel } from "@/components/custom/calendar-panel";
import { Message as PreviewMessage } from "@/components/custom/message";
import { useScrollToBottom } from "@/components/custom/use-scroll-to-bottom";

import { MultimodalInput } from "./multimodal-input";

export function Chat({
  id,
  initialMessages,
  hasCalendarIntegration = false,
  initialCalendarVisible,
}: {
  id: string;
  initialMessages: Array<UIMessage>;
  hasCalendarIntegration?: boolean;
  initialCalendarVisible?: boolean;
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

  const initialCalendarState = useMemo(
    () => Boolean(hasCalendarIntegration && (initialCalendarVisible ?? true)),
    [hasCalendarIntegration, initialCalendarVisible],
  );

  const [showCalendar, setShowCalendar] = useState(initialCalendarState);

  useEffect(() => {
    setShowCalendar(initialCalendarState);
  }, [initialCalendarState]);

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

  useEffect(() => {
    if (!hasCalendarIntegration) {
      return;
    }

    const latestUserMessage = [...messages].reverse().find((message) => message.role === "user");

    if (!latestUserMessage) {
      return;
    }

    const plainText = getMessagePlainText(latestUserMessage);

    if (!plainText) {
      return;
    }

    const normalized = plainText.toLowerCase();
    const triggers = [
      "show me my calendar",
      "show my calendar",
      "show calendar",
      "my upcoming events",
      "show me upcoming events",
    ];

    if (triggers.some((trigger) => normalized.includes(trigger))) {
      setShowCalendar(true);
    }
  }, [messages, hasCalendarIntegration]);

  const [messagesContainerRef, messagesEndRef] =
    useScrollToBottom<HTMLDivElement>();

  const [attachments, setAttachments] = useState<Array<FileUIPart>>([]);

  return (
    <div className="flex h-dvh flex-col bg-background md:flex-row">
      <div className="flex flex-1 flex-col items-center justify-between gap-4 pb-4 md:pb-8">
        <div
          ref={messagesContainerRef}
          className="flex h-full w-full flex-1 flex-col items-center gap-4 overflow-y-scroll px-4 md:px-0"
        >
          {messages.map((message) => (
            <PreviewMessage key={message.id} chatId={id} message={message} />
          ))}

          <div
            ref={messagesEndRef}
            className="min-h-[24px] min-w-[24px] shrink-0"
          />
        </div>

        <form className="relative flex w-full max-w-[min(720px,100%)] flex-row items-end gap-2 px-4 md:max-w-[520px] md:px-0">
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
            hasCalendarIntegration={hasCalendarIntegration}
            onToggleCalendar={() => setShowCalendar((prev) => !prev)}
            isCalendarVisible={showCalendar}
          />
        </form>
      </div>

      {hasCalendarIntegration && showCalendar ? (
        <aside className="w-full border-t border-border/40 p-4 md:flex md:max-w-[420px] md:border-l md:border-t-0 md:p-6">
          <CalendarPanel
            className="h-[420px] md:h-[calc(100dvh-48px)]"
            onClose={() => setShowCalendar(false)}
          />
        </aside>
      ) : null}
    </div>
  );
}

function getMessagePlainText(message: UIMessage): string {
  if (Array.isArray((message as any)?.parts)) {
    return (message as any).parts
      .filter((part: any) => part?.type === "text" && typeof part.text === "string")
      .map((part: any) => part.text as string)
      .join(" ")
      .trim();
  }

  if (typeof (message as any)?.content === "string") {
    return ((message as any).content as string).trim();
  }

  return "";
}
