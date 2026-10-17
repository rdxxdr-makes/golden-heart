import { describe, expect, it } from "vitest";
import { hasPortalAccess } from "@/lib/access";
import { readFileSync } from "node:fs";

describe("portal access", () => {
  it("blocks accounts without a verified portal role", () => {
    expect(hasPortalAccess(undefined)).toBe(false);
    expect(hasPortalAccess([])).toBe(false);
    expect(hasPortalAccess(["fake-admin"])).toBe(false);
  });
  it("accepts both backend-issued portal roles", () => {
    expect(hasPortalAccess(["user"])).toBe(true);
    expect(hasPortalAccess(["admin"])).toBe(true);
  });
  const sql = readFileSync("drizzle/migrations/0005_portal_access_and_posting_profile.sql", "utf8");
  it("requires a profile for posting, not browsing", () => {
    expect(sql).toContain("BEFORE INSERT ON public.listings");
    expect(sql).toContain("WHERE id = NEW.owner_id");
  });
  it("requires an immutable profile device", () => {
    expect(sql).toContain("NEW.device_id IS NULL");
    expect(sql).toContain("NEW.device_id IS DISTINCT FROM OLD.device_id");
  });
});