import type { Role } from "@/lib/types";

// USER < MODERATOR < ADMIN
const rank: Record<Role, number> = { USER: 0, MODERATOR: 1, ADMIN: 2 };

export function hasRole(actual: Role | undefined, required: Role) {
  return actual !== undefined && rank[actual] >= rank[required];
}

// only the author can edit their own post directly
export function canEdit(authorId: string, actorId: string | undefined) {
  return actorId === authorId;
}

export function canManageUsers(role: Role | undefined) {
  return hasRole(role, "MODERATOR");
}

export function canModerate(role: Role | undefined) {
  return hasRole(role, "MODERATOR");
}

// mods can act on users, but not on other mods/admins
export function canActOnRole(actorRole: Role | undefined, targetRole: Role) {
  return actorRole !== undefined && rank[actorRole] > rank[targetRole];
}
