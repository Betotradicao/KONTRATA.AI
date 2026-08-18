import { AppDataSource } from '../config/database';
import { RhidService } from './rhid.service';

/**
 * SALDO DE BANCO DE HORAS (fonte unica)
 * -------------------------------------
 * Mora aqui, e nao no controller, porque DOIS caminhos precisam do mesmo numero:
 *   1. a tela RH > Ponto e Ausencias > Saldo de Banco
 *   2. o disparo agendado do PDF pro WhatsApp (cron, sem navegador)
 * Se cada um calculasse do seu jeito, o PDF que o gerente recebe divergiria da
 * tela que o RH abre — e ninguem confiaria em nenhum dos dois.
 *
 * O valor vem do ultimo `saldoBancoFinalDia` da apuracao RHiD: acumulado
 * all-time, ja com queima/pagamento aplicados. E o MESMO campo que alimenta o
 * card "Saldo Banco Atual" do Espelho de Ponto.
 */

const _pisNorm = (s: any) => String(s || '').replace(/\D/g, '').replace(/^0+/, '');
const _cpfNorm = (s: any) => {
  const d = String(s || '').replace(/\D/g, '');
  return d && d !== '00000000000' ? d.padStart(11, '0') : '';
};

async function _mapPool<T>(items: T[], n: number, fn: (t: T) => Promise<void>): Promise<void> {
  let idx = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (idx < items.length) { const i = idx++; await fn(items[i]); }
  }));
}

export type LinhaSaldo = {
  colaborador_id: number;
  nome: string;
  matricula: string | null;
  setor: string;
  empresa: string | null;
  company_id: string | null;
  saldo_min: number | null;
  positivo_min: number | null;
  negativo_min: number | null;
  saldo_data: string | null;
};

export type FiltroSaldo = {
  companyId?: string;
  departamentoId?: string;
  colaboradorId?: string;
};

export class SaldoBancoService {
  /** Calcula o saldo de banco de todos os colaboradores ativos que batem o filtro. */
  static async calcular(f: FiltroSaldo = {}) {
    const params: any[] = [];
    let where = `c.status = 'ativo'`;
    if (f.companyId) { params.push(f.companyId); where += ` AND c.company_id = $${params.length}`; }
    if (f.departamentoId) { params.push(f.departamentoId); where += ` AND c.departamento_id = $${params.length}`; }
    if (f.colaboradorId) { params.push(f.colaboradorId); where += ` AND c.id = $${params.length}`; }

    const colabs = await AppDataSource.query(
      `SELECT c.id, c.nome, c.matricula, c.cpf, c.pis_pasep, c.nao_bate_ponto, c.company_id,
              COALESCE(dep.nome, 'Sem setor') AS setor,
              COALESCE(comp.apelido, comp.nome_fantasia, comp.razao_social) AS empresa
       FROM rh_colaboradores c
       LEFT JOIN rh_departamentos dep ON dep.id = c.departamento_id
       LEFT JOIN rh_empresas comp ON comp.id = c.company_id
       WHERE ${where}
       ORDER BY c.nome`, params);

    // Casamento colaborador <-> RHiD por CPF OU PIS — MESMA regra do espelho e dos
    // indicadores. Divergir aqui faria o saldo bater diferente entre as telas.
    const pessoas = await RhidService.listarPessoas();
    const porPis = new Map<string, any>(), porCpf = new Map<string, any>();
    for (const p of pessoas) {
      const pk = _pisNorm(p.pis); if (pk && pk !== '0') porPis.set(pk, p);
      const ck = _cpfNorm(p.cpf); if (ck) porCpf.set(ck, p);
    }
    const matchRhid = (c: any) => porCpf.get(_cpfNorm(c.cpf)) || porPis.get(_pisNorm(c.pis_pasep)) || null;

    const naoBate = colabs.filter((c: any) => c.nao_bate_ponto === true);
    const consideram = colabs.filter((c: any) => c.nao_bate_ponto !== true);
    const alvos = consideram.map((c: any) => ({ ...c, rhid: matchRhid(c) })).filter((c: any) => c.rhid);
    const semMatch = consideram.filter((c: any) => !matchRhid(c));

    // A janela serve so pra ACHAR o dia mais recente. Como o valor e acumulado,
    // alargar nunca muda o numero — so evita vir vazio pra quem esteve de ferias.
    const hoje = new Date();
    const ini = new Date(hoje.getTime() - 45 * 86400000);
    const fY = (d: Date) => d.toISOString().slice(0, 10);
    const iniStr = fY(ini), fimStr = fY(hoje);

    const linhas: LinhaSaldo[] = [];
    await _mapPool(alvos, 6, async (c: any) => {
      let saldoMin: number | null = null, saldoData: string | null = null;
      try {
        const apur = await RhidService.apuracao(c.rhid.id, iniStr, fimStr);
        for (const d of apur) if (typeof d.saldoBancoFinalDia === 'number') {
          saldoMin = d.saldoBancoFinalDia; saldoData = String(d.dateTimeStr || '').slice(0, 8);
        }
      } catch { /* sem apuracao no periodo -> fica sem saldo */ }
      linhas.push({
        colaborador_id: c.id, nome: c.nome, matricula: c.matricula || null,
        setor: c.setor, empresa: c.empresa || null, company_id: c.company_id || null,
        saldo_min: saldoMin,
        // Positivo e negativo NUNCA aparecem juntos: e o MESMO saldo, so separado
        // em duas colunas. Saldo zero nao marca nenhuma das duas.
        positivo_min: saldoMin != null && saldoMin > 0 ? saldoMin : null,
        negativo_min: saldoMin != null && saldoMin < 0 ? saldoMin : null,
        saldo_data: saldoData ? `${saldoData.slice(6, 8)}/${saldoData.slice(4, 6)}/${saldoData.slice(0, 4)}` : null,
      });
    });

    // _mapPool nao preserva ordem (cada worker empurra quando termina)
    linhas.sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'pt-BR'));

    const totalPositivo = linhas.reduce((s, l) => s + (l.positivo_min || 0), 0);
    const totalNegativo = linhas.reduce((s, l) => s + (l.negativo_min || 0), 0);

    return {
      fonte: 'RHiD (apuração oficial)',
      gerado_em: new Date().toISOString(),
      linhas,
      totais: {
        colaboradores: linhas.length,
        com_saldo: linhas.filter(l => l.saldo_min != null).length,
        positivos: linhas.filter(l => l.positivo_min != null).length,
        negativos: linhas.filter(l => l.negativo_min != null).length,
        total_positivo_min: totalPositivo,
        total_negativo_min: totalNegativo,
        liquido_min: totalPositivo + totalNegativo,
      },
      diagnostico: {
        nao_bate_ponto: naoBate.length,
        sem_match_rhid: semMatch.length,
        sem_match_nomes: semMatch.slice(0, 20).map((c: any) => c.nome),
      },
    };
  }

  /** Minutos -> "+2h30" / "-0h20". String vazia pra null. */
  static fmt(min: number | null | undefined): string {
    if (min == null) return '';
    const neg = min < 0;
    const abs = Math.abs(Math.round(min));
    return `${neg ? '-' : '+'}${Math.floor(abs / 60)}h${String(abs % 60).padStart(2, '0')}`;
  }

  /**
   * Agrupa as linhas por LOJA e, dentro de cada loja, por SETOR.
   * E a estrutura do PDF do disparo: 1 arquivo por loja, setores como secoes.
   */
  static agruparPorLojaESetor(linhas: LinhaSaldo[]) {
    const lojas = new Map<string, { loja: string; setores: Map<string, LinhaSaldo[]> }>();
    for (const l of linhas) {
      const chaveLoja = l.empresa || 'Sem loja';
      if (!lojas.has(chaveLoja)) lojas.set(chaveLoja, { loja: chaveLoja, setores: new Map() });
      const bloco = lojas.get(chaveLoja)!;
      const chaveSetor = l.setor || 'Sem setor';
      if (!bloco.setores.has(chaveSetor)) bloco.setores.set(chaveSetor, []);
      bloco.setores.get(chaveSetor)!.push(l);
    }
    return Array.from(lojas.values())
      .sort((a, b) => a.loja.localeCompare(b.loja, 'pt-BR'))
      .map(b => ({
        loja: b.loja,
        setores: Array.from(b.setores.entries())
          .sort((a, b2) => a[0].localeCompare(b2[0], 'pt-BR'))
          .map(([setor, itens]) => ({
            setor,
            itens,
            positivo_min: itens.reduce((s, i) => s + (i.positivo_min || 0), 0),
            negativo_min: itens.reduce((s, i) => s + (i.negativo_min || 0), 0),
          })),
        positivo_min: b.setores.size
          ? Array.from(b.setores.values()).flat().reduce((s, i) => s + (i.positivo_min || 0), 0) : 0,
        negativo_min: b.setores.size
          ? Array.from(b.setores.values()).flat().reduce((s, i) => s + (i.negativo_min || 0), 0) : 0,
      }));
  }
}
