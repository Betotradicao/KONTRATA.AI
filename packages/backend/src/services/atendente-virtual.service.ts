import axios from 'axios';
import { AppDataSource } from '../config/database';
import { ConfigurationService } from './configuration.service';

/**
 * ATENDENTE VIRTUAL — motor do menu automático no WhatsApp.
 *
 * Escopo pequeno de propósito: menu numerado, respostas em sequência, transferir
 * pra humano e encerrar. Sem construtor de fluxos e sem IA.
 *
 * A instância da Evolution é a do Atendente (`atendente_evolution_*`), NÃO a dos
 * disparos. Ligar webhook no número dos disparos faria o bot responder qualquer
 * um que respondesse um aviso automático de aniversário ou de ASO.
 */

export type PassoTipo = 'texto' | 'pergunta' | 'atendente' | 'encerrar';

export interface Passo {
  tipo: PassoTipo;
  texto: string;
  /** Só em 'pergunta': palavra que o bot espera o cliente digitar pra seguir. */
  palavra_chave?: string;
}
export interface Opcao {
  numero: string;
  label: string;
  passos: Passo[];
}

interface Config {
  id: number;
  ativo: boolean;
  mensagem_primeira_vez: string | null;
  mensagem_recorrente: string | null;
  texto_menu: string | null;
  mensagem_nao_entendi: string | null;
  intervalo_menu_horas: number;
  simular_digitando: boolean;
  segundos_espera: number;
  opcoes: Opcao[];
}

/** Tira acento e caixa: "Salvei!" e "salvei" viram a mesma coisa. */
const normalizar = (s?: string | null) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();

export class AtendenteVirtualService {
  // ── Configuração ────────────────────────────────────────────────────
  static async obterConfig(): Promise<Config | null> {
    const rows = await AppDataSource.query(`SELECT * FROM atendente_config ORDER BY id LIMIT 1`);
    if (!rows[0]) return null;
    const c = rows[0];
    return { ...c, opcoes: Array.isArray(c.opcoes) ? c.opcoes : [] };
  }

  private static async credenciais() {
    const [url, token, instance] = await Promise.all([
      ConfigurationService.get('atendente_evolution_url', ''),
      ConfigurationService.get('atendente_evolution_token', ''),
      ConfigurationService.get('atendente_evolution_instance', ''),
    ]);
    return { url: String(url || '').replace(/\/+$/, ''), token: String(token || ''), instance: String(instance || '') };
  }

  /**
   * Registra o webhook na Evolution apontando pra este servidor.
   *
   * Feito por código, e não por instrução na tela, porque esquecer este passo
   * é o erro mais confuso possível: tudo aparece salvo e conectado, e o bot
   * simplesmente não responde — sem nenhum erro em lugar nenhum.
   */
  static async configurarWebhook(urlPublica: string): Promise<{ ok: boolean; erro?: string }> {
    const { url, token, instance } = await this.credenciais();
    if (!url || !token || !instance) {
      return { ok: false, erro: 'Preencha URL, Token e Instância antes.' };
    }
    const destino = `${urlPublica.replace(/\/+$/, '')}/api/atendente-virtual/webhook`;
    try {
      await axios.post(
        `${url}/webhook/set/${encodeURIComponent(instance)}`,
        {
          webhook: {
            enabled: true,
            url: destino,
            webhookByEvents: false,
            webhookBase64: false,
            // Só o evento de mensagem nova: os demais só gerariam ruído.
            events: ['MESSAGES_UPSERT'],
          },
        },
        { headers: { apikey: token }, timeout: 15000 }
      );
      return { ok: true };
    } catch (e: any) {
      // Versões mais antigas da Evolution esperam o corpo sem o embrulho
      // "webhook". Tentamos o formato antigo antes de desistir.
      try {
        await axios.post(
          `${url}/webhook/set/${encodeURIComponent(instance)}`,
          { enabled: true, url: destino, webhook_by_events: false, events: ['MESSAGES_UPSERT'] },
          { headers: { apikey: token }, timeout: 15000 }
        );
        return { ok: true };
      } catch (e2: any) {
        const detalhe = e2.response?.data?.message || e2.message || e.message;
        console.error('[atendente] configurarWebhook:', detalhe);
        return { ok: false, erro: String(detalhe) };
      }
    }
  }

  // ── Envio ───────────────────────────────────────────────────────────
  private static pausa(ms: number) {
    return new Promise((r) => setTimeout(r, ms));
  }

  /**
   * Mostra "digitando..." no WhatsApp do cliente e espera antes de enviar.
   * Resposta instantânea entrega que é robô; dois segundos com o balãozinho
   * mudam completamente a percepção de quem recebe.
   */
  private static async simularDigitacao(telefone: string, segundos: number): Promise<void> {
    const { url, token, instance } = await this.credenciais();
    if (!url || !token || !instance) return;
    try {
      await axios.post(
        `${url}/chat/sendPresence/${encodeURIComponent(instance)}`,
        { number: telefone, presence: 'composing', delay: segundos * 1000 },
        { headers: { apikey: token }, timeout: 10000 }
      );
    } catch {
      // Presença é enfeite: se a Evolution não suportar, seguimos com a espera.
    }
    await this.pausa(segundos * 1000);
  }

  private static async enviarTexto(telefone: string, texto: string): Promise<void> {
    if (!texto || !texto.trim()) return;
    const { url, token, instance } = await this.credenciais();
    if (!url || !token || !instance) {
      console.error('[atendente] credenciais da Evolution nao configuradas');
      return;
    }

    const cfg = await this.obterConfig();
    const seg = Math.max(0, Number(cfg?.segundos_espera ?? 0));
    if (seg > 0) {
      if (cfg?.simular_digitando) await this.simularDigitacao(telefone, seg);
      else await this.pausa(seg * 1000);
    }
    try {
      await axios.post(
        `${url}/message/sendText/${encodeURIComponent(instance)}`,
        { number: telefone, text: texto },
        { headers: { apikey: token }, timeout: 15000 }
      );
      await AppDataSource.query(
        `INSERT INTO atendente_mensagens (telefone, direcao, texto) VALUES ($1,'enviada',$2)`,
        [telefone, texto]
      );
    } catch (e: any) {
      console.error('[atendente] falha ao enviar:', e.response?.data?.message || e.message);
    }
  }

  /** Texto do menu com as opções numeradas no fim. */
  private static montarMenu(cfg: Config): string {
    const base = cfg.texto_menu || '*MENU DE ATENDIMENTO*';
    const linhas = (cfg.opcoes || [])
      .filter((o) => o.numero && o.label)
      .map((o) => `${o.numero} - ${o.label}`);
    // As opções entram sozinhas: se fossem digitadas à mão no texto, numeração
    // e lista sairiam do sincronismo na primeira vez que alguém reordenasse.
    return linhas.length ? `${base}\n\n${linhas.join('\n')}` : base;
  }

  // ── Sessão ──────────────────────────────────────────────────────────
  private static async obterSessao(telefone: string, nome?: string) {
    const achou = await AppDataSource.query(
      `SELECT * FROM atendente_sessoes WHERE telefone = $1`, [telefone]
    );
    if (achou[0]) return achou[0];
    const nova = await AppDataSource.query(
      `INSERT INTO atendente_sessoes (telefone, nome) VALUES ($1,$2) RETURNING *`,
      [telefone, nome || null]
    );
    return nova[0];
  }

  private static async atualizarSessao(telefone: string, campos: Record<string, any>) {
    const cols = Object.keys(campos);
    if (!cols.length) return;
    const sets = cols.map((c, i) => `${c} = $${i + 1}`);
    await AppDataSource.query(
      `UPDATE atendente_sessoes SET ${sets.join(', ')} WHERE telefone = $${cols.length + 1}`,
      [...Object.values(campos), telefone]
    );
  }

  /**
   * Executa os passos de uma opção a partir de um índice.
   * Para quando encontra um passo que ESPERA resposta do cliente.
   */
  private static async executarPassos(telefone: string, opcao: Opcao, aPartirDe: number) {
    const passos = opcao.passos || [];
    for (let i = aPartirDe; i < passos.length; i++) {
      const p = passos[i];
      await this.enviarTexto(telefone, p.texto);

      if (p.tipo === 'pergunta' && p.palavra_chave) {
        // Congela aqui: a próxima mensagem do cliente é a resposta esperada.
        await this.atualizarSessao(telefone, {
          opcao_numero: opcao.numero,
          passo_indice: i,
          aguardando_palavra: p.palavra_chave,
        });
        return;
      }
      if (p.tipo === 'atendente') {
        // Bot cala a boca até alguém liberar de novo pelo painel.
        await this.atualizarSessao(telefone, {
          com_atendente: true, opcao_numero: null, passo_indice: 0, aguardando_palavra: null,
        });
        return;
      }
      if (p.tipo === 'encerrar') {
        await this.atualizarSessao(telefone, {
          opcao_numero: null, passo_indice: 0, aguardando_palavra: null,
        });
        return;
      }
    }
    // Terminou a sequência: volta ao estado neutro SEM reenviar o menu.
    // Reenviar aqui fazia o menu aparecer depois de toda opção escolhida, o
    // que na prática furava a regra do intervalo — parecia que ela não
    // funcionava. Quem quiser o menu de novo digita qualquer coisa depois
    // do intervalo, ou um número de opção (que funciona sempre).
    await this.atualizarSessao(telefone, {
      opcao_numero: null,
      passo_indice: 0,
      aguardando_palavra: null,
    });
  }

  // ── Webhook ─────────────────────────────────────────────────────────
  /** Extrai telefone/texto/nome do payload da Evolution. Ignora o que não serve. */
  static extrairMensagem(body: any): { telefone: string; texto: string; nome?: string } | null {
    const d = body?.data || body;
    const key = d?.key || {};
    if (key.fromMe) return null;                       // mensagem que NÓS enviamos
    const jid = String(key.remoteJid || '');
    if (!jid || jid.includes('@g.us')) return null;    // grupo: atendente é 1-a-1
    const telefone = jid.split('@')[0];
    if (!telefone) return null;

    const m = d?.message || {};
    const texto =
      m.conversation ||
      m.extendedTextMessage?.text ||
      m.imageMessage?.caption ||
      m.videoMessage?.caption ||
      m.buttonsResponseMessage?.selectedDisplayText ||
      m.listResponseMessage?.title ||
      '';
    if (!texto) return null;                            // áudio/figurinha: ignora

    return { telefone, texto: String(texto), nome: d?.pushName || undefined };
  }

  static async processar(body: any): Promise<void> {
    const msg = this.extrairMensagem(body);
    if (!msg) return;

    const { telefone, texto, nome } = msg;

    // Registra ANTES de checar se está ligado. Com o log só depois, um bot
    // desligado não deixava rastro nenhum e "não chegou nada" ficava
    // indistinguível de "chegou e foi ignorado".
    await AppDataSource.query(
      `INSERT INTO atendente_mensagens (telefone, direcao, texto) VALUES ($1,'recebida',$2)`,
      [telefone, texto]
    );

    const cfg = await this.obterConfig();
    if (!cfg || !cfg.ativo) {
      console.log('[atendente] mensagem recebida mas o atendente esta DESLIGADO');
      return;
    }

    const sessao = await this.obterSessao(telefone, nome);
    await this.atualizarSessao(telefone, { ultima_mensagem_em: new Date(), nome: nome || sessao.nome });

    const digitado = normalizar(texto);
    const opcao = (cfg.opcoes || []).find((o) => normalizar(o.numero) === digitado);

    // 1) Número de opção funciona SEMPRE — inclusive durante atendimento
    // humano e quantas vezes o cliente quiser.
    //
    // Antes, escolher "Falar com Atendente" calava o bot pra tudo, pra
    // sempre: da opção 2 em diante nada mais respondia, nem repetindo a 1.
    // Escolher qualquer opção que não seja a de atendente também devolve a
    // conversa pro bot — o cliente mudou de ideia sozinho.
    if (opcao) {
      const vaiPraAtendente = (opcao.passos || []).some((p) => p.tipo === 'atendente');
      await this.atualizarSessao(telefone, {
        aguardando_palavra: null,
        opcao_numero: opcao.numero,
        passo_indice: 0,
        ...(vaiPraAtendente ? {} : { com_atendente: false }),
      });
      await this.executarPassos(telefone, opcao, 0);
      return;
    }

    // Daqui pra baixo é mensagem solta. Se tem gente atendendo, o bot cala.
    if (sessao.com_atendente) return;

    // 2) Estava esperando uma palavra-chave?
    if (sessao.aguardando_palavra) {
      if (digitado.includes(normalizar(sessao.aguardando_palavra))) {
        const opcao = (cfg.opcoes || []).find((o) => String(o.numero) === String(sessao.opcao_numero));
        if (opcao) {
          await this.atualizarSessao(telefone, { aguardando_palavra: null });
          await this.executarPassos(telefone, opcao, Number(sessao.passo_indice) + 1);
          return;
        }
      }
      // Não digitou o esperado: cai adiante e tenta interpretar como opção.
    }


    // 3) Mensagem solta — mandar o menu?
    // O intervalo evita despejar o menu a cada "oi"/"bom dia". Digitar um número
    // sempre funciona (tratado acima), então o silêncio não trava ninguém.
    const horas = Number(cfg.intervalo_menu_horas) || 0;
    if (horas > 0 && sessao.ultimo_menu_em) {
      const desde = (Date.now() - new Date(sessao.ultimo_menu_em).getTime()) / 3600000;
      if (desde < horas) {
        // Silêncio de propósito. Responder "não entendi" a cada "oi"/"bom dia"
        // vira eco chato — foi removido a pedido do usuário.
        return;
      }
    }

    const abertura = sessao.ja_conversou ? cfg.mensagem_recorrente : cfg.mensagem_primeira_vez;
    if (abertura) await this.enviarTexto(telefone, abertura);
    await this.enviarTexto(telefone, this.montarMenu(cfg));

    await this.atualizarSessao(telefone, {
      ja_conversou: true,
      ultimo_menu_em: new Date(),
      opcao_numero: null,
      passo_indice: 0,
      aguardando_palavra: null,
    });
  }
}
