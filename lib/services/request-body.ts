export class BodyTooLarge extends Error {}
export async function readJson(req: Request, limit = 250_000): Promise<any> {
  const reader = req.body?.getReader();
  if (!reader) throw new Error("Request body is empty.");
  const decoder = new TextDecoder();
  let size = 0,
    text = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        throw new BodyTooLarge("Request exceeds 250 KB.");
      }
      text += decoder.decode(value, { stream: true });
    }
    return JSON.parse(text + decoder.decode());
  } finally {
    reader.releaseLock();
  }
}
