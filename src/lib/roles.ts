export const ROLES = ["partner", "manager", "staff"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  partner: "Partner",
  manager: "Manager",
  staff: "Staff",
};

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

export type AppUser = {
  id: string;
  firm_id: string;
  name: string;
  email: string;
  mobile: string | null;
  role: Role;
  active: boolean;
  created_at: string;
};
