import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, type Transporter } from 'nodemailer';
import type { Env } from 'src/config/env';
import {
  brandSettings,
  mailFrom,
  smtpSettings,
  type Brand,
} from './mail.config';
import type { EmailContent } from './templates';

export type MailAttachment = {
  filename: string;
  content: Buffer | string;
  contentType?: string;
};

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter?: Transporter | null;

  constructor(private readonly config: ConfigService<Env, true>) {}

  brand(): Brand {
    return brandSettings(this.config);
  }

  private transport(): Transporter | null {
    if (this.transporter === undefined) {
      const smtp = smtpSettings(this.config);
      this.transporter = smtp ? createTransport(smtp) : null;
    }
    return this.transporter;
  }

  async send(
    to: string,
    email: EmailContent,
    {
      replyTo,
      headers,
      attachments,
    }: {
      replyTo?: string;
      headers?: Record<string, string>;
      attachments?: MailAttachment[];
    } = {},
  ): Promise<void> {
    const transport = this.transport();
    if (!transport) {
      this.logger.warn(
        `SMTP_HOST is not set: printing the email to ${to} instead of sending it\nSubject: ${email.subject}\n\n${email.text}`,
      );
      return;
    }
    await transport.sendMail({
      from: mailFrom(this.config),
      to,
      subject: email.subject,
      html: email.html,
      text: email.text,
      ...(replyTo && { replyTo }),
      ...(headers && { headers }),
      ...(attachments?.length && { attachments }),
    });
    this.logger.log(
      `Sent "${email.subject}" to ${to.replace(/(^.).*(@.*$)/, '$1***$2')}`,
    );
  }
}
