import nodemailer from 'nodemailer';
import { AppDataSource } from '../config/database';

interface EmailAttachment {
  filename: string;
  /** Conteudo em base64 (sem o prefixo data:...;base64,) */
  contentBase64?: string;
  content?: Buffer;
  contentType?: string;
}

interface SendEmailOptions {
  to: string;
  cc?: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: EmailAttachment[];
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

  /**
   * Cria um transporter nodemailer a partir de credenciais. Detecta Gmail/Yahoo
   * automaticamente e cai num SMTP customizado (via .env) caso contrário.
   * Reutilizado tanto pelo remetente padrão quanto pelo "e-mail da empresa".
   */
  private makeTransporter(user: string, pass: string): nodemailer.Transporter {
    const isGmail = user.includes('@gmail.com');
    const isYahoo = user.includes('@yahoo.com');

    if (isGmail) {
      return nodemailer.createTransport({ service: 'gmail', auth: { user, pass } });
    }
    if (isYahoo) {
      return nodemailer.createTransport({
        host: 'smtp.mail.yahoo.com', port: 465, secure: true, auth: { user, pass },
      });
    }
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user, pass },
    });
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
      this.transporter = this.makeTransporter(creds.user, creds.pass);
      console.log(`✅ Email service initialized: ${creds.user}`);
    } catch (error) {
      console.error('❌ Erro ao inicializar serviço de email:', error);
      this.transporter = null;
    }
  }

  /**
   * Envia um e-mail usando credenciais ESPECÍFICAS (ex: o e-mail da empresa/cliente),
   * sem mexer no transporter padrão. O remetente (from) é o próprio e-mail informado.
   */
  async sendEmailFrom(
    creds: { user: string; pass: string; fromName?: string },
    options: SendEmailOptions
  ): Promise<boolean> {
    if (!creds.user || !creds.pass) {
      console.error('❌ sendEmailFrom: credenciais da empresa ausentes');
      return false;
    }
    try {
      const transporter = this.makeTransporter(creds.user, creds.pass);
      const attachments = (options.attachments || []).map(a => ({
        filename: a.filename,
        content: a.content ? a.content : Buffer.from(a.contentBase64 || '', 'base64'),
        contentType: a.contentType,
      }));
      const info = await transporter.sendMail({
        from: `"${creds.fromName || creds.user}" <${creds.user}>`,
        to: options.to,
        cc: options.cc || undefined,
        subject: options.subject,
        text: options.text || '',
        html: options.html,
        attachments: attachments.length ? attachments : undefined,
      });
      console.log('✅ Email (empresa) enviado:', info.messageId);
      return true;
    } catch (error) {
      console.error('❌ Erro ao enviar email (empresa):', error);
      return false;
    }
  }

  /** Atalho publico pro controller chamar apos salvar email no banco */
  async reinitialize(): Promise<void> {
    await this.initializeTransporter();
  }

  /** Verifica se as credenciais conseguem autenticar no servidor SMTP. */
  async verifyCredentials(user: string, pass: string): Promise<{ ok: boolean; error?: string }> {
    try {
      const transporter = this.makeTransporter(user, pass);
      await transporter.verify();
      return { ok: true };
    } catch (e: any) {
      return { ok: false, error: e?.message || 'Falha na verificação' };
    }
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
      // Converte anexos (base64 -> Buffer) pro formato do nodemailer
      const attachments = (options.attachments || []).map(a => ({
        filename: a.filename,
        content: a.content
          ? a.content
          : Buffer.from(a.contentBase64 || '', 'base64'),
        contentType: a.contentType,
      }));

      const info = await this.transporter.sendMail({
        from: `"Kontrata.ai" <${this.fromEmail || process.env.EMAIL_USER}>`,
        to: options.to,
        cc: options.cc || undefined,
        subject: options.subject,
        text: options.text || '',
        html: options.html,
        attachments: attachments.length ? attachments : undefined,
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
            background-color: #7E22CE;
            padding: 20px;
            text-align: center;
            border-radius: 5px 5px 0 0;
          }
          .header h1 {
            color: #FFD60A;
            margin: 0;
            font-weight: bold;
          }
          .content {
            background-color: #f9f9f9;
            padding: 30px;
            border-radius: 0 0 5px 5px;
          }
          .button {
            display: inline-block;
            padding: 12px 30px;
            background-color: #7E22CE !important;
            color: #ffffff !important;
            text-decoration: none;
            border-radius: 5px;
            margin: 20px 0;
            font-weight: bold;
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
              <a href="${resetUrl}" class="button" style="background-color:#7E22CE;color:#ffffff;display:inline-block;padding:12px 30px;text-decoration:none;border-radius:5px;font-weight:bold;">Redefinir Senha</a>
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
