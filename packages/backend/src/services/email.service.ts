import nodemailer from 'nodemailer';
import { AppDataSource } from '../config/database';

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

class EmailService {
  private transporter: nodemailer.Transporter | null = null;
  private fromEmail: string | null = null;

  constructor() {
    // Inicializa com fallback no .env. Sera re-inicializado quando alguem
    // chamar reinitialize() apos salvar credenciais no banco.
    this.initializeTransporter().catch(() => {});
  }

  /** Le credenciais do banco (tabela configurations) com fallback .env */
  private async loadCredentials(): Promise<{ user: string; pass: string } | null> {
    let user = process.env.EMAIL_USER || '';
    let pass = process.env.EMAIL_PASS || '';

    // Tenta sobrescrever com config do banco
    try {
      if (AppDataSource.isInitialized) {
        const rows = await AppDataSource.query(
          `SELECT key, value FROM configurations WHERE key IN ('email_user', 'email_pass')`
        );
        for (const r of rows) {
          if (r.key === 'email_user' && r.value) user = r.value;
          if (r.key === 'email_pass' && r.value) pass = r.value;
        }
      }
    } catch (err: any) {
      console.warn('[email.service] erro lendo credenciais do banco:', err?.message);
    }

    if (!user || !pass) return null;
    return { user, pass };
  }

  /** Inicializa/reinicializa o transporter. Pode ser chamado em runtime apos salvar email. */
  async initializeTransporter(): Promise<void> {
    const creds = await this.loadCredentials();

    if (!creds) {
      console.warn('⚠️ Email não configurado (sem EMAIL_USER/EMAIL_PASS no .env nem em configurations)');
      this.transporter = null;
      this.fromEmail = null;
      return;
    }

    this.fromEmail = creds.user;

    try {
      const isGmail = creds.user.includes('@gmail.com');
      const isYahoo = creds.user.includes('@yahoo.com');

      if (isGmail) {
        this.transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: { user: creds.user, pass: creds.pass }
        });
        console.log(`✅ Email service initialized (Gmail): ${creds.user}`);
      } else if (isYahoo) {
        this.transporter = nodemailer.createTransport({
          host: 'smtp.mail.yahoo.com',
          port: 465,
          secure: true,
          auth: { user: creds.user, pass: creds.pass }
        });
        console.log(`✅ Email service initialized (Yahoo): ${creds.user}`);
      } else {
        this.transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST || 'smtp.gmail.com',
          port: parseInt(process.env.SMTP_PORT || '587'),
          secure: process.env.SMTP_SECURE === 'true',
          auth: { user: creds.user, pass: creds.pass }
        });
        console.log(`✅ Email service initialized (SMTP custom): ${creds.user}`);
      }
    } catch (error) {
      console.error('❌ Erro ao inicializar serviço de email:', error);
      this.transporter = null;
    }
  }

  /** Atalho publico pro controller chamar apos salvar email no banco */
  async reinitialize(): Promise<void> {
    await this.initializeTransporter();
  }

  async sendEmail(options: SendEmailOptions): Promise<boolean> {
    // Se transporter caiu / nao foi inicializado, tenta reinicializar uma vez
    if (!this.transporter) {
      console.warn('⚠️ Transporter null, tentando reinicializar do banco...');
      await this.initializeTransporter();
    }

    if (!this.transporter) {
      console.error('❌ Transporter de email não está configurado');
      return false;
    }

    try {
      const info = await this.transporter.sendMail({
        from: `"Kontrata.ai" <${this.fromEmail || process.env.EMAIL_USER}>`,
        to: options.to,
        subject: options.subject,
        text: options.text || '',
        html: options.html
      });

      console.log('✅ Email enviado:', info.messageId);
      return true;
    } catch (error) {
      console.error('❌ Erro ao enviar email:', error);
      return false;
    }
  }

  async sendPasswordRecoveryEmail(email: string, resetUrl: string, userName: string): Promise<boolean> {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .header {
            background-color: #6B21A8;
            color: white;
            padding: 20px;
            text-align: center;
            border-radius: 5px 5px 0 0;
          }
          .content {
            background-color: #f9f9f9;
            padding: 30px;
            border-radius: 0 0 5px 5px;
          }
          .button {
            display: inline-block;
            padding: 12px 30px;
            background-color: #6B21A8;
            color: white;
            text-decoration: none;
            border-radius: 5px;
            margin: 20px 0;
          }
          .footer {
            text-align: center;
            margin-top: 20px;
            font-size: 12px;
            color: #666;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Kontrata.ai</h1>
          </div>
          <div class="content">
            <h2>Recuperação de Senha</h2>
            <p>Olá ${userName},</p>
            <p>Você solicitou a recuperação de senha para sua conta no sistema Kontrata.ai.</p>
            <p>Clique no botão abaixo para redefinir sua senha:</p>
            <p style="text-align: center;">
              <a href="${resetUrl}" class="button">Redefinir Senha</a>
            </p>
            <p>Ou copie e cole este link no seu navegador:</p>
            <p style="word-break: break-all; background-color: #eee; padding: 10px; border-radius: 3px;">
              ${resetUrl}
            </p>
            <p><strong>Este link é válido por 1 hora.</strong></p>
            <p>Se você não solicitou esta recuperação, ignore este email. Sua senha permanecerá inalterada.</p>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} Kontrata.ai - Todos os direitos reservados</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
Recuperação de Senha - Kontrata.ai

Olá ${userName},

Você solicitou a recuperação de senha para sua conta.

Para redefinir sua senha, acesse o link abaixo:
${resetUrl}

Este link é válido por 1 hora.

Se você não solicitou esta recuperação, ignore este email.

---
© ${new Date().getFullYear()} Kontrata.ai
    `;

    return this.sendEmail({
      to: email,
      subject: 'Recuperação de Senha - Kontrata.ai',
      html,
      text
    });
  }
}

export const emailService = new EmailService();
