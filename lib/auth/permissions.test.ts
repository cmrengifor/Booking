import { describe, expect, it } from "vitest";
import {
  canManageCatalog,
  canManageOwnership,
  canManageStaff,
  canModerateReviews,
  canViewAllAppointments,
  canViewAllCustomers,
  canViewCustomerContactInfo,
  canViewSalonFinancials,
} from "./permissions";

const ROLES = ["owner", "manager", "receptionist", "stylist"] as const;

function membership(role: (typeof ROLES)[number]) {
  return { role };
}

// Table-driven: which of the 4 salon roles each function should allow.
// Every function is asserted by name, even where two currently share an
// allow-set — permissions.ts's own doc comment says that's coincidental,
// not a reason to only check one and assume the other matches.
const CASES: {
  name: string;
  fn: (m: ReturnType<typeof membership> | null | undefined) => boolean;
  allowed: (typeof ROLES)[number][];
}[] = [
  { name: "canManageCatalog", fn: canManageCatalog, allowed: ["owner", "manager"] },
  { name: "canModerateReviews", fn: canModerateReviews, allowed: ["owner", "manager"] },
  { name: "canManageStaff", fn: canManageStaff, allowed: ["owner", "manager"] },
  { name: "canManageOwnership", fn: canManageOwnership, allowed: ["owner"] },
  { name: "canViewAllCustomers", fn: canViewAllCustomers, allowed: ["owner", "manager", "receptionist"] },
  { name: "canViewCustomerContactInfo", fn: canViewCustomerContactInfo, allowed: ["owner", "manager"] },
  { name: "canViewAllAppointments", fn: canViewAllAppointments, allowed: ["owner", "manager", "receptionist"] },
  { name: "canViewSalonFinancials", fn: canViewSalonFinancials, allowed: ["owner", "manager", "receptionist"] },
];

describe.each(CASES)("$name", ({ fn, allowed }) => {
  for (const role of ROLES) {
    const expected = allowed.includes(role);
    it(`returns ${expected} for role=${role}`, () => {
      expect(fn(membership(role))).toBe(expected);
    });
  }

  it("returns false for null membership", () => {
    expect(fn(null)).toBe(false);
  });

  it("returns false for undefined membership", () => {
    expect(fn(undefined)).toBe(false);
  });
});

describe("owner-only vs owner/manager boundary", () => {
  // The exact line Phase 3's role-change safeguards (RLS + update_staff_role
  // RPC) depend on at the UI layer: a manager can manage staff broadly but
  // must never be treated as able to touch ownership itself.
  it("canManageStaff(manager) is true but canManageOwnership(manager) is false", () => {
    expect(canManageStaff(membership("manager"))).toBe(true);
    expect(canManageOwnership(membership("manager"))).toBe(false);
  });

  it("canManageOwnership(owner) is true", () => {
    expect(canManageOwnership(membership("owner"))).toBe(true);
  });
});
