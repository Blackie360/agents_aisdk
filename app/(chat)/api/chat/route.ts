import {
  convertToCoreMessages,
  Message,
  streamText,
  generateText,
} from "ai";
import { put } from "@vercel/blob";
import { google } from "@ai-sdk/google";
import { GoogleGenerativeAIProviderMetadata } from "@ai-sdk/google";

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
  const { id, messages }: { id: string; messages: Array<Message> } =
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

Always be helpful, empathetic, and action-oriented. Provide specific, practical advice that community managers can implement immediately.`;

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
