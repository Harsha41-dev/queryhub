import type { EmailMessage } from "@/lib/email/provider";

function escapeHtml(value: string) {
  return value.replace(
    /[&<>'"]/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "'": "&#39;",
        '"': "&quot;",
      })[character]!,
  );
}

function actionTemplate(input: {
  to: string;
  name: string;
  subject: string;
  intro: string;
  action: string;
  url: string;
  expires: string;
}): EmailMessage {
  const name = escapeHtml(input.name);
  const intro = escapeHtml(input.intro);
  const url = escapeHtml(input.url);
  return {
    to: input.to,
    subject: input.subject,
    text: `Hello ${input.name},\n\n${input.intro}\n\n${input.action}: ${input.url}\n\nThis link expires ${input.expires}. If you did not request this, you can ignore this message.`,
    html: `<p>Hello ${name},</p><p>${intro}</p><p><a href="${url}">${escapeHtml(input.action)}</a></p><p>This link expires ${escapeHtml(input.expires)}. If you did not request this, you can ignore this message.</p>`,
  };
}

export function verificationEmail(input: {
  to: string;
  name: string;
  url: string;
}) {
  return actionTemplate({
    ...input,
    subject: "Verify your QueryHub email",
    intro: "Confirm that this email address belongs to your QueryHub account.",
    action: "Verify email",
    expires: "in 24 hours",
  });
}

export function passwordResetEmail(input: {
  to: string;
  name: string;
  url: string;
}) {
  return actionTemplate({
    ...input,
    subject: "Reset your QueryHub password",
    intro: "A password reset was requested for your QueryHub account.",
    action: "Reset password",
    expires: "in 30 minutes",
  });
}

export function emailChangeEmail(input: {
  to: string;
  name: string;
  url: string;
}) {
  return actionTemplate({
    ...input,
    subject: "Confirm your new QueryHub email",
    intro:
      "Confirm this address to finish changing your QueryHub sign-in email.",
    action: "Confirm email change",
    expires: "in 60 minutes",
  });
}

export function securityNotificationEmail(input: {
  to: string;
  name: string;
  event: string;
}): EmailMessage {
  return {
    to: input.to,
    subject: "QueryHub security notification",
    text: `Hello ${input.name},\n\n${input.event}\n\nIf this was not you, reset your password and contact the site administrator.`,
    html: `<p>Hello ${escapeHtml(input.name)},</p><p>${escapeHtml(input.event)}</p><p>If this was not you, reset your password and contact the site administrator.</p>`,
  };
}
