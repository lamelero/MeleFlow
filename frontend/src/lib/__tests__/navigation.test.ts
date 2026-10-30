import { describe, it, expect, vi, afterEach } from "vitest";
import { setNavigator, navigateTo } from "../navigation";

afterEach(() => setNavigator(null));

describe("navigation bridge", () => {
  it("routes through the registered navigator", () => {
    const nav = vi.fn();
    setNavigator(nav);
    navigateTo("/app?view=habits");
    expect(nav).toHaveBeenCalledWith("/app?view=habits");
  });

  it("stops using the navigator after it is cleared", () => {
    const nav = vi.fn();
    setNavigator(nav);
    setNavigator(null);
    const assign = vi.fn();
    // jsdom's location.assign is not implemented; stub it for the fallback path.
    const original = window.location.assign;
    Object.defineProperty(window, "location", { value: { assign }, writable: true });
    navigateTo("/app?view=tasks");
    expect(nav).not.toHaveBeenCalled();
    expect(assign).toHaveBeenCalledWith("/app?view=tasks");
    Object.defineProperty(window, "location", { value: original, writable: true });
  });
});
