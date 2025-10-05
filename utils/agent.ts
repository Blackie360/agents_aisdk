import { generateText, stepCountIs, tool } from "ai";
import { google } from "@ai-sdk/google";
import z from "zod/v4";
import fs from "fs";
import path from "path";
import * as pdfParse from "pdf-parse";

export async function documentAgent(prompt: string) {
  const result = await generateText({
    model: google("gemini-2.0-flash"),
    prompt,
    system:
      "You are a Document Processing Agent. You MUST use tools to read actual file contents. You are FORBIDDEN from making assumptions about file contents based on filenames. When asked to analyze a file, you MUST first extract its text content using the extract_text_content tool, then analyze that content.",
    stopWhen: stepCountIs(15),
    tools: {
      change_directory: tool({
        description: "Change the current working directory to navigate to different folders.",
        inputSchema: z.object({
          path: z.string().describe("The directory path to change to (relative or absolute)"),
        }),
        execute: async ({ path }) => {
          try {
            const resolvedPath = path.startsWith('/') ? path : path;
            process.chdir(resolvedPath);
            const currentDir = process.cwd();
            return { 
              success: true, 
              path: resolvedPath, 
              currentDirectory: currentDir,
              message: `Successfully changed to directory: ${currentDir}`
            };
          } catch (error) {
            return { 
              success: false, 
              path, 
              error: error instanceof Error ? error.message : String(error) 
            };
          }
        },
      }),
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
            return { error: "Cannot list protected path", generatedPath };
          }
          const targetPath = generatedPath?.trim() ? generatedPath : ".";
          try {
            const output = fs.readdirSync(targetPath, { recursive: false });
            return { path: targetPath, output };
          } catch (e) {
            console.error(`Error listing files:`, e);
            return { error: e instanceof Error ? e.message : String(e) };
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
            const output = fs.readFileSync(path, "utf-8");
            return { path, output };
          } catch (error) {
            console.error(`Error reading file at ${path}:`, error instanceof Error ? error.message : String(error));
            return { path, error: error instanceof Error ? error.message : String(error) };
          }
        },
      }),
      detect_document_type: tool({
        description: "Detect the type of a document based on its extension and content.",
        inputSchema: z.object({
          filePath: z.string().describe("The path to the document file"),
        }),
        execute: async ({ filePath }) => {
          try {
            if (filePath === ".git" || filePath === "node_modules") {
              return { error: "Cannot analyze protected path", filePath };
            }
            const stats = fs.statSync(filePath);
            const ext = path.extname(filePath).toLowerCase();
            const typeMap: Record<string, string> = {
              ".txt": "txt",
              ".md": "markdown",
              ".json": "json",
              ".csv": "csv",
              ".html": "html",
              ".htm": "html",
              ".pdf": "pdf",
            };
            const detectedType = typeMap[ext] || "unknown";
            return {
              filePath,
              type: detectedType,
              extension: ext,
              sizeBytes: stats.size,
              lastModified: stats.mtime,
            };
          } catch (e) {
            return { error: e instanceof Error ? e.message : String(e), filePath };
          }
        },
      }),
      extract_text_content: tool({
        description: "Extract readable text content from supported formats: txt, md, json, csv, html, pdf.",
        inputSchema: z.object({
          filePath: z.string().describe("The path to the document file"),
        }),
        execute: async ({ filePath }) => {
          if (filePath === ".git" || filePath === "node_modules") {
            return { error: "Cannot read protected path", filePath };
          }
          try {
            const ext = path.extname(filePath).toLowerCase();
            let text = "";
            let metadata: Record<string, any> = {};

            // Handle PDF separately (binary format)
            if (ext === ".pdf") {
              try {
                const dataBuffer = fs.readFileSync(filePath);
                const pdfResult = await pdfParse.pdf(dataBuffer);
                text = pdfResult.text;
                metadata = { isPdf: true };
              } catch (pdfErr) {
                return { error: `PDF parse error: ${pdfErr instanceof Error ? pdfErr.message : String(pdfErr)}`, filePath };
              }
            } else {
              // Handle text-based formats
              const raw = fs.readFileSync(filePath, "utf-8");
              text = raw;
              
              switch (ext) {
                case ".json": {
                  try {
                    const parsed = JSON.parse(raw);
                    text = JSON.stringify(parsed, null, 2);
                  } catch {}
                  break;
                }
                case ".csv": {
                  const lines = raw.split(/\r?\n/);
                  text = `CSV rows: ${lines.length}\n\n${raw}`;
                  break;
                }
                case ".html":
                case ".htm": {
                  text = raw
                    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gsi, "")
                    .replace(/<[^>]*>/g, " ")
                    .replace(/\s+/g, " ")
                    .trim();
                  break;
                }
              }
            }
            
            return { 
              filePath, 
              extractedText: text, 
              wordCount: text.split(/\s+/).filter(Boolean).length,
              metadata 
            };
          } catch (e) {
            return { error: e instanceof Error ? e.message : String(e), filePath };
          }
        },
      }),
      analyze_document: tool({
        description: "Analyze document content: summary, entities, topics.",
        inputSchema: z.object({
          content: z.string().describe("Content to analyze"),
          analyzeType: z
            .enum(["full", "summary_only", "entities_only", "topics_only"])
            .default("full"),
        }),
        execute: async ({ content, analyzeType }) => {
          try {
            const fragments = content.split(/[.!?]+/).filter((s) => s.trim().length > 10);
            const words = content.toLowerCase().replace(/[^\w\s]/g, "").split(/\s+/).filter(Boolean);
            const obj: Record<string, any> = { wordCount: words.length };
            
            if (analyzeType === "full" || analyzeType === "summary_only") {
              const summaryFragments = [
                fragments[0],
                fragments[Math.floor(fragments.length / 2)],
                fragments[fragments.length - 1],
              ].filter(Boolean);
              obj.summary = summaryFragments.map((s) => s.trim()).join(". ") + ".";
            }
            
            if (analyzeType === "full" || analyzeType === "entities_only") {
              const caps = content.match(/\b[A-Z][a-z]+\b/g) || [];
              const emails = content.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
              const phones = content.match(/[\+]?[1-9]?[0-9]{10,11}/g) || [];
              const urls = content.match(/https?:\/\/[^\s]+/g) || [];
              obj.entities = [...new Set([...caps.slice(0, 20), ...emails, ...phones, ...urls])];
            }
            
            if (analyzeType === "full" || analyzeType === "topics_only") {
              const freq: Record<string, number> = {};
              const stopWords = new Set([
                "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for", "of", "with", "by",
                "is", "are", "was", "were", "be", "been", "have", "has", "had", "do", "does", "did", "will",
                "would", "could", "should",
              ]);
              words.forEach((w) => {
                if (w.length > 3 && !stopWords.has(w)) {
                  freq[w] = (freq[w] || 0) + 1;
                }
              });
              obj.topics = Object.entries(freq)
                .sort(([,a], [,b]) => b - a)
                .slice(0, 10)
                .map(([word]) => word);
            }
            return { analysisData: obj };
          } catch (e) {
            return { error: e instanceof Error ? e.message : String(e) };
          }
        },
      }),
      search_document: tool({
        description: "Search for terms within document content.",
        inputSchema: z.object({
          content: z.string().describe("Document content to search"),
          query: z.string().describe("Search term"),
          contextLength: z.number().min(20).max(400).default(50),
        }),
        execute: async ({ content, query, contextLength }) => {
          try {
            const re = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
            const matches: Array<{ text: string; position: number }> = [];
            let m;
            while ((m = re.exec(content)) !== null) {
              const start = Math.max(0, m.index - contextLength);
              const end = Math.min(content.length, m.index + m[0].length + contextLength);
              const text = content.slice(start, end).trim();
              matches.push({ text, position: m.index });
            }
            return { query, matches, totalMatches: matches.length };
          } catch (e) {
            return { error: e instanceof Error ? e.message : String(e) };
          }
        },
      }),
      save_analysis: tool({
        description: "Save analysis output to a structured JSON file.",
        inputSchema: z.object({
          analysisData: z
            .object({
              filename: z.string(),
              summary: z.string(),
              keyPoints: z.array(z.string()).optional(),
              entities: z.array(z.string()).optional(),
              topics: z.array(z.string()).optional(),
              wordCount: z.number(),
              sourceFile: z.string(),
            })
            .describe("Analysis data to save"),
          outputPath: z.string().describe("Where to save the JSON file"),
        }),
        execute: async ({ analysisData, outputPath }) => {
          try {
            const payload = { ...analysisData, generatedAt: new Date().toISOString() };
            fs.writeFileSync(outputPath, JSON.stringify(payload, null, 2));
            return { success: true, savedPath: outputPath };
          } catch (e) {
            return { error: e instanceof Error ? e.message : String(e) };
          }
        },
      }),
    },
  });
  return { 
    response: result.text, 
    toolCalls: result.toolCalls,
    toolResults: result.toolResults,
    usage: result.usage 
  };
}
