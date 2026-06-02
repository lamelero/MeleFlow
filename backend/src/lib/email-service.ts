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

export function buildReminderEmail(username: string, body: string, dueDate: string, appUrl: string, lang = "en"): string {
  const formatted = formatDate(dueDate, lang);

  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${t(lang, "headerTitle")}</title>
  <style>
    body { margin:0; padding:0; background-color:#f4f9f9; font-family:'Segoe UI',Arial,sans-serif; }
    .container { max-width:520px; margin:40px auto; background:#ffffff; border-radius:16px; overflow:hidden; box-shadow:0 4px 24px rgba(0,0,0,0.06); }
    .header { background:#14B8A6; padding:28px 32px; }
    .header h1 { margin:0; color:#fff; font-size:20px; font-weight:600; }
    .body { padding:32px; }
    .body p { margin:0 0 12px; color:#374151; font-size:15px; line-height:1.6; }
    .task-card { background:#f0fdfa; border:1px solid #14B8A6; border-radius:12px; padding:16px; margin:16px 0; }
    .task-card .title { color:#0f766e; font-size:18px; font-weight:600; }
    .task-card .due { color:#6b7280; font-size:13px; margin-top:4px; }
    .btn { display:inline-block; background:#14B8A6; color:#fff; text-decoration:none; padding:12px 28px; border-radius:10px; font-size:15px; font-weight:500; margin-top:16px; }
    .footer { padding:24px 32px; text-align:center; color:#9ca3af; font-size:12px; border-top:1px solid #f3f4f6; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${t(lang, "headerTitle")}</h1>
    </div>
    <div class="body">
      <p>${t(lang, "greeting").replace("{{username}}", username)}</p>
      <p>${body}</p>
      ${dueDate ? `<div class="task-card">
        <div class="due">${t(lang, "dueLabel")} ${formatted}</div>
      </div>` : ""}
      <a href="${appUrl}" class="btn" target="_blank">${t(lang, "cta")}</a>
      <p style="margin-top:16px;color:#9ca3af;font-size:13px;">${t(lang, "footerTagline")}</p>
    </div>
    <div class="footer">
      ${t(lang, "footerBrand")}
    </div>
  </div>
</body>
</html>`;
}
