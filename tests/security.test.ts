import { describe, expect, it } from "vitest";
import {
  isMutationOriginAllowed,
  isUnsafeMethod,
  originFromUrl,
} from "@/lib/security";

describe("mutation origin protection", () => {
  it("allows safe reads and same-origin mutations", () => {
    expect(isUnsafeMethod("GET")).toBe(false);
    expect(isUnsafeMethod("POST")).toBe(true);
    expect(
      isMutationOriginAllowed({
        method: "POST",
        requestUrl: "https://queryhub.example.com/api/questions",
        origin: "https://queryhub.example.com",
        host: "queryhub.example.com",
        forwardedProto: "https",
      }),
    ).toBe(true);
  });

  it("rejects browser cross-site mutations", () => {
    expect(
      isMutationOriginAllowed({
        method: "POST",
        requestUrl: "https://queryhub.example.com/api/questions",
        origin: "https://evil.example",
        host: "queryhub.example.com",
        forwardedProto: "https",
        secFetchSite: "cross-site",
      }),
    ).toBe(false);
  });

  it("accepts configured production origins behind a proxy", () => {
    expect(originFromUrl("https://queryhub.example.com/home")).toBe(
      "https://queryhub.example.com",
    );
    expect(
      isMutationOriginAllowed({
        method: "PATCH",
        requestUrl: "http://internal:3000/api/settings/profile",
        origin: "https://queryhub.example.com",
        host: "internal:3000",
        forwardedProto: "http",
        allowedOrigins: ["https://queryhub.example.com"],
      }),
    ).toBe(true);
  });
});
