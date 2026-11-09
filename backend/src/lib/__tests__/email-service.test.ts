import { describe, it, expect } from "vitest";
import { buildOTPEmail, buildGenericEmail } from "../email-service";

describe("email templates branding", () => {
  it("OTP email has no hardcoded BCProject branding", () => {
    const html = buildOTPEmail("123456", "es");
    expect(html.toLowerCase()).not.toContain("bcproject");
    expect(html).not.toContain("blu-castle");
    // Brand is injected at send time by renderBrand().
    expect(html).toContain("{{brandHeader}}");
    expect(html).toContain("123456");
  });

  it("generic email has no hardcoded BCProject branding", () => {
    const html = buildGenericEmail("Hi", "<p>body</p>", "en");
    expect(html.toLowerCase()).not.toContain("bcproject");
    expect(html).toContain("{{brandHeader}}");
    expect(html).toContain("{{brandName}}");
  });
});
