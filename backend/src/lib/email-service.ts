import nodemailer from "nodemailer";
import { prisma } from "../config/database";
import { t, formatDate } from "./email-i18n";
import { getCategoryIcon, TASK_ICON } from "./email-icons";

let transporter: nodemailer.Transporter | null = null;

export function resetTransport(): void {
  transporter = null;
}

export interface EmailConfig {
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPassword: string;
  fromEmail: string;
  fromName: string;
  emailEnabled: boolean;
  emailSubject: string;
}

async function getConfig(): Promise<EmailConfig | null> {
  const rows = await prisma.systemSetting.findMany({
    where: { key: { in: ["smtpHost", "smtpPort", "smtpUser", "smtpPassword", "fromEmail", "fromName", "emailEnabled", "emailSubject"] } },
  });
  const map: Record<string, string> = {};
  for (const r of rows) map[r.key] = r.value;

  if (!map.emailEnabled || map.emailEnabled !== "true") return null;
  if (!map.smtpHost || !map.smtpUser || !map.smtpPassword || !map.fromEmail) return null;

  return {
    smtpHost: map.smtpHost,
    smtpPort: Number(map.smtpPort) || 587,
    smtpUser: map.smtpUser,
    smtpPassword: map.smtpPassword,
    fromEmail: map.fromEmail,
    fromName: map.fromName || "MeleFlow",
    emailEnabled: true,
    emailSubject: map.emailSubject || "Reminder: {{title}} is due soon",
  };
}

function createTransporter(cfg: EmailConfig) {
  return nodemailer.createTransport({
    host: cfg.smtpHost,
    port: cfg.smtpPort,
    secure: cfg.smtpPort === 465,
    auth: { user: cfg.smtpUser, pass: cfg.smtpPassword },
  });
}

export async function isEmailConfigured(): Promise<boolean> {
  const cfg = await getConfig();
  return cfg !== null;
}

export function buildOTPEmail(code: string, lang = "en"): string {
  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <title>${t(lang, "otpSubject")}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@500;600;700&family=Urbanist:wght@400;500;600&display=swap" rel="stylesheet">
  <style>${baseStyle("#0857C3", "#181851")}</style>
</head>
<body>
  <div class="outer">
    <div class="container">
      <div class="header">
        <div class="header-text" style="text-align:center;width:100%;">
          <img src="https://bcproject.blu-castle.eu/logo-email.png?v=2" alt="BCProject" style="width:280px;height:auto;display:block;margin:0 auto 8px;" />
          <h1 style="text-align:center;">${t(lang, "otpSubject")}</h1>
        </div>
      </div>
      <div class="body" style="text-align:center;">
        <p class="greeting" style="text-align:center;">${t(lang, "otpSubject")}</p>
        <p style="color:#6b7280;font-size:16px;margin:24px 0 12px;text-align:center;">${t(lang, "otpBody").replace("{{code}}", `<span style="font-size:32px;font-weight:700;letter-spacing:8px;color:#0857C3;font-family:monospace;">${code}</span>`)}</p>
        <div style="background:#eef2ff;border-radius:16px;padding:20px;margin:24px auto;max-width:240px;border:1px solid #c7d2fe;">
          <div style="font-size:40px;font-weight:700;letter-spacing:12px;color:#0857C3;font-family:monospace;text-align:center;">${code}</div>
        </div>
        <p style="color:#9ca3af;font-size:13px;text-align:center;">${t(lang, "footerTagline")}</p>
      </div>
      <div class="divider"></div>
      <div class="footer">
        <p class="brand">${t(lang, "footerBrand")}</p>
      </div>
    </div>
  </div>
</body>
</html>`;
}

export function buildGenericEmail(title: string, bodyHtml: string, lang = "es"): string {
  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <title>${title}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@500;600;700&family=Urbanist:wght@400;500;600&display=swap" rel="stylesheet">
  <style>${baseStyle("#0857C3", "#181851")}</style>
</head>
<body>
  <div class="outer">
    <div class="container">
      <div class="header">
        <div class="header-text" style="text-align:center;width:100%;">
          <img src="https://bcproject.blu-castle.eu/logo-email.png?v=2" alt="BCProject" style="width:280px;height:auto;display:block;margin:0 auto 8px;" />
          <h1 style="text-align:center;">${title}</h1>
        </div>
      </div>
      <div class="body">
        ${bodyHtml}
      </div>
      <div class="divider"></div>
      <div class="footer">
        <p class="brand">BCProject</p>
        <p>Blu-Castle &mdash; Corporate project management</p>
      </div>
    </div>
  </div>
</body>
</html>`;
}

export async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  const cfg = await getConfig();
  if (!cfg) return false;

  try {
    if (!transporter) {
      transporter = createTransporter(cfg);
    }
    await transporter.sendMail({
      from: `"${cfg.fromName}" <${cfg.fromEmail}>`,
      to,
      subject,
      html,
    });
    return true;
  } catch (err) {
    console.error("[Email] Failed to send:", err);
    transporter = null;
    return false;
  }
}

function baseStyle(headerFrom: string, headerTo: string): string {
  return `
    :root { color-scheme: light dark; }
    body { margin:0; padding:0; background-color:#f2f6f5; font-family:'Urbanist',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Oxygen,Ubuntu,Cantarell,Helvetica,arial,sans-serif; -webkit-font-smoothing:antialiased; }
    .outer { padding:32px 16px; background:#f4f7f6; }
    .container { max-width:520px; margin:0 auto; background:#ffffff; border-radius:20px; overflow:hidden; box-shadow:0 8px 40px rgba(0,0,0,0.06),0 2px 8px rgba(0,0,0,0.03); }
    .header { background-color:${headerFrom}; background:linear-gradient(135deg,${headerFrom} 0%,${headerTo} 100%); padding:28px 36px; display:flex; align-items:center; gap:16px; }
    .header-text { }
    .header h1 { margin:0; color:#ffffff; font-family:'Outfit',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Oxygen,Ubuntu,Cantarell,Helvetica,arial,sans-serif; font-size:20px; font-weight:600; letter-spacing:-0.02em; line-height:1.3; }
    .header .sub { margin:2px 0 0; color:rgba(255,255,255,0.75); font-size:12px; font-weight:400; letter-spacing:0.04em; text-transform:uppercase; }
    .body { padding:28px 36px 24px; }
    .body p { margin:0 0 12px; color:#374151; font-size:15px; line-height:1.7; }
    .greeting { font-weight:600; color:#111827; font-size:16px; }
    .card { border-radius:14px; margin:16px 0; overflow:hidden; border:1px solid #e5e7eb; }
    .card-accent { height:4px; }
    .card-body { padding:16px 20px; }
    .card-title { font-family:'Outfit',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Oxygen,Ubuntu,Cantarell,Helvetica,arial,sans-serif; font-size:16px; font-weight:600; letter-spacing:-0.01em; line-height:1.4; color:#111827; }
    .card-meta { display:flex; align-items:center; gap:10px; margin-top:4px; flex-wrap:wrap; }
    .streak { display:inline-flex; align-items:center; gap:4px; font-size:12px; font-weight:600; padding:2px 10px; border-radius:20px; }
    .btn-wrapper { margin:20px 0 4px; }
    .btn { display:inline-block; background-color:#0857C3; background:linear-gradient(135deg,${headerFrom} 0%,${headerTo} 100%); color:#ffffff !important; text-decoration:none !important; padding:14px 36px; border-radius:12px; font-family:'Outfit',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Oxygen,Ubuntu,Cantarell,Helvetica,arial,sans-serif; font-size:16px; font-weight:600; letter-spacing:-0.01em; box-shadow:0 6px 20px rgba(8,87,195,0.3); border:1px solid rgba(255,255,255,0.15); }
    .footer { padding:20px 36px 28px; text-align:center; }
    .footer p { margin:0; color:#9ca3af; font-size:12px; line-height:1.6; }
    .footer .brand { font-weight:500; color:#0857C3; font-size:13px; letter-spacing:0.02em; font-family:'Outfit',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Oxygen,Ubuntu,Cantarell,Helvetica,arial,sans-serif; }
    .divider { height:1px; background:linear-gradient(to right,transparent,#e5e7eb,transparent); margin:0 36px; }
    @media (prefers-color-scheme:dark) {
      body { background-color:#0a0f1a; }
      .outer { background:#0a0f1a; }
      .container { background:#0f1a2e; box-shadow:0 8px 40px rgba(0,0,0,0.3); }
      .body p { color:#cbd5e1; }
      .greeting { color:#e2e8f0; }
      .card { border-color:#1e2d4a; }
      .card-title { color:#e2e8f0; }
      .divider { background:linear-gradient(to right,transparent,#1e2d4a,transparent); }
      .footer p { color:#64748b; }
    }
  `;
}

export function buildReminderEmail(
  username: string,
  title: string,
  message: string,
  dueDate: string,
  appUrl: string,
  lang = "en",
): string {
  const formatted = formatDate(dueDate, lang);
  const hasDueDate = !!dueDate;
  const icon = TASK_ICON;

  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <title>${t(lang, "headerTitle")}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@500;600;700&family=Urbanist:wght@400;500;600&display=swap" rel="stylesheet">
  <style>${baseStyle("#0857C3", "#181851")}</style>
</head>
<body>
  <div class="outer">
    <div class="container">
      <div class="header">
        <div class="header-text" style="text-align:center;width:100%;">
          <img src="https://bcproject.blu-castle.eu/logo-email.png?v=2" alt="BCProject" style="width:280px;height:auto;display:block;margin:0 auto 8px;" />
          <h1 style="text-align:center;">${t(lang, "headerTitle")}</h1>
        </div>
      </div>
      <div class="body">
        <p class="greeting">${t(lang, "greeting").replace("{{username}}", username)}</p>
        <p class="message">${message}</p>
        ${hasDueDate ? `<div class="card">
          <div class="card-accent" style="background:${icon.color}"></div>
          <div class="card-body">
            <div class="card-title">${title}</div>
            <div class="card-meta" style="margin-top:6px;">
              <span style="font-size:12px;color:#9ca3af;display:flex;align-items:center;gap:4px;">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                ${t(lang, "dueLabel")} ${formatted}
              </span>
            </div>
          </div>
        </div>` : `<div class="card">
          <div class="card-accent" style="background:${icon.color}"></div>
          <div class="card-body">
            <div class="card-title">${title}</div>
          </div>
        </div>`}
        <div class="btn-wrapper">
          <a href="${appUrl}" class="btn" target="_blank" style="color:#ffffff !important;text-decoration:none !important;">${t(lang, "cta")}</a>
        </div>
        <p style="color:#9ca3af;font-size:13px;margin-top:8px;">${t(lang, "footerTagline")}</p>
      </div>
      <div class="divider"></div>
      <div class="footer">
        <p class="brand">${t(lang, "footerBrand")}</p>
      </div>
    </div>
  </div>
</body>
</html>`;
}

export function buildHabitReminderEmail(
  username: string,
  habitName: string,
  category: string | null,
  streakCount: number,
  appUrl: string,
  lang = "en",
): string {
  const cat = getCategoryIcon(category);
  const icon = cat;
  const headerColor = icon.color;

  function darken(hex: string, amount: number): string {
    const num = parseInt(hex.slice(1), 16);
    const r = Math.max(0, (num >> 16) - amount);
    const g = Math.max(0, ((num >> 8) & 0xff) - amount);
    const b = Math.max(0, (num & 0xff) - amount);
    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
  }

  const headerTo = darken(headerColor, 30);

  const streakHtml = streakCount > 0
    ? `<span class="streak" style="background:${headerColor}1A;color:${headerColor}">🔥 ${t(lang, "streakBadge").replace("{{count}}", String(streakCount))}</span>`
    : "";

  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <title>${t(lang, "headerTitle")}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@500;600;700&family=Urbanist:wght@400;500;600&display=swap" rel="stylesheet">
  <style>${baseStyle(headerColor, headerTo)}</style>
</head>
<body>
  <div class="outer">
    <div class="container">
      <div class="header">
        <div class="header-text" style="text-align:center;width:100%;">
          <img src="https://bcproject.blu-castle.eu/logo-email.png?v=2" alt="BCProject" style="width:280px;height:auto;display:block;margin:0 auto 8px;" />
          <h1 style="text-align:center;">${habitName}</h1>
        </div>
      </div>
      <div class="body">
        <p class="greeting">${t(lang, "greeting").replace("{{username}}", username)}</p>
        <p class="message">${t(lang, "habitBody")}</p>
        <div class="card">
          <div class="card-accent" style="background:${headerColor}"></div>
          <div class="card-body">
            <div class="card-title">${habitName}</div>
            <div class="card-meta" style="margin-top:6px;">
              ${streakHtml}
            </div>
          </div>
        </div>
        <div class="btn-wrapper">
          <a href="${appUrl}" class="btn" target="_blank" style="color:#ffffff !important;text-decoration:none !important;">${t(lang, "cta")}</a>
        </div>
        <p style="color:#9ca3af;font-size:13px;margin-top:8px;">${t(lang, "footerTagline")}</p>
      </div>
      <div class="divider"></div>
      <div class="footer">
        <p class="brand">${t(lang, "footerBrand")}</p>
      </div>
    </div>
  </div>
</body>
</html>`;
}
