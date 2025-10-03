import { documentAgent } from "../utils/agent";

export async function POST(request: Request) {
  const body = await request.json();
  const { prompt, filePath, content }: { prompt: string; filePath?: string; content?: string } = body;

  if (!prompt) {
    return new Response(JSON.stringify({ error: "Prompt is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const fullPrompt = filePath 
      ? `${prompt} (Document: ${filePath})`
      : content
      ? `${prompt}\n\nDocument content:\n${content}`
      : prompt;
    
    const result = await documentAgent(fullPrompt);
    
    return new Response(JSON.stringify({ 
      response: result.response 
    }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: "An error occurred processing the document" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

