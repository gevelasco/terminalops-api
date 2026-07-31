import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { render } from '@react-email/render';
import { createElement, type ComponentType } from 'react';
import { Resend } from 'resend';
import EnvConfig from 'src/types/env-config.type';
import { InviteEmail } from './templates/invite.email';
import { PasswordResetEmail } from './templates/password-reset.email';
import { WelcomeEmail } from './templates/welcome.email';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly resend: Resend | null;

  constructor(private readonly config: ConfigService<EnvConfig>) {
    const apiKey = this.config.get('RESEND_API_KEY', { infer: true })?.trim();
    this.resend = apiKey ? new Resend(apiKey) : null;
    if (!this.resend) {
      this.logger.warn(
        'RESEND_API_KEY no configurada — los correos no se enviarán',
      );
    }
  }

  appBaseUrl(): string {
    const explicit = this.config.get('APP_URL', { infer: true })?.trim();
    if (explicit) {
      return explicit.replace(/\/$/, '');
    }
    const origin = this.config.get('ORIGIN', { infer: true })?.trim() ?? '';
    const first = origin.split(',')[0]?.trim();
    return (first || 'http://localhost:4200').replace(/\/$/, '');
  }

  async sendWelcome(params: {
    to: string;
    recipientName: string;
    companyName: string;
  }): Promise<void> {
    await this.sendTemplate(
      params.to,
      'Bienvenido a TerminalOps',
      WelcomeEmail,
      {
        recipientName: params.recipientName,
        companyName: params.companyName,
        loginUrl: `${this.appBaseUrl()}/login`,
      },
    );
  }

  async sendInvite(params: {
    to: string;
    recipientName: string;
    companyName: string;
    inviterName?: string;
    setPasswordToken: string;
  }): Promise<void> {
    const base = this.appBaseUrl();
    await this.sendTemplate(
      params.to,
      `Invitación a ${params.companyName} · TerminalOps`,
      InviteEmail,
      {
        recipientName: params.recipientName,
        companyName: params.companyName,
        inviterName: params.inviterName,
        email: params.to,
        setPasswordUrl: `${base}/reset-password?token=${encodeURIComponent(params.setPasswordToken)}`,
        loginUrl: `${base}/login`,
      },
    );
  }

  async sendPasswordReset(params: {
    to: string;
    recipientName: string;
    resetToken: string;
  }): Promise<void> {
    const resetUrl = `${this.appBaseUrl()}/reset-password?token=${encodeURIComponent(params.resetToken)}`;
    await this.sendTemplate(
      params.to,
      'Restablecer contraseña · TerminalOps',
      PasswordResetEmail,
      {
        recipientName: params.recipientName,
        resetUrl,
      },
    );
  }

  private async sendTemplate<P extends object>(
    to: string,
    subject: string,
    template: ComponentType<P>,
    props: P,
  ): Promise<void> {
    if (!this.resend) {
      this.logger.warn(`Email omitido (sin RESEND_API_KEY): ${subject} → ${to}`);
      return;
    }
    try {
      const html = await render(createElement(template, props));
      const { error } = await this.resend.emails.send({
        from:
          this.config.get('EMAIL_FROM', { infer: true })?.trim() ||
          'TerminalOps <noreply@terminalops.app>',
        to,
        subject,
        html,
      });
      if (error) {
        this.logger.error(`Failed to send email to ${to}: ${error.message}`);
      }
    } catch (err) {
      this.logger.error(
        `Failed to send email to ${to}`,
        err instanceof Error ? err.message : err,
      );
    }
  }
}
