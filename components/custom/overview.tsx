import { motion } from "framer-motion";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import { LogoGoogle, MessageIcon, VercelIcon } from "./icons";

export const Overview = () => {
  return (
    <motion.div
      key="overview"
      className="max-w-[500px] mx-auto"
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ delay: 0.5 }}
    >
      <Card>
        <CardHeader>
          <CardTitle className="flex flex-row justify-center gap-4 items-center">
            <VercelIcon />
            <span>+</span>
            <MessageIcon />
          </CardTitle>
          <CardDescription>
            Advanced AI agent powered by Google Gemini 2.5 models
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Built with Next.js and the AI SDK by Vercel. It supports multiple capabilities:
          </p>
          <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
            <li>
              <strong className="text-foreground">Image Generation:</strong> Create images using Google Imagen 3.0
            </li>
            <li>
              <strong className="text-foreground">Web Search:</strong> Get real-time information with Google Search grounding
            </li>
            <li>
              <strong className="text-foreground">URL Analysis:</strong> Analyze and summarize web content from URLs
            </li>
            <li>
              <strong className="text-foreground">Code Execution:</strong> Run Python code for calculations and problem-solving
            </li>
            <li>
              <strong className="text-foreground">File Processing:</strong> Understand PDFs, images, and YouTube videos
            </li>
            <li>
              <strong className="text-foreground">Advanced Reasoning:</strong> Complex thinking with Gemini 2.5 Flash
            </li>
          </ul>
          <p className="text-sm text-muted-foreground">
            Learn more about the AI SDK by visiting the{" "}
            <Link
              className="text-primary hover:underline"
              href="https://sdk.vercel.ai/docs"
              target="_blank"
            >
              Docs
            </Link>
            .
          </p>
        </CardContent>
      </Card>
    </motion.div>
  );
};
