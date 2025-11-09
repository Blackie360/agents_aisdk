import {
  generateId,
  type ModelMessage,
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
      const toolMessage = message as ModelMessage & { role: "tool" };
      if (Array.isArray(toolMessage.content)) {
        for (const content of toolMessage.content) {
          if (content.type === "tool-result") {
            pendingToolResults.set(content.toolCallId, (content as any).result || (content as any).output);
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
            input: content.input,
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
  try {
    // Extract directly from raw messages stored in database for better reliability
    const rawMessages = (chat.messages as unknown) as Array<ModelMessage>;
    
    if (!rawMessages || rawMessages.length === 0) {
      // Fallback to date if no messages
      if (chat.createdAt) {
        const date = new Date(chat.createdAt);
        return `Chat ${date.toLocaleDateString()}`;
      }
      return "Untitled";
    }

    // Prioritize the first message (usually user's input)
    const firstMessage = rawMessages[0];
    
    if (firstMessage) {
      // Extract text content directly from message content
      if (typeof firstMessage.content === "string") {
        const text = firstMessage.content.trim();
        if (text.length > 0) {
          return text.length > 50 ? `${text.slice(0, 50)}...` : text;
        }
      } else if (Array.isArray(firstMessage.content)) {
        // Look for text content in array format
        for (const content of firstMessage.content) {
          if (content.type === "text" && typeof content.text === "string") {
            const text = content.text.trim();
            if (text.length > 0) {
              return text.length > 50 ? `${text.slice(0, 50)}...` : text;
            }
          }
        }
      }
    }

    // If first message has no text, try second message (assistant response)
    if (rawMessages.length > 1) {
      const secondMessage = rawMessages[1];
      if (secondMessage) {
        if (typeof secondMessage.content === "string") {
          const text = secondMessage.content.trim();
          if (text.length > 0) {
            return text.length > 50 ? `${text.slice(0, 50)}...` : text;
          }
        } else if (Array.isArray(secondMessage.content)) {
          for (const content of secondMessage.content) {
            if (content.type === "text" && typeof content.text === "string") {
              const text = content.text.trim();
              if (text.length > 0) {
                return text.length > 50 ? `${text.slice(0, 50)}...` : text;
              }
            }
          }
        }
      }
    }

    // Fallback: use date-based title only if no messages have text content
    if (chat.createdAt) {
      const date = new Date(chat.createdAt);
      return `Chat ${date.toLocaleDateString()}`;
    }
  } catch (error) {
    console.error("Error generating chat title:", error);
    // If error occurs, try date fallback
    if (chat.createdAt) {
      const date = new Date(chat.createdAt);
      return `Chat ${date.toLocaleDateString()}`;
    }
  }

  return "Untitled";
}
