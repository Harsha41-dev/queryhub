import { describe, expect, it } from "vitest";
import {
  canActOnRole,
  canEdit,
  canManageUsers,
  canModerate,
  hasRole,
} from "@/lib/authorization";

describe("role-based authorization", () => {
  it("honors the role hierarchy", () => {
    expect(hasRole("ADMIN", "MODERATOR")).toBe(true);
    expect(hasRole("MODERATOR", "ADMIN")).toBe(false);
    expect(canModerate("MODERATOR")).toBe(true);
    expect(canManageUsers("MODERATOR")).toBe(true);
    expect(canActOnRole("MODERATOR", "USER")).toBe(true);
    expect(canActOnRole("MODERATOR", "ADMIN")).toBe(false);
  });

  it("allows only owners to edit content directly", () => {
    expect(canEdit("author", "author")).toBe(true);
    expect(canEdit("author", "someone-else")).toBe(false);
    expect(canEdit("author", "moderator")).toBe(false);
  });
});
