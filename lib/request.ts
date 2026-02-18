// parse body safely; bad JSON becomes null instead of throwing.
export async function parseJson(
  request: Request,
  { maxBytes = 128 * 1024 }: { maxBytes?: number } = {},
): Promise<unknown> {
  try {
    const type = request.headers.get("content-type") ?? "";
    if (type && !type.toLowerCase().includes("application/json")) return null;

    const declaredLength = Number(request.headers.get("content-length") ?? 0);
    if (declaredLength > maxBytes) return null;

    return await request.json();
  } catch {
    return null;
  }
}
