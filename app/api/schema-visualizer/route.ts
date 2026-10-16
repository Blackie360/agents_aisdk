import { readJson, BodyTooLarge } from "@/lib/services/request-body";
import { importSchema } from "@/lib/importers";
export const runtime = "nodejs";
export async function POST(req: Request) {
  try {
    const body = await readJson(req);
    return Response.json({
      success: true,
      schema: importSchema(body.schema, body.format),
    });
  } catch (error) {
    return Response.json(
      {
        success: false,
        message: (error instanceof Error
          ? error.message
          : "Invalid schema"
        ).slice(0, 1200),
      },
      { status: error instanceof BodyTooLarge ? 413 : 400 },
    );
  }
}
