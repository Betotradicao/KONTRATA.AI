import axios from 'axios';
import { AppDataSource } from '../config/database';
import { ConfigurationService } from './configuration.service';

// Parabeniza no grupo de WhatsApp os colaboradores que fazem aniversario HOJE.
// Manda UMA mensagem POR LOJA (em nome da "Equipe {loja}"), no horario configurado.
// Texto editavel com placeholders {nomes} e {loja}.

async function getEvo() {
  const apiUrl = await ConfigurationService.get('evolution_api_url', '');
  const apiToken = await ConfigurationService.get('evolution_api_token', '');
  const instance = await ConfigurationService.get('evolution_instance', '');
  return { apiUrl, apiToken, instance };
}

export const MENSAGEM_ANIVERSARIO_PADRAO =
`🥳🎊 *HOJE TEM ANIVERSARIANTE!* 🎊🥳

{nomes}

Que venha um ano INCRÍVEL, cheio de realizações, risadas e muito bolo! 🎂🎈✨

Toda a *Equipe {loja}* te deseja o melhor do mundo! 💛🙌

#TamoJunto 🛒`;

interface Aniv { nome: string; loja: string; }

export class AniversarioWhatsService {
  static async getHoje(): Promise<Aniv[]> {
    return AppDataSource.query(
      `SELECT c.nome,
              COALESCE(e.apelido, e.nome_fantasia, e.razao_social, 'nossa equipe') AS loja
       FROM rh_colaboradores c
       LEFT JOIN rh_empresas e ON e.cod_loja = c.empresa_id
       WHERE c.status = 'ativo' AND c.data_nascimento IS NOT NULL
         AND EXTRACT(MONTH FROM c.data_nascimento) = EXTRACT(MONTH FROM CURRENT_DATE)
         AND EXTRACT(DAY FROM c.data_nascimento) = EXTRACT(DAY FROM CURRENT_DATE)
       ORDER BY loja, c.nome`
    );
  }

  static buildMensagem(template: string, loja: string, nomes: string[]): string {
    const bloco = nomes.map(n => `🎉 *${n}* 🎉`).join('\n');
    return (template || MENSAGEM_ANIVERSARIO_PADRAO)
      .replace(/\{nomes\}/gi, bloco)
      .replace(/\{loja\}/gi, loja);
  }

  private static async getTemplate(): Promise<string> {
    const t = await ConfigurationService.get('whatsapp_aniversario_mensagem', '');
    return (t && String(t).trim()) ? String(t) : MENSAGEM_ANIVERSARIO_PADRAO;
  }

  private static async enviarTexto(groupId: string, texto: string): Promise<void> {
    const { apiUrl, apiToken, instance } = await getEvo();
    if (!apiUrl || !apiToken || !instance) throw new Error('Evolution API não configurada (URL, Token e Instância).');
    const base = String(apiUrl).replace(/\/+$/, '');
    const headers = { 'Content-Type': 'application/json', apikey: apiToken };
    await axios.post(`${base}/message/sendText/${encodeURIComponent(instance)}`, { number: groupId, text: texto }, { headers, timeout: 20000 });
  }

  // force=true (Testar): manda exemplo se nao houver aniversariante hoje.
  static async enviar(force = false): Promise<{ enviado: boolean; total: number; lojas: number }> {
    const groupId = await ConfigurationService.get('whatsapp_group_aniversario', '');
    if (!groupId) { if (force) throw new Error('Grupo de "Aniversários" não configurado.'); return { enviado: false, total: 0, lojas: 0 }; }
    const template = await this.getTemplate();
    const rows = await this.getHoje();

    // agrupa por loja
    const porLoja = new Map<string, string[]>();
    for (const r of rows) {
      if (!porLoja.has(r.loja)) porLoja.set(r.loja, []);
      porLoja.get(r.loja)!.push(r.nome);
    }

    if (porLoja.size === 0) {
      if (!force) return { enviado: false, total: 0, lojas: 0 };
      // teste sem aniversariante hoje: manda um exemplo
      const marca = await ConfigurationService.get('client_brand_name', '');
      await this.enviarTexto(groupId, this.buildMensagem(template, marca || 'nossa equipe', ['Maria Silva (exemplo)']));
      return { enviado: true, total: 1, lojas: 1 };
    }

    let total = 0;
    for (const [loja, nomes] of porLoja) {
      await this.enviarTexto(groupId, this.buildMensagem(template, loja, nomes));
      total += nomes.length;
    }
    return { enviado: true, total, lojas: porLoja.size };
  }

  // texto pra preview na tela (com dados de hoje, ou exemplo se nao houver).
  static async preview(): Promise<string> {
    const template = await this.getTemplate();
    const rows = await this.getHoje();
    if (rows.length === 0) {
      const marca = await ConfigurationService.get('client_brand_name', '');
      return this.buildMensagem(template, marca || 'nossa equipe', ['Maria Silva (exemplo)', 'João Souza (exemplo)']);
    }
    const porLoja = new Map<string, string[]>();
    for (const r of rows) { if (!porLoja.has(r.loja)) porLoja.set(r.loja, []); porLoja.get(r.loja)!.push(r.nome); }
    return [...porLoja.entries()].map(([loja, nomes]) => this.buildMensagem(template, loja, nomes)).join('\n\n— — — — —\n\n');
  }
}
