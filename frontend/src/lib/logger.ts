/**
 * Client-side logger.
 *
 * `import.meta.env.DEV` is statically replaced by Vite, so in production
 * builds the body is `if (false)` and the debug calls are removed by the
 * minifier. Useful for notification/push diagnostics without leaking noise
 * (or user data) to end users.
 */
const isDev = import.meta.env.DEV;

export const logger = {
  debug(...args: unknown[]): void {
    if (isDev) console.log(...args);
  },
  info(...args: unknown[]): void {
    if (isDev) console.info(...args);
  },
};
