import nodemailer, { type Transporter } from "nodemailer";
import { env } from "../env.js";

let transporter: Transporter | null = null;

if (env.SMTP_HOST && env.SMTP_PORT) {
  transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: env.SMTP_USER && env.SMTP_PASSWORD ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } : undefined,
  });
}

export const mailEnabled = () => transporter !== null;

async function send(to: string, subject: string, html: string) {
  if (!transporter) {
    console.info(`[mail] SMTP not configured — skipped "${subject}" → ${to}`);
    return { skipped: true };
  }
  const info = await transporter.sendMail({ from: env.MAIL_FROM, to, subject, html });
  return { skipped: false, messageId: info.messageId };
}

const shell = (title: string, body: string) => `
  <div style="font-family:ui-sans-serif,system-ui,sans-serif;background:#f6f8fb;padding:32px">
    <div style="max-width:520px;margin:0 auto;background:#fff;border:1px solid #e6e9f1;border-radius:14px;padding:28px">
      <p style="margin:0 0 4px;font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#2456d6">MC Nexus · Mission Control</p>
      <h1 style="margin:0 0 14px;font-size:20px;color:#16181d">${title}</h1>
      <div style="font-size:14px;line-height:1.6;color:#3b4149">${body}</div>
    </div>
  </div>`;

export const mail = {
  approvalRequested: (to: string, opts: { date: string; topic: string; url: string }) =>
    send(
      to,
      `Content ready for your review — ${opts.date}`,
      shell(
        "Content is ready for review",
        `<p><strong>${opts.topic}</strong> is scheduled for ${opts.date} and is waiting for your approval.</p>
         <p><a href="${opts.url}" style="display:inline-block;margin-top:12px;background:#2456d6;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Review content</a></p>`
      )
    ),

  reviewResult: (to: string, opts: { date: string; topic: string; approved: boolean; comment?: string }) =>
    send(
      to,
      `${opts.approved ? "Approved" : "Changes requested"} — ${opts.topic}`,
      shell(
        opts.approved ? "Content approved" : "Changes requested",
        `<p><strong>${opts.topic}</strong> (${opts.date}) was ${opts.approved ? "approved" : "sent back for changes"}.</p>
         ${opts.comment ? `<blockquote style="margin:12px 0;padding:10px 14px;background:#f6f8fb;border-left:3px solid #2456d6;border-radius:6px">${opts.comment}</blockquote>` : ""}`
      )
    ),

  deadlineReminder: (to: string, opts: { date: string; topic: string }) =>
    send(to, `Reminder: ${opts.topic} publishes ${opts.date}`, shell("Upcoming publish", `<p><strong>${opts.topic}</strong> goes live on ${opts.date}.</p>`)),
};
