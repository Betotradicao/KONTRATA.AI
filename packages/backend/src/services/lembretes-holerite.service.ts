import { AppDataSource } from '../config/database';
import { ConfigurationService } from './configuration.service';
import { PortalColaboradorService, normalizarCelular } from './portal-colaborador.service';

/**
 * Lembretes de holerite pendente (quem ainda não abriu). Decisão do Beto (24/10/2026):
 * - manual: botão "Lembrar pendentes" manda em lote;
 * - automático: 1º lembrete N dias após o envio, depois a cada X dias, até M lembretes,
 *   no horário configurado, de segunda a sábado (direito à desconexão).
 * Config em `configurations` (portal_lembrete_*). Cada envio vai pra trilha do holerite.
 */

export const TEXTO_PADRAO = `Olá, *{nome}*! 👋

Seu holerite de *{competencia}* ({tipo}) já está disponível, mas você ainda não abriu. Leva 1 minuto:

1️⃣ Toque no link: {link}
2️⃣ Entre com seu *CPF e senha* (se for o primeiro acesso, o link já abre a tela pra criar sua senha)
3️⃣ Toque em *Abrir holerite* e digite o código de 6 números que chega aqui no WhatsApp

Pronto! Ao abrir, fica registrado que você recebeu. Dúvidas sobre os valores? Fale com o RH. 😊

_Mensagem automática — Kontrata.ai_`;

export interface ConfigLembrete {
  ativo: boolean;
  primeiro_dias: number;
  intervalo_dias: number;
  max_lembretes: number;
  hora: string;   // HH:MM
  texto: string;
}

const K = {
  ativo: 'portal_lembrete_ativo',
  primeiro: 'portal_lembrete_primeiro_dias',
  intervalo: 'portal_lembrete_intervalo_dias',
  max: 'portal_lembrete_max',
  hora: 'portal_lembrete_hora',
  texto: 'portal_lembrete_texto',
  ultimaExec: 'portal_lembrete_ultima_execucao',
};

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const int = (v: any, def: number, min = 0, max = 365) => { const n = parseInt(String(v), 10); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def; };

/** Data/hora em São Paulo (o container pode estar em UTC). */
function agoraSP() {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'short', hour12: false })
    .formatToParts(new Date()).reduce((o: any, x) => { o[x.type] = x.value; return o; }, {});
  return { data: `${p.year}-${p.month}-${p.day}`, hhmm: `${p.hour === '24' ? '00' : p.hour}:${p.minute}`, domingo: p.weekday === 'Sun' };
}

export class LembretesHoleriteService {
  static async getConfig(): Promise<ConfigLembrete> {
    const g = (k: string, d: string) => ConfigurationService.get(k, d);
    return {
      ativo: String(await g(K.ativo, 'false')) === 'true',
      primeiro_dias: int(await g(K.primeiro, '4'), 4, 1, 60),
      intervalo_dias: int(await g(K.intervalo, '3'), 3, 1, 60),
      max_lembretes: int(await g(K.max, '3'), 3, 1, 20),
      hora: /^\d{2}:\d{2}$/.test(String(await g(K.hora, '09:00'))) ? String(await g(K.hora, '09:00')) : '09:00',
      texto: String((await g(K.texto, '')) || '').trim() || TEXTO_PADRAO,
    };
  }

  static async salvarConfig(c: Partial<ConfigLembrete>) {
    if (c.ativo !== undefined) await ConfigurationService.set(K.ativo, c.ativo ? 'true' : 'false');
    if (c.primeiro_dias !== undefined) await ConfigurationService.set(K.primeiro, String(int(c.primeiro_dias, 4, 1, 60)));
    if (c.intervalo_dias !== undefined) await ConfigurationService.set(K.intervalo, String(int(c.intervalo_dias, 3, 1, 60)));
    if (c.max_lembretes !== undefined) await ConfigurationService.set(K.max, String(int(c.max_lembretes, 3, 1, 20)));
    if (c.hora !== undefined && /^\d{2}:\d{2}$/.test(c.hora)) await ConfigurationService.set(K.hora, c.hora);
    if (c.texto !== undefined) await ConfigurationService.set(K.texto, String(c.texto).trim() === TEXTO_PADRAO.trim() ? '' : String(c.texto));
    return this.getConfig();
  }

  private static montarTexto(tpl: string, d: { nome: string; competencia: string; tipo: string; link: string; empresa: string }) {
    const [y, m] = String(d.competencia || '').split('-');
    const comp = m ? `${MESES[parseInt(m) - 1]}/${y}` : d.competencia;
    return tpl
      .replace(/\{nome\}/g, String(d.nome || '').split(' ')[0])
      .replace(/\{competencia\}/g, comp)
      .replace(/\{tipo\}/g, String(d.tipo || 'PAGAMENTO').toLowerCase())
      .replace(/\{link\}/g, d.link)
      .replace(/\{empresa\}/g, d.empresa || '');
  }

  /** Manda o lembrete de UM holerite pendente. origem: 'manual' | 'automatico'. */
  static async enviar(aceiteId: number, baseUrl: string, origem: 'manual' | 'automatico', texto?: string) {
    const [a] = await AppDataSource.query(
      `SELECT a.id, a.status, a.colaborador_id, a.competencia, c.nome, c.celular, t.nome AS tipo_nome,
              COALESCE(e.apelido, e.nome_fantasia, e.razao_social, '') AS empresa
       FROM rh_documento_aceites a
       JOIN rh_colaboradores c ON c.id = a.colaborador_id
       LEFT JOIN rh_empresas e ON e.id = c.company_id
       LEFT JOIN rh_tipos_holerite t ON t.id = a.tipo_holerite_id
       WHERE a.id = $1`,
      [aceiteId]
    );
    if (!a) return { aceite_id: aceiteId, ok: false, erro: 'não encontrado' };
    if (a.status !== 'pendente') return { aceite_id: aceiteId, nome: a.nome, ok: false, erro: 'não está pendente' };
    const numero = normalizarCelular(a.celular);
    if (!numero) return { aceite_id: aceiteId, nome: a.nome, ok: false, erro: 'sem celular' };
    const acesso = await PortalColaboradorService.garantirAcesso(a.colaborador_id, baseUrl);
    const tpl = texto || (await this.getConfig()).texto;
    try {
      await PortalColaboradorService.enviarWhats(numero, this.montarTexto(tpl, { nome: a.nome, competencia: a.competencia, tipo: a.tipo_nome, link: acesso.link, empresa: a.empresa }), null, '');
    } catch (e: any) {
      const erro = `WhatsApp: ${e.response?.data?.message || e.message}`;
      await PortalColaboradorService.registrarEvento(a.id, 'lembrete_falhou', { detalhe: `${origem} · ${erro}` });
      return { aceite_id: aceiteId, nome: a.nome, ok: false, erro };
    }
    await AppDataSource.query(
      `UPDATE rh_documento_aceites SET lembretes_enviados = lembretes_enviados + 1, ultimo_lembrete_em = NOW(), updated_at = NOW() WHERE id = $1`, [a.id]);
    await PortalColaboradorService.registrarEvento(a.id, 'lembrete_enviado', { detalhe: `${origem} · ${numero}` });
    return { aceite_id: aceiteId, nome: a.nome, ok: true };
  }

  static async enviarLote(ids: number[], baseUrl: string) {
    const tpl = (await this.getConfig()).texto;
    const out = [];
    for (const id of ids) {
      out.push(await this.enviar(id, baseUrl, 'manual', tpl));
      await new Promise(r => setTimeout(r, 1500)); // espaça os envios (anti-bloqueio do WhatsApp)
    }
    return out;
  }

  /** Chamado pelo cron a cada minuto: dispara 1x/dia no horário, seg a sáb. */
  static async rodarAutomatico(baseUrl: string) {
    const cfg = await this.getConfig();
    if (!cfg.ativo) return null;
    const sp = agoraSP();
    if (sp.domingo || sp.hhmm !== cfg.hora) return null;
    if ((await ConfigurationService.get(K.ultimaExec, '')) === sp.data) return null;
    await ConfigurationService.set(K.ultimaExec, sp.data);

    const elegiveis = await AppDataSource.query(
      `SELECT a.id FROM rh_documento_aceites a
       JOIN rh_colaboradores c ON c.id = a.colaborador_id
       WHERE a.status = 'pendente' AND a.lembretes_enviados < $1
         AND COALESCE(a.enviado_em, a.created_at) <= NOW() - ($2::int * interval '1 day')
         AND (a.ultimo_lembrete_em IS NULL OR a.ultimo_lembrete_em <= NOW() - ($3::int * interval '1 day') + interval '1 hour')
       ORDER BY a.id`,
      [cfg.max_lembretes, cfg.primeiro_dias, cfg.intervalo_dias]
    );
    let ok = 0;
    for (const { id } of elegiveis) {
      const r = await this.enviar(id, baseUrl, 'automatico', cfg.texto);
      if (r.ok) ok++;
      await new Promise(res => setTimeout(res, 1500));
    }
    return { total: elegiveis.length, enviados: ok };
  }
}
