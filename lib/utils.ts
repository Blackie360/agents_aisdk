import {
  CoreMessage,
  CoreToolMessage,
  generateId,
  UIMessage,
} from "ai";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// Database removed - Chat type no longer available
// import { Chat } from "@/db/schema";

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

    error.info = await res.json();
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

function addToolMessageToChat({
  toolMessage,
  messages,
}: {
  toolMessage: CoreToolMessage;
  messages: Array<UIMessage>;
}): Array<UIMessage> {
  return messages.map((message) => {
    const msg = message as any;
    if (msg.toolInvocations) {
      return {
        ...message,
        toolInvocations: msg.toolInvocations.map((toolInvocation: any) => {
          const toolResult = toolMessage.content.find(
            (tool: any) => tool.toolCallId === toolInvocation.toolCallId,
          );

          if (toolResult && (toolResult as any).result !== undefined) {
            return {
              ...toolInvocation,
              state: "result",
              result: (toolResult as any).result,
            };
          }

          return toolInvocation;
        }),
      } as UIMessage;
    }

    return message;
  });
}

export function convertToUIMessages(
  messages: Array<CoreMessage>,
): Array<UIMessage> {
  return messages.reduce((chatMessages: Array<UIMessage>, message) => {
    if (message.role === "tool") {
      return addToolMessageToChat({
        toolMessage: message as CoreToolMessage,
        messages: chatMessages,
      });
    }

    let textContent = "";
    let toolInvocations: Array<any> = []; // Tool invocations structure varies in v5

    if (typeof message.content === "string") {
      textContent = message.content;
    } else if (Array.isArray(message.content)) {
      for (const content of message.content) {
        if (content.type === "text") {
          textContent += content.text;
        } else if (content.type === "tool-call") {
          toolInvocations.push({
            state: "call",
            toolCallId: content.toolCallId,
            toolName: content.toolName,
            args: (content as any).args,
          });
        }
      }
    }

    chatMessages.push({
      id: generateId(),
      role: message.role,
      parts: [
        {
          type: "text",
          text: textContent,
        },
        ...toolInvocations.map((inv) => ({
          type: "tool-call" as const,
          toolCallId: inv.toolCallId,
          toolName: inv.toolName,
          args: inv.args,
        })),
      ],
    } as UIMessage);

    return chatMessages;
  }, []);
}

// Database removed - this function is no longer used
// export function getTitleFromChat(chat: Chat) {
//   const messages = convertToUIMessages(chat.messages as Array<CoreMessage>);
//   const firstMessage = messages[0];

//   if (!firstMessage) {
//     return "Untitled";
//   }

//   return firstMessage.content;
// }
