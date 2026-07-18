// parse body safely – bad json becomes null instead of throwing
export async function parseJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}
