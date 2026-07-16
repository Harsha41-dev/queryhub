import "server-only";

import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

export interface EmailProvider {
  send(message: EmailMessage): Promise<void>;
  health(): Promise<boolean>;
}

export class LogEmailProvider implements EmailProvider {
  async send(message: EmailMessage) {
    // APP_ENV=production rejects this provider. Raw development links are
    // intentionally visible locally so workflows can be exercised without a
    // third-party account.
    logger.info("email.development", message);
  }

  async health() {
    return true;
  }
}

class ResendEmailProvider implements EmailProvider {
  async send(message: EmailMessage) {
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
      throw new Error(`Email provider returned ${response.status}`);
  }

  async health() {
    return Boolean(env.RESEND_API_KEY);
  }
}

const provider: EmailProvider =
  env.EMAIL_PROVIDER === "resend"
    ? new ResendEmailProvider()
    : new LogEmailProvider();

export function sendEmail(message: EmailMessage) {
  return provider.send(message);
}

export function emailHealth() {
  return provider.health();
}
