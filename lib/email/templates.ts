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

function activityTemplate(input: {
  to: string;
  name: string;
  subject: string;
  intro: string;
  action: string;
  url: string;
}): EmailMessage {
  const name = escapeHtml(input.name);
  const intro = escapeHtml(input.intro);
  const url = escapeHtml(input.url);
  return {
    to: input.to,
    subject: input.subject,
    text: `Hello ${input.name},\n\n${input.intro}\n\n${input.action}: ${input.url}`,
    html: `<p>Hello ${name},</p><p>${intro}</p><p><a href="${url}">${escapeHtml(input.action)}</a></p>`,
  };
}

export function answerRequestEmail(input: {
  to: string;
  name: string;
  actor: string;
  question: string;
  url: string;
}): EmailMessage {
  return activityTemplate({
    to: input.to,
    name: input.name,
    subject: `${input.actor} requested your answer on QueryHub`,
    intro: `${input.actor} asked you to answer: ${input.question}`,
    action: "Open question",
    url: input.url,
  });
}

export function newAnswerEmail(input: {
  to: string;
  name: string;
  actor: string;
  question: string;
  url: string;
}): EmailMessage {
  return activityTemplate({
    to: input.to,
    name: input.name,
    subject: `${input.actor} answered on QueryHub`,
    intro: `${input.actor} answered a question you follow: ${input.question}`,
    action: "Read answer",
    url: input.url,
  });
}

export function commentNotificationEmail(input: {
  to: string;
  name: string;
  actor: string;
  question: string;
  url: string;
  reply: boolean;
}): EmailMessage {
  return activityTemplate({
    to: input.to,
    name: input.name,
    subject: input.reply
      ? `${input.actor} replied to you on QueryHub`
      : `${input.actor} commented on your answer`,
    intro: input.reply
      ? `${input.actor} replied in a discussion on: ${input.question}`
      : `${input.actor} commented on your answer to: ${input.question}`,
    action: "Open discussion",
    url: input.url,
  });
}

export function followerNotificationEmail(input: {
  to: string;
  name: string;
  actor: string;
  url: string;
}): EmailMessage {
  return activityTemplate({
    to: input.to,
    name: input.name,
    subject: `${input.actor} followed you on QueryHub`,
    intro: `${input.actor} started following your profile.`,
    action: "View profile",
    url: input.url,
  });
}

export function acceptedAnswerEmail(input: {
  to: string;
  name: string;
  question: string;
  url: string;
}): EmailMessage {
  return activityTemplate({
    to: input.to,
    name: input.name,
    subject: "Your answer was marked best on QueryHub",
    intro: `Your answer was selected as the best answer for: ${input.question}`,
    action: "View answer",
    url: input.url,
  });
}

export function spacePostEmail(input: {
  to: string;
  name: string;
  space: string;
  question: string;
  url: string;
}): EmailMessage {
  return activityTemplate({
    to: input.to,
    name: input.name,
    subject: `New Space activity in ${input.space}`,
    intro: `A question needs attention in ${input.space}: ${input.question}`,
    action: "Open Space",
    url: input.url,
  });
}

export function spaceReviewEmail(input: {
  to: string;
  name: string;
  space: string;
  question: string;
  approved: boolean;
  url: string;
}): EmailMessage {
  return activityTemplate({
    to: input.to,
    name: input.name,
    subject: input.approved
      ? `Your submission was approved in ${input.space}`
      : `Your submission was reviewed in ${input.space}`,
    intro: input.approved
      ? `Your question was approved in ${input.space}: ${input.question}`
      : `A moderator reviewed your submission in ${input.space}: ${input.question}`,
    action: input.approved ? "View question" : "Open Space",
    url: input.url,
  });
}

export function weeklyDigestEmail(input: {
  to: string;
  name: string;
  url: string;
  items: Array<{
    message: string;
    detail: string;
    href: string;
  }>;
}): EmailMessage {
  const lines = input.items.map(
    (item) => `- ${item.message} (${item.detail}): ${input.url}${item.href}`,
  );
  const htmlItems = input.items
    .map(
      (item) =>
        `<li><a href="${escapeHtml(`${input.url}${item.href}`)}">${escapeHtml(
          item.message,
        )}</a><br><small>${escapeHtml(item.detail)}</small></li>`,
    )
    .join("");
  return {
    to: input.to,
    subject: "Your QueryHub weekly digest",
    text: `Hello ${input.name},\n\nHere is what happened on QueryHub this week:\n\n${lines.join(
      "\n",
    )}\n\nOpen QueryHub: ${input.url}/notifications`,
    html: `<p>Hello ${escapeHtml(input.name)},</p><p>Here is what happened on QueryHub this week:</p><ul>${htmlItems}</ul><p><a href="${escapeHtml(
      `${input.url}/notifications`,
    )}">Open QueryHub</a></p>`,
  };
}
