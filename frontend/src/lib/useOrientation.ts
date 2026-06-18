import { useState, useEffect } from "react";

export function useOrientation(): "portrait" | "landscape" {
  const [orientation, setOrientation] = useState<"portrait" | "landscape">(
    typeof window !== "undefined"
      ? window.matchMedia("(orientation: landscape)").matches
        ? "landscape"
        : "portrait"
      : "portrait",
  );

  useEffect(() => {
    const mql = window.matchMedia("(orientation: landscape)");
    const handler = (e: MediaQueryListEvent) =>
      setOrientation(e.matches ? "landscape" : "portrait");
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  return orientation;
}
