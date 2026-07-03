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
   * Query: colaborador_id, data_inicio, data_fim (YYYY-MM-DD)
   */
  static async espelho(req: AuthRequest, res: Response) {
    try {
      const { colaborador_id, data_inicio, data_fim } = req.query as any;
      if (!colaborador_id || !data_inicio || !data_fim) {
        return res.status(400).json({ error: 'colaborador_id, data_inicio e data_fim são obrigatórios' });
      }

      const [colab] = await AppDataSource.query(
        `SELECT c.id, c.nome, c.matricula, c.pis_pasep, ca.nome AS cargo_nome
         FROM rh_colaboradores c LEFT JOIN rh_cargos ca ON ca.id = c.cargo_id
         WHERE c.id = $1`, [colaborador_id]
      );
      if (!colab) return res.status(404).json({ error: 'Colaborador não encontrado' });
      if (!colab.pis_pasep || !String(colab.pis_pasep).replace(/\D/g, '')) {
        return res.json({ colaborador: colab, sem_pis: true, dias: [], totais: null });
      }

      const pessoa = await RhidService.idPersonPorPis(colab.pis_pasep);
      if (!pessoa) return res.json({ colaborador: colab, nao_encontrado_rhid: true, dias: [], totais: null });

      const apur = await RhidService.apuracao(pessoa.id, data_inicio, data_fim);

      let trabTotal = 0, heTotal = 0, faltaAtrasoTotal = 0, abonoTotal = 0, noturnoTotal = 0;
      let diasTrab = 0, diasFolga = 0, diasFalta = 0;
      let saldoBancoAtual: number | null = null;
      let jornadaRef = '';

      const dias = apur.map((d: any) => {
        const ymd = String(d.dateTimeStr || '').slice(0, 8);
        const jornada = String(d.strHorarioContratualSimples || '').replace(/\r?\n/g, ' / ').trim();
        if (jornada && !jornadaRef) jornadaRef = jornada;
        const batidas = (d.listAfdtManutencao || []).map((b: any) => ({
          hora: fmtHora(b.hora), tipo: b._typeEntradaSaida, justificativa: b.abreviationJustification || null,
        }));
        if (!d.folga) { trabTotal += d.totalHorasTrabalhadas || 0; }
        heTotal += d.horasExtrasCalculadas || 0;
        faltaAtrasoTotal += d.horasFaltaAtraso || 0;
        abonoTotal += d.minutosAbono || 0;
        noturnoTotal += d.horasTotalNoturno || 0;
        if (d.folga) diasFolga++; else if (d.faltaDiaInteiro) diasFalta++; else diasTrab++;
        if (typeof d.saldoBancoFinalDia === 'number') saldoBancoAtual = d.saldoBancoFinalDia; // acumulado até o dia

        const status = d.folga ? 'folga' : d.faltaDiaInteiro ? 'falta' : d.isHoliday ? 'feriado' : 'trabalhou';
        return {
          ymd, dia: fmtDia(ymd), jornada, batidas,
          trabalhado_min: d.folga ? null : (d.totalHorasTrabalhadas || 0),
          he_min: d.horasExtrasCalculadas || 0,
          noturno_min: d.horasTotalNoturno || 0,
          falta_atraso_min: d.horasFaltaAtraso || 0,
          abono_min: d.minutosAbono || 0,
          saldo_dia_min: d.saldoBancoCredDeb ?? null,       // crédito/débito do dia
          saldo_banco_min: d.saldoBancoFinalDia ?? null,     // saldo acumulado (oficial)
          status,
          alerta: d.toolTipAlert || null,
          alerta_cor: d.colorAlert || null,
          pendencia: !!d.possuiPendencias,
        };
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

      return res.json({
        colaborador: {
          id: colab.id, nome: colab.nome, matricula: colab.matricula,
          pis_pasep: colab.pis_pasep, cargo_nome: colab.cargo_nome,
          rhid_id: pessoa.id, jornada: jornadaRef,
        },
        periodo: { data_inicio, data_fim },
        fonte: 'RHiD (apuração oficial)',
        dias,
        totais: {
          dias_trabalhados: diasTrab, dias_folga: diasFolga, dias_falta: diasFalta,
          trabalhado_min: trabTotal, he_min: heTotal, noturno_min: noturnoTotal,
          falta_atraso_min: faltaAtrasoTotal, abono_min: abonoTotal,
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
