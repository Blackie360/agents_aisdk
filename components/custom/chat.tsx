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

function extractImageUrls(text: string): string[] {
  const urlRegex = /https?:\/\/[^\s<>"{}|\\^`\[\]]+\.(?:png|jpg|jpeg|gif|webp|svg)(?:\?[^\s<>"{}|\\^`\[\]]*)?/gi;
  const blobRegex = /https?:\/\/[^\s<>"{}|\\^`\[\]]*(?:blob\.vercel-storage\.com|vercelusercontent\.com)[^\s<>"{}|\\^`\[\]]*/gi;
  
  const imageMatches = text.match(urlRegex) || [];
  const blobMatches = text.match(blobRegex) || [];
  
  return [...imageMatches, ...blobMatches];
}

function removeImageUrls(text: string): string {
  let cleanText = text;
  const imageUrls = extractImageUrls(text);
  
  imageUrls.forEach(url => {
    cleanText = cleanText.replace(url, '');
  });
  
  return cleanText.replace(/\s+/g, ' ').trim();
}

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
      <Conversation className="flex-1 relative">
        <ConversationContent className="p-2 sm:p-4 md:p-6">
          {messages.length === 0 ? (
            <ConversationEmptyState
              icon={<MessageSquare className="size-10 sm:size-12 text-primary" />}
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

                const imageUrls = extractImageUrls(content);
                const textWithoutImages = removeImageUrls(content);

                return (
                  <Message key={message.id} from={message.role as "user" | "assistant"}>
                    <MessageContent>
                      {textWithoutImages && <Response>{textWithoutImages}</Response>}
                      {imageUrls.length > 0 && (
                        <div className="flex flex-col gap-3 mt-3">
                          {imageUrls.map((imageUrl, idx) => (
                            <div 
                              key={idx}
                              className="relative rounded-lg border overflow-hidden bg-card p-2 sm:p-3 shadow-sm"
                            >
                              <img
                                src={imageUrl}
                                alt="Generated image"
                                className="w-full h-auto rounded"
                                loading="lazy"
                                onError={(e) => {
                                  console.error('Image failed to load:', imageUrl);
                                  const target = e.target as HTMLImageElement;
                                  target.style.display = 'none';
                                  const parent = target.parentElement;
                                  if (parent) {
                                    const errorDiv = document.createElement('div');
                                    errorDiv.className = 'text-sm text-muted-foreground p-4 text-center';
                                    errorDiv.innerHTML = `<p>Image failed to load</p><a href="${imageUrl}" target="_blank" class="text-xs underline break-all">${imageUrl}</a>`;
                                    parent.appendChild(errorDiv);
                                  }
                                }}
                              />
                              <div className="absolute top-3 right-3 bg-primary/90 border rounded-full px-2 py-1 text-xs font-semibold text-primary-foreground shadow-sm">
                                Generated
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
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

      <div className="border-t p-2 sm:p-4 bg-background">
        <div className="max-w-full sm:max-w-2xl md:max-w-4xl mx-auto px-2 sm:px-0">
          {messages.length === 0 && <div className="mb-3 sm:mb-4"><Overview /></div>}
          {attachments.length > 0 && (
            <div className="flex gap-2 mb-2 overflow-x-auto pb-2">
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
