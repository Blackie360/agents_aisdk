// History endpoint - no database, returns empty array
export async function GET() {
  return Response.json([]);
}
