import {
  convertToCoreMessages,
  Message,
  streamText,
  generateText,
} from "ai";
import { put } from "@vercel/blob";
import { google } from "@ai-sdk/google";
import { GoogleGenerativeAIProviderMetadata } from "@ai-sdk/google";
import { auth } from "@/app/(auth)/auth";
import {
  getWorkspaceById,
  getWorkspaceMembers,
  getWorkspaceFiles,
} from "@/db/queries";

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

  const { id, messages, workspaceId }: { id: string; messages: Array<Message>; workspaceId?: string } =
    await request.json();

  const coreMessages = convertToCoreMessages(messages).filter(
    (message) => message.content.length > 0,
  );

  const lastUserMessage = coreMessages
    .filter((msg) => msg.role === "user")
    .pop();

  if (!lastUserMessage) {
    return new Response("No prompt provided", { status: 400 });
  }

  const prompt = Array.isArray(lastUserMessage.content)
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
  if (shouldSearchWeb) {
    try {
      tools.google_search = google.tools.googleSearch({});
    } catch (error) {
      console.warn("Google Search tool not available:", error);
    }
  }

  // URL Context for analyzing web content
  if (shouldUseUrlContext) {
    try {
      if (google?.tools?.urlContext) {
        tools.url_context = google.tools.urlContext({});
      }
    } catch (error) {
      console.warn("URL Context tool not available:", error);
    }
  }

  // Code execution for calculations
  if (shouldExecuteCode) {
    try {
      if (google?.tools?.codeExecution) {
        tools.code_execution = google.tools.codeExecution({});
      }
    } catch (error) {
      console.warn("Code execution tool not available:", error);
    }
  }

  let imageUrl: string | null = null;
  if (shouldGenerateImage) {
    try {
      const imageResult = await generateText({
        model: geminiImageModel,
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

        workspaceContext += `\n\nWhen providing advice, consider this specific community's context, size, member base, and available files. Personalize your recommendations to fit "${workspace.name}" community's needs.`;
      }
    } catch (error) {
      console.error("Failed to load workspace context:", error);
    }
  }

  let systemPrompt = `You are an expert Tech Community Manager AI Assistant, specialized in helping DevRel professionals and community managers build, grow, and engage thriving tech communities.

Your expertise includes:

**Community Strategy & Growth**
- Developing community engagement strategies and growth plans
- Planning and organizing tech events (conferences, meetups, hackathons, workshops)
- Creating community programs (ambassador programs, mentorship, user groups)
- Building community guidelines, codes of conduct, and governance models
- Analyzing community metrics and KPIs for growth and engagement

**Developer Relations**
- Creating technical content (blog posts, tutorials, documentation)
- Planning developer advocacy programs and campaigns
- Building relationships with open source maintainers and contributors
- Identifying and nurturing community champions and advocates
- Managing developer feedback loops and feature requests

**Content & Communication**
- Crafting engaging social media content for tech audiences
- Writing newsletters, announcements, and community updates
- Developing technical documentation and getting started guides
- Creating presentation decks and workshop materials
- Responding to community inquiries and support requests

**Platform & Tools Management**
- Managing community platforms (Discord, Slack, forums, GitHub Discussions)
- Setting up automation and bot workflows for community management
- Tracking community sentiment and engagement metrics
- Monitoring industry trends and competitive landscape
- Finding relevant tech news, articles, and resources

**Best Practices**
- You search the web for the latest community trends, tools, and best practices
- You provide data-driven recommendations backed by real-world examples
- You stay updated on current tech news, conferences, and industry events
- You help create inclusive, welcoming communities that value diversity
- You balance community needs with business objectives

Always be helpful, empathetic, and action-oriented. Provide specific, practical advice that community managers can implement immediately.${workspaceContext}`;

  if (imageUrl) {
    systemPrompt += `\n\nAn image has been generated based on the user's request. Share this URL in your response so the user can see it: ${imageUrl}
IMPORTANT: Include the full URL in your response exactly as provided. The UI will automatically display it as an image.`;
  }

  const result = streamText({
    model,
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
