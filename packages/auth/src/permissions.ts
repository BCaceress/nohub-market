// RBAC — 5 papéis, permissões granulares por recurso (Etapa 2).

export const ROLES = ["owner", "admin", "manager", "operator", "viewer"] as const;
export type Role = (typeof ROLES)[number];

export const RESOURCES = [
  "location",
  "channel",
  "product",
  "inventory",
  "order",
  "supplier",
  "purchase",
  "report",
  "fiscal",
  "billing",
  "audit",
] as const;
export type Resource = (typeof RESOURCES)[number];

export type Action = "create" | "read" | "update" | "delete" | "manage";

type PermissionMatrix = Record<Role, Partial<Record<Resource, Action[]>>>;

const ALL: Action[] = ["create", "read", "update", "delete", "manage"];
const RW: Action[] = ["create", "read", "update"];
const RO: Action[] = ["read"];

export const PERMISSIONS: PermissionMatrix = {
  owner: Object.fromEntries(RESOURCES.map((r) => [r, ALL])) as PermissionMatrix["owner"],
  admin: {
    location: ALL,
    channel: ALL,
    product: ALL,
    inventory: ALL,
    order: ALL,
    supplier: ALL,
    purchase: ALL,
    report: RO,
    fiscal: RW,
    billing: RO,
    audit: RO,
  },
  manager: {
    location: RW,
    channel: RW,
    product: ALL,
    inventory: ALL,
    order: ALL,
    supplier: RW,
    purchase: RW,
    report: RO,
    fiscal: RO,
  },
  operator: {
    product: RO,
    inventory: RW,
    order: RW,
    purchase: RO,
  },
  viewer: {
    location: RO,
    channel: RO,
    product: RO,
    inventory: RO,
    order: RO,
    supplier: RO,
    purchase: RO,
    report: RO,
  },
};

export function can(role: Role, resource: Resource, action: Action): boolean {
  const allowed = PERMISSIONS[role]?.[resource];
  if (!allowed) return false;
  return allowed.includes("manage") || allowed.includes(action);
}
