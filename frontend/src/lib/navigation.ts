/**
 * Navigation bridge.
 *
 * Lets non-React code (notification handlers, native listeners) drive the
 * router without importing it. `App` registers the react-router `navigate`
 * function on mount; elsewhere we fall back to a normal location change.
 */
type Navigator = (path: string) => void;

let currentNavigator: Navigator | null = null;

export function setNavigator(fn: Navigator | null): void {
  currentNavigator = fn;
}

export function navigateTo(path: string): void {
  if (currentNavigator) {
    currentNavigator(path);
    return;
  }
  // Fallback (e.g. handler fires before App mounts): full navigation.
  window.location.assign(path);
}
