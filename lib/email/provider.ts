import "server-only";

import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

// send email via Resend in prod, or just log it locally
export async function sendEmail(message: EmailMessage) {
  if (env.EMAIL_PROVIDER === "resend") {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${env.RESEND_API_KEY}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from: env.EMAIL_FROM,
        reply_to: env.EMAIL_REPLY_TO,
        ...message,
      }),
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok)
      throw new Error(`Email send failed with status ${response.status}`);
    return;
  }

  // local/dev: print the email so we can click links without Resend
  logger.info("email.development", message);
}

export async function emailHealth() {
  if (env.EMAIL_PROVIDER === "resend") return Boolean(env.RESEND_API_KEY);
  return true;
}
