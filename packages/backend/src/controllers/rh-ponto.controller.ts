import { Response } from 'express';
import { AppDataSource } from '../config/database';
import { AuthRequest } from '../middleware/auth';
import { RhidService } from '../services/rhid.service';

const fmtHora = (h: any) => { const s = String(h ?? '').padStart(4, '0'); return `${s.slice(0, 2)}:${s.slice(2, 4)}`; };
const fmtDia = (ymd: string) => `${ymd.slice(6, 8)}/${ymd.slice(4, 6)}/${ymd.slice(0, 4)}`;

// ---------- Indicadores de Ponto/Ausências (agregação da apuração RHiD) ----------
const _indCache = new Map<string, { at: number; data: any }>();
const IND_TTL = 20 * 60 * 1000;   // 20 min
/** Invalida o cache dos indicadores — chamado quando um colaborador é criado/editado/excluído
 * (ex: marcar "não bate ponto" tem que refletir na hora, sem precisar clicar em Recalcular). */
export function limparCacheIndicadores() { _indCache.clear(); }
const MES_LABEL = ['', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const _pisNorm = (s: any) => String(s || '').replace(/\D/g, '').replace(/^0+/, '');

/** Executa fn nos itens com no máximo n em paralelo. */
async function _mapPool<T>(items: T[], n: number, fn: (t: T) => Promise<void>): Promise<void> {
  let idx = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (idx < items.length) { const i = idx++; await fn(items[i]); }
  }));
}

/** Classifica um dia da apuração e extrai os minutos por categoria. */
function _classificaDia(d: any) {
  const jorStr = String(d.strHorarioContratualSimples || '').trim();
  const bat = d.listAfdtManutencao || [];
  const ehPunch = (b: any) => b._typeEntradaSaida === 'E' || b._typeEntradaSaida === 'S' || (b._typeEntradaSaida === 'D' && b.idAfd != null && !b.abreviationJustification);
  const temReal = bat.some(ehPunch);
  const soJust = bat.length > 0 && bat.every((b: any) => b._typeEntradaSaida === 'D' && !ehPunch(b));
  const isFeriado = d.isHoliday === 1;
  const isFalta = !!d.faltaDiaInteiro || (d.faltasDiasInteiro || 0) > 0;
  let status: string;
  if (isFeriado) status = 'feriado'; else if (isFalta) status = 'falta';
  else if (soJust && !temReal) status = 'atestado';
  else if (!jorStr && !temReal) status = 'folga'; else status = 'trabalhou';
  const uteis = d.horasUteis || 0;   // jornada prevista do dia (min)
  return {
    status, ymd: String(d.dateTimeStr || '').slice(0, 8), mes: +String(d.dateTimeStr || '').slice(4, 6),
    jornada: (status === 'folga' || status === 'feriado') ? 0 : uteis,
    trabalhado: d.totalHorasTrabalhadas || 0,
    // atraso/saída-antecipada só conta em dia trabalhado (senão duplica com a falta do dia)
    atraso: status === 'trabalhou' ? (d.horasFaltaAtraso || 0) : 0,
    abono: d.minutosAbono || 0, he: d.horasExtrasCalculadas || 0,
    falta: status === 'falta' ? uteis : 0, atestado: status === 'atestado' ? uteis : 0,
  };
}

/** Bradford Factor = episódios² × dias de ausência (penaliza faltas curtas e frequentes). */
function _bradford(dias: string[] | undefined): number {
  if (!dias?.length) return 0;
  const ord = [...new Set(dias)].sort();
  let ep = 1;
  for (let i = 1; i < ord.length; i++) {
    const a = new Date(+ord[i - 1].slice(0, 4), +ord[i - 1].slice(4, 6) - 1, +ord[i - 1].slice(6, 8));
    const b = new Date(+ord[i].slice(0, 4), +ord[i].slice(4, 6) - 1, +ord[i].slice(6, 8));
    if ((b.getTime() - a.getTime()) / 86400000 > 1) ep++;
  }
  return ep * ep * ord.length;
}

export class RhPontoController {
  /** Testa conexão com a nuvem RHiD (usa a config salva). */
  static async statusRelogio(_req: AuthRequest, res: Response) {
    try {
      const info = await RhidService.testarConexao();
      // Último sync do(s) relógio(s) com a nuvem — indica a "validade" do dado.
      const dispositivos = await RhidService.listarDispositivos().catch(() => [] as any[]);
      const syncs = dispositivos.map(d => d.lastSyncMs || 0).filter(Boolean);
      const ultimoSyncMs = syncs.length ? Math.max(...syncs) : null;
      const ativos = dispositivos.filter(d => d.status === 'OK');
      return res.json({ fonte: 'RHiD', ...info, dispositivos, ultimo_sync_ms: ultimoSyncMs, relogios_ok: ativos.length });
    } catch (err: any) {
      return res.status(502).json({ ok: false, error: err?.message || 'Falha ao conectar na RHiD' });
    }
  }

  /** Testa credenciais digitadas (sem salvar) — pro botão "Testar Conexão" da config. */
  static async testarCredenciais(req: AuthRequest, res: Response) {
    try {
      const { email, senha, dominio, base } = req.body || {};
      if (!email || !senha) return res.json({ success: false, message: 'Informe e-mail e senha' });
      const info = await RhidService.testarLoginManual(email, senha, dominio, base);
      return res.json({ success: true, message: `Conexão OK com a RHiD (${info.ms}ms)`, data: info });
    } catch (err: any) {
      return res.json({ success: false, message: err?.response?.data?.error || err?.message || 'Falha ao conectar na RHiD' });
    }
  }

  /**
   * Sincroniza o PIS dos colaboradores com a RHiD (casa por CPF, depois por nome).
   * Preenche/atualiza rh_colaboradores.pis_pasep com o PIS oficial da RHiD.
   */
  static async sincronizarPis(_req: AuthRequest, res: Response) {
    try {
      const norm = (s: any) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
        .toUpperCase().replace(/[^A-Z ]/g, ' ').replace(/\s+/g, ' ').trim();
      const cpfN = (s: any) => { const d = String(s || '').replace(/\D/g, ''); return d ? d.padStart(11, '0') : ''; };

      const pessoas = await RhidService.listarPessoas();
      const porCpf = new Map<string, any>(), porNome = new Map<string, any>();
      for (const p of pessoas) {
        const c = cpfN(p.cpf); if (c && c !== '00000000000') porCpf.set(c, p);
        const n = norm(p.name); if (n && !porNome.has(n)) porNome.set(n, p);
      }

      const colabs = await AppDataSource.query(
        `SELECT id, nome, cpf, pis_pasep FROM rh_colaboradores WHERE status = 'ativo'`
      );
      let vinculados = 0, jaComPis = 0;
      const naoEncontrados: string[] = [];
      for (const c of colabs) {
        const p = porCpf.get(cpfN(c.cpf)) || porNome.get(norm(c.nome));
        if (p && p.pis && String(p.pis).replace(/\D/g, '')) {
          await AppDataSource.query(`UPDATE rh_colaboradores SET pis_pasep = $1 WHERE id = $2`, [String(p.pis), c.id]);
          vinculados++;
        } else if (c.pis_pasep && String(c.pis_pasep).replace(/\D/g, '')) {
          jaComPis++;
        } else {
          naoEncontrados.push(c.nome);
        }
      }
      return res.json({ success: true, vinculados, ja_com_pis: jaComPis, nao_encontrados: naoEncontrados });
    } catch (err: any) {
      console.error('[PONTO] sincronizarPis:', err?.message);
      return res.status(502).json({ success: false, message: err?.message || 'Falha ao sincronizar PIS com a RHiD' });
    }
  }

  /** Lista as empresas da conta RHiD (pra associar com as lojas). */
  static async empresasRhid(_req: AuthRequest, res: Response) {
    try {
      const empresas = await RhidService.listarEmpresas();
      return res.json({ success: true, empresas });
    } catch (err: any) {
      return res.status(502).json({ success: false, message: err?.message || 'Falha ao listar empresas da RHiD' });
    }
  }

  /** Conjuntos de PIS e CPF (normalizados) que o relógio/RHiD conhece — pra marcar no
   * cadastro quais colaboradores o relógio identifica (verde) ou não (vermelho).
   * Casa por CPF OU PIS (CPF é mais confiável / mais preenchido). */
  static async pisVinculados(_req: AuthRequest, res: Response) {
    try {
      const pessoas = await RhidService.listarPessoas();
      const cpfN = (s: any) => { const d = String(s || '').replace(/\D/g, ''); return d && d !== '00000000000' ? d.padStart(11, '0') : ''; };
      const pis = [...new Set(pessoas.map((p: any) => _pisNorm(p.pis)).filter((x: string) => x && x !== '0'))];
      const cpf = [...new Set(pessoas.map((p: any) => cpfN(p.cpf)).filter(Boolean))];
      return res.json({ ok: true, pis, cpf, total_pis: pis.length, total_cpf: cpf.length });
    } catch (err: any) {
      return res.status(502).json({ ok: false, error: err?.message || 'Falha ao consultar a RHiD', pis: [], cpf: [] });
    }
  }

  /**
   * Espelho de ponto OFICIAL (apuração RHiD) de um colaborador num período.
   * Reproduz o "Cartão de Ponto" do Control iD 100% fiel: todas as colunas
   * (Normais, Trabalhado, Falta/Atraso, Abono, Extra Diurna/Noturna,
   * Interjornada, Banco) + Folga DERIVADA + Feriado + justificativas.
   * Query: colaborador_id, data_inicio, data_fim (YYYY-MM-DD)
   */
  static async espelho(req: AuthRequest, res: Response) {
    try {
      const { colaborador_id, data_inicio, data_fim } = req.query as any;
      if (!colaborador_id || !data_inicio || !data_fim) {
        return res.status(400).json({ error: 'colaborador_id, data_inicio e data_fim são obrigatórios' });
      }

      const [colab] = await AppDataSource.query(
        `SELECT c.id, c.nome, c.matricula, c.pis_pasep, c.cpf, c.data_admissao,
                ca.nome AS cargo_nome,
                dep.nome AS departamento_nome,
                comp.razao_social AS empresa_razao, comp.nome_fantasia AS empresa_fantasia,
                comp.apelido AS empresa_apelido, comp.cnpj AS empresa_cnpj, comp.cod_loja AS empresa_cod_loja
         FROM rh_colaboradores c
         LEFT JOIN rh_cargos ca ON ca.id = c.cargo_id
         LEFT JOIN rh_departamentos dep ON dep.id = c.departamento_id
         LEFT JOIN rh_empresas comp ON comp.id = c.company_id
         WHERE c.id = $1`, [colaborador_id]
      );
      if (!colab) return res.status(404).json({ error: 'Colaborador não encontrado' });
      if (!colab.pis_pasep || !String(colab.pis_pasep).replace(/\D/g, '')) {
        return res.json({ colaborador: colab, sem_pis: true, dias: [], totais: null });
      }

      const pessoa = await RhidService.idPersonPorPis(colab.pis_pasep);
      if (!pessoa) return res.json({ colaborador: colab, nao_encontrado_rhid: true, dias: [], totais: null });

      const apur = await RhidService.apuracao(pessoa.id, data_inicio, data_fim);

      // Acumuladores de totais (rodapé do cartão)
      const T = { normais: 0, trabalhado: 0, falta_atraso: 0, abono: 0, extra_diurna: 0,
                  extra_noturna: 0, interjornada: 0, he: 0, noturno: 0, banco_dia: 0 };
      let diasTrab = 0, diasFolga = 0, diasFalta = 0, diasFeriado = 0, diasAtestado = 0;
      let saldoBancoAtual: number | null = null;
      let jornadaRef = '';

      // Grade semanal (HORÁRIO DE TRABALHO) — deriva o previsto mais comum por dia da semana
      const horarioPorDow: Record<number, Record<string, number>> = {};
      // Lista de "Alterações" do rodapé (banco/abono/atestado por dia)
      const alteracoes: string[] = [];

      const dias = apur.map((d: any) => {
        const ymd = String(d.dateTimeStr || '').slice(0, 8);
        const jornada = String(d.strHorarioContratualSimples || '').replace(/\r?\n/g, ' / ').trim();
        if (jornada && !jornadaRef) jornadaRef = jornada;

        const batidasRaw = d.listAfdtManutencao || [];
        const batidas = batidasRaw.map((b: any) => {
          const detalhe = (b.afdtLogs || []).map((l: any) => l.detalheDiferencaConsiderada).filter(Boolean)[0] || null;
          // "real" = batida efetivamente registrada no relógio (tem idAfd). Distingue de
          // placeholder (saída esperada ainda não batida = idAfd null) e de justificativa.
          const real = b.idAfd != null;
          return {
            hora: fmtHora(b.hora), tipo: b._typeEntradaSaida,          // E=entrada, S=saída, D=não-pareada/justif.
            real,
            prevista: b.horaPrevista != null ? fmtHora(b.horaPrevista) : null,
            justificativa: b.abreviationJustification || null,          // "Medico", "Abono"...
            detalhe,                                                     // "Atestado Médico"...
          };
        });
        // batida "de verdade" no relógio = E/S OU um "D" real (volta pendente de fechamento), sem justificativa
        const ehPunch = (b: any) => b.tipo === 'E' || b.tipo === 'S' || (b.tipo === 'D' && b.real && !b.justificativa);
        const temBatidaReal = batidas.some(ehPunch);
        const soJustificativa = batidas.length > 0 && batidas.every((b: any) => b.tipo === 'D' && !ehPunch(b));

        // ⭐ CLASSIFICAÇÃO do dia — a RHiD NÃO manda folga:true; derivamos.
        const isFeriado = d.isHoliday === 1 || d.isHoliday === true;
        const isFaltaCheia = !!d.faltaDiaInteiro || (d.faltasDiasInteiro || 0) > 0;
        let status: string;
        if (isFeriado) status = 'feriado';
        else if (isFaltaCheia) status = 'falta';
        else if (soJustificativa && !temBatidaReal) status = 'atestado';   // dia todo justificado (atestado)
        else if (!jornada && !temBatidaReal) status = 'folga';             // DERIVADA: sem jornada + sem batida = DSR
        else status = 'trabalhou';

        // Justificativa que vale pro dia todo (atestado): pega o detalhe/abreviação
        const justDia = (status === 'atestado')
          ? (batidas.map((b: any) => b.detalhe || b.justificativa).filter(Boolean)[0] || 'Justificado')
          : null;
        const feriadoNome = isFeriado ? (d.holiday?.name || 'Feriado') : null;

        const normais = d.horasTotalNaoExtra || 0;
        const trabalhado = d.totalHorasTrabalhadas || 0;
        const faltaAtraso = d.horasFaltaAtraso || 0;
        const abono = d.minutosAbono || 0;
        const extraDiurna = d.extraDiurna || 0;
        const extraNoturna = d.extraNoturna || 0;
        const interjornada = d.extraInterjornada || 0;
        const bancoDia = d.saldoBancoCredDeb || 0;

        // Totais
        if (status !== 'folga') { T.normais += normais; T.trabalhado += trabalhado; }
        T.falta_atraso += faltaAtraso; T.abono += abono;
        T.extra_diurna += extraDiurna; T.extra_noturna += extraNoturna; T.interjornada += interjornada;
        T.he += d.horasExtrasCalculadas || 0; T.noturno += d.horasTotalNoturno || 0; T.banco_dia += bancoDia;
        if (status === 'folga') diasFolga++; else if (status === 'falta') diasFalta++;
        else if (status === 'feriado') diasFeriado++; else if (status === 'atestado') diasAtestado++; else diasTrab++;
        if (typeof d.saldoBancoFinalDia === 'number') saldoBancoAtual = d.saldoBancoFinalDia; // acumulado até o dia

        // Grade semanal por dia-da-semana (só dias com jornada prevista)
        if (jornada) {
          const dow = new Date(+ymd.slice(0, 4), +ymd.slice(4, 6) - 1, +ymd.slice(6, 8)).getDay();
          (horarioPorDow[dow] ||= {})[jornada] = (horarioPorDow[dow]?.[jornada] || 0) + 1;
        }
        // Rodapé "Alterações"
        if (abono > 0) alteracoes.push(`Abono de ${fmtHora(Math.floor(abono / 60) * 100 + (abono % 60))} em ${fmtDia(ymd)}`);
        if (status === 'atestado' && justDia) alteracoes.push(`${justDia} em ${fmtDia(ymd)}`);

        return {
          ymd, dia: fmtDia(ymd), jornada, batidas,
          previsto: jornada || (isFeriado ? 'FERIADO' : status === 'folga' ? 'Folga' : ''),
          normais_min: status === 'folga' ? null : normais,
          trabalhado_min: status === 'folga' ? null : trabalhado,
          falta_dia: isFaltaCheia ? 1 : 0,
          falta_atraso_min: faltaAtraso,
          atraso_entrada_min: d.atrasoEntrada || 0,
          saida_antecipada_min: d.saidaAntecipada || 0,
          abono_min: abono,
          extra_diurna_min: extraDiurna,
          extra_noturna_min: extraNoturna,
          interjornada_min: interjornada,
          he_min: d.horasExtrasCalculadas || 0,
          noturno_min: d.horasTotalNoturno || 0,
          banco_dia_min: bancoDia,                            // crédito/débito do dia
          saldo_dia_min: d.saldoBancoCredDeb ?? null,
          saldo_banco_min: d.saldoBancoFinalDia ?? null,      // saldo acumulado (oficial)
          status,
          justificativa_dia: justDia,
          feriado_nome: feriadoNome,
          alerta: d.toolTipAlert || null,
          alerta_cor: d.colorAlert || null,
          pendencia: !!d.possuiPendencias,
        };
      });

      // Monta grade semanal final (0=Dom ... 6=Sáb) com o previsto mais frequente
      const DOW_LABEL = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB'];
      const horarioSemanal = [1, 2, 3, 4, 5, 6, 0].map((dow) => {
        const m = horarioPorDow[dow];
        let previsto = '';
        if (m) previsto = Object.entries(m).sort((a, b) => b[1] - a[1])[0][0];
        return { dow, label: DOW_LABEL[dow], previsto };
      });

      // ⭐ Saldo REAL do banco ATUAL (independente do filtro): pega o balanço mais
      // recente até HOJE. saldoBancoFinalDia é acumulado (all-time), então o último
      // dia disponível = saldo atual verdadeiro (com queima/pagamento já aplicados).
      let saldoAtualMin: number | null = saldoBancoAtual;
      let saldoAtualData: string | null = null;
      try {
        const hoje = new Date();
        const ini = new Date(hoje.getTime() - 25 * 86400000);
        const fY = (d: Date) => d.toISOString().slice(0, 10);
        const recente = await RhidService.apuracao(pessoa.id, fY(ini), fY(hoje));
        for (const d of recente) if (typeof d.saldoBancoFinalDia === 'number') {
          saldoAtualMin = d.saldoBancoFinalDia; saldoAtualData = String(d.dateTimeStr || '').slice(0, 8);
        }
      } catch { /* mantém o saldo do fim do período */ }

      const empresaNome = colab.empresa_razao || colab.empresa_fantasia || colab.empresa_apelido || null;
      return res.json({
        colaborador: {
          id: colab.id, nome: colab.nome, matricula: colab.matricula,
          pis_pasep: colab.pis_pasep, cpf: colab.cpf || null,
          data_admissao: colab.data_admissao || null,
          cargo_nome: colab.cargo_nome, departamento_nome: colab.departamento_nome || null,
          rhid_id: pessoa.id, jornada: jornadaRef,
        },
        empresa: {
          nome: empresaNome,
          razao_social: colab.empresa_razao || null,
          nome_fantasia: colab.empresa_fantasia || null,
          apelido: colab.empresa_apelido || null,
          cnpj: colab.empresa_cnpj || null,
          cod_loja: colab.empresa_cod_loja ?? null,
          inscricao_estadual: null,   // não temos em rh_empresas; opcional (fica em branco)
        },
        horario_semanal: horarioSemanal,
        alteracoes,
        periodo: { data_inicio, data_fim },
        fonte: 'RHiD (apuração oficial)',
        dias,
        totais: {
          dias_trabalhados: diasTrab, dias_folga: diasFolga, dias_falta: diasFalta,
          dias_feriado: diasFeriado, dias_atestado: diasAtestado,
          normais_min: T.normais, trabalhado_min: T.trabalhado,
          he_min: T.he, noturno_min: T.noturno,
          falta_atraso_min: T.falta_atraso, abono_min: T.abono,
          extra_diurna_min: T.extra_diurna, extra_noturna_min: T.extra_noturna,
          interjornada_min: T.interjornada, banco_dia_min: T.banco_dia,
          saldo_banco_periodo_min: saldoBancoAtual,          // saldo ao fim do período filtrado
          saldo_banco_atual_min: saldoAtualMin,              // ⭐ saldo REAL atual (fixo, até hoje)
          saldo_banco_atual_data: saldoAtualData ? fmtDia(saldoAtualData) : null,
        },
      });
    } catch (err: any) {
      console.error('[PONTO] espelho RHiD:', err?.message);
      return res.status(502).json({ error: err?.message || 'Erro ao buscar a apuração na RHiD' });
    }
  }

  /**
   * Indicadores de Ponto e Ausências (dashboard) — agrega a apuração RHiD de
   * TODOS os colaboradores ativos (com PIS) do ano, por colaborador / setor / mês.
   * Query: ano, company_id (opcional), refresh (1 = ignora cache).
   * Métricas: absenteísmo, gravidade, frequência, TEA, Bradford. Cacheado 20min.
   */
  static async indicadores(req: AuthRequest, res: Response) {
    try {
      const ano = +(req.query.ano || new Date().getFullYear());
      const empresaId = (req.query.company_id as string) || '';
      const refresh = req.query.refresh === '1';
      const cacheKey = `${empresaId || 'all'}:${ano}`;
      if (!refresh) {
        const c = _indCache.get(cacheKey);
        if (c && Date.now() - c.at < IND_TTL) return res.json({ ...c.data, cache: true });
      }

      // Todos os colaboradores ativos (o filtro de PIS/não-bate é feito no JS pra montar o diagnóstico)
      const params: any[] = [];
      let where = `c.status='ativo'`;
      if (empresaId) { params.push(empresaId); where += ` AND c.company_id = $${params.length}`; }
      const colabs = await AppDataSource.query(
        `SELECT c.id, c.nome, c.pis_pasep, c.foto_url, c.nao_bate_ponto, COALESCE(dep.nome,'Sem setor') AS setor
         FROM rh_colaboradores c LEFT JOIN rh_departamentos dep ON dep.id = c.departamento_id
         WHERE ${where}`, params);

      // Casa o colaborador com a RHiD por CPF OU PIS (mesma regra da coluna "Relógio de
      // Ponto" do cadastro — evita divergência entre as telas).
      const pessoas = await RhidService.listarPessoas();
      const cpfN = (s: any) => { const d = String(s || '').replace(/\D/g, ''); return d && d !== '00000000000' ? d.padStart(11, '0') : ''; };
      const porPis = new Map<string, any>();
      const porCpf = new Map<string, any>();
      for (const p of pessoas) {
        const pk = _pisNorm(p.pis); if (pk && pk !== '0') porPis.set(pk, p);
        const ck = cpfN(p.cpf); if (ck) porCpf.set(ck, p);
      }
      const matchRhid = (c: any) => porCpf.get(cpfN(c.cpf)) || porPis.get(_pisNorm(c.pis_pasep)) || null;
      const temDoc = (c: any) => !!(cpfN(c.cpf) || _pisNorm(c.pis_pasep) !== '0' && _pisNorm(c.pis_pasep));

      const naoBate = colabs.filter((c: any) => c.nao_bate_ponto === true);
      const considerados = colabs.filter((c: any) => c.nao_bate_ponto !== true);
      const alvos = considerados.map((c: any) => ({ ...c, rhid: matchRhid(c) })).filter((c: any) => c.rhid);
      const semMatch = considerados.filter((c: any) => !matchRhid(c));
      const semDoc = semMatch.filter((c: any) => !temDoc(c));
      const naoEncontrado = semMatch.filter((c: any) => temDoc(c));

      // Diagnóstico: por que alguém ficou de fora do dashboard
      const diagnostico = {
        total_ativos: colabs.length,
        incluidos: alvos.length,
        nao_bate_ponto: naoBate.length,
        sem_documento: semDoc.length,
        nao_encontrado: naoEncontrado.length,
        nao_incluidos: [
          ...naoEncontrado.map((c: any) => ({ nome: c.nome, setor: c.setor, motivo: 'não encontrado no relógio (RHiD)' })),
          ...semDoc.map((c: any) => ({ nome: c.nome, setor: c.setor, motivo: 'sem CPF/PIS no cadastro' })),
          ...naoBate.map((c: any) => ({ nome: c.nome, setor: c.setor, motivo: 'não bate ponto (cargo de confiança)' })),
        ],
      };

      const anoAtual = new Date().getFullYear();
      const mesAtual = new Date().getMonth() + 1;
      // ⚠️ O MÊS VIGENTE NÃO ENTRA: o RH só ajusta/justifica as marcações depois que o
      // mês fecha (antes disso o dia aberto conta como falta e infla tudo). Só contamos
      // meses ENCERRADOS — até o mês anterior no ano corrente.
      const ateMes = ano < anoAtual ? 12 : ano > anoAtual ? 0 : (mesAtual - 1);
      const ultDia = (m: number) => new Date(ano, m, 0).getDate();
      const tarefas: { c: any; m: number }[] = [];
      for (const c of alvos) for (let m = 1; m <= ateMes; m++) tarefas.push({ c, m });

      const byColab: Record<number, any> = {};
      const diasAus: Record<number, string[]> = {};
      await _mapPool(tarefas, 8, async ({ c, m }) => {
        const ini = `${ano}-${String(m).padStart(2, '0')}-01`;
        const fim = `${ano}-${String(m).padStart(2, '0')}-${String(ultDia(m)).padStart(2, '0')}`;
        const apur = await RhidService.apuracao(c.rhid.id, ini, fim).catch(() => []);
        const acc = (byColab[c.id] ||= { id: c.id, nome: c.nome, setor: c.setor, foto_url: c.foto_url, jornada: 0, trabalhado: 0, falta: 0, atraso: 0, atestado: 0, abono: 0, he: 0, diasFalta: 0, diasAtestado: 0, porMes: {} });
        for (const d of apur) {
          const x = _classificaDia(d);
          acc.jornada += x.jornada; acc.trabalhado += x.trabalhado; acc.atraso += x.atraso; acc.abono += x.abono; acc.he += x.he;
          acc.falta += x.falta; acc.atestado += x.atestado;
          if (x.status === 'falta') { acc.diasFalta++; (diasAus[c.id] ||= []).push(x.ymd); }
          if (x.status === 'atestado') { acc.diasAtestado++; (diasAus[c.id] ||= []).push(x.ymd); }
          const pm = (acc.porMes[x.mes] ||= { jornada: 0, falta: 0, atraso: 0, atestado: 0, he: 0 });
          pm.jornada += x.jornada; pm.falta += x.falta; pm.atraso += x.atraso; pm.atestado += x.atestado; pm.he += x.he;
        }
      });

      const colabArr: any[] = Object.values(byColab).map((c: any) => ({
        ...c, nao_planejada: c.falta + c.atraso, bradford: _bradford(diasAus[c.id]),
        absenteismo: c.jornada ? +((c.falta + c.atraso) / c.jornada * 100).toFixed(1) : 0,
      }));

      const sum = (k: string) => colabArr.reduce((a: number, c: any) => a + (c[k] || 0), 0);
      const nFunc = colabArr.length;
      const jornadaTot = sum('jornada'), naoPlanTot = sum('nao_planejada');
      const comAus = colabArr.filter((c: any) => c.nao_planejada > 0 || c.atestado > 0).length;
      const eventos = colabArr.reduce((a: number, c: any) => a + c.diasFalta + c.diasAtestado, 0);

      // Por mês (global) — Jan..Dez
      const porMes = Array.from({ length: 12 }, (_, i) => {
        const m = i + 1;
        let jornada = 0, falta = 0, atraso = 0, atestado = 0, he = 0;
        for (const c of colabArr) { const pm = c.porMes[m]; if (pm) { jornada += pm.jornada; falta += pm.falta; atraso += pm.atraso; atestado += pm.atestado; he += pm.he; } }
        const naoPlan = falta + atraso;
        return { mes: m, label: MES_LABEL[m], jornada_min: jornada, falta_min: falta, atraso_min: atraso, atestado_min: atestado, he_min: he,
          nao_planejada_min: naoPlan, absenteismo_pct: jornada ? +(naoPlan / jornada * 100).toFixed(1) : 0,
          gravidade_min: nFunc ? Math.round(naoPlan / nFunc) : 0, sem_dados: m > ateMes };
      });

      // Por setor (com quebra mensal)
      const setorMap: Record<string, any> = {};
      for (const c of colabArr) {
        const s = (setorMap[c.setor] ||= { setor: c.setor, funcionarios: 0, jornada: 0, falta: 0, atraso: 0, atestado: 0, he: 0, porMes: {} });
        s.funcionarios++; s.jornada += c.jornada; s.falta += c.falta; s.atraso += c.atraso; s.atestado += c.atestado; s.he += c.he;
        for (let m = 1; m <= 12; m++) { const pm = c.porMes[m]; if (pm) { const spm = (s.porMes[m] ||= { jornada: 0, nao_planejada: 0 }); spm.jornada += pm.jornada; spm.nao_planejada += pm.falta + pm.atraso; } }
      }
      const porSetor = Object.values(setorMap).map((s: any) => {
        const naoPlan = s.falta + s.atraso;
        const por_mes = Array.from({ length: 12 }, (_, i) => { const pm = s.porMes[i + 1] || { jornada: 0, nao_planejada: 0 }; return { mes: i + 1, absenteismo_pct: pm.jornada ? +(pm.nao_planejada / pm.jornada * 100).toFixed(1) : 0, nao_planejada_min: pm.nao_planejada }; });
        return { setor: s.setor, funcionarios: s.funcionarios, jornada_min: s.jornada, falta_min: s.falta, atraso_min: s.atraso, atestado_min: s.atestado, he_min: s.he,
          nao_planejada_min: naoPlan, absenteismo_pct: s.jornada ? +(naoPlan / s.jornada * 100).toFixed(1) : 0, por_mes };
      }).sort((a, b) => b.absenteismo_pct - a.absenteismo_pct);

      // Ranking colaboradores (top 100 por Bradford)
      const ranking = colabArr.map((c: any) => ({
        id: c.id, nome: c.nome, setor: c.setor, foto_url: c.foto_url, falta_min: c.falta, atraso_min: c.atraso, atestado_min: c.atestado, abono_min: c.abono, he_min: c.he,
        dias_falta: c.diasFalta, dias_atestado: c.diasAtestado, nao_planejada_min: c.nao_planejada, absenteismo_pct: c.absenteismo, bradford: c.bradford,
        // quebra mês a mês (Jan..Dez) pra colunas mensais no ranking
        por_mes: Array.from({ length: 12 }, (_, i) => {
          const pm = c.porMes[i + 1] || { jornada: 0, falta: 0, atraso: 0, atestado: 0 };
          const np = pm.falta + pm.atraso;
          return { mes: i + 1, nao_planejada_min: np, atestado_min: pm.atestado, abs_pct: pm.jornada ? +(np / pm.jornada * 100).toFixed(1) : 0 };
        }),
      })).sort((a, b) => b.bradford - a.bradford).slice(0, 100);

      const data = {
        periodo: { ano, ate_mes: ateMes }, empresa_id: empresaId || null,
        gerado_em: new Date().toISOString(), cache: false, funcionarios: nFunc,
        diagnostico,
        kpis: {
          absenteismo_pct: jornadaTot ? +(naoPlanTot / jornadaTot * 100).toFixed(1) : 0,
          gravidade_min: nFunc ? Math.round(naoPlanTot / nFunc) : 0,
          nao_planejada_min: naoPlanTot, jornada_min: jornadaTot, trabalhado_min: sum('trabalhado'),
          falta_min: sum('falta'), atraso_min: sum('atraso'), atestado_min: sum('atestado'), abono_min: sum('abono'), he_min: sum('he'),
          frequencia: nFunc ? +(eventos / nFunc).toFixed(1) : 0, tea_pct: nFunc ? Math.round(comAus / nFunc * 100) : 0,
          eventos, funcionarios_ausentes: comAus,
        },
        por_tipo: [
          { tipo: 'Falta', min: sum('falta'), cor: '#ef4444' },
          { tipo: 'Atraso', min: sum('atraso'), cor: '#f59e0b' },
          { tipo: 'Atestado', min: sum('atestado'), cor: '#8b5cf6' },
          { tipo: 'Abono', min: sum('abono'), cor: '#6366f1' },
        ],
        por_mes: porMes, por_setor: porSetor, ranking_colaboradores: ranking,
      };
      _indCache.set(cacheKey, { at: Date.now(), data });
      return res.json(data);
    } catch (err: any) {
      console.error('[PONTO] indicadores:', err?.message);
      return res.status(502).json({ error: err?.message || 'Erro ao gerar indicadores de ponto' });
    }
  }
}
