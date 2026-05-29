import { Request, Response } from 'express';
import crypto from 'crypto';
import { AppDataSource } from '../config/database';
import { AuthRequest } from '../middleware/auth';

const sha = (s: string) => crypto.createHash('sha256').update(s || '').digest('hex').slice(0, 32);

export class PesquisaClimaController {
  // ===========================================================================
  // MODELOS (templates de pesquisa)
  // ===========================================================================
  static async listarModelos(_req: AuthRequest, res: Response) {
    try {
      const rows = await AppDataSource.query(`
        SELECT m.*,
          (SELECT COUNT(*)::int FROM pesquisa_perguntas p WHERE p.modelo_id = m.id) AS qtd_perguntas,
          (SELECT COUNT(*)::int FROM pesquisa_rodadas r WHERE r.modelo_id = m.id) AS qtd_rodadas,
          (SELECT COUNT(*)::int FROM pesquisa_rodadas r
              JOIN pesquisa_respostas resp ON resp.rodada_id = r.id
              WHERE r.modelo_id = m.id) AS total_respostas
        FROM pesquisa_modelos m
        ORDER BY m.created_at DESC
      `);
      res.json(rows);
    } catch (e: any) {
      console.error('[PesquisaClima] listarModelos:', e);
      res.status(500).json({ error: e.message });
    }
  }

  static async getModelo(req: AuthRequest, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const [modelo] = await AppDataSource.query(`SELECT * FROM pesquisa_modelos WHERE id = $1`, [id]);
      if (!modelo) return res.status(404).json({ error: 'Modelo nao encontrado' });
      const perguntas = await AppDataSource.query(
        `SELECT * FROM pesquisa_perguntas WHERE modelo_id = $1 ORDER BY ordem ASC, id ASC`,
        [id]
      );
      res.json({ ...modelo, perguntas });
    } catch (e: any) {
      console.error('[PesquisaClima] getModelo:', e);
      res.status(500).json({ error: e.message });
    }
  }

  static async criarModelo(req: AuthRequest, res: Response) {
    try {
      const { nome, descricao, cor, icone, anonima } = req.body;
      if (!nome?.trim()) return res.status(400).json({ error: 'nome obrigatorio' });
      const [r] = await AppDataSource.query(
        `INSERT INTO pesquisa_modelos (nome, descricao, cor, icone, anonima, created_by)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [nome.trim(), descricao || null, cor || 'orange', icone || '📋', anonima !== false, (req as any).user?.id || null]
      );
      res.status(201).json(r);
    } catch (e: any) {
      console.error('[PesquisaClima] criarModelo:', e);
      res.status(500).json({ error: e.message });
    }
  }

  static async atualizarModelo(req: AuthRequest, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const { nome, descricao, cor, icone, ativa, anonima } = req.body;
      const [r] = await AppDataSource.query(
        `UPDATE pesquisa_modelos SET
           nome = COALESCE($1, nome),
           descricao = COALESCE($2, descricao),
           cor = COALESCE($3, cor),
           icone = COALESCE($4, icone),
           ativa = COALESCE($5, ativa),
           anonima = COALESCE($6, anonima),
           updated_at = NOW()
         WHERE id = $7 RETURNING *`,
        [nome ?? null, descricao ?? null, cor ?? null, icone ?? null,
         ativa === undefined ? null : ativa, anonima === undefined ? null : anonima, id]
      );
      if (!r) return res.status(404).json({ error: 'Modelo nao encontrado' });
      res.json(r);
    } catch (e: any) {
      console.error('[PesquisaClima] atualizarModelo:', e);
      res.status(500).json({ error: e.message });
    }
  }

  static async deletarModelo(req: AuthRequest, res: Response) {
    try {
      const id = parseInt(req.params.id);
      // Templates do sistema (protegida=true, ex: NR-1) nao podem ser deletados.
      const [m] = await AppDataSource.query(
        `SELECT protegida FROM pesquisa_modelos WHERE id = $1`,
        [id]
      );
      if (!m) return res.status(404).json({ error: 'Modelo nao encontrado' });
      if (m.protegida) {
        return res.status(403).json({ error: 'Esta pesquisa é obrigatória do sistema e não pode ser excluída.' });
      }
      await AppDataSource.query(`DELETE FROM pesquisa_modelos WHERE id = $1`, [id]);
      res.json({ success: true });
    } catch (e: any) {
      console.error('[PesquisaClima] deletarModelo:', e);
      res.status(500).json({ error: e.message });
    }
  }

  // ===========================================================================
  // PERGUNTAS (do modelo)
  // ===========================================================================
  static async salvarPerguntas(req: AuthRequest, res: Response) {
    try {
      const modeloId = parseInt(req.params.id);
      const { perguntas } = req.body;
      if (!Array.isArray(perguntas)) return res.status(400).json({ error: 'perguntas array obrigatorio' });
      // Substituicao total: deleta as existentes e re-cria. Simples, evita conflitos de ids.
      await AppDataSource.query(`DELETE FROM pesquisa_perguntas WHERE modelo_id = $1`, [modeloId]);
      const out: any[] = [];
      for (let i = 0; i < perguntas.length; i++) {
        const p = perguntas[i];
        const [row] = await AppDataSource.query(
          `INSERT INTO pesquisa_perguntas (modelo_id, secao, ordem, tipo, enunciado, obrigatoria, configuracao)
           VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb) RETURNING *`,
          [modeloId, p.secao || null, p.ordem ?? i + 1, p.tipo, p.enunciado || '', !!p.obrigatoria, JSON.stringify(p.configuracao || {})]
        );
        out.push(row);
      }
      res.json({ success: true, perguntas: out });
    } catch (e: any) {
      console.error('[PesquisaClima] salvarPerguntas:', e);
      res.status(500).json({ error: e.message });
    }
  }

  // ===========================================================================
  // RODADAS (cada execucao do modelo, gera token publico)
  // ===========================================================================
  static async listarRodadas(req: AuthRequest, res: Response) {
    try {
      const modeloId = req.query.modelo_id ? parseInt(req.query.modelo_id as string) : null;
      const params: any[] = [];
      let where = '';
      if (modeloId) { where = 'WHERE r.modelo_id = $1'; params.push(modeloId); }
      const rows = await AppDataSource.query(`
        SELECT r.*,
          m.nome AS modelo_nome,
          (SELECT COUNT(*)::int FROM pesquisa_respostas resp WHERE resp.rodada_id = r.id) AS total_respostas
        FROM pesquisa_rodadas r
        JOIN pesquisa_modelos m ON m.id = r.modelo_id
        ${where}
        ORDER BY r.created_at DESC
      `, params);
      res.json(rows);
    } catch (e: any) {
      console.error('[PesquisaClima] listarRodadas:', e);
      res.status(500).json({ error: e.message });
    }
  }

  static async criarRodada(req: AuthRequest, res: Response) {
    try {
      const { modelo_id, nome, abre_em, fecha_em } = req.body;
      if (!modelo_id || !nome?.trim()) return res.status(400).json({ error: 'modelo_id e nome obrigatorios' });
      const token = crypto.randomBytes(20).toString('hex');
      const [r] = await AppDataSource.query(
        `INSERT INTO pesquisa_rodadas (modelo_id, nome, token_publico, abre_em, fecha_em, created_by)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [modelo_id, nome.trim(), token, abre_em || null, fecha_em || null, (req as any).user?.id || null]
      );
      res.status(201).json(r);
    } catch (e: any) {
      console.error('[PesquisaClima] criarRodada:', e);
      res.status(500).json({ error: e.message });
    }
  }

  static async atualizarRodada(req: AuthRequest, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const { nome, aberta, abre_em, fecha_em } = req.body;
      const [r] = await AppDataSource.query(
        `UPDATE pesquisa_rodadas SET
           nome = COALESCE($1, nome),
           aberta = COALESCE($2, aberta),
           abre_em = COALESCE($3, abre_em),
           fecha_em = COALESCE($4, fecha_em),
           updated_at = NOW()
         WHERE id = $5 RETURNING *`,
        [nome ?? null, aberta === undefined ? null : aberta, abre_em ?? null, fecha_em ?? null, id]
      );
      if (!r) return res.status(404).json({ error: 'Rodada nao encontrada' });
      res.json(r);
    } catch (e: any) {
      console.error('[PesquisaClima] atualizarRodada:', e);
      res.status(500).json({ error: e.message });
    }
  }

  static async deletarRodada(req: AuthRequest, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const r = await AppDataSource.query(`DELETE FROM pesquisa_rodadas WHERE id = $1 RETURNING id`, [id]);
      if (!r[0]) return res.status(404).json({ error: 'Rodada nao encontrada' });
      res.json({ success: true });
    } catch (e: any) {
      console.error('[PesquisaClima] deletarRodada:', e);
      res.status(500).json({ error: e.message });
    }
  }

  // ===========================================================================
  // PUBLICO (sem auth) - candidato/cliente acessa pelo token
  // ===========================================================================
  static async publicoCarregar(req: Request, res: Response) {
    try {
      const token = req.params.token;
      const [rodada] = await AppDataSource.query(
        `SELECT r.*, m.nome AS modelo_nome, m.descricao AS modelo_descricao, m.cor, m.icone, m.anonima
         FROM pesquisa_rodadas r
         JOIN pesquisa_modelos m ON m.id = r.modelo_id
         WHERE r.token_publico = $1`,
        [token]
      );
      if (!rodada) return res.status(404).json({ error: 'Pesquisa nao encontrada' });
      if (!rodada.aberta) return res.status(403).json({ error: 'Pesquisa fechada' });
      const agora = new Date();
      if (rodada.abre_em && new Date(rodada.abre_em) > agora) return res.status(403).json({ error: 'Pesquisa ainda nao abriu' });
      if (rodada.fecha_em && new Date(rodada.fecha_em) < agora) return res.status(403).json({ error: 'Pesquisa encerrada' });

      const perguntas = await AppDataSource.query(
        `SELECT id, secao, ordem, tipo, enunciado, obrigatoria, configuracao
         FROM pesquisa_perguntas WHERE modelo_id = $1 ORDER BY ordem ASC, id ASC`,
        [rodada.modelo_id]
      );

      // Branding do cliente (logo + nome) — mesmas configs usadas no Sidebar
      const brandConfigs = await AppDataSource.query(
        `SELECT key, value FROM configurations WHERE key IN ('client_brand_name','client_logo_url')`
      );
      const brand: Record<string, string> = {};
      for (const c of brandConfigs) brand[c.key] = c.value;

      // Nao bloqueia mais por IP+UA na carga — gerava falsos positivos quando
      // multiplos respondentes acessavam de redes parecidas / mesmo navegador.
      // O frontend ainda faz a checagem soft via localStorage.
      res.json({
        rodada: { id: rodada.id, nome: rodada.nome, modelo_nome: rodada.modelo_nome, modelo_descricao: rodada.modelo_descricao, cor: rodada.cor, icone: rodada.icone, anonima: rodada.anonima },
        perguntas,
        ja_respondeu: false,
        brand: {
          name: brand.client_brand_name || null,
          logo_url: brand.client_logo_url || null,
        },
      });
    } catch (e: any) {
      console.error('[PesquisaClima] publicoCarregar:', e);
      res.status(500).json({ error: e.message });
    }
  }

  static async publicoSubmeter(req: Request, res: Response) {
    const token = req.params.token;
    const { respostas, tempo_segundos } = req.body;
    if (!Array.isArray(respostas)) return res.status(400).json({ error: 'respostas array obrigatorio' });
    // Defesa em profundidade: nao cria cabecalho se nao veio resposta nenhuma.
    // Isso evitava cabecalhos orfaos com 0 itens quando o frontend mandava []
    // (ja vimos isso acontecer em producao — perda silenciosa de dados).
    if (respostas.length === 0) {
      return res.status(400).json({ error: 'Voce precisa responder antes de enviar' });
    }

    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const [rodada] = await queryRunner.query(
        `SELECT id, modelo_id, aberta, abre_em, fecha_em FROM pesquisa_rodadas WHERE token_publico = $1`,
        [token]
      );
      if (!rodada) { await queryRunner.rollbackTransaction(); return res.status(404).json({ error: 'Pesquisa nao encontrada' }); }
      if (!rodada.aberta) { await queryRunner.rollbackTransaction(); return res.status(403).json({ error: 'Pesquisa fechada' }); }
      const agora = new Date();
      if (rodada.fecha_em && new Date(rodada.fecha_em) < agora) {
        await queryRunner.rollbackTransaction();
        return res.status(403).json({ error: 'Pesquisa encerrada' });
      }

      const perguntas = await queryRunner.query(
        `SELECT id, tipo, obrigatoria, configuracao FROM pesquisa_perguntas WHERE modelo_id = $1`,
        [rodada.modelo_id]
      );
      const respostasMap: Record<number, any> = {};
      respostas.forEach((r: any) => { respostasMap[r.pergunta_id] = r; });

      // Validacao de obrigatoriedade no backend (defesa em profundidade).
      // Espelha o isVazio do frontend pra que mesmo um cliente bugado / fora-do-ar
      // nao consiga gravar pesquisa incompleta.
      const isItemVazio = (p: any, r: any): boolean => {
        if (!r) return true;
        const v = r.valor;
        if (v === undefined || v === null || v === '') return true;
        if (Array.isArray(v) && v.length === 0) return true;
        if (typeof v === 'string' && /^outro:\s*$/i.test(v)) return true;
        if (Array.isArray(v) && v.some((x: any) => typeof x === 'string' && /^outro:\s*$/i.test(x))) return true;
        if (p.tipo === 'rating_5_matriz') {
          const criterios = (p.configuracao && p.configuracao.criterios) || [];
          if (typeof v !== 'object' || Array.isArray(v)) return true;
          return criterios.some((c: string) => v[c] === undefined || v[c] === null || v[c] === '');
        }
        return false;
      };
      const faltando = perguntas
        .filter((p: any) => p.obrigatoria && isItemVazio(p, respostasMap[p.id]));
      if (faltando.length > 0) {
        await queryRunner.rollbackTransaction();
        return res.status(400).json({
          error: 'Responda todas as perguntas obrigatorias antes de enviar',
          perguntas_faltando: faltando.map((p: any) => p.id),
        });
      }

      // Cabecalho da resposta. ip_hash/ua_hash ficam so como auditoria leve
      // (NAO usado mais como bloqueio anti-duplicata).
      const ipHash = sha((req.ip || '') + ':ip');
      const uaHash = sha((req.get('user-agent') || '') + ':ua');
      const [resp] = await queryRunner.query(
        `INSERT INTO pesquisa_respostas (rodada_id, ip_hash, user_agent_hash, tempo_segundos)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [rodada.id, ipHash, uaHash, tempo_segundos || null]
      );
      const respostaId = resp.id;

      // Itens. Tudo dentro da mesma transacao — se algum insert falhar,
      // rollback descarta o cabecalho tambem (sem orfaos).
      for (const p of perguntas) {
        const r = respostasMap[p.id];
        if (!r) continue;
        let valorNumerico: number | null = null;
        let valorTexto: string | null = null;
        let valorOpcoes: any = null;
        let valorMatriz: any = null;
        if (p.tipo === 'rating_5_matriz') {
          valorMatriz = r.valor || {};
          const vals = Object.values(valorMatriz).map((v: any) => Number(v) || 0).filter(v => v > 0);
          if (vals.length > 0) valorNumerico = vals.reduce((a, b) => a + b, 0) / vals.length;
        } else if (p.tipo === 'nps_0_10' || p.tipo === 'rating_5' || p.tipo === 'rating_10') {
          valorNumerico = Number(r.valor);
        } else if (p.tipo === 'sim_nao' || p.tipo === 'multipla_escolha') {
          valorTexto = String(r.valor || '');
        } else if (p.tipo === 'checkbox') {
          valorOpcoes = Array.isArray(r.valor) ? r.valor : [];
        } else if (p.tipo === 'texto_curto' || p.tipo === 'texto_longo') {
          valorTexto = String(r.valor || '').slice(0, 4000);
        }
        await queryRunner.query(
          `INSERT INTO pesquisa_resp_itens
           (resposta_id, pergunta_id, valor_numerico, valor_texto, valor_opcoes, valor_matriz, colaborador_id_avaliado, setor_id_avaliado)
           VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8)`,
          [respostaId, p.id, valorNumerico, valorTexto,
           valorOpcoes ? JSON.stringify(valorOpcoes) : null,
           valorMatriz ? JSON.stringify(valorMatriz) : null,
           r.colaborador_id || null, r.setor_id || null]
        );
      }

      // Contadores agregados na rodada (dentro da transacao tambem)
      await queryRunner.query(`
        UPDATE pesquisa_rodadas SET
          total_respostas = (SELECT COUNT(*) FROM pesquisa_respostas WHERE rodada_id = $1),
          nps_medio = (
            SELECT AVG(ri.valor_numerico)
            FROM pesquisa_resp_itens ri
            JOIN pesquisa_respostas r ON r.id = ri.resposta_id
            JOIN pesquisa_perguntas p ON p.id = ri.pergunta_id
            WHERE r.rodada_id = $1 AND p.tipo = 'nps_0_10'
          ),
          updated_at = NOW()
        WHERE id = $1
      `, [rodada.id]);

      await queryRunner.commitTransaction();
      res.json({ success: true });
    } catch (e: any) {
      try { await queryRunner.rollbackTransaction(); } catch { /* */ }
      console.error('[PesquisaClima] publicoSubmeter:', e);
      res.status(500).json({ error: e.message });
    } finally {
      await queryRunner.release();
    }
  }

  // ===========================================================================
  // DASHBOARD (analise de uma rodada)
  // ===========================================================================
  static async dashboardRodada(req: AuthRequest, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const [rodada] = await AppDataSource.query(`
        SELECT r.*, m.nome AS modelo_nome, m.cor, m.icone
        FROM pesquisa_rodadas r JOIN pesquisa_modelos m ON m.id = r.modelo_id
        WHERE r.id = $1
      `, [id]);
      if (!rodada) return res.status(404).json({ error: 'Rodada nao encontrada' });

      const perguntas = await AppDataSource.query(
        `SELECT id, secao, ordem, tipo, enunciado, configuracao FROM pesquisa_perguntas
         WHERE modelo_id = $1 ORDER BY ordem ASC`,
        [rodada.modelo_id]
      );

      // Pra cada pergunta, agrega
      const analise: any[] = [];
      for (const p of perguntas) {
        const itens = await AppDataSource.query(
          `SELECT valor_numerico, valor_texto, valor_opcoes, valor_matriz
           FROM pesquisa_resp_itens ri
           JOIN pesquisa_respostas r ON r.id = ri.resposta_id
           WHERE r.rodada_id = $1 AND ri.pergunta_id = $2`,
          [id, p.id]
        );
        let analiseP: any = { id: p.id, secao: p.secao, ordem: p.ordem, tipo: p.tipo, enunciado: p.enunciado, total_respostas: itens.length };

        if (p.tipo === 'nps_0_10') {
          const vals = itens.map((i: any) => Number(i.valor_numerico)).filter((v: number) => !isNaN(v));
          const promotores = vals.filter((v: number) => v >= 9).length;
          const detratores = vals.filter((v: number) => v <= 6).length;
          const passivos = vals.length - promotores - detratores;
          const nps = vals.length ? ((promotores - detratores) / vals.length) * 100 : 0;
          analiseP.nps = Math.round(nps);
          analiseP.media = vals.length ? vals.reduce((a: number, b: number) => a + b, 0) / vals.length : 0;
          analiseP.distribuicao = { promotores, passivos, detratores };
        } else if (p.tipo === 'rating_5' || p.tipo === 'rating_10') {
          const vals = itens.map((i: any) => Number(i.valor_numerico)).filter((v: number) => !isNaN(v));
          analiseP.media = vals.length ? vals.reduce((a: number, b: number) => a + b, 0) / vals.length : 0;
          const dist: Record<number, number> = {};
          vals.forEach((v: number) => { dist[v] = (dist[v] || 0) + 1; });
          analiseP.distribuicao = dist;
        } else if (p.tipo === 'rating_5_matriz') {
          const criterios = (p.configuracao?.criterios) || [];
          const medias: Record<string, number> = {};
          // distribuicao_criterios[criterio][nota] = contagem
          const distCrit: Record<string, Record<string, number>> = {};
          for (const c of criterios) {
            const vals = itens.map((i: any) => Number(i.valor_matriz?.[c])).filter((v: number) => v > 0);
            medias[c] = vals.length ? vals.reduce((a: number, b: number) => a + b, 0) / vals.length : 0;
            const d: Record<string, number> = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 };
            vals.forEach((v: number) => { d[String(v)] = (d[String(v)] || 0) + 1; });
            distCrit[c] = d;
          }
          analiseP.medias_criterios = medias;
          analiseP.distribuicao_criterios = distCrit;
          analiseP.escala_labels = p.configuracao?.escala_labels || ['1','2','3','4','5'];
          const todos = itens.map((i: any) => Number(i.valor_numerico)).filter((v: number) => !isNaN(v));
          analiseP.media = todos.length ? todos.reduce((a: number, b: number) => a + b, 0) / todos.length : 0;
        } else if (p.tipo === 'multipla_escolha' || p.tipo === 'sim_nao') {
          const dist: Record<string, number> = {};
          itens.forEach((i: any) => {
            const v = i.valor_texto || '—';
            dist[v] = (dist[v] || 0) + 1;
          });
          analiseP.distribuicao = dist;
        } else if (p.tipo === 'checkbox') {
          const dist: Record<string, number> = {};
          itens.forEach((i: any) => {
            (i.valor_opcoes || []).forEach((o: string) => { dist[o] = (dist[o] || 0) + 1; });
          });
          analiseP.distribuicao = dist;
        } else if (p.tipo === 'texto_curto' || p.tipo === 'texto_longo') {
          analiseP.respostas = itens.map((i: any) => i.valor_texto).filter(Boolean).slice(0, 50);
        }
        analise.push(analiseP);
      }

      res.json({ rodada, analise });
    } catch (e: any) {
      console.error('[PesquisaClima] dashboardRodada:', e);
      res.status(500).json({ error: e.message });
    }
  }

  // Compara varias rodadas do mesmo modelo (evolucao temporal)
  static async comparativoEvolucao(req: AuthRequest, res: Response) {
    try {
      const modeloId = parseInt(req.params.id);
      const rodadas = await AppDataSource.query(`
        SELECT r.id, r.nome, r.created_at,
          (SELECT COUNT(*)::int FROM pesquisa_respostas WHERE rodada_id = r.id) AS total_respostas,
          r.nps_medio
        FROM pesquisa_rodadas r WHERE r.modelo_id = $1 ORDER BY r.created_at ASC
      `, [modeloId]);

      const perguntas = await AppDataSource.query(
        `SELECT id, secao, ordem, tipo, enunciado FROM pesquisa_perguntas
         WHERE modelo_id = $1 AND tipo IN ('nps_0_10','rating_5','rating_10','rating_5_matriz')
         ORDER BY ordem ASC`,
        [modeloId]
      );

      // Pra cada pergunta numerica + cada rodada: calcula media
      const matriz: any[] = [];
      for (const p of perguntas) {
        const linha: any = { pergunta_id: p.id, enunciado: p.enunciado, secao: p.secao, valores: [] };
        for (const r of rodadas) {
          const [agg] = await AppDataSource.query(
            `SELECT AVG(ri.valor_numerico)::float AS media FROM pesquisa_resp_itens ri
             JOIN pesquisa_respostas resp ON resp.id = ri.resposta_id
             WHERE resp.rodada_id = $1 AND ri.pergunta_id = $2`,
            [r.id, p.id]
          );
          linha.valores.push({ rodada_id: r.id, rodada_nome: r.nome, media: agg?.media || 0 });
        }
        matriz.push(linha);
      }

      res.json({ rodadas, matriz });
    } catch (e: any) {
      console.error('[PesquisaClima] comparativoEvolucao:', e);
      res.status(500).json({ error: e.message });
    }
  }

  // ===========================================================================
  // NR-1: DIAGNOSTICO FAROL
  // Agrega respostas de UM modelo NR-1 por (rodada x dimensao_nr1).
  // Cada pergunta tem na configuracao.dimensao_nr1 e configuracao.inverter_escala.
  // Score 0-100: 100 = melhor; 0 = pior. Inverter aplicado quando "Sempre"=ruim.
  // ===========================================================================
  static async diagnosticoNr1(req: AuthRequest, res: Response) {
    try {
      const modeloId = parseInt(req.params.modeloId);
      const escalaFreq = ['Sempre', 'Muitas vezes', 'Às vezes', 'Raramente', 'Nunca'];
      const escalaSaude = ['Excelente', 'Muito boa', 'Boa', 'Razoável', 'Ruim'];

      // Carrega perguntas com mapeamento de dimensao
      const perguntas = await AppDataSource.query(
        `SELECT id, secao, enunciado, tipo, configuracao FROM pesquisa_perguntas WHERE modelo_id = $1 ORDER BY ordem`,
        [modeloId]
      );

      // Rodadas abertas/fechadas do modelo
      const rodadas = await AppDataSource.query(
        `SELECT r.id, r.nome, r.aberta, r.created_at,
                (SELECT COUNT(*)::int FROM pesquisa_respostas WHERE rodada_id = r.id) AS total_respostas
         FROM pesquisa_rodadas r WHERE r.modelo_id = $1 ORDER BY r.created_at DESC`,
        [modeloId]
      );

      // Todas as respostas + itens de uma vez (mais eficiente)
      const itens = await AppDataSource.query(
        `SELECT ri.pergunta_id, ri.valor_texto, resp.rodada_id
         FROM pesquisa_resp_itens ri
         JOIN pesquisa_respostas resp ON resp.id = ri.resposta_id
         JOIN pesquisa_rodadas r ON r.id = resp.rodada_id
         WHERE r.modelo_id = $1 AND ri.valor_texto IS NOT NULL`,
        [modeloId]
      );

      // Mapa pergunta_id -> {dimensao, inverter, escala}
      const pmap = new Map<number, { dimensao: string; bloco: string; inverter: boolean; escala: string[] }>();
      for (const p of perguntas) {
        const cfg = typeof p.configuracao === 'string' ? JSON.parse(p.configuracao) : (p.configuracao || {});
        if (!cfg.dimensao_nr1) continue;
        const escala = Array.isArray(cfg.opcoes) ? cfg.opcoes : (cfg.dimensao_nr1 === 'saude_geral' ? escalaSaude : escalaFreq);
        pmap.set(p.id, {
          dimensao: cfg.dimensao_nr1,
          bloco: cfg.bloco_nr1 || 'outros',
          inverter: !!cfg.inverter_escala,
          escala,
        });
      }

      // Agrega: { [rodadaId]: { [dimensao]: { soma, count, bloco } } }
      const agg: Record<string, Record<string, { soma: number; count: number; bloco: string }>> = {};
      for (const it of itens) {
        const p = pmap.get(it.pergunta_id);
        if (!p) continue;
        const idx = p.escala.indexOf(it.valor_texto);
        if (idx < 0) continue;
        // Score por resposta: idx vai de 0..4 (5 opcoes). Normaliza pra 0..100.
        // Se inverter=true, "Sempre" (idx 0) = pior = score 0.
        // Se inverter=false, "Sempre" (idx 0) = melhor = score 100.
        // Formula: inverter ? idx*25 : (4-idx)*25  (com escala de 5 niveis)
        const niveis = p.escala.length - 1;
        const scoreItem = p.inverter ? (idx / niveis) * 100 : ((niveis - idx) / niveis) * 100;
        const rk = String(it.rodada_id);
        if (!agg[rk]) agg[rk] = {};
        if (!agg[rk][p.dimensao]) agg[rk][p.dimensao] = { soma: 0, count: 0, bloco: p.bloco };
        agg[rk][p.dimensao].soma += scoreItem;
        agg[rk][p.dimensao].count += 1;
      }

      // Monta saida: lista de { rodada_id, rodada_nome, total_respostas, dimensoes: [{dimensao, bloco, score, classificacao}] }
      const classificar = (score: number) => {
        // Score representa "qualidade" 0-100 (100=otimo). Risco e o inverso.
        // Verde: score >= 67 (risco baixo)
        // Amarelo: 34-66 (risco medio)
        // Vermelho: < 34 (risco alto)
        if (score >= 67) return 'verde';
        if (score >= 34) return 'amarelo';
        return 'vermelho';
      };

      const setores = rodadas.map((r: any) => {
        const dims = agg[String(r.id)] || {};
        const dimensoes = Object.entries(dims).map(([dimensao, v]) => {
          const score = v.count > 0 ? Math.round(v.soma / v.count) : null;
          return {
            dimensao,
            bloco: v.bloco,
            score,
            classificacao: score !== null ? classificar(score) : null,
            n_respostas: v.count,
          };
        });
        return {
          rodada_id: r.id,
          rodada_nome: r.nome,
          total_respostas: r.total_respostas,
          dimensoes,
        };
      });

      // Lista de TODAS as dimensoes possiveis (pra montar header do heatmap)
      const todasDimensoes = Array.from(new Set(Array.from(pmap.values()).map(v => v.dimensao)));

      res.json({ setores, todasDimensoes });
    } catch (e: any) {
      console.error('[PesquisaClima] diagnosticoNr1:', e);
      res.status(500).json({ error: e.message });
    }
  }
}
