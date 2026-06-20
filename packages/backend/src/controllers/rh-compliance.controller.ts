import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import axios from 'axios';

// Cérebro do Agente Compliance.
// Ordem: 1) busca nos documentos internos (rh_compliance_memoria) e responde citando a fonte;
//        2) se NÃO achar, avisa e busca na WEB ao vivo (modelo de busca da OpenAI).
export class RhComplianceController {
  static async chat(req: Request, res: Response) {
    try {
      const { messages, empresaId } = req.body;
      if (!Array.isArray(messages) || !messages.length) {
        return res.status(400).json({ error: 'messages array obrigatorio' });
      }

      const { ConfigurationService } = await import('../services/configuration.service');
      const apiKey = await ConfigurationService.get('openai_api_key');
      if (!apiKey) {
        return res.status(400).json({ error: 'OpenAI API Key nao configurada (Configuracoes -> AI -> Chave API).' });
      }

      const get = async (k: string, def = '') => (await ConfigurationService.get(k)) || def;
      const persona = await get('compliance_persona');
      const tom = await get('compliance_tom', 'profissional');
      const instrucoes = await get('compliance_instrucoes');
      const nomeAgente = await get('compliance_nome_agente', 'COMPLIANCE');
      const model = await get('compliance_modelo', 'gpt-4o-mini');
      const webModel = await get('compliance_web_model', 'gpt-4o-mini-search-preview');
      const webAtivo = (await get('compliance_web_fallback', 'true')) !== 'false';

      const ultimaPergunta = String(messages[messages.length - 1]?.content || '');

      // ===== RAG interno: busca por palavras-chave no vault do compliance =====
      const termos = ultimaPergunta.toLowerCase().split(/[^a-zA-Z0-9À-ſ]+/).filter((w) => w.length >= 4);
      const termosUnicos = [...new Set(termos)].slice(0, 20);
      let notas: any[] = [];
      if (termosUnicos.length) {
        const params: any[] = [];
        let where = `ativo = true`;
        if (empresaId) { params.push(empresaId); where += ` AND (empresa_id = $${params.length} OR empresa_id IS NULL)`; }
        const orClauses: string[] = [];
        termosUnicos.forEach((t) => {
          params.push(`%${t}%`); orClauses.push(`LOWER(titulo) LIKE $${params.length}`);
          params.push(`%${t}%`); orClauses.push(`LOWER(conteudo) LIKE $${params.length}`);
        });
        notas = await AppDataSource.query(
          `SELECT slug, titulo, tipo, LEFT(conteudo, 4000) AS conteudo
           FROM rh_compliance_memoria
           WHERE ${where} AND (${orClauses.join(' OR ')})
           LIMIT 6`,
          params
        );
      }

      const achouInterno = notas.length > 0;
      const blocoDocs = achouInterno
        ? notas.map((n) => `\n## [${n.tipo}] ${n.titulo}\n${n.conteudo}`).join('\n---')
        : '(Nenhum documento interno relevante encontrado para esta pergunta.)';

      const systemPrompt = `Voce e ${nomeAgente}, agente de compliance de RH de supermercado. Tom: ${tom}.
${persona}

${instrucoes}

=== DOCUMENTOS INTERNOS (Base de Conhecimento) ===
${blocoDocs}

REGRA DE OURO:
- Se a resposta esta nos DOCUMENTOS INTERNOS acima, responda com base neles e CITE a fonte (o titulo do documento).
- Se NAO esta nos documentos internos, COMECE a resposta com: "⚠️ Nao encontrei isso no regimento interno cadastrado." e entao ${webAtivo ? 'pesquise na internet e responda citando as FONTES (links).' : 'de uma orientacao geral e oriente confirmar com o RH.'}
- Respostas em pt-BR, curtas e diretas (e um grupo de WhatsApp).`;

      const usaWeb = !achouInterno && webAtivo;
      const modeloUsado = usaWeb ? webModel : model;

      const montarPayload = (m: string, comTemp: boolean) => {
        const p: any = { model: m, messages: [{ role: 'system', content: systemPrompt }, ...messages] };
        if (/^gpt-5/i.test(m)) p.max_completion_tokens = 2500;
        else { p.max_tokens = 1000; if (comTemp && !/search/i.test(m)) p.temperature = 0.4; }
        return p;
      };

      const call = async (payload: any) => {
        const r = await axios.post('https://api.openai.com/v1/chat/completions', payload, {
          headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          timeout: 60000,
        });
        return r.data.choices?.[0]?.message?.content || '(sem resposta)';
      };

      let reply = '';
      let fonte = usaWeb ? 'web' : achouInterno ? 'interno' : 'geral';
      try {
        reply = await call(montarPayload(modeloUsado, true));
      } catch (err: any) {
        // Se o modelo de busca web nao estiver disponivel na conta, cai pro modelo normal
        if (usaWeb) {
          console.warn('[RhCompliance] modelo de busca falhou, fallback p/ modelo normal:', err?.response?.data?.error?.message || err.message);
          reply = await call(montarPayload(model, true));
          fonte = 'geral';
        } else {
          throw err;
        }
      }

      res.json({
        reply,
        fonte, // 'interno' | 'web' | 'geral'
        modelo: modeloUsado,
        docs: notas.map((n) => ({ titulo: n.titulo, tipo: n.tipo, slug: n.slug })),
      });
    } catch (e: any) {
      console.error('[RhCompliance] chat:', e?.response?.data || e.message);
      res.status(500).json({ error: e?.response?.data?.error?.message || e.message || 'Falha no chat' });
    }
  }
}
