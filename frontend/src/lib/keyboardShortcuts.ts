type ShortcutHandler = () => void;

interface Shortcut {
  key: string;
  ctrl?: boolean;
  handler: ShortcutHandler;
  description: string;
}

let shortcuts: Shortcut[] = [];
let listener: ((e: KeyboardEvent) => void) | null = null;

export function registerShortcut(key: string, handler: ShortcutHandler, ctrl = false) {
  shortcuts.push({ key: key.toLowerCase(), ctrl, handler, description: "" });
  updateListener();
}

export function registerShortcuts(handlers: Record<string, ShortcutHandler>) {
  for (const [key, handler] of Object.entries(handlers)) {
    const ctrl = key.startsWith("ctrl+");
    const k = ctrl ? key.slice(5) : key;
    shortcuts.push({ key: k.toLowerCase(), ctrl, handler, description: "" });
  }
  updateListener();
}

export function clearShortcuts() {
  shortcuts = [];
  if (listener) {
    document.removeEventListener("keydown", listener);
    listener = null;
  }
}

function updateListener() {
  if (listener) {
    document.removeEventListener("keydown", listener);
  }
  listener = (e: KeyboardEvent) => {
    const target = e.target as HTMLElement;
    if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) {
      // Don't trigger shortcuts when typing
      return;
    }
    for (const s of shortcuts) {
      if (s.ctrl && !(e.ctrlKey || e.metaKey)) continue;
      if (e.key.toLowerCase() === s.key && (!s.ctrl || e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        s.handler();
        return;
      }
    }
  };
  document.addEventListener("keydown", listener);
}
