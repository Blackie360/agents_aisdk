import {
  convertToCoreMessages,
  UIMessage,
  streamText,
  generateText,
} from "ai";
import { put } from "@vercel/blob";
import { google } from "@ai-sdk/google";
import { auth } from "@/app/(auth)/auth";
import {
  getWorkspaceById,
  getWorkspaceMembers,
  getWorkspaceFiles,
  getChatById,
  saveChat,
  getWorkspaceFileEmbeddings,
} from "@/db/queries";
import { searchEmbeddings } from "@/lib/embeddings";

import { geminiModel, geminiImageModel } from "@/ai";

const isImageGenerationRequest = (prompt: string): boolean => {
  const imageKeywords = [
    "generate image",
    "create image",
    "make an image",
    "draw",
    "picture of",
    "image of",
    "generate a picture",
    "create a picture",
  ];
  const lowerPrompt = prompt.toLowerCase();
  return imageKeywords.some((keyword) => lowerPrompt.includes(keyword));
};

const needsWebSearch = (prompt: string): boolean => {
  // Always enable web search for community manager agent
  return true;
};

const needsCodeExecution = (prompt: string): boolean => {
  const codeKeywords = [
    "calculate",
    "compute",
    "solve",
    "python",
    "code",
    "algorithm",
    "formula",
    "math",
    "equation",
  ];
  const lowerPrompt = prompt.toLowerCase();
  return codeKeywords.some((keyword) => lowerPrompt.includes(keyword));
};

const extractUrls = (text: string): string[] => {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return text.match(urlRegex) || [];
};

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { id, messages, workspaceId: providedWorkspaceId }: { id: string; messages: Array<UIMessage>; workspaceId?: string } =
    await request.json();

  // Try to get workspaceId from chat record if not provided
  let workspaceId = providedWorkspaceId;
  if (!workspaceId && id) {
    try {
      const chat = await getChatById({ id });
      if (chat?.workspaceId) {
        workspaceId = chat.workspaceId;
      }
    } catch (error) {
      console.error("Failed to load chat record:", error);
    }
  }

  // Save workspaceId to chat record if provided and different from existing
  if (providedWorkspaceId && id) {
    try {
      const chat = await getChatById({ id });
      // If chat exists and workspaceId is different, update it
      // If chat doesn't exist yet, create it with workspaceId
      if (chat) {
        if (chat.workspaceId !== providedWorkspaceId) {
          await saveChat({
            id,
            messages: chat.messages as any,
            userId: chat.userId,
            workspaceId: providedWorkspaceId,
          });
        }
      } else {
        // Chat doesn't exist yet, create it with workspaceId
        await saveChat({
          id,
          messages: [],
          userId: session.user.id,
          workspaceId: providedWorkspaceId,
        });
      }
    } catch (error) {
      console.error("Failed to save workspaceId to chat:", error);
    }
  }

  const coreMessages = convertToCoreMessages(messages).filter(
    (message) => message.content.length > 0,
  );

  const lastUserMessage = coreMessages
    .filter((msg) => msg.role === "user")
    .pop();

  if (!lastUserMessage) {
    return new Response("No prompt provided", { status: 400 });
  }

  let prompt = Array.isArray(lastUserMessage.content)
    ? lastUserMessage.content
        .filter((part) => part.type === "text")
        .map((part) => part.text)
        .join(" ")
    : typeof lastUserMessage.content === "string"
      ? lastUserMessage.content
      : "";

  if (!prompt.trim()) {
    return new Response("No prompt provided", { status: 400 });
  }

  // Detect event planning requests and enhance the prompt
  const eventPlanningKeywords = [
    "plan an event",
    "organize an event",
    "create an event",
    "event planning",
    "help me plan",
    "help me organize",
    "event idea",
    "hackathon",
    "meetup",
    "conference",
    "workshop",
    "webinar",
  ];
  
  const lowerPrompt = prompt.toLowerCase();
  const isEventPlanningRequest = eventPlanningKeywords.some(keyword => 
    lowerPrompt.includes(keyword)
  );

  if (isEventPlanningRequest && !prompt.includes("**Event Goal") && !prompt.includes("comprehensive event plan")) {
    // Enhance the prompt to get a comprehensive event plan with structured skeleton
    prompt = `Help me plan a tech community event. ${prompt}

Please provide a comprehensive event plan using this structured format:

**Event Goal**
[Clear statement of what the event aims to achieve]

**Target Audience**
[Who should attend and why]

**Event Format**
[In-person, virtual, hybrid, duration, schedule]

**Content & Speakers**
[Session topics, speaker suggestions, agenda outline]

**Marketing & Promotion**
[Channels, timeline, messaging strategy]

**Logistics & Platform**
[Venue/platform selection, tech requirements, setup needs]

**Community Engagement**
[Pre-event, during-event, and post-event activities]

**Budget Considerations**
[Cost breakdown, revenue streams, sponsorship opportunities]

**Success Metrics**
[KPIs, measurement methods, reporting]

**Timeline**
[Key milestones and deadlines]

**Next Steps**
[Immediate action items to get started]

Please be detailed and practical in your recommendations. Use this exact structure.`;
  }

  const hasFileInputs = Array.isArray(lastUserMessage.content)
    ? lastUserMessage.content.some((part) => part.type === "file")
    : false;

  const urls = extractUrls(prompt);

  const shouldGenerateImage = isImageGenerationRequest(prompt);
  const shouldSearchWeb = needsWebSearch(prompt);
  const shouldExecuteCode = needsCodeExecution(prompt);
  const shouldUseUrlContext = urls.length > 0;

  const tools: Record<string, any> = {};

  // Always enable Google Search for community management research
  // This provides real-time web search capabilities with grounding metadata
  if (shouldSearchWeb) {
    try {
      // Configure Google Search tool - provides access to grounding metadata
      // and safety ratings in the providerMetadata response
      tools.google_search = (google as any).tools.googleSearch({});
    } catch (error) {
      console.warn("Google Search tool not available:", error);
    }
  }

  // URL Context for analyzing web content
  if (shouldUseUrlContext) {
    try {
      if ((google as any)?.tools?.urlContext) {
        tools.url_context = (google as any).tools.urlContext({});
      }
    } catch (error) {
      console.warn("URL Context tool not available:", error);
    }
  }

  // Code execution for calculations
  if (shouldExecuteCode) {
    try {
      if ((google as any)?.tools?.codeExecution) {
        tools.code_execution = (google as any).tools.codeExecution({});
      }
    } catch (error) {
      console.warn("Code execution tool not available:", error);
    }
  }

  let imageUrl: string | null = null;
  if (shouldGenerateImage) {
    try {
      const imageResult = await generateText({
        model: geminiImageModel as any,
        prompt: prompt,
      });

      if (imageResult.files && imageResult.files.length > 0) {
        const imageFile = imageResult.files.find((file) =>
          file.mediaType?.startsWith("image/"),
        );

        if (imageFile && imageFile.uint8Array) {
          try {
            const imageBuffer = Buffer.from(imageFile.uint8Array);

            const blob = await put(`generated-${Date.now()}.png`, imageBuffer, {
              access: "public",
              contentType: imageFile.mediaType || "image/png",
            });

            imageUrl = blob.url;
          } catch (error) {
            console.error("Failed to process image file:", error);
          }
        }
      }
    } catch (error) {
      console.error("Image generation failed:", error);
    }
  }

  const model = geminiModel;

  // Get workspace context if workspaceId is provided
  let workspaceContext = "";
  if (workspaceId) {
    try {
      const workspace = await getWorkspaceById(workspaceId);
      if (workspace && workspace.ownerId === session.user.id) {
        const members = await getWorkspaceMembers(workspaceId);
        const memberSample = members.slice(0, 10).map((m) => ({
          name: m.name || "Unknown",
          email: m.email,
        }));

        // Fetch workspace files
        const workspaceFiles = await getWorkspaceFiles(workspaceId);

        workspaceContext = `\n\n**Current Workspace Context:**
You are managing the "${workspace.name}" community${workspace.description ? `: ${workspace.description}` : ""}.

**Community Members:** This workspace has ${members.length} registered members.`;
        
        if (memberSample.length > 0) {
          workspaceContext += ` Here are some of the community members:\n${memberSample.map((m, i) => `${i + 1}. ${m.name} (${m.email})`).join("\n")}`;
        }

        // Add workspace files context
        if (workspaceFiles.length > 0) {
          workspaceContext += `\n\n**Workspace Files & Documents:** This workspace has ${workspaceFiles.length} file(s) available for reference:`;
          
          // Group files by type
          const textFiles = workspaceFiles.filter(f => 
            f.mimeType?.startsWith("text/") || 
            f.fileName.endsWith(".txt") || 
            f.fileName.endsWith(".md") ||
            f.fileName.endsWith(".json")
          );
          const pdfFiles = workspaceFiles.filter(f => 
            f.mimeType === "application/pdf" || 
            f.fileName.endsWith(".pdf")
          );
          const imageFiles = workspaceFiles.filter(f => 
            f.mimeType?.startsWith("image/")
          );
          const otherFiles = workspaceFiles.filter(f => 
            !textFiles.includes(f) && 
            !pdfFiles.includes(f) && 
            !imageFiles.includes(f)
          );

          if (textFiles.length > 0) {
            workspaceContext += `\n\n* Text/Document Files (${textFiles.length}):`;
            for (const file of textFiles.slice(0, 10)) {
              workspaceContext += `\n  - ${file.fileName}${file.fileUrl ? ` (${file.fileUrl})` : ""}`;
              // Try to fetch text content for small text files
              if (file.fileUrl && file.fileSize && file.fileSize < 100000) {
                try {
                  const fileResponse = await fetch(file.fileUrl);
                  if (fileResponse.ok) {
                    const textContent = await fileResponse.text();
                    if (textContent.length < 5000) {
                      workspaceContext += `\n    Content preview: ${textContent.substring(0, 500)}${textContent.length > 500 ? "..." : ""}`;
                    }
                  }
                } catch (error) {
                  // Silently fail if file can't be fetched
                }
              }
            }
          }

          if (pdfFiles.length > 0) {
            workspaceContext += `\n\n* PDF Documents (${pdfFiles.length}):`;
            for (const file of pdfFiles.slice(0, 10)) {
              workspaceContext += `\n  - ${file.fileName}${file.fileUrl ? ` (${file.fileUrl})` : ""}`;
            }
            workspaceContext += `\n  Note: You can reference these PDFs by their URLs when providing advice.`;
          }

          if (imageFiles.length > 0) {
            workspaceContext += `\n\n* Images (${imageFiles.length}):`;
            for (const file of imageFiles.slice(0, 10)) {
              workspaceContext += `\n  - ${file.fileName}${file.fileUrl ? ` (${file.fileUrl})` : ""}`;
            }
          }

          if (otherFiles.length > 0) {
            workspaceContext += `\n\n* Other Files (${otherFiles.length}):`;
            for (const file of otherFiles.slice(0, 10)) {
              workspaceContext += `\n  - ${file.fileName}${file.fileUrl ? ` (${file.fileUrl})` : ""}`;
            }
          }

          workspaceContext += `\n\nWhen answering questions, you can reference these workspace files and their content to provide context-aware responses specific to this community.`;
        }

        // Search embeddings for relevant content from uploaded files
        try {
          console.log(`[Chat] Searching embeddings for workspace: ${workspaceId}`);
          const embeddings = await getWorkspaceFileEmbeddings(workspaceId);
          console.log(`[Chat] Found ${embeddings.length} embeddings in database`);
          
          if (embeddings.length > 0) {
            console.log(`[Chat] Searching embeddings for query: "${prompt.substring(0, 50)}..."`);
            const searchResults = await searchEmbeddings(
              prompt,
              embeddings.map((emb) => ({
                id: emb.id,
                content: emb.content,
                embedding: emb.embedding,
                metadata: emb.metadata,
              })),
              5, // top 5 results
              0.6, // minimum similarity threshold
            );
            console.log(`[Chat] Found ${searchResults.length} relevant results`);

            if (searchResults.length > 0) {
              workspaceContext += `\n\n**Relevant Content from Workspace Files:**\nBased on your question, here is relevant information from uploaded files:\n`;
              searchResults.forEach((result, index) => {
                workspaceContext += `\n${index + 1}. ${result.content.substring(0, 500)}${result.content.length > 500 ? "..." : ""}`;
                if (result.metadata?.type === "data" && result.metadata?.startRow) {
                  workspaceContext += `\n   (From rows ${result.metadata.startRow}-${result.metadata.endRow})`;
                }
              });
              workspaceContext += `\n\nUse this information to provide accurate, context-aware answers about the workspace data.`;
            } else {
              console.log(`[Chat] No results above similarity threshold (0.6)`);
            }
          } else {
            console.log(`[Chat] No embeddings found for workspace ${workspaceId}`);
          }
        } catch (error) {
          console.error("[Chat] Failed to search embeddings:", error);
          console.error("[Chat] Error details:", error instanceof Error ? error.message : String(error));
          // Don't fail if embedding search fails
        }

        workspaceContext += `\n\nWhen providing advice, consider this specific community's context, size, member base, and available files. Personalize your recommendations to fit "${workspace.name}" community's needs.`;
      }
    } catch (error) {
      console.error("Failed to load workspace context:", error);
    }
  }

  let systemPrompt = `You are **Astra**, an advanced Tech Community Manager & DevRel AI Assistant.  

Your mission is to help users plan events, grow communities, manage developer ecosystems, and execute DevRel workflows with clarity, accuracy, and practical recommendations.

---

## 🎯 Core Identity

You are:

- A world-class Tech Community Manager  

- A DevRel strategist  

- A technical writer & documentation expert  

- A community analyst with data-driven insights  

- A reliable assistant that uses tools when needed  

You combine DevRel contextual understanding + real-time information from web search + workspace data (files, embeddings, members).

---

## 🧠 Core Capabilities

You excel at:

### **1. Community Strategy & Growth**

- Designing community growth roadmaps  

- Tracking community health metrics  

- Creating onboarding flows  

- Helping set up ambassador/advocacy programs  

- Suggesting engagement activities

### **2. Event Planning (Your Superpower)**

You produce complete, realistic, structured plans for:

- Hackathons  

- Meetups  

- Conferences  

- Workshops  

- Launch events  

- Online webinars  

**CRITICAL: All event planning responses MUST follow this structured skeleton format:**

Use this exact structure (or similar) when planning events:

**Event Goal**
[Clear statement of what the event aims to achieve]

**Target Audience**
[Who should attend and why]

**Event Format**
[In-person, virtual, hybrid, duration, schedule]

**Content & Speakers**
[Session topics, speaker suggestions, agenda outline]

**Marketing & Promotion**
[Channels, timeline, messaging strategy]

**Logistics & Platform**
[Venue/platform selection, tech requirements, setup needs]

**Community Engagement**
[Pre-event, during-event, and post-event activities]

**Budget Considerations**
[Cost breakdown, revenue streams, sponsorship opportunities]

**Success Metrics**
[KPIs, measurement methods, reporting]

**Timeline**
[Key milestones and deadlines]

**Next Steps**
[Immediate action items to get started]

Always use clear headings, bullet points, and structured sections. Stream responses section by section for better readability.  

### **3. Developer Relations**

- Producing tech content (blogs, tutorials, samples, slide decks)  

- Designing developer onboarding journeys  

- Champion/advocate programs  

- Feedback collection frameworks  

### **4. Communication & Content**

- Drafting announcements, emails, newsletters, and social content  

- Writing professional responses  

- Improving clarity and tone  

### **5. Community Platform Management**

- Managing Discord, Slack, GitHub Discussions  

- Suggesting automation using bots  

- Moderation policy advice  

- Community guidelines & Code of Conduct creation  

---

## 🧩 Workspace-Aware Intelligence

When workspace data is available (files, members, embeddings):

- **Use the context to personalize answers**

- Reference uploaded documents when relevant

- Leverage embedding search results as "knowledge snippets"

- Understand community size, composition, and goals

- Avoid hallucinating if information is missing  

Example:  

If a file about "Event Budget Template.pdf" exists, you may say:  

"According to your workspace documents, you already have a budget framework. Here's how to adapt it to your upcoming event…"

---

## 🛠️ Tool Usage Rules

You may use available tools when needed:

### **✔ Web Search**

Use *whenever*:  

- The prompt asks for up-to-date info  

- Trends, news, research, best practices are required  

- Event topics, speaker suggestions, industry standards  

### **✔ URL Context**

Use when:  

- The user provides a link  

- You need to extract info directly from a webpage  

### **✔ Code Execution**

Use only for:  

- Calculations  

- Formulas  

- Data transformation  

- Budget breakdowns  

- Scheduling generation  

### **✔ Image Generation**

Use when the user explicitly asks for images.

---

## 🧩 Response Quality Standards

All responses must be:

- Clear  

- **Structured with consistent skeleton formats** (use headings, bullets, tables when helpful)  

- **For event planning: Always use the structured skeleton format with sections like Event Goal, Target Audience, Event Format, Content & Speakers, Marketing & Promotion, Logistics & Platform, Community Engagement, Budget Considerations, Success Metrics, Timeline, and Next Steps**

- Practical and realistic  

- Community-centered  

- Actionable (give steps, templates, checklists)  

- Professional but friendly  

- Free of hallucinations  

- **Stream responses section by section** - complete one section before moving to the next for better readability  

---

## 🚫 Avoid

- Overly generic answers  

- Repeating the user's prompt  

- Inventing facts  

- Giving advice outside community/DevRel/event domains  

- Using tools unnecessarily  

---

## 💬 Tone Guidelines

- Confident, warm, and collaborative  

- Speak like an experienced DevRel manager  

- Give examples, templates, and frameworks when useful  

---

## 🔥 Final Reminder

Your primary mission is to empower the user to build **strong tech communities**, run **high-impact events**, create **excellent technical content**, and execute **DevRel excellence**, using **workspace data + web search** whenever helpful.

${workspaceContext}`;

  if (imageUrl) {
    systemPrompt += `\n\nAn image has been generated based on the user's request. Share this URL in your response so the user can see it: ${imageUrl}
IMPORTANT: Include the full URL in your response exactly as provided. The UI will automatically display it as an image.`;
  }

  const result = streamText({
    model: model as any,
    system: systemPrompt,
    messages: coreMessages,
    tools: Object.keys(tools).length > 0 ? tools : undefined,
    experimental_telemetry: {
      isEnabled: true,
      functionId: "stream-text",
    },
  });

  return result.toUIMessageStreamResponse();
}
