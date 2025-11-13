"use client";

import { UIMessage } from "ai";
import { useChat } from "@ai-sdk/react";
import { useState } from "react";
import { MessageSquare } from "lucide-react";

import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent } from "@/components/ai-elements/message";
import { Response } from "@/components/ai-elements/response";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputSubmit,
  PromptInputAttachment,
  PromptInputActionAddAttachments,
} from "@/components/ai-elements/prompt-input";
import { PreviewAttachment } from "./preview-attachment";
import { Overview } from "./overview";

export function Chat({
  id,
  initialMessages,
}: {
  id: string;
  initialMessages: Array<UIMessage>;
}) {
  const { messages, sendMessage, status, stop } = useChat({
    id,
    body: { id },
    initialMessages,
    onFinish: () => {
      window.history.replaceState({}, "", `/chat/${id}`);
    },
  });

  const isLoading = status === "streaming";
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<
    Array<{ url: string; name: string; contentType: string }>
  >([]);

  const handleSubmit = async (message: { text?: string; files?: Array<{ url: string; name: string; contentType: string }> }) => {
    if (input.trim() || attachments.length > 0) {
      await sendMessage({
        text: input,
        files: attachments.length > 0 ? attachments : undefined,
      });
      setInput("");
      setAttachments([]);
    }
  };

  return (
    <div className="flex flex-col h-dvh bg-background">
      <Conversation className="flex-1">
        <ConversationContent>
          {messages.length === 0 ? (
            <ConversationEmptyState
              icon={<MessageSquare className="size-12 text-muted-foreground" />}
              title="Start a conversation"
              description="Ask me anything or try one of the suggestions below"
            />
          ) : (
            messages.map((message) => {
                const textParts = message.parts.filter(
                  (part) => part.type === "text"
                );
                const content = textParts
                  .map((part) => (part as any).text)
                  .join("");
                const fileParts = message.parts.filter(
                  (part) => part.type === "file"
                );
                const messageAttachments = fileParts.map((part) => ({
                  url: (part as any).url || "",
                  name: (part as any).name || "",
                  contentType: (part as any).contentType || "",
                }));

                return (
                  <Message key={message.id} from={message.role as "user" | "assistant"}>
                    <MessageContent>
                      {content && <Response>{content}</Response>}
                      {messageAttachments.length > 0 && (
                        <div className="flex flex-col gap-2 mt-2">
                          {messageAttachments.map((attachment) => (
                            <PreviewAttachment
                              key={attachment.url}
                              attachment={attachment}
                            />
                          ))}
                        </div>
                      )}
                    </MessageContent>
                  </Message>
                );
              })
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div className="border-t p-4">
        <div className="max-w-4xl mx-auto">
          {messages.length === 0 && <Overview />}
          {attachments.length > 0 && (
            <div className="flex gap-2 mb-2">
              {attachments.map((attachment) => (
                <PromptInputAttachment key={attachment.url} data={attachment} />
              ))}
            </div>
          )}
          <PromptInput onSubmit={handleSubmit}>
            <div className="relative">
              <PromptInputTextarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Send a message..."
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    if (!isLoading && (input.trim() || attachments.length > 0)) {
                      handleSubmit({ text: input, files: attachments });
                    }
                  }
                }}
              />
              <div className="absolute bottom-2 right-2 flex gap-1">
                <PromptInputActionAddAttachments
                  onFileSelect={async (files) => {
                    const uploadedAttachments: Array<{
                      url: string;
                      name: string;
                      contentType: string;
                    }> = [];

                    for (const file of Array.from(files)) {
                      const formData = new FormData();
                      formData.append("file", file);
                      try {
                        const response = await fetch(`/api/files/upload`, {
                          method: "POST",
                          body: formData,
                        });
                        if (response.ok) {
                          const data = await response.json();
                          uploadedAttachments.push({
                            url: data.url,
                            name: data.pathname,
                            contentType: data.contentType,
                          });
                        }
                      } catch (error) {
                        console.error("Error uploading file:", error);
                      }
                    }
                    setAttachments((prev) => [...prev, ...uploadedAttachments]);
                  }}
                />
                <PromptInputSubmit
                  status={isLoading ? "streaming" : "ready"}
                  disabled={!input.trim() && attachments.length === 0}
                />
              </div>
            </div>
          </PromptInput>
        </div>
      </div>
    </div>
  );
}
