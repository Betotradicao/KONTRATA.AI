import { Request, Response } from 'express';
import { emailService } from '../services/email.service';
import { ConfigurationService } from '../services/configuration.service';

/**
 * Envio de documentos do RH por e-mail (ex: Ficha Cadastral / Admissao).
 * O PDF e gerado no FRONTEND (mesmo HTML da impressao) e chega aqui em base64;
 * aqui so anexamos e disparamos pelo emailService (credenciais SMTP do cliente).
 */
export class RhEmailDocController {
  static async enviarDocumento(req: Request, res: Response) {
    try {
      const { to, cc, subject, body, attachment } = req.body as {
        to?: string;
        cc?: string;
        subject?: string;
        body?: string;
        attachment?: { filename?: string; base64?: string; contentType?: string };
      };

      if (!to || !String(to).trim()) {
        return res.status(400).json({ error: 'Destinatário (to) é obrigatório' });
      }
      if (!subject || !String(subject).trim()) {
        return res.status(400).json({ error: 'Assunto é obrigatório' });
      }
      if (!attachment?.base64) {
        return res.status(400).json({ error: 'Anexo (PDF) é obrigatório' });
      }

      // Remove qualquer prefixo data URI antes do base64 puro. Cobre as variações:
      //   "data:application/pdf;base64,XXXX"
      //   "data:application/pdf;filename=generated.pdf;base64,XXXX"  (jsPDF)
      // O payload base64 não contém vírgula, então corta tudo até a 1ª vírgula.
      const base64 = String(attachment.base64).replace(/^data:[^,]+,/, '');

      // Corpo: texto puro do RH -> embrulha num HTML simples preservando quebras de linha
      const safeBody = String(body || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      const html = `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;font-size:14px;color:#222;line-height:1.6">
        <div style="white-space:pre-wrap">${safeBody}</div>
        <hr style="margin-top:24px;border:none;border-top:1px solid #eee"/>
        <p style="font-size:11px;color:#999">Enviado via Kontrata.ai — sistema de gestão de RH</p>
      </body></html>`;

      const mailOptions = {
        to: String(to).trim(),
        cc: cc ? String(cc).trim() : undefined,
        subject: String(subject).trim(),
        text: String(body || ''),
        html,
        attachments: [
          {
            filename: attachment.filename || 'documento.pdf',
            contentBase64: base64,
            contentType: attachment.contentType || 'application/pdf',
          },
        ],
      };

      // Preferência: enviar pelo E-MAIL DA EMPRESA (cliente). Só cai no remetente
      // padrão do sistema (recuperação de senha) se a empresa não tiver configurado.
      const empUser = await ConfigurationService.get('email_empresa_user', '');
      const empPass = await ConfigurationService.get('email_empresa_pass', '');
      const empNome = await ConfigurationService.get('email_empresa_nome', '');

      let ok: boolean;
      if (empUser && empPass) {
        ok = await emailService.sendEmailFrom(
          { user: empUser, pass: empPass, fromName: empNome || undefined },
          mailOptions
        );
      } else {
        ok = await emailService.sendEmail(mailOptions);
      }

      if (!ok) {
        return res.status(502).json({
          error: (empUser && empPass)
            ? 'Falha ao enviar pelo e-mail da empresa. Verifique o e-mail e a senha de app em Emails Padronizados → Email Empresa.'
            : 'Nenhum e-mail remetente configurado. Cadastre o e-mail da empresa em Emails Padronizados → Email Empresa.',
        });
      }

      return res.json({ success: true, message: 'E-mail enviado com sucesso' });
    } catch (error: any) {
      console.error('[rh-email-doc] erro ao enviar documento:', error?.message);
      return res.status(500).json({ error: 'Erro interno ao enviar e-mail' });
    }
  }

  /** Testa as credenciais do e-mail da empresa (remetente) sem salvar nada. */
  static async testarEmailEmpresa(req: Request, res: Response) {
    const { user, pass } = req.body as { user?: string; pass?: string };
    if (!user || !pass) {
      return res.status(400).json({ ok: false, error: 'E-mail e senha são obrigatórios' });
    }
    const result = await emailService.verifyCredentials(String(user).trim(), String(pass).trim());
    if (result.ok) {
      return res.json({ ok: true, message: 'Conexão válida! O e-mail da empresa está pronto para enviar.' });
    }
    return res.status(400).json({
      ok: false,
      error: 'Credenciais inválidas. Para Gmail, use uma Senha de App (16 caracteres).',
      details: result.error,
    });
  }
}
