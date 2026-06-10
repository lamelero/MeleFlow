import { isNative } from "../capacitor/register";
import { getServerOrigin } from "../api/client";

export function resolveImageUrl(path: string | null | undefined): string | undefined {
  if (!path) return undefined;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  if (isNative()) {
    const origin = getServerOrigin();
    if (origin) return `${origin}${path}`;
  }
  return path;
}
