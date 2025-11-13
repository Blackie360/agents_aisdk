import { motion } from "framer-motion";
import Link from "next/link";

import { LogoGoogle, MessageIcon, VercelIcon } from "./icons";

export const Overview = () => {
  return (
    <motion.div
      key="overview"
      className="max-w-[500px] mt-20 mx-4 md:mx-0"
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ delay: 0.5 }}
    >
      <div className="border-none bg-muted/50 rounded-2xl p-6 flex flex-col gap-4 text-zinc-500 text-sm dark:text-zinc-400 dark:border-zinc-700">
        <p className="flex flex-row justify-center gap-4 items-center text-zinc-900 dark:text-zinc-50">
          <VercelIcon />
          <span>+</span>
          <MessageIcon />
        </p>
        <p>
          This is an advanced AI agent powered by Google Gemini 2.5 models built
          with Next.js and the AI SDK by Vercel. It supports multiple capabilities:
        </p>
        <ul className="list-disc list-inside space-y-1 text-sm">
          <li>
            <strong>Image Generation:</strong> Create images using Google Imagen 3.0
          </li>
          <li>
            <strong>Web Search:</strong> Get real-time information with Google Search
            grounding
          </li>
          <li>
            <strong>URL Analysis:</strong> Analyze and summarize web content from URLs
          </li>
          <li>
            <strong>Code Execution:</strong> Run Python code for calculations and
            problem-solving
          </li>
          <li>
            <strong>File Processing:</strong> Understand PDFs, images, and YouTube
            videos
          </li>
          <li>
            <strong>Advanced Reasoning:</strong> Complex thinking with Gemini 2.5 Flash
          </li>
        </ul>
        <p>
          {" "}
          You can learn more about the AI SDK by visiting the{" "}
          <Link
            className="text-blue-500 dark:text-blue-400"
            href="https://sdk.vercel.ai/docs"
            target="_blank"
          >
            Docs
          </Link>
          .
        </p>
      </div>
    </motion.div>
  );
};
