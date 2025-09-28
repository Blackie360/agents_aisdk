import { generateText, stepCountIs, tool } from "ai";
import z from "zod/v4";
import fs from "fs";

export async function codingAgent(prompt: string) {
  const result = await generateText({
    model: "openai/gpt-4.1-mini",
    prompt,
    system:
      "You are a coding agent. You will be working with js/ts projects. Your responses must be concise.",
    stopWhen: stepCountIs(10),
    tools: {
      list_files: tool({
        description:
          "List files and directories at a given path. If no path is provided, lists files in the current directory.",
        inputSchema: z.object({
          path: z
            .string()
            .nullable()
            .describe(
              "Optional relative path to list files from. Defaults to current directory if not provided.",
            ),
        }),
        execute: async ({ path: generatedPath }) => {
          if (generatedPath === ".git" || generatedPath === "node_modules") {
            return { error: "You cannot read the path: ", generatedPath };
          }
          const path = generatedPath?.trim() ? generatedPath : ".";
          try {
            console.log(`Listing files at '${path}'`);
            const output = fs.readdirSync(path, {
              recursive: false,
            });
            return { path, output };
          } catch (e) {
            console.error(`Error listing files:`, e);
            return { error: e };
          }
        },
      }),
      read_file: tool({ 
        description:
          "Read the contents of a given relative file path. Use this when you want to see what's inside a file. Do not use this with directory names.", 
          inputSchema: z.object({ 
            path: z 
              .string() 
              .describe("The relative path of a file in the working directory."), 
          }), 
          execute: async ({ path }) => { 
            try { 
              console.log(`Reading file at '${path}'`); 
              const output = fs.readFileSync(path, "utf-8"); 
              return { path, output }; 
            } catch (error) { 
              console.error(`Error reading file at ${path}:`, error.message); 
              return { path, error: error.message }; 
            } 
          }, 
      }), 
    },
  });

  return {
    response: result.text,
  };
}