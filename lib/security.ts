const unsafeMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function isUnsafeMethod(method: string) {
  return unsafeMethods.has(method.toUpperCase());
}

export function originFromUrl(value: string | null | undefined) {
  if (!value?.trim()) return undefined;
  try {
    return new URL(value).origin;
  } catch {
    return undefined;
  }
}

export function isMutationOriginAllowed({
  method,
  requestUrl,
  origin,
  host,
  forwardedProto,
  secFetchSite,
  allowedOrigins = [],
}: {
  method: string;
  requestUrl: string;
  origin?: string | null;
  host?: string | null;
  forwardedProto?: string | null;
  secFetchSite?: string | null;
  allowedOrigins?: Array<string | undefined>;
}) {
  if (!isUnsafeMethod(method)) return true;
  if (secFetchSite === "cross-site") return false;

  const request = new URL(requestUrl);
  const proto = forwardedProto?.split(",")[0]?.trim() || request.protocol;
  const hostOrigin = host ? `${proto.replace(/:$/, "")}://${host}` : undefined;
  const originValue = originFromUrl(origin);

  if (!originValue) return true;

  const trusted = new Set(
    [request.origin, originFromUrl(hostOrigin), ...allowedOrigins].filter(
      (value): value is string => Boolean(value),
    ),
  );

  return trusted.has(originValue);
}
