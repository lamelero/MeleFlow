import type { TFunction } from "i18next";

const errorPatterns: [RegExp, string][] = [
  [/invalid (email|credentials|password)/i, "auth.errors.invalidCredentials"],
  [/email.*(taken|already exists|registered)/i, "auth.errors.emailTaken"],
  [/username.*(taken|already exists)/i, "auth.errors.usernameTaken"],
  [/unauthorized/i, "auth.errors.unauthorized"],
  [/forbidden/i, "auth.errors.forbidden"],
  [/not found/i, "auth.errors.notFound"],
  [/login failed/i, "auth.errors.loginFailed"],
  [/registration failed/i, "auth.errors.registrationFailed"],
];

export function translateAuthError(error: string, t: TFunction): string {
  for (const [pattern, key] of errorPatterns) {
    if (pattern.test(error)) {
      return t(key);
    }
  }
  return error || t("auth.errors.unknown");
}
