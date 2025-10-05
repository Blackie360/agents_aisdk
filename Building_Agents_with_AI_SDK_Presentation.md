# Building Agents with AI SDK
## A Comprehensive Guide to Creating Intelligent AI Agents

---

## Table of Contents
1. [Introduction to AI Agents](#introduction-to-ai-agents)
2. [What is the AI SDK?](#what-is-the-ai-sdk)
3. [Core Concepts](#core-concepts)
4. [Setting Up Your Environment](#setting-up-your-environment)
5. [Basic Agent Implementation](#basic-agent-implementation)
6. [Working with Tools](#working-with-tools)
7. [Agent Loop Control](#agent-loop-control)
8. [AI SDK v5 New Features](#ai-sdk-v5-new-features)
9. [Advanced Patterns](#advanced-patterns)
10. [Real-World Examples](#real-world-examples)
11. [Best Practices](#best-practices)
12. [Next Steps](#next-steps)

---

## Introduction to AI Agents

### What are AI Agents?

AI agents are autonomous systems that can:
- **Perceive** their environment through inputs
- **Reason** about tasks and make decisions
- **Act** by calling tools and APIs
- **Learn** from interactions and feedback

### Why Build Agents?

- **Automation**: Handle complex, multi-step tasks
- **Integration**: Connect different systems and APIs
- **Intelligence**: Make decisions based on context
- **Scalability**: Process multiple requests simultaneously

---

## What is the AI SDK?

### Overview

The **Vercel AI SDK** is a TypeScript toolkit designed to help developers build AI-powered applications and agents across various frameworks.

### Key Features

- **Unified Provider APIs**: Works with multiple AI providers
- **Streaming Support**: Real-time response streaming with UI updates
- **Tool Integration**: Easy tool calling with advanced UI integration
- **Framework Agnostic**: Works with React, Next.js, Vue, Svelte, Node.js
- **Type Safety**: Full TypeScript support with inference
- **React Server Components**: Native RSC integration for server-side AI
- **Generative UI**: Dynamic UI components from AI responses
- **Computer Tools**: Real-time computer interaction capabilities

### Supported Providers

- OpenAI (GPT-4o, GPT-4, GPT-3.5)
- Anthropic (Claude Sonnet 4, Claude 3.5)
- Google (Gemini 1.5 Pro, Gemini 1.5 Flash)
- Cohere
- And many more...

---

## Core Concepts

### 1. Models
AI models that power the agent's reasoning capabilities.

```typescript
import { openai } from '@ai-sdk/openai';

const model = openai('gpt-4o');
```

### 2. Tools
Functions that agents can call to interact with external systems.

```typescript
import { tool } from 'ai';
import { z } from 'zod';

const weatherTool = tool({
  description: 'Get the weather in a location',
  parameters: z.object({
    location: z.string().describe('The location to get weather for'),
  }),
  execute: async ({ location }) => {
    // API call to weather service
    return { temperature: 72, condition: 'sunny' };
  },
});
```

### 3. Agents
The main orchestrator that combines models and tools.

```typescript
import { Experimental_Agent as Agent } from 'ai';

const agent = new Agent({
  model: 'openai/gpt-4o',
  system: 'You are a helpful assistant.',
  tools: {
    weather: weatherTool,
  },
});
```

---

## Setting Up Your Environment

### Installation

```bash
# Install core AI SDK (latest v5)
pnpm add ai@latest

# Install provider-specific packages
pnpm add @ai-sdk/openai @ai-sdk/anthropic @ai-sdk/google

# Install UI packages for React
pnpm add @ai-sdk/react @ai-sdk/rsc

# Install utility packages
pnpm add zod

# Install development dependencies
pnpm add -D tsx @types/node
```

### Environment Variables

```bash
# .env
OPENAI_API_KEY=your_openai_api_key_here
ANTHROPIC_API_KEY=your_anthropic_api_key_here
```

### Basic Project Structure

```
my-agent-project/
├── src/
│   ├── agents/
│   │   └── weather-agent.ts
│   ├── tools/
│   │   └── weather-tool.ts
│   └── index.ts
├── .env
├── package.json
└── tsconfig.json
```

---

## Basic Agent Implementation

### Simple Text Generation

```typescript
import { generateText } from 'ai';

const result = await generateText({
  model: 'openai/gpt-4o',
  prompt: 'Classify this sentiment: "I love this product!"',
});

console.log(result.text); // "positive"
```

### Creating Your First Agent

```typescript
import { generateText, stepCountIs } from "ai";
import { google } from "@ai-sdk/google";

export async function documentAgent(prompt: string) {
  const result = await generateText({
    model: google("gemini-2.0-flash"),
    prompt,
    system:
      "You are a Document Processing Agent. You MUST use tools to read actual file contents. You are FORBIDDEN from making assumptions about file contents based on filenames. When asked to analyze a file, you MUST first extract its text content using the extract_text_content tool, then analyze that content.",
    stopWhen: stepCountIs(15),
  });

  return { 
    response: result.text, 
    toolCalls: result.toolCalls,
    toolResults: result.toolResults,
    usage: result.usage 
  };
}

// Usage example
const result = await documentAgent("List all files in the current directory");
console.log(result.response);
```

### Agent with System Prompt

```typescript
export async function documentAgent(prompt: string) {
  const result = await generateText({
    model: google("gemini-2.0-flash"),
    prompt,
    system: `You are a Document Processing Agent. You MUST use tools to read actual file contents. You are FORBIDDEN from making assumptions about file contents based on filenames. When asked to analyze a file, you MUST first extract its text content using the extract_text_content tool, then analyze that.content.

  Your capabilities:
  - Navigate file systems and list files
  - Extract text from multiple document formats (txt, md, json, csv, html, pdf)
  - Analyze document content for summaries, entities, and topics
  - Search through document content
  - Save analysis results to structured files
  - Work with absolute and relative file paths`,
    stopWhen: stepCountIs(15),
    tools: { /* tools defined below */ }
  });
}
```

---

## Working with Tools

### Basic Tool Definition

```typescript
import { tool } from 'ai';
import z from 'zod/v4';
import fs from 'fs';
import path from 'path';

const listFilesTool = tool({
  description: "List files and directories at a given path. If no path is provided, lists files in the current directory.",
  inputSchema: z.object({
    path: z
      .string()
      .nullable()
      .describe("Optional relative path to list files from. Defaults to current directory if not provided."),
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
});
```

### Agent with Tools

```typescript
export async function documentAgent(prompt: string) {
  const result = await generateText({
    model: google("gemini-2.0-flash"),
    prompt,
    system: "You are a Document Processing Agent. You MUST use tools to read actual file contents.",
    stopWhen: stepCountIs(15),
    tools: {
      list_files: listFilesTool,
      read_file: readFileTool,
      extract_text_content: extractTextTool,
      analyze_document: analyzeDocumentTool,
      // ... more tools below
    },
  });

  return { 
    response: result.text, 
    toolCalls: result.toolCalls,
    toolResults: result.toolResults,
    usage: result.usage 
  };
}

// Usage example
const result = await documentAgent("Analyze the AIGovernance.pdf file and provide a comprehensive summary");
console.log(result.response);
console.log(result.toolCalls); // Array of all tool calls made
```

### Comprehensive Document Processing Tools

```typescript
export async function documentAgent(prompt: string) {
  const result = await generateText({
    model: google("gemini-2.0-flash"),
    prompt,
    system: "You are a Document Processing Agent with comprehensive filesystem and document analysis capabilities.",
    stopWhen: stepCountIs(15),
    tools: {
      // File System Tools
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

      // Document Extraction Tool
      extract_text_content: tool({
        description: "Extract readable text content from supported formats: txt, md, json, csv, html, pdf.",
        inputSchema: z.object({
          filePath: z.string().describe("The path to the document file"),
        }),
        execute: async ({ filePath }) => {
          try {
            const ext = path.extname(filePath).toLowerCase();
            let text = "";
            let metadata: Record<string, any> = {};

            
            if (ext === ".pdf") {
              const dataBuffer = fs.readFileSync(filePath);
              const pdfResult = await pdfParse.pdf(dataBuffer);
              text = pdfResult.text;
              metadata = { isPdf: true };
            } else {
              // Handle text-based formats
              const raw = fs.readFileSync(filePath, "utf-8");
              text = raw;
              
              switch (ext) {
                case ".json":
                  const parsed = JSON.parse(raw);
                  text = JSON.stringify(parsed, null, 2);
                  break;
                case ".csv":
                  const lines = raw.split(/\r?\n/);
                  text = `CSV rows: ${lines.length}\n\n${raw}`;
                  break;
                case ".html":
                case ".htm":
                  text = raw
                    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gsi, "")
                    .replace(/<[^>]*>/g, " ")
                    .replace(/\s+/g, " ")
                    .trim();
                  break;
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

      // Document Analysis Tool
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
              const emails = content.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-z]{2,}/g) || [];
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
    },
  });

  return { 
    response: result.text, 
    toolCalls: result.toolCalls,
    toolResults: result.toolResults,
    usage: result.usage 
  };
}
```

---

## Agent Loop Control

### Step Count Control

```typescript
import { stepCountIs } from 'ai';

const agent = new Agent({
  model: 'openai/gpt-4o',
  stopWhen: stepCountIs(10), // Allow up to 10 steps
});
```

### Custom Stop Conditions

```typescript
import { Experimental_Agent as Agent, stepCountIs } from 'ai';

const agent = new Agent({
  model: 'openai/gpt-4o',
  stopWhen: [
    stepCountIs(10), // Maximum 10 steps
    yourCustomCondition(), // Custom logic for when to stop
  ],
});
```

### Tool Choice Control

```typescript
const agent = new Agent({
  model: 'openai/gpt-4o',
  tools: {
    weather: weatherTool,
    cityAttractions: attractionsTool,
  },
  toolChoice: {
    type: 'tool',
    toolName: 'weather', // Force the weather tool to be used
  },
});

// Alternative tool choice options:
// toolChoice: 'required' // Force tool use
// toolChoice: 'none' // Disable tools
// toolChoice: 'auto' // Let the model decide (default)
```

---

## AI SDK v5 New Features

### Streaming UI with React Server Components

```typescript
'use server';

import { getMutableAIState, streamUI } from '@ai-sdk/rsc';
import { openai } from '@ai-sdk/openai';
import { ReactNode } from 'react';
import { z } from 'zod';
import { generateId } from 'ai';

export interface ServerMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ClientMessage {
  id: string;
  role: 'user' | 'assistant';
  display: ReactNode;
}

export async function continueConversation(
  input: string,
): Promise<ClientMessage> {
  'use server';

  const history = getMutableAIState();

  const result = await streamUI({
    model: openai('gpt-4o'),
    messages: [...history.get(), { role: 'user', content: input }],
    text: ({ content, done }) => {
      if (done) {
        history.done((messages: ServerMessage[]) => [
          ...messages,
          { role: 'assistant', content },
        ]);
      }
      return <div>{content}</div>;
    },
    tools: {
      deploy: {
        description: 'Deploy repository to vercel',
        inputSchema: z.object({
          repositoryName: z.string().describe('The name of the repository'),
        }),
        generate: async function* ({ repositoryName }) {
          yield <div>Cloning repository {repositoryName}...</div>;
          await new Promise(resolve => setTimeout(resolve, 3000));
          yield <div>Building repository {repositoryName}...</div>;
          await new Promise(resolve => setTimeout(resolve, 2000));
          return <div>{repositoryName} deployed!</div>;
        },
      },
    },
  });

  return {
    id: generateId(),
    role: 'assistant',
    display: result.value,
  };
}
```

### Client-Side Integration

```typescript
'use client';

import { useState } from 'react';
import { ClientMessage } from './actions';
import { useActions, useUIState } from '@ai-sdk/rsc';
import { generateId } from 'ai';

export default function Home() {
  const [input, setInput] = useState<string>('');
  const [conversation, setConversation] = useUIState();
  const { continueConversation } = useActions();

  return (
    <div>
      <div>
        {conversation.map((message: ClientMessage) => (
          <div key={message.id}>
            {message.role}: {message.display}
          </div>
        ))}
      </div>

      <div>
        <input
          type="text"
          value={input}
          onChange={event => setInput(event.target.value)}
        />
        <button
          onClick={async () => {
            setConversation((currentConversation: ClientMessage[]) => [
              ...currentConversation,
              { id: generateId(), role: 'user', display: input },
            ]);

            const message = await continueConversation(input);
            setConversation((currentConversation: ClientMessage[]) => [
              ...currentConversation,
              message,
            ]);
          }}
        >
          Send Message
        </button>
      </div>
    </div>
  );
}
```

### Updated Tool Handling with UI Integration

```typescript
// Server-side tool with UI streaming
import { streamText, tool } from 'ai';
import { z } from 'zod';

export async function POST(request: Request) {
  const { messages } = await request.json();

  const result = streamText({
    model: openai('gpt-4o'),
    system: 'You are a friendly assistant!',
    messages: convertToModelMessages(messages),
    stopWhen: stepCountIs(5),
    tools: {
      displayWeather: {
        description: 'Display the weather for a location',
        inputSchema: z.object({
          latitude: z.number(),
          longitude: z.number(),
        }),
        execute: async function ({ latitude, longitude }) {
          const props = await getWeather({ latitude, longitude });
          return props;
        },
      },
    },
  });

  return result.toUIMessageStreamResponse();
}
```

### Updated Client with Tool Display

```typescript
'use client';

import { useChat } from '@ai-sdk/react';
import { useState } from 'react';
import { Weather } from '@/components/weather';

export default function Page() {
  const [input, setInput] = useState('');
  const { messages, sendMessage } = useChat();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage({ text: input });
    setInput('');
  };

  return (
    <div>
      {messages.map(message => (
        <div key={message.id}>
          <div>{message.role === 'user' ? 'User: ' : 'AI: '}</div>
          <div>
            {message.parts.map((part, index) => {
              if (part.type === 'text') {
                return <span key={index}>{part.text}</span>;
              }

              if (part.type === 'tool-displayWeather') {
                switch (part.state) {
                  case 'input-available':
                    return <div key={index}>Loading weather...</div>;
                  case 'output-available':
                    return (
                      <div key={index}>
                        <Weather {...part.output} />
                      </div>
                    );
                  case 'output-error':
                    return <div key={index}>Error: {part.errorText}</div>;
                  default:
                    return null;
                }
              }

              return null;
            })}
          </div>
        </div>
      ))}

      <form onSubmit={handleSubmit}>
        <input
          value={input}
          onChange={e => setInput(e.currentTarget.value)}
          placeholder="Type a message..."
        />
        <button type="submit">Send</button>
      </form>
    </div>
  );
}
```

---

## Advanced Patterns

### Structured Output

```typescript
import { generateText, experimental_object } from 'ai';
import { z } from 'zod';

const result = await generateText({
  model: 'openai/gpt-4o',
  prompt: 'Analyze customer feedback from the last quarter',
  experimental_object: z.object({
    sentiment: z.enum(['positive', 'neutral', 'negative']),
    summary: z.string(),
    keyPoints: z.array(z.string()),
  }),
});

console.log(result.object); // Typed as { sentiment, summary, keyPoints }
```

### Streaming Responses

```typescript
import { streamText } from 'ai';

const result = streamText({
  model: openai('gpt-4o'),
  prompt: 'Tell me a short story about a time traveler.',
});

for await (const chunk of result.textStream) {
  process.stdout.write(chunk);
}
```

### Manual Agent Loop

```typescript
import { ModelMessage, streamText, tool } from 'ai';

const messages: ModelMessage[] = [
  {
    role: 'user',
    content: 'Get the weather in New York and San Francisco',
  },
];

async function main() {
  while (true) {
    const result = streamText({
      model: openai('gpt-4o'),
      messages,
      tools: {
        getWeather: tool({
          description: 'Get the current weather in a given location',
          parameters: z.object({
            location: z.string(),
          }),
        }),
      },
    });

    // Stream the response
    for await (const chunk of result.fullStream) {
      if (chunk.type === 'text-delta') {
        process.stdout.write(chunk.text);
      }
      if (chunk.type === 'tool-call') {
        console.log('\nCalling tool:', chunk.toolName);
      }
    }

    // Add LLM generated messages to the message history
    const responseMessages = (await result.response).messages;
    messages.push(...responseMessages);

    const finishReason = await result.finishReason;

    if (finishReason === 'tool-calls') {
      // Handle tool execution
      const toolCalls = await result.toolCalls;
      for (const toolCall of toolCalls) {
        if (toolCall.toolName === 'getWeather') {
          const toolOutput = await getWeather(toolCall.input);
          messages.push({
            role: 'tool',
            content: [{
              toolName: toolCall.toolName,
              toolCallId: toolCall.toolCallId,
              type: 'tool-result',
              output: { type: 'text', value: toolOutput },
            }],
          });
        }
      }
    } else {
      // Exit the loop
      break;
    }
  }
}
```

---

## Real-World Examples

### Document Processing Agent - Real Implementation

```typescript
// Actual implementation from utils/agent.ts
export async function documentAgent(prompt: string) {
  const result = await generateText({
    model: google("gemini-2.0-flash"),
    prompt,
    system: `You are a Document Processing Agent. You MUST use tools to read actual file contents. You are FORBIDDEN from making assumptions about file contents based on filenames.

  Rules:
  - Always use tools to read actual file contents before analyzing
  - Support multiple document formats: PDF, TXT, MD, JSON, CSV, HTML
  - Provide comprehensive analysis including summaries, entities, and topics
  - Navigate file systems safely with proper error handling
  - Extract text content before performing analysis
  - Save analysis results in structured formats`,
    stopWhen: stepCountIs(15),
    tools: {
      change_directory: changeDirectoryTool,
      list_files: listFilesTool,
      read_file: readFileTool,
      detect_document_type: detectDocumentTypeTool,
      extract_text_content: extractTextContentTool,
      analyze_document: analyzeDocumentTool,
      search_document: searchDocumentTool,
      save_analysis: saveAnalysisTool,
    },
  });

  return { 
    response: result.text, 
    toolCalls: result.toolCalls,
    toolResults: result.toolResults,
    usage: result.usage 
  };
}
```

### Actual Usage Examples

```typescript
// Test implementation from utils/test-document.ts
import { documentAgent } from "./agent";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

async function testDocumentAgent() {
  console.log("🧪 Testing Document Processing Agent...\n");

  try {
    // Test 1: Directory Navigation and File Listing
    console.log("📄 Test 1: List Files");
    const result1 = await documentAgent(
      "change directory to /home/blackie/Documents/ and list the files in that directory"
    );
    console.log("Response:", result1.response);
    console.log("---\n");

    // Test 2: PDF Analysis
    console.log("📄 Test 2: Analyze AIGovernance.pdf");
    const result2 = await documentAgent(
      "Analyze the AIGovernance.pdf file and provide a comprehensive summary"
    );
    console.log("Response:", result2.response);
    console.log("---\n");

    // Test 3: Directory Analysis
    console.log("📄 Test 3: Analyze Directory Contents");
    const result3 = await documentAgent(
      "Analyze all the files in this directory /home/blackie/Documents/ and provide a comprehensive summary"
    );
    console.log("Response:", result3.response);
    console.log("---\n");
    
    console.log("✅ All tests completed successfully!");

  } catch (error) {
    console.error("❌ Test failed:", error);
  }
}

testDocumentAgent();
```

### Document Processing Capabilities

Your agent can:
- **Navigate file systems** using `change_directory` tool
- **List and explore** directories with `list_files` tool  
- **Read various file types** with `read_file` tool
- **Detect document formats** with `detect_document_type` tool
- **Extract text from PDFs** using PDF parsing libraries
- **Analyze content** for summaries, entities, and topics
- **Search within documents** for specific terms
- **Save structured results** to JSON files

### Complete Tool Implementation Examples

```typescript
// Additional tools from the document agent implementation

// File Reading Tool
const readFileTool = tool({
  description: "Read the contents of a given relative file path. Use this when you want to see what's inside a file.",
  inputSchema: z.object({
    path: z.string().describe("The relative path of a file in the working directory."),
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
});

// Document Type Detection Tool
const detectDocumentTypeTool = tool({
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
});

// Search Document Tool
const searchDocumentTool = tool({
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
});

// Save Analysis Tool  
const saveAnalysisTool = tool({
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
});
```

---

## Best Practices

### 1. System Prompt Design

- **Be specific**: Clearly define the agent's role and capabilities
- **Set boundaries**: Define what the agent should and shouldn't do
- **Provide examples**: Include sample interactions when helpful
- **Keep it focused**: Avoid overly broad or conflicting instructions
- **Use warnings**: Check `result.warnings` for unsupported features

```typescript
const result = await generateText({
  model: openai('gpt-4o'),
  prompt: 'Hello, world!',
});

console.log(result.warnings); // Check for unsupported features
```

### 2. Tool Design

```typescript
// Good: Clear description and parameters
const goodTool = tool({
  description: 'Get the current weather for a specific location',
  inputSchema: z.object({
    location: z.string().describe('City name or coordinates'),
    units: z.enum(['celsius', 'fahrenheit']).default('celsius'),
  }),
  execute: async ({ location, units }) => {
    // Implementation
  },
});

// Bad: Vague description
const badTool = tool({
  description: 'Get weather',
  inputSchema: z.object({
    location: z.string(),
  }),
  execute: async ({ location }) => {
    // Implementation
  },
});
```

### 3. Error Handling

```typescript
const robustTool = tool({
  description: 'Get weather information',
  parameters: z.object({
    location: z.string(),
  }),
  execute: async ({ location }) => {
    try {
      const weather = await fetchWeather(location);
      return { success: true, data: weather };
    } catch (error) {
      return { 
        success: false, 
        error: `Failed to get weather for ${location}` 
      };
    }
  },
});
```

### 4. Context Management

```typescript
// Use prepareStep to manage context length
const result = await generateText({
  model: 'openai/gpt-4o',
  tools: { /* your tools */ },
  prepareStep: async ({ messages }) => {
    // Keep only recent messages to stay within context limits
    if (messages.length > 20) {
      return {
        messages: [
          messages[0], // Keep system message
          ...messages.slice(-10), // Keep last 10 messages
        ],
      };
    }
    return {};
  },
});
```

### 5. Performance Optimization

- **Limit steps**: Use `stepCountIs()` to prevent infinite loops
- **Cache responses**: Store frequently accessed data
- **Parallel execution**: Use `Promise.all()` for independent tool calls
- **Stream responses**: Use streaming for better user experience

---

## Integration Examples

### Next.js API Route

```typescript
// app/api/chat/route.ts
import { streamText, convertToModelMessages, UIMessage, stepCountIs } from 'ai';
import { openai } from '@ai-sdk/openai';
import { tools } from '@/ai/tools';

export async function POST(request: Request) {
  const { messages }: { messages: UIMessage[] } = await request.json();

  const result = streamText({
    model: openai('gpt-4o'),
    system: 'You are a helpful assistant.',
    messages: convertToModelMessages(messages),
    stopWhen: stepCountIs(5),
    tools,
  });

  return result.toUIMessageStreamResponse();
}
```

### React Component

```typescript
'use client';

import { useChat } from '@ai-sdk/react';
import { useState } from 'react';

export function Chat() {
  const [input, setInput] = useState('');
  const { messages, sendMessage } = useChat({
    api: '/api/chat',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage({ text: input });
    setInput('');
  };

  return (
    <div className="flex flex-col w-full max-w-md py-24 mx-auto stretch">
      {messages.map(message => (
        <div key={message.id} className="whitespace-pre-wrap">
          {message.role === 'user' ? 'User: ' : 'AI: '}
          {message.parts.map((part, i) => {
            switch (part.type) {
              case 'text':
                return <div key={`${message.id}-${i}`}>{part.text}</div>;
              case 'tool-weather':
              case 'tool-calculator':
                return (
                  <pre key={`${message.id}-${i}`}>
                    {JSON.stringify(part, null, 2)}
                  </pre>
                );
              default:
                return null;
            }
          })}
        </div>
      ))}
      
      <form onSubmit={handleSubmit}>
        <input
          value={input}
          placeholder="Say something..."
          onChange={e => setInput(e.currentTarget.value)}
        />
        <button type="submit">Send</button>
      </form>
    </div>
  );
}
```

### Type Safety

```typescript
import {
  Experimental_Agent as Agent,
  Experimental_InferAgentUIMessage as InferAgentUIMessage,
} from 'ai';

const myAgent = new Agent({
  model: 'openai/gpt-4o',
  tools: { weather: weatherTool },
});

// Infer the UIMessage type for UI components
export type MyAgentUIMessage = InferAgentUIMessage<typeof myAgent>;

// Use in React component
export function Chat() {
  const { messages } = useChat<MyAgentUIMessage>();
  // Full type safety for messages and tools
}
```

---

## AI SDK v5 Migration Notes

### Key Changes from v4 to v5

#### 1. Tool Parameter Changes
```typescript
// v4
const tool = tool({
  parameters: z.object({ ... }),
});

// v5
const tool = tool({
  inputSchema: z.object({ ... }),
});
```

#### 2. Stream Event Updates
```typescript
// v4
for await (const chunk of result.fullStream) {
  switch (chunk.type) {
    case 'step-finish':
      console.log('Step finished:', chunk.finishReason);
      break;
    case 'finish':
      console.log('Usage:', chunk.usage);
      break;
  }
}

// v5
for await (const chunk of result.fullStream) {
  switch (chunk.type) {
    case 'finish-step': // Renamed from 'step-finish'
      console.log('Step finished:', chunk.finishReason);
      break;
    case 'finish':
      console.log('Total Usage:', chunk.totalUsage); // Changed from 'usage'
      break;
  }
}
```

#### 3. Chat Hook Updates
```typescript
// v4
const { messages, experimental_addToolResult } = useChat({
  maxSteps: 5,
  async onToolCall({ toolCall }) {
    if (toolCall.toolName === 'getLocation') {
      return 'New York'; // Automatic submission
    }
  },
});

// v5
const { messages, addToolResult } = useChat({
  sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
  async onToolCall({ toolCall }) {
    if (toolCall.toolName === 'getLocation') {
      addToolResult({
        tool: 'getLocation',
        toolCallId: toolCall.toolCallId,
        output: 'New York',
      });
    }
  },
});
```

#### 4. Stream Resumption
```typescript
// v4 (experimental)
const { messages } = useChat({
  experimental_resume: true,
});

// v5 (stable)
const { messages } = useChat({
  resumeStream: true,
});
```

#### 5. Reasoning Properties
```typescript
// v4
console.log(result.reasoning); // String reasoning text
console.log(result.reasoningDetails); // Array of reasoning details

// v5
console.log(result.reasoningText); // String reasoning text
console.log(result.reasoning); // Array of reasoning details
```

### Migration Checklist

- [ ] Update `parameters` to `inputSchema` in tool definitions
- [ ] Update stream event handling (`step-finish` → `finish-step`)
- [ ] Update usage property access (`usage` → `totalUsage`)
- [ ] Replace `experimental_addToolResult` with `addToolResult`
- [ ] Update tool result parameters (`result` → `output`, add `tool` parameter)
- [ ] Replace `experimental_resume` with `resumeStream`
- [ ] Update reasoning property access
- [ ] Test all streaming functionality
- [ ] Update error handling for new chunk types

---

## Next Steps

### 1. Explore Advanced Features
- **Multi-modal agents**: Handle text, images, and audio
- **Custom providers**: Integrate with your own models
- **Agent orchestration**: Build systems of multiple agents
- **Computer tools**: Real-time computer interaction
- **Generative UI**: Dynamic UI components from AI responses
- **React Server Components**: Server-side AI with streaming UI

### 2. Production Considerations
- **Monitoring**: Track agent performance and errors
- **Rate limiting**: Implement proper API rate limiting
- **Security**: Validate inputs and sanitize outputs
- **Scaling**: Design for horizontal scaling

### 3. Learning Resources
- **Official Documentation**: [ai-sdk.dev](https://ai-sdk.dev)
- **Cookbook Examples**: Practical implementation guides
- **Community**: Join the AI SDK community for support

### 4. Project Ideas
- **Personal Assistant**: Manage calendar, tasks, and reminders
- **Code Review Bot**: Automated code analysis and suggestions
- **Customer Support**: Multi-channel support automation
- **Data Analysis**: Automated report generation and insights

---

## Key Takeaways

### What We've Learned

1. **AI SDK v5 provides a powerful foundation** for building intelligent agents
2. **Tools enable agents** to interact with external systems and APIs
3. **Proper loop control** ensures agents behave predictably
4. **Type safety** improves development experience and reliability
5. **Streaming support** enables real-time user interactions
6. **React Server Components** enable server-side AI with streaming UI
7. **Generative UI** allows dynamic component creation from AI responses
8. **Computer tools** enable real-time computer interaction

### Best Practices Summary

- Design clear system prompts
- Create well-defined tools with proper error handling
- Implement appropriate loop controls
- Use structured outputs when possible
- Plan for production deployment from the start

### Ready to Build?

You now have the knowledge to:
- ✅ Set up the AI SDK v5 in your project
- ✅ Create basic agents with custom tools
- ✅ Implement advanced patterns like streaming and structured outputs
- ✅ Build real-world applications with proper error handling
- ✅ Integrate agents into web applications
- ✅ Use React Server Components for server-side AI
- ✅ Create generative UI components from AI responses
- ✅ Migrate from AI SDK v4 to v5
- ✅ Handle computer tools for real-time interaction

---

## Thank You!

### Questions & Discussion

- **GitHub**: [github.com/vercel/ai](https://github.com/vercel/ai)
- **Documentation**: [ai-sdk.dev](https://ai-sdk.dev)
- **Discord**: Join the Vercel AI SDK community

### Happy Building! 🚀

Start building your first AI agent today and unlock the power of intelligent automation!
