import { isNative } from "../capacitor/register";
import { getServerOrigin } from "../api/client";

export function resolveImageUrl(path: string | null | undefined): string | undefined {
  if (!path) return undefined;
  if (/^https?:\/\//.test(path)) return path;
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(path)) return undefined;
  if (isNative()) {
    const origin = getServerOrigin();
    if (origin) return `${origin}${path}`;
  }
  return path;
}
