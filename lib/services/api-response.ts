/** Read API errors without exposing proxy HTML or request/credential fragments. */
export async function readApiResponse(response: Response): Promise<any> {
  const status = `HTTP ${response.status}`;
  if (response.redirected)
    throw new Error(
      `Request denied or redirected (${status}). Check deployment access and, for AI, your API key.`,
    );
  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    if (response.status === 401 || response.status === 403)
      throw new Error(
        `Request denied (HTTP ${response.status}). Check deployment access and your API key.`,
      );
    throw new Error(
      `The server returned ${text.trim() ? "a non-JSON" : "an empty"} response (${status}). The request may have been blocked by deployment protection or a server failure. Try again on an authorized deployment.`,
    );
  }
  if (
    (response.status === 401 || response.status === 403) &&
    data?.code !== "AI_ACCESS_DENIED"
  )
    throw new Error(
      `Request denied (HTTP ${response.status}). Check deployment access and your API key.`,
    );
  if (!response.ok)
    throw new Error(
      typeof data?.message === "string"
        ? data.message.slice(0, 1200)
        : `Request failed (${status}).`,
    );
  if (!data || typeof data !== "object")
    throw new Error(`The server returned an invalid response (${status}).`);
  return data;
}
