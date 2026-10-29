import { describe, it, expect } from "vitest";
import { compareVersions, isNewer, parseVersion } from "../updateChecker";

describe("parseVersion", () => {
  it("parses full, partial and v-prefixed versions", () => {
    expect(parseVersion("1.3.1")).toMatchObject({ major: 1, minor: 3, patch: 1, pre: null });
    expect(parseVersion("v1.3.1")).toMatchObject({ major: 1, minor: 3, patch: 1 });
    expect(parseVersion("1.3")).toMatchObject({ major: 1, minor: 3, patch: 0 });
    expect(parseVersion("1.3.1-beta.2")).toMatchObject({ patch: 1, pre: "beta.2" });
  });

  it("returns null for non-numeric versions", () => {
    expect(parseVersion("dev")).toBeNull();
    expect(parseVersion("")).toBeNull();
  });
});

describe("compareVersions", () => {
  it("orders by major, minor and patch", () => {
    expect(compareVersions("1.3.1", "1.3.0")).toBeGreaterThan(0);
    expect(compareVersions("1.3.0", "1.4.0")).toBeLessThan(0);
    expect(compareVersions("2.0.0", "1.9.9")).toBeGreaterThan(0);
  });

  it("treats equal versions (with or without v) as equal", () => {
    expect(compareVersions("1.3.1", "1.3.1")).toBe(0);
    expect(compareVersions("v1.3.1", "1.3.1")).toBe(0);
  });

  it("ranks a final release above its pre-releases", () => {
    expect(compareVersions("1.3.1", "1.3.1-beta.1")).toBeGreaterThan(0);
    expect(compareVersions("1.3.1-beta.1", "1.3.1-beta.2")).toBeLessThan(0);
  });

  it("treats unparseable versions as equal (never triggers an update)", () => {
    expect(compareVersions("1.3.1", "dev")).toBe(0);
  });
});

describe("isNewer", () => {
  it("is true only for strictly newer remote versions", () => {
    expect(isNewer("1.3.2", "1.3.1")).toBe(true);
    expect(isNewer("1.3.1", "1.3.1")).toBe(false);
    // Downgrade must NOT be offered (the old `!==` check offered it).
    expect(isNewer("1.2.0", "1.3.1")).toBe(false);
    expect(isNewer("dev", "1.3.1")).toBe(false);
  });
});
