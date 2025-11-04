import {
  generateId,
  type ModelMessage,
  type ModelToolMessage,
  type UIMessage,
} from "ai";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

import { Chat } from "@/db/schema";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface ApplicationError extends Error {
  info: string;
  status: number;
}

export const fetcher = async (url: string) => {
  const res = await fetch(url);

  if (!res.ok) {
    const error = new Error(
      "An error occurred while fetching the data.",
    ) as ApplicationError;

    try {
      error.info = await res.json();
    } catch {
      error.info = await res.text();
    }
    error.status = res.status;

    throw error;
  }

  return res.json();
};

export function getLocalStorage(key: string) {
  if (typeof window !== "undefined") {
    return JSON.parse(localStorage.getItem(key) || "[]");
  }
  return [];
}

export function generateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Convert ModelMessage (from database) to UIMessage (for UI)
export function convertToUIMessages(
  messages: Array<ModelMessage>,
): Array<UIMessage> {
  const uiMessages: Array<UIMessage> = [];
  let pendingToolResults: Map<string, any> = new Map();

  for (const message of messages) {
    if (message.role === "tool") {
      // Store tool results for the next assistant message
      const toolMessage = message as ModelToolMessage;
      if (Array.isArray(toolMessage.content)) {
        for (const content of toolMessage.content) {
          if (content.type === "tool-result") {
            pendingToolResults.set(content.toolCallId, content.result);
          }
        }
      }
      continue; // Skip tool messages in UI
    }

    const parts: UIMessage["parts"] = [];

    // Extract text content
    if (typeof message.content === "string") {
      if (message.content.length > 0) {
        parts.push({ type: "text", text: message.content });
      }
    } else if (Array.isArray(message.content)) {
      for (const content of message.content) {
        if (content.type === "text") {
          parts.push({ type: "text", text: content.text });
        } else if (content.type === "tool-call") {
          // Convert tool-call to tool UI part
          const toolResult = pendingToolResults.get(content.toolCallId);
          parts.push({
            type: `tool-${content.toolName}`,
            toolCallId: content.toolCallId,
            input: content.args,
            output: toolResult,
            state:
              toolResult !== undefined ? "output-available" : "input-available",
          });
          pendingToolResults.delete(content.toolCallId);
        }
      }
    }

    uiMessages.push({
      id: generateId(),
      role: message.role,
      parts: parts.length > 0 ? parts : [{ type: "text", text: "" }],
    });
  }

  return uiMessages;
}

export function getTitleFromChat(chat: Chat) {
  const messages = convertToUIMessages(chat.messages as Array<ModelMessage>);
  const firstMessage = messages[0];

  if (!firstMessage || firstMessage.parts.length === 0) {
    return "Untitled";
  }

  const firstTextPart = firstMessage.parts.find((part) => part.type === "text");
  return firstTextPart && "text" in firstTextPart
    ? firstTextPart.text
    : "Untitled";
}
