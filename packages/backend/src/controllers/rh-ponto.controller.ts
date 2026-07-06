import { Response } from 'express';
import { AppDataSource } from '../config/database';
import { AuthRequest } from '../middleware/auth';
import { RhidService } from '../services/rhid.service';

const fmtHora = (h: any) => { const s = String(h ?? '').padStart(4, '0'); return `${s.slice(0, 2)}:${s.slice(2, 4)}`; };
const fmtDia = (ymd: string) => `${ymd.slice(6, 8)}/${ymd.slice(4, 6)}/${ymd.slice(0, 4)}`;

export class RhPontoController {
  /** Testa conexão com a nuvem RHiD (usa a config salva). */
  static async statusRelogio(_req: AuthRequest, res: Response) {
    try {
      const info = await RhidService.testarConexao();
      return res.json({ fonte: 'RHiD', ...info });
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
}
