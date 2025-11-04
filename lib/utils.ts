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
    const messages = convertToUIMessages((chat.messages as unknown) as Array<ModelMessage>);
    
    // Try both user and assistant messages to find a title
    for (const message of messages) {
      if (!message || !message.parts || message.parts.length === 0) {
        continue;
      }

      // Try to find text content
      for (const part of message.parts) {
        if (part.type === "text" && "text" in part && typeof part.text === "string") {
          const text = part.text.trim();
          if (text.length > 0) {
            // Truncate to first 50 characters for display
            return text.length > 50 ? `${text.slice(0, 50)}...` : text;
          }
        }
      }

      // If no text part, check for tool parts
      for (const part of message.parts) {
        if (part.type?.startsWith("tool-")) {
          const toolName = part.type.replace("tool-", "") || "tool";
          return `Tool: ${toolName}`;
        }
      }
    }
  } catch (error) {
    console.error("Error generating chat title:", error);
  }

  // Fallback: use date-based title
  if (chat.createdAt) {
    const date = new Date(chat.createdAt);
    return `Chat ${date.toLocaleDateString()}`;
  }

  return "Untitled";
}
