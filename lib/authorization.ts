import type { Role } from "@/lib/types";

const rank: Record<Role, number> = { USER: 0, MODERATOR: 1, ADMIN: 2 };

export function hasRole(actual: Role | undefined, required: Role) {
  return actual !== undefined && rank[actual] >= rank[required];
}

export function canEdit(authorId: string, actorId: string | undefined) {
  return actorId === authorId;
}

export function canManageUsers(role: Role | undefined) {
  return hasRole(role, "MODERATOR");
}

export function canModerate(role: Role | undefined) {
  return hasRole(role, "MODERATOR");
}

export function canActOnRole(actorRole: Role | undefined, targetRole: Role) {
  return actorRole !== undefined && rank[actorRole] > rank[targetRole];
}
