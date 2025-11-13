"use client";

// In AI SDK v5, attachments and tool invocations are part of UIMessage content
type Attachment = { url: string; name: string; contentType: string };
type ToolInvocation = any; // Tool invocations structure may vary
import { motion } from "framer-motion";
import { ReactNode } from "react";

import { BotIcon, UserIcon } from "./icons";
import { Markdown } from "./markdown";
import { PreviewAttachment } from "./preview-attachment";

export const Message = ({
  chatId,
  role,
  content,
  toolInvocations,
  attachments,
}: {
  chatId: string;
  role: string;
  content: string | ReactNode;
  toolInvocations: Array<ToolInvocation> | undefined;
  attachments?: Array<Attachment>;
}) => {
  return (
    <motion.div
      className={`flex flex-row gap-4 px-4 w-full md:w-[500px] md:px-0 first-of-type:pt-20`}
      initial={{ y: 5, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
    >
      <div className="size-[24px] border rounded-sm p-1 flex flex-col justify-center items-center shrink-0 text-zinc-500">
        {role === "assistant" ? <BotIcon /> : <UserIcon />}
      </div>

      <div className="flex flex-col gap-2 w-full">
        {content && typeof content === "string" && (
          <div className="text-zinc-800 dark:text-zinc-300 flex flex-col gap-4">
            <Markdown>{content}</Markdown>
          </div>
        )}


        {attachments && attachments.length > 0 && (
          <div className="flex flex-col gap-4">
            {attachments.map((attachment) => {
              // Display images larger for generated images
              if (attachment.contentType?.startsWith("image")) {
                return (
                  <div key={attachment.url} className="w-full">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={attachment.url}
                      alt={attachment.name ?? "Generated image"}
                      className="rounded-lg w-full max-w-2xl object-contain"
                    />
                  </div>
                );
              }
              return (
                <PreviewAttachment key={attachment.url} attachment={attachment} />
              );
            })}
          </div>
        )}
      </div>
    </motion.div>
  );
};
