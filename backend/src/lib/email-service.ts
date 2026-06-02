import nodemailer from "nodemailer";
import { prisma } from "../config/database";
import { t, formatDate } from "./email-i18n";

let transporter: nodemailer.Transporter | null = null;

export interface EmailConfig {
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPassword: string;
  fromEmail: string;
  emailEnabled: boolean;
  emailSubject: string;
}

async function getConfig(): Promise<EmailConfig | null> {
  const rows = await prisma.systemSetting.findMany({
    where: { key: { in: ["smtpHost", "smtpPort", "smtpUser", "smtpPassword", "fromEmail", "emailEnabled", "emailSubject"] } },
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

export async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  const cfg = await getConfig();
  if (!cfg) return false;

  try {
    if (!transporter) {
      transporter = createTransporter(cfg);
    }
    await transporter.sendMail({
      from: cfg.fromEmail,
      to,
      subject,
      html,
    });
    return true;
  } catch (err) {
    console.error("[Email] Failed to send:", err);
    transporter = null; // reset on failure
    return false;
  }
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
  <style>
    :root { color-scheme: light dark; }
    body { margin:0; padding:0; background-color:#f4f7f6; font-family:'Urbanist',-apple-system,BlinkMacSystemFont,sans-serif; -webkit-font-smoothing:antialiased; }
    .outer { padding:32px 16px; }
    .container { max-width:520px; margin:0 auto; background:#ffffff; border-radius:20px; overflow:hidden; box-shadow:0 8px 40px rgba(0,0,0,0.06),0 2px 8px rgba(0,0,0,0.03); }
    .header { background:linear-gradient(135deg,#14B8A6 0%,#0D9488 100%); padding:36px 36px 32px; position:relative; overflow:hidden; }
    .header::before { content:''; position:absolute; top:-60px; right:-40px; width:180px; height:180px; background:rgba(255,255,255,0.06); border-radius:50%; }
    .header::after { content:''; position:absolute; bottom:-40px; left:-30px; width:120px; height:120px; background:rgba(255,255,255,0.04); border-radius:50%; }
    .header h1 { margin:0; color:#ffffff; font-family:'Outfit',sans-serif; font-size:22px; font-weight:600; letter-spacing:-0.02em; position:relative; z-index:1; }
    .header p { margin:6px 0 0; color:rgba(255,255,255,0.8); font-size:14px; font-weight:400; position:relative; z-index:1; }
    .body { padding:32px 36px 28px; }
    .body p { margin:0 0 14px; color:#374151; font-size:15px; line-height:1.7; }
    .greeting { font-weight:500; color:#111827; }
    .message { color:#6b7280; }
    .task-card { background:#f0fdfa; border:1px solid rgba(20,184,166,0.25); border-radius:14px; padding:18px 20px; margin:18px 0; }
    .task-card .item { color:#0f766e; font-family:'Outfit',sans-serif; font-size:17px; font-weight:600; letter-spacing:-0.01em; line-height:1.4; }
    .task-card .due { color:#6b7280; font-size:13px; margin-top:6px; display:flex; align-items:center; gap:6px; }
    .task-card .due::before { content:''; display:inline-block; width:5px; height:5px; background:#14B8A6; border-radius:50%; flex-shrink:0; }
    .btn-wrapper { margin:24px 0 8px; }
    .btn { display:inline-block; background:linear-gradient(135deg,#14B8A6 0%,#0D9488 100%); color:#ffffff; text-decoration:none; padding:13px 32px; border-radius:12px; font-family:'Outfit',sans-serif; font-size:15px; font-weight:600; letter-spacing:-0.01em; box-shadow:0 4px 14px rgba(20,184,166,0.3); }
    .footer { padding:20px 36px 28px; text-align:center; }
    .footer p { margin:0; color:#9ca3af; font-size:12px; line-height:1.6; }
    .footer .brand { font-weight:500; color:#14B8A6; font-size:13px; letter-spacing:0.02em; }
    .divider { height:1px; background:linear-gradient(to right,transparent,#e5e7eb,transparent); margin:0 36px; }
    @media (prefers-color-scheme:dark) {
      body { background-color:#0a0f1a; }
      .container { background:#0f1a2e; box-shadow:0 8px 40px rgba(0,0,0,0.3); }
      .body p { color:#cbd5e1; }
      .greeting { color:#e2e8f0; }
      .message { color:#94a3b8; }
      .task-card { background:rgba(20,184,166,0.08); border-color:rgba(20,184,166,0.2); }
      .task-card .item { color:#5eead4; }
      .task-card .due { color:#94a3b8; }
      .divider { background:linear-gradient(to right,transparent,#1e2d4a,transparent); }
      .footer p { color:#64748b; }
    }
  </style>
</head>
<body>
  <div class="outer">
    <div class="container">
      <div class="header">
        <h1>${t(lang, "headerTitle")}</h1>
        <p>MeleNotes</p>
      </div>
      <div class="body">
        <p class="greeting">${t(lang, "greeting").replace("{{username}}", username)}</p>
        <p class="message">${message}</p>
        ${hasDueDate ? `<div class="task-card">
          <div class="item">${title}</div>
          <div class="due">${t(lang, "dueLabel")} ${formatted}</div>
        </div>` : ""}
        <div class="btn-wrapper">
          <a href="${appUrl}" class="btn" target="_blank">${t(lang, "cta")}</a>
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
