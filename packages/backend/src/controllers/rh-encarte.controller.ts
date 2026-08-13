import { Response } from 'express';
import { AppDataSource } from '../config/database';
import { AuthRequest } from '../middleware/auth';
import { minioService } from '../services/minio.service';

/**
 * PADRAO DE ENCARTE — modelos de arte de divulgacao de vaga.
 *
 * Um modelo por cargo (+ um curinga com cargo_id NULL). Guarda a imagem de fundo
 * e a posicao de cada caixa de texto em PORCENTAGEM, pra mesma arte exportar em
 * 1080x1350, 1080x1080 e 1080x1920 sem reposicionar.
 *
 * A renderizacao acontece no NAVEGADOR (canvas): o preview precisa ser ao vivo
 * enquanto o RH digita, e desenhar no servidor obrigaria a instalar fonte na VPS
 * e ir/voltar a cada tecla.
 */

/** Campos que o encarte sabe preencher. `chave` e o que casa com os dados da vaga. */
const CAMPOS_PADRAO = [
  { chave: 'cargo', label: 'Cargo' },
  { chave: 'jornada', label: 'Jornada' },
  { chave: 'salario', label: 'Salário' },
  { chave: 'experiencia', label: 'Experiência' },
  { chave: 'atividades', label: 'Atividades' },
  { chave: 'beneficios', label: 'Benefícios' },
  { chave: 'diferencial', label: 'Diferencial' },
];

const CHAVES_VALIDAS = new Set(CAMPOS_PADRAO.map((c) => c.chave));

/**
 * Saneia os TEXTOS vindos do formulario — nunca confiar no payload do front.
 * Guarda como objeto { chave: texto }, nao mais coordenadas: quem monta o
 * layout agora e a IA, a partir da arte de referencia.
 */
function sanearValores(campos: any): Record<string, string> {
  const out: Record<string, string> = {};
  if (!campos || typeof campos !== 'object') return out;
  for (const [k, v] of Object.entries(campos)) {
    // `orientacao` e o campo livre pra dar instrucao extra a IA (nao vai como
    // texto na arte, vai como direcionamento) — por isso aceita mais caracteres.
    if (k === 'orientacao') { out[k] = String(v ?? '').slice(0, 1200); continue; }
    if (!CHAVES_VALIDAS.has(k)) continue;
    // Teto de tamanho: texto gigante estoura o prompt e a arte fica ilegivel
    out[k] = String(v ?? '').slice(0, 600);
  }
  return out;
}

/** Modelos de imagem tentados em ordem — o 1o que a chave do cliente aceitar vence. */
const MODELOS_IMAGEM = ['gpt-image-2', 'gpt-image-1.5', 'gpt-image-1'];

/** Tamanho pedido a API por preset de feed. */
const TAMANHO_API: Record<string, string> = {
  feed_4_5: '1024x1536',   // retrato — o mais proximo de 4:5 que a API entrega
  feed_1_1: '1024x1024',
  story_9_16: '1024x1536',
};

/** Monta o prompt em portugues com os textos EXATOS que precisam sair na arte. */
function montarPrompt(valores: Record<string, string>, extras: { empresa?: string }): string {
  const linha = (rotulo: string, chave: string) =>
    valores[chave]?.trim() ? `- ${rotulo}: "${valores[chave].trim()}"` : null;

  const blocos = [
    linha('CARGO (título principal, o maior texto da arte)', 'cargo'),
    linha('JORNADA', 'jornada'),
    linha('SALÁRIO', 'salario'),
    linha('EXPERIÊNCIA', 'experiencia'),
    linha('ATIVIDADES', 'atividades'),
    linha('BENEFÍCIOS', 'beneficios'),
    linha('DIFERENCIAL', 'diferencial'),
  ].filter(Boolean).join('\n');

  return [
    'Gere uma arte de divulgação de VAGA DE EMPREGO para redes sociais (feed do Instagram),',
    'em português do Brasil, no formato retrato.',
    '',
    'IMPORTANTE — use a imagem enviada como REFERÊNCIA VISUAL: mantenha a mesma identidade',
    'visual, a mesma paleta de cores, o mesmo logotipo e o mesmo estilo gráfico dela.',
    'Mantenha o cabeçalho de chamada (ex.: "TEMOS VAGA!") e o rodapé de chamada para ação.',
    'Troque apenas os textos das informações da vaga pelos textos abaixo.',
    '',
    'ESCREVA EXATAMENTE ESTES TEXTOS, sem alterar nenhum caractere, número ou pontuação:',
    blocos,
    extras.empresa ? `- EMPRESA: "${extras.empresa}"` : '',
    '',
    'Regras: todo texto deve ficar legível e sem erro de ortografia; não invente informação',
    'que não esteja na lista; não escreva texto em inglês; mantenha bastante contraste entre',
    'o texto e o fundo; organize as informações em blocos/cartões bem separados.',
    valores.orientacao?.trim()
      ? `\nORIENTAÇÃO ADICIONAL DO RH (siga também):\n${valores.orientacao.trim()}`
      : '',
  ].filter(Boolean).join('\n');
}

export class RhEncarteController {
  /** Catalogo de campos que podem ir no encarte (o front monta a paleta com isto). */
  static async listarCampos(_req: AuthRequest, res: Response) {
    res.json({ success: true, data: CAMPOS_PADRAO });
  }

  /** Lista todos os modelos com o nome do cargo. */
  static async listar(_req: AuthRequest, res: Response) {
    try {
      const rows = await AppDataSource.query(`
        SELECT m.*, c.nome AS cargo_nome
        FROM rh_encarte_modelos m
        LEFT JOIN rh_cargos c ON c.id = m.cargo_id
        WHERE m.ativo = true
        ORDER BY (m.cargo_id IS NULL) DESC, c.nome ASC
      `);
      res.json({ success: true, data: rows });
    } catch (e: any) {
      console.error('[RhEncarte] listar:', e);
      res.status(500).json({ success: false, error: e.message });
    }
  }

  /**
   * Modelo de um cargo. Cai no curinga (cargo_id NULL) se o cargo nao tiver arte
   * propria — assim uma vaga de cargo novo ainda gera encarte.
   */
  static async obterPorCargo(req: AuthRequest, res: Response) {
    try {
      const cargoId = parseInt(req.params.cargoId, 10);
      const rows = await AppDataSource.query(
        `SELECT m.*, c.nome AS cargo_nome
           FROM rh_encarte_modelos m
           LEFT JOIN rh_cargos c ON c.id = m.cargo_id
          WHERE m.ativo = true AND (m.cargo_id = $1 OR m.cargo_id IS NULL)
          ORDER BY (m.cargo_id IS NULL) ASC
          LIMIT 1`,
        [isNaN(cargoId) ? null : cargoId]
      );
      res.json({ success: true, data: rows[0] || null });
    } catch (e: any) {
      console.error('[RhEncarte] obterPorCargo:', e);
      res.status(500).json({ success: false, error: e.message });
    }
  }

  /**
   * Puxa os dados JA CADASTRADOS pra pre-preencher o encarte.
   *
   * Prioridade: a vaga ABERTA mais recente daquele cargo (e o dado mais fiel do
   * que esta sendo anunciado). Se nao houver vaga aberta, cai na ultima vaga
   * qualquer; se nao houver vaga nenhuma, usa o cadastro do proprio cargo
   * (salario_base / descritivo_atividades) pra tela nao nascer vazia.
   */
  static async dadosDaVaga(req: AuthRequest, res: Response) {
    try {
      const cargoId = parseInt(req.params.cargoId, 10);
      if (isNaN(cargoId)) return res.status(400).json({ success: false, error: 'Cargo inválido' });

      const vagas = await AppDataSource.query(
        `SELECT v.*, j.nome AS jornada_nome
           FROM rh_vagas v
           LEFT JOIN rh_jornadas j ON j.id = v.jornada_id
          WHERE v.cargo_id = $1
          ORDER BY (LOWER(COALESCE(v.status,'')) LIKE '%aberta%'
                 OR LOWER(COALESCE(v.status,'')) LIKE '%selec%') DESC,
                   v.data_abertura DESC NULLS LAST, v.id DESC
          LIMIT 1`,
        [cargoId]
      );
      const vaga = vagas[0] || null;

      const cargos = await AppDataSource.query(
        `SELECT id, nome, salario_base, descritivo_atividades, requisitos
           FROM rh_cargos WHERE id = $1`,
        [cargoId]
      );
      const cargo = cargos[0] || null;

      const jornadas = await AppDataSource.query(
        `SELECT id, nome, carga_horaria FROM rh_jornadas WHERE ativo = true ORDER BY nome`
      );
      // Escala (6x1, 5x2, 12x36…) vem do cadastro. ⚠️ rh_vagas NAO guarda escala,
      // entao aqui e escolha manual do RH — nao da pra pre-selecionar pela vaga.
      const escalas = await AppDataSource.query(
        `SELECT id, nome, descricao FROM rh_escalas WHERE ativo = true ORDER BY nome`
      );

      const dinheiro = (v: any) =>
        v === null || v === undefined || v === '' ? ''
          : `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

      const hhmm = (t: any) => (t ? String(t).substring(0, 5) : '');

      const experiencia = vaga
        ? (vaga.experiencia_obrigatoria
            ? (vaga.experiencia_meses_minimo
                ? `Mínimo de ${vaga.experiencia_meses_minimo} meses de experiência`
                : 'Exige experiência na função')
            : 'Não exige experiência')
        : '';

      res.json({
        success: true,
        data: {
          tem_vaga: !!vaga,
          vaga_id: vaga?.id || null,
          vaga_status: vaga?.status || null,
          jornadas,
          escalas,
          // Slugs dos turnos marcados na vaga (ex: ["manha"]) — o front traduz
          // pro rotulo usando a MESMA lista da tela de Vagas.
          turnos: Array.isArray(vaga?.turnos) ? vaga.turnos : [],
          // O front usa isto pra preencher os campos e o bloco de horários
          sugestao: {
            cargo: (vaga?.titulo || cargo?.nome || '').toString().toUpperCase(),
            salario: dinheiro(vaga?.salario_min ?? cargo?.salario_base),
            experiencia,
            atividades: (vaga?.requisitos || cargo?.descritivo_atividades || '').toString(),
            // ⚠️ `beneficios` da vaga vai pro campo BENEFICIOS, nao pro Diferencial —
            // sao coisas diferentes (VT/VR x o que faz o candidato se destacar).
            beneficios: (vaga?.beneficios || '').toString(),
            diferencial: (cargo?.requisitos || '').toString(),
          },
          jornada: {
            jornada_id: vaga?.jornada_id || null,
            jornada_nome: vaga?.jornada_nome || null,
            hora_entrada: hhmm(vaga?.hora_entrada),
            hora_almoco_ini: hhmm(vaga?.hora_almoco_ini),
            hora_almoco_fim: hhmm(vaga?.hora_almoco_fim),
            hora_saida: hhmm(vaga?.hora_saida),
          },
        },
      });
    } catch (e: any) {
      console.error('[RhEncarte] dadosDaVaga:', e);
      res.status(500).json({ success: false, error: e.message });
    }
  }

  /** Cria ou atualiza o modelo do cargo (upsert pelo indice unico). */
  static async salvar(req: AuthRequest, res: Response) {
    try {
      const { id, cargo_id, nome, imagem_url, imagem_largura, imagem_altura, preset_export, campos } = req.body || {};
      if (!nome || !String(nome).trim()) {
        return res.status(400).json({ success: false, error: 'Nome do modelo é obrigatório' });
      }
      const cargoId = cargo_id === null || cargo_id === undefined || cargo_id === '' ? null : parseInt(cargo_id, 10);
      const preset = ['feed_4_5', 'feed_1_1', 'story_9_16'].includes(preset_export) ? preset_export : 'feed_4_5';
      const camposLimpos = JSON.stringify(sanearValores(campos));

      // ⚠️ COALESCE no imagem_url: um save que venha sem a imagem NAO pode apagar
      // a referencia ja gravada. Antes, qualquer payload sem `imagem_url` zerava
      // a arte do cargo e o RH tinha que subir tudo de novo sem entender por que.
      // Pra TROCAR a arte existe o botao "Trocar"; pra remover, apagar o modelo.
      if (id) {
        const r = await AppDataSource.query(
          `UPDATE rh_encarte_modelos
              SET cargo_id=$1, nome=$2,
                  imagem_url=COALESCE($3, imagem_url),
                  imagem_largura=COALESCE($4, imagem_largura),
                  imagem_altura=COALESCE($5, imagem_altura),
                  preset_export=$6, campos=$7::jsonb, updated_at=NOW()
            WHERE id=$8 RETURNING *`,
          [cargoId, String(nome).trim(), imagem_url || null, imagem_largura || null,
           imagem_altura || null, preset, camposLimpos, parseInt(id, 10)]
        );
        return res.json({ success: true, data: r[0] });
      }

      // ⚠️ O modelo curinga (cargo_id NULL) NAO entra no ON CONFLICT abaixo: o indice
      // dele e parcial sobre a expressao (cargo_id IS NULL), e o Postgres nao infere
      // esse alvo. Sem este ramo, o 2o salvamento do curinga estouraria unique violation
      // em vez de atualizar.
      if (cargoId === null || isNaN(cargoId as number)) {
        const existente = await AppDataSource.query(
          `SELECT id FROM rh_encarte_modelos WHERE cargo_id IS NULL LIMIT 1`
        );
        if (existente.length) {
          const upd = await AppDataSource.query(
            `UPDATE rh_encarte_modelos
                SET nome=$1,
                    imagem_url=COALESCE($2, imagem_url),
                    imagem_largura=COALESCE($3, imagem_largura),
                    imagem_altura=COALESCE($4, imagem_altura),
                    preset_export=$5, campos=$6::jsonb, ativo=true, updated_at=NOW()
              WHERE id=$7 RETURNING *`,
            [String(nome).trim(), imagem_url || null, imagem_largura || null,
             imagem_altura || null, preset, camposLimpos, existente[0].id]
          );
          return res.json({ success: true, data: upd[0] });
        }
        const ins = await AppDataSource.query(
          `INSERT INTO rh_encarte_modelos
             (cargo_id, nome, imagem_url, imagem_largura, imagem_altura, preset_export, campos, padrao)
           VALUES (NULL,$1,$2,$3,$4,$5,$6::jsonb,true) RETURNING *`,
          [String(nome).trim(), imagem_url || null, imagem_largura || null,
           imagem_altura || null, preset, camposLimpos]
        );
        return res.json({ success: true, data: ins[0] });
      }

      // Upsert: se ja existe modelo pro cargo, atualiza em vez de estourar o indice unico
      const r = await AppDataSource.query(
        `INSERT INTO rh_encarte_modelos
           (cargo_id, nome, imagem_url, imagem_largura, imagem_altura, preset_export, campos)
         VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)
         ON CONFLICT (cargo_id) WHERE cargo_id IS NOT NULL
         DO UPDATE SET nome=EXCLUDED.nome,
                       imagem_url=COALESCE(EXCLUDED.imagem_url, rh_encarte_modelos.imagem_url),
                       imagem_largura=COALESCE(EXCLUDED.imagem_largura, rh_encarte_modelos.imagem_largura),
                       imagem_altura=COALESCE(EXCLUDED.imagem_altura, rh_encarte_modelos.imagem_altura),
                       preset_export=EXCLUDED.preset_export, campos=EXCLUDED.campos, updated_at=NOW()
         RETURNING *`,
        [cargoId, String(nome).trim(), imagem_url || null, imagem_largura || null,
         imagem_altura || null, preset, camposLimpos]
      );
      res.json({ success: true, data: r[0] });
    } catch (e: any) {
      console.error('[RhEncarte] salvar:', e);
      res.status(500).json({ success: false, error: e.message });
    }
  }

  static async deletar(req: AuthRequest, res: Response) {
    try {
      await AppDataSource.query(`DELETE FROM rh_encarte_modelos WHERE id=$1`, [parseInt(req.params.id, 10)]);
      res.json({ success: true });
    } catch (e: any) {
      console.error('[RhEncarte] deletar:', e);
      res.status(500).json({ success: false, error: e.message });
    }
  }

  /**
   * GERA a arte com IA a partir da imagem de referencia + os textos preenchidos.
   *
   * Usa a MESMA `openai_api_key` que o resto do sistema (Configuracoes -> IA).
   * Vai no endpoint de EDICAO de imagem (`/v1/images/edits`) e nao no de geracao
   * pura, porque so a edicao aceita a arte de referencia como entrada — e a
   * referencia e justamente o que carrega cor, logotipo e estilo do cliente.
   *
   * ⚠️ Tenta os modelos em ordem: a chave de cada cliente pode nao ter acesso ao
   * mais novo. O 1o que responder vence, e devolvemos qual foi.
   */
  static async gerar(req: AuthRequest, res: Response) {
    try {
      const { ConfigurationService } = await import('../services/configuration.service');
      const apiKey = await ConfigurationService.get('openai_api_key');
      if (!apiKey) {
        return res.status(400).json({
          success: false,
          error: 'Chave da OpenAI não configurada. Vá em Configurações → IA → Chave API.',
        });
      }

      const { referencia_url, campos, preset_export, empresa } = req.body || {};
      if (!referencia_url) {
        return res.status(400).json({ success: false, error: 'Suba a arte de referência primeiro.' });
      }
      const valores = sanearValores(campos);
      if (!valores.cargo?.trim()) {
        return res.status(400).json({ success: false, error: 'Preencha ao menos o Cargo.' });
      }

      // Baixa a referencia do MinIO pra mandar como entrada da edicao
      const respImg = await fetch(referencia_url);
      if (!respImg.ok) {
        return res.status(400).json({ success: false, error: 'Não consegui ler a arte de referência.' });
      }
      const bufRef = Buffer.from(await respImg.arrayBuffer());
      const mimeRef = respImg.headers.get('content-type') || 'image/png';

      const prompt = montarPrompt(valores, { empresa });
      const size = TAMANHO_API[preset_export] || TAMANHO_API.feed_4_5;

      let ultimoErro = 'Falha desconhecida';
      for (const modelo of MODELOS_IMAGEM) {
        try {
          const fd = new FormData();
          fd.append('model', modelo);
          fd.append('prompt', prompt);
          fd.append('size', size);
          fd.append('n', '1');
          fd.append('image', new Blob([new Uint8Array(bufRef)], { type: mimeRef }), 'referencia.png');

          const r = await fetch('https://api.openai.com/v1/images/edits', {
            method: 'POST',
            headers: { Authorization: `Bearer ${apiKey}` },
            body: fd as any,
          });
          const json: any = await r.json();

          if (!r.ok) {
            ultimoErro = json?.error?.message || `HTTP ${r.status}`;
            // Modelo indisponivel pra esta chave -> tenta o proximo da lista
            if (/model|not found|does not exist|unsupported|access/i.test(ultimoErro)) continue;
            break;
          }

          const b64 = json?.data?.[0]?.b64_json;
          const urlDireta = json?.data?.[0]?.url;
          let bufOut: Buffer | null = null;
          if (b64) bufOut = Buffer.from(b64, 'base64');
          else if (urlDireta) bufOut = Buffer.from(await (await fetch(urlDireta)).arrayBuffer());
          if (!bufOut) { ultimoErro = 'A IA não devolveu imagem.'; continue; }

          const objectName = `encartes/gerados/${Date.now()}_${Math.random().toString(36).slice(2, 10)}.png`;
          const url = await minioService.uploadFile(objectName, bufOut, 'image/png');
          return res.json({ success: true, url, modelo_usado: modelo });
        } catch (err: any) {
          ultimoErro = err?.message || String(err);
        }
      }

      return res.status(502).json({
        success: false,
        error: `Não consegui gerar a arte. Último erro: ${ultimoErro}`,
      });
    } catch (e: any) {
      console.error('[RhEncarte] gerar:', e);
      res.status(500).json({ success: false, error: e.message });
    }
  }

  /**
   * Envia as artes geradas pros grupos de WhatsApp configurados.
   * `teste: true` manda só pro primeiro grupo (pra conferir antes de disparar).
   */
  static async enviarWhatsapp(req: AuthRequest, res: Response) {
    try {
      const { EncarteWhatsService } = await import('../services/encarte-whats.service');
      const { urls, legenda, teste } = req.body || {};
      const r = await EncarteWhatsService.enviar(urls, legenda, teste === true);
      res.json({ success: true, ...r });
    } catch (e: any) {
      console.error('[RhEncarte] enviarWhatsapp:', e);
      res.status(400).json({ success: false, error: e.message });
    }
  }

  /** Grupos configurados pro encarte — o front mostra pra onde vai antes de enviar. */
  static async gruposConfigurados(_req: AuthRequest, res: Response) {
    try {
      const { EncarteWhatsService } = await import('../services/encarte-whats.service');
      const { grupos, intervalo, legendaPadrao } = await EncarteWhatsService.getConfig();
      res.json({ success: true, data: { grupos, intervalo, legendaPadrao } });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  }

  /** Upload da arte de fundo. Mesmo caminho da foto do candidato (MinIO). */
  static async uploadImagem(req: AuthRequest, res: Response) {
    try {
      const file = (req as any).file;
      if (!file) return res.status(400).json({ success: false, error: 'Arquivo obrigatório' });
      const mime = file.mimetype || '';
      if (!mime.startsWith('image/')) {
        return res.status(400).json({ success: false, error: 'Envie uma imagem (JPG ou PNG)' });
      }
      const ext = (file.originalname || 'png').split('.').pop() || 'png';
      const objectName = `encartes/modelos/${Date.now()}_${Math.random().toString(36).slice(2, 10)}.${ext}`;
      const url = await minioService.uploadFile(objectName, file.buffer, mime);
      res.json({ success: true, url });
    } catch (e: any) {
      console.error('[RhEncarte] uploadImagem:', e);
      res.status(500).json({ success: false, error: e.message });
    }
  }
}
