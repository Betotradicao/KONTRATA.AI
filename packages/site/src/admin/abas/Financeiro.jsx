import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Info } from 'lucide-react';
import { api } from '../api';

/**
 * Grade cliente × mês. Cada célula é um clique: pendente ↔ pago.
 *
 * A cobrança do mês é criada na hora do primeiro clique — não é preciso lançar
 * 12 cobranças antes de poder marcar a primeira como paga.
 *
 * "Atrasado" NÃO é um status guardado: é calculado (pendente + venceu). Guardar
 * no banco exigiria alguém rodando uma rotina todo dia pra virar o status, e o
 * dia que ela falhasse a tela mentiria.
 *
 * Provisório até integrar o Asaas — quando isso acontecer, a grade continua
 * igual e só para de depender do clique.
 */

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

const dinheiro = (v) =>
  (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const hojeIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/**
 * Competência ('AAAA-MM') em que o cliente começou, a partir de `data_inicio`.
 * Sem data cadastrada devolve null e a grade mostra o ano inteiro — melhor
 * do que esconder meses por um palpite errado.
 */
const mesDeInicio = (cliente) => {
  const txt = String(cliente.data_inicio || '').slice(0, 7);
  return /^[0-9]{4}-[0-9]{2}$/.test(txt) ? txt : null;
};

function Avatar({ cliente }) {
  const [falhou, setFalhou] = useState(false);
  const inicial = String(cliente.nome || '?').charAt(0).toUpperCase();
  if (cliente.logo_url && !falhou) {
    return (
      <img src={cliente.logo_url} alt=""
        className="w-9 h-9 rounded-full object-contain border border-border-light bg-white flex-shrink-0"
        onError={() => setFalhou(true)} />
    );
  }
  return (
    <div className="w-9 h-9 rounded-full bg-purple-100 text-purple-800 flex items-center justify-center font-bold text-xs flex-shrink-0 border border-purple-200">
      {inicial}
    </div>
  );
}

/** Uma célula do mês. */
function Celula({ cliente, competencia, cobranca, aoAlternar }) {
  // Antes de ser cliente não existe mensalidade. Mostrar "A vencer" em
  // janeiro pra quem entrou em julho sugere uma dívida que nunca existiu.
  const inicio = mesDeInicio(cliente);
  const antesDeSerCliente = inicio && competencia < inicio && !cobranca;

  const [ocupado, setOcupado] = useState(false);

  if (antesDeSerCliente) {
    return (
      <div title="Ainda não era cliente neste mês"
        className="w-full rounded-lg border border-dashed border-gray-200 px-2 py-1.5 text-center text-gray-300 text-[10px] leading-tight select-none">
        —
        <span className="block">&nbsp;</span>
      </div>
    );
  }

  const pago = cobranca?.status === 'pago';
  const venc = String(cobranca?.vencimento || '').slice(0, 10);
  const atrasado = !pago && venc && venc < hojeIso();

  // Dia mostrado: o da cobrança se já existir, senão o do cadastro do cliente.
  const dia = venc ? Number(venc.slice(8, 10)) : cliente.dia_vencimento;

  const clicar = async () => {
    setOcupado(true);
    try {
      await aoAlternar(cliente.id, competencia, pago ? 'pendente' : 'pago');
    } finally {
      setOcupado(false);
    }
  };

  let cor = 'bg-gray-50 border-gray-200 hover:bg-gray-100 text-text-gray';
  let rotulo = 'A vencer';
  if (pago) {
    cor = 'bg-emerald-50 border-emerald-300 hover:bg-emerald-100 text-emerald-800';
    rotulo = 'PAGO';
  } else if (atrasado) {
    cor = 'bg-red-50 border-red-300 hover:bg-red-100 text-red-700';
    rotulo = 'ATRASADO';
  }

  return (
    <button
      onClick={clicar}
      disabled={ocupado}
      title={
        pago
          ? `Pago em ${cobranca.pago_em ? String(cobranca.pago_em).slice(0, 10).split('-').reverse().join('/') : '—'} · clique para desmarcar`
          : 'Clique para marcar como pago'
      }
      className={`w-full rounded-lg border px-2 py-1.5 text-center transition-colors disabled:opacity-50 ${cor}`}
    >
      <span className="block text-[10px] leading-tight opacity-80">
        {dia ? `Venc ${dia}` : 'sem venc.'}
      </span>
      <span className="block text-[10px] font-bold leading-tight">{rotulo}</span>
    </button>
  );
}

export default function Financeiro({ aoMudar }) {
  const [ano, setAno] = useState(new Date().getFullYear());
  const [clientes, setClientes] = useState([]);
  const [carregando, setCarregando] = useState(true);

  const carregar = async (a = ano) => {
    setCarregando(true);
    try {
      const r = await api.get(`/financeiro/matriz?ano=${a}`);
      setClientes(r.clientes || []);
    } catch {
      setClientes([]);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => { carregar(ano); }, [ano]);

  const alternar = async (clienteId, competencia, novoStatus) => {
    await api.post('/financeiro/marcar', {
      cliente_id: clienteId,
      competencia,
      status: novoStatus,
    });
    await carregar(ano);
    aoMudar?.();
  };

  const acharCobranca = (cliente, mes) => {
    const comp = `${ano}-${String(mes + 1).padStart(2, '0')}`;
    return (cliente.cobrancas || []).find((c) => c.competencia === comp);
  };

  // Total pago no ano, por cliente — dá noção rápida de quem está em dia.
  const totalPago = (cliente) =>
    (cliente.cobrancas || [])
      .filter((c) => c.status === 'pago')
      .reduce((s, c) => s + (Number(c.valor) || 0), 0);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-border-light">
      <div className="p-4 border-b border-border-light flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-display font-bold text-text-dark text-lg">Financeiro</h2>
          <p className="text-xs text-text-gray">
            Clique na célula do mês para marcar como paga. Clique de novo para desfazer.
          </p>
        </div>

        <div className="flex items-center gap-1">
          <button onClick={() => setAno(ano - 1)}
            className="p-2 rounded-lg hover:bg-purple-50 text-purple-800" aria-label="Ano anterior">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="font-display font-bold text-text-dark text-lg w-16 text-center">{ano}</span>
          <button onClick={() => setAno(ano + 1)}
            className="p-2 rounded-lg hover:bg-purple-50 text-purple-800" aria-label="Próximo ano">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 text-xs text-amber-900 flex items-start gap-2">
        <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <span>
          Controle manual até integrarmos o <strong>Asaas</strong>. O dia de vencimento vem
          do cadastro do cliente — quem estiver sem, mostra "sem venc.".
        </span>
      </div>

      {carregando ? (
        <p className="p-8 text-center text-text-gray text-sm">Carregando…</p>
      ) : !clientes.length ? (
        <p className="p-8 text-center text-text-gray text-sm">
          Nenhum cliente ativo. A grade lista só quem está em Clientes Ativos.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-separate border-spacing-0">
            <thead>
              <tr className="bg-purple-50">
                <th className="sticky left-0 z-10 bg-purple-50 text-left px-4 py-2.5 font-semibold text-text-dark min-w-[200px]">
                  Cliente
                </th>
                {MESES.map((m) => (
                  <th key={m} className="px-1.5 py-2.5 font-semibold text-text-dark text-center text-xs min-w-[74px]">
                    {m}
                  </th>
                ))}
                <th className="px-4 py-2.5 font-semibold text-text-dark text-right whitespace-nowrap">
                  Pago no ano
                </th>
              </tr>
            </thead>
            <tbody>
              {clientes.map((c, i) => (
                <tr key={c.id} className={i % 2 ? 'bg-purple-50/30' : 'bg-white'}>
                  {/* Coluna do cliente fica presa ao rolar pro lado — sem isso
                      você perde a referência de quem é a linha no mês de dezembro */}
                  <td className={`sticky left-0 z-10 px-4 py-2 border-r border-border-light ${
                    i % 2 ? 'bg-purple-50/30' : 'bg-white'
                  }`}>
                    <div className="flex items-center gap-3">
                      <Avatar cliente={c} />
                      <div className="min-w-0">
                        <span className="block font-semibold text-text-dark truncate">{c.nome}</span>
                        <span className="block text-[11px] text-text-gray">
                          {dinheiro(Math.max((Number(c.valor_mensal) || 0) - (Number(c.desconto) || 0), 0))}/mês
                        </span>
                      </div>
                    </div>
                  </td>

                  {MESES.map((m, idx) => (
                    <td key={m} className="px-1 py-2 align-middle">
                      <Celula
                        cliente={c}
                        competencia={`${ano}-${String(idx + 1).padStart(2, '0')}`}
                        cobranca={acharCobranca(c, idx)}
                        aoAlternar={alternar}
                      />
                    </td>
                  ))}

                  <td className="px-4 py-2 text-right font-semibold text-text-dark whitespace-nowrap">
                    {dinheiro(totalPago(c))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="p-4 border-t border-border-light flex flex-wrap gap-4 text-xs text-text-gray">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-emerald-50 border border-emerald-300" /> Pago
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-red-50 border border-red-300" /> Atrasado (venceu e não pagou)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-gray-50 border border-gray-200" /> A vencer
        </span>
      </div>
    </div>
  );
}
