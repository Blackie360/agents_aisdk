import {
  convertToCoreMessages,
  Message,
  streamText,
  generateText,
} from "ai";
import { put } from "@vercel/blob";
import { gateway } from "@ai-sdk/gateway";

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
  const searchKeywords = [
    "current",
    "latest",
    "recent",
    "news",
    "today",
    "now",
    "what happened",
    "search for",
    "find information about",
  ];
  const lowerPrompt = prompt.toLowerCase();
  return searchKeywords.some((keyword) => lowerPrompt.includes(keyword));
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

  const gatewayApiKey =
    process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_AI_GATEWAY_API_KEY;
  const googleGateway = gateway("google", {
    apiKey: gatewayApiKey,
  });

  if (shouldSearchWeb) {
    tools.google_search = googleGateway.tools.googleSearch({});
  }

  if (shouldUseUrlContext) {
    tools.url_context = googleGateway.tools.urlContext({});
  }

  if (shouldExecuteCode) {
    try {
      tools.code_execution = googleGateway.tools.codeExecution({});
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

  let systemPrompt = `You are a helpful AI assistant powered by Google Gemini. 
You can help users with a wide variety of tasks including:
- Answering questions and providing information
- Generating images from text descriptions
- Searching the web for current information
- Analyzing web content from URLs
- Executing code for calculations and problem-solving
- Processing and understanding documents (PDFs, images, YouTube videos)

Keep your responses helpful, accurate, and concise.`;

  if (imageUrl) {
    systemPrompt += `\n\nAn image has been generated based on the user's request. The image URL is: ${imageUrl}`;
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
