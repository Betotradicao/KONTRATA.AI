import nodemailer from 'nodemailer';

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

class EmailService {
  private transporter: nodemailer.Transporter | null = null;

  constructor() {
    this.initializeTransporter();
  }

  private initializeTransporter() {
    // Verificar se as credenciais de email estão configuradas
    const emailUser = process.env.EMAIL_USER;
    const emailPass = process.env.EMAIL_PASS;

    if (!emailUser || !emailPass) {
      console.warn('⚠️ Email não configurado. Defina EMAIL_USER e EMAIL_PASS no arquivo .env');
      return;
    }

    try {
      // Detecta se é Gmail ou Yahoo baseado no domínio do email
      const isGmail = emailUser.includes('@gmail.com');
      const isYahoo = emailUser.includes('@yahoo.com');

      if (isGmail) {
        // Configuração para Gmail
        this.transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: {
            user: emailUser,
            pass: emailPass
          }
        });
        console.log('✅ Serviço de email inicializado (Gmail)');
      } else if (isYahoo) {
        // Configuração para Yahoo
        this.transporter = nodemailer.createTransport({
          host: 'smtp.mail.yahoo.com',
          port: 465,
          secure: true,
          auth: {
            user: emailUser,
            pass: emailPass
          }
        });
        console.log('✅ Serviço de email inicializado (Yahoo)');
      } else {
        // Configuração genérica SMTP (pode configurar manualmente no .env)
        this.transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST || 'smtp.gmail.com',
          port: parseInt(process.env.SMTP_PORT || '587'),
          secure: process.env.SMTP_SECURE === 'true',
          auth: {
            user: emailUser,
            pass: emailPass
          }
        });
        console.log('✅ Serviço de email inicializado (SMTP customizado)');
      }
    } catch (error) {
      console.error('❌ Erro ao inicializar serviço de email:', error);
    }
  }

  async sendEmail(options: SendEmailOptions): Promise<boolean> {
    if (!this.transporter) {
      console.error('❌ Transporter de email não está configurado');
      return false;
    }

    try {
      const info = await this.transporter.sendMail({
        from: `"Kontrata.ai" <${process.env.EMAIL_USER}>`,
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
            background-color: #ea580c;
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
            background-color: #ea580c;
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
