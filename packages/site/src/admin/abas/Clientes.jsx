import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, ExternalLink } from 'lucide-react';
import { api } from '../api';

/**
 * Mesma tela serve CLIENTES ATIVOS e PROSPECÇÃO — muda o que aparece.
 * Ativo mostra plano/valor/subdomínio; prospecção mostra funil e próxima ação.
 */

// Durações de teste oferecidas.
const DIAS_TESTE = [15, 20, 30, 45];

/**
 * Quanto falta do teste. Devolve null quando não há teste configurado.
 * Calculado na hora a partir da data de início — guardar "dias restantes"
 * no banco daria um número que envelhece sozinho e mente no dia seguinte.
 */
const restaTeste = (cliente) => {
  const txt = String(cliente.teste_inicio || '').slice(0, 10);
  const m = txt.match(/^([0-9]{4})-([0-9]{2})-([0-9]{2})$/);
  const total = Number(cliente.teste_dias) || 0;
  if (!m || !total) return null;

  // Data montada por pedaços: new Date("2026-08-23") seria lido como UTC
  // e voltaria um dia no nosso fuso.
  const inicio = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const agora = new Date();
  const hoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
  const decorridos = Math.floor((hoje - inicio) / 86400000);
  return total - decorridos;
};
const ESTAGIOS = [
  { v: 'novo',     rotulo: 'Novo',     cor: 'bg-gray-100 text-gray-700' },
  { v: 'contato',  rotulo: 'Contato',  cor: 'bg-blue-100 text-blue-800' },
  { v: 'demo',     rotulo: 'Demo',     cor: 'bg-purple-100 text-purple-800' },
  { v: 'proposta', rotulo: 'Proposta', cor: 'bg-amber-100 text-amber-800' },
  { v: 'ganho',    rotulo: 'Ganho',    cor: 'bg-emerald-100 text-emerald-800' },
  { v: 'perdido',  rotulo: 'Perdido',  cor: 'bg-red-100 text-red-700' },
];

// Valor final cobrado: preco do plano menos o desconto em REAIS.
// Nunca abaixo de zero — desconto maior que a mensalidade viraria receita
// negativa no resumo.
const valorFinal = (c) =>
  Math.max((Number(c.valor_mensal) || 0) - (Number(c.desconto) || 0), 0);

/** Quanto falta do teste, com cor conforme a urgência. */
function SeloTeste({ cliente }) {
  const resta = restaTeste(cliente);
  if (resta === null) return <span className="text-text-gray">—</span>;

  let texto;
  let cor;
  if (resta < 0) {
    texto = `Venceu há ${Math.abs(resta)} ${Math.abs(resta) === 1 ? 'dia' : 'dias'}`;
    cor = 'bg-red-100 text-red-700';
  } else if (resta === 0) {
    texto = 'Vence hoje';
    cor = 'bg-red-100 text-red-700';
  } else {
    texto = `${resta} ${resta === 1 ? 'dia' : 'dias'} de teste`;
    cor = resta <= 7 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800';
  }

  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap ${cor}`}>
      {texto}
    </span>
  );
}

/**
 * Avatar do cliente: logo se houver, senao a inicial do nome.
 * Se a imagem falhar em carregar, CAI PRA INICIAL — a versao anterior
 * escondia a img e deixava um buraco branco na linha.
 */
function Avatar({ cliente }) {
  const [falhou, setFalhou] = useState(false);
  const inicial = String(cliente.nome || "?").charAt(0).toUpperCase();

  if (cliente.logo_url && !falhou) {
    return (
      <img src={cliente.logo_url} alt=""
        className="w-10 h-10 rounded-full object-contain border border-border-light bg-white flex-shrink-0"
        onError={() => setFalhou(true)} />
    );
  }
  return (
    <div className="w-10 h-10 rounded-full bg-purple-100 text-purple-800 flex items-center justify-center font-bold text-sm flex-shrink-0 border border-purple-200">
      {inicial}
    </div>
  );
}

const dinheiro = (v) =>
  v == null ? '—' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/**
 * Ha quanto tempo e cliente: '1 ano 1 mes' | '6 meses' | '25 dias'.
 *
 * Monta a data a partir dos PEDACOS (ano, mes, dia) em vez de
 * new Date("2025-07-15") — essa forma e lida como UTC e volta um dia no
 * nosso fuso, o classico que ja mordeu este projeto antes.
 */
const tempoDeCliente = (valor) => {
  const txt = String(valor || '').slice(0, 10);
  const m = txt.match(/^([0-9]{4})-([0-9]{2})-([0-9]{2})$/);
  if (!m) return '—';

  const inicio = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const agora = new Date();
  const hoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
  if (inicio > hoje) return '—'; // data futura: ainda nao comecou

  let anos = hoje.getFullYear() - inicio.getFullYear();
  let meses = hoje.getMonth() - inicio.getMonth();
  let dias = hoje.getDate() - inicio.getDate();

  if (dias < 0) {
    meses -= 1;
    // dia 0 do mes atual = ultimo dia do mes anterior (28/29/30/31 certinho)
    dias += new Date(hoje.getFullYear(), hoje.getMonth(), 0).getDate();
  }
  if (meses < 0) { anos -= 1; meses += 12; }

  const parte = (n, um, varios) => n + ' ' + (n === 1 ? um : varios);
  if (anos > 0) {
    return meses > 0
      ? parte(anos, 'ano', 'anos') + ' ' + parte(meses, 'mês', 'meses')
      : parte(anos, 'ano', 'anos');
  }
  if (meses > 0) return parte(meses, 'mês', 'meses');
  if (dias > 0) return parte(dias, 'dia', 'dias');
  return 'hoje';
};
const dataBr = (d) => {
  if (!d) return '—';
  const s = String(d).slice(0, 10);
  const m = s.match(/^([0-9]{4})-([0-9]{2})-([0-9]{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : s;
};

export default function Clientes({ situacao, aoMudar }) {
  const ativo = situacao === 'ativo';
  const [lista, setLista] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState('');
  const [editando, setEditando] = useState(null);

  const [planos, setPlanos] = useState([]);

  const carregar = async () => {
    setCarregando(true);
    try {
      const [cli, pl] = await Promise.all([
        api.get(`/clientes?situacao=${situacao}`),
        api.get('/planos'),
      ]);
      setLista(cli);
      setPlanos(pl.filter((p) => p.ativo));
    } catch { setLista([]); } finally { setCarregando(false); }
  };

  useEffect(() => { carregar(); }, [situacao]);

  const excluir = async (c) => {
    if (!window.confirm(`Excluir "${c.nome}"? Isso apaga também as cobranças dele.`)) return;
    await api.del(`/clientes/${c.id}`);
    carregar();
    aoMudar?.();
  };

  const filtrados = lista.filter((c) =>
    [c.nome, c.cidade, c.contato_nome, c.subdominio]
      .filter(Boolean).join(' ').toLowerCase().includes(busca.toLowerCase())
  );

  return (
    <div className="bg-white rounded-xl shadow-sm border border-border-light">
      <div className="p-4 border-b border-border-light flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-display font-bold text-text-dark text-lg">
            {ativo ? 'Clientes Ativos' : 'Prospecção'}
          </h2>
          <p className="text-xs text-text-gray">
            {ativo
              ? 'Quem já é cliente pagante e está com o sistema no ar.'
              : 'Funil comercial — de contato inicial até fechar.'}
          </p>
        </div>
        <div className="flex gap-2">
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar…"
            className="border-2 border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-purple-600"
          />
          <button
            onClick={() => setEditando({ situacao, estagio: ativo ? 'ganho' : 'novo' })}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-purple-800 text-white text-sm font-semibold hover:bg-purple-600 transition-colors"
          >
            <Plus className="w-4 h-4" /> Novo
          </button>
        </div>
      </div>

      {carregando ? (
        <p className="p-8 text-center text-text-gray text-sm">Carregando…</p>
      ) : !filtrados.length ? (
        <p className="p-8 text-center text-text-gray text-sm">
          {busca ? 'Nada encontrado com esse termo.' : 'Nenhum registro ainda. Clique em Novo.'}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-purple-50 text-text-dark">
              <tr>
                <th className="text-left px-4 py-2.5 font-semibold">Nome</th>
                <th className="text-left px-4 py-2.5 font-semibold">Contato</th>
                <th className="text-left px-4 py-2.5 font-semibold">Telefone</th>
                <th className="text-left px-4 py-2.5 font-semibold">Cidade</th>
                {ativo ? (
                  <>
                    <th className="text-left px-4 py-2.5 font-semibold">Lojas</th>
                    <th className="text-left px-4 py-2.5 font-semibold">Tempo de casa</th>
                    <th className="text-left px-4 py-2.5 font-semibold">Plano</th>
                    <th className="text-left px-4 py-2.5 font-semibold">Desconto</th>
                    <th className="text-left px-4 py-2.5 font-semibold">Mensal</th>
                    <th className="text-left px-4 py-2.5 font-semibold">Sistema</th>
                  </>
                ) : (
                  <>
                    <th className="text-left px-4 py-2.5 font-semibold">Estágio</th>
                    <th className="text-left px-4 py-2.5 font-semibold">Resta</th>
                    <th className="text-left px-4 py-2.5 font-semibold">Próxima ação</th>
                    <th className="text-left px-4 py-2.5 font-semibold">Quando</th>
                  </>
                )}
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((c, i) => {
                const est = ESTAGIOS.find((e) => e.v === c.estagio);
                return (
                  <tr key={c.id} className={i % 2 ? 'bg-purple-50/40' : 'bg-white'}>
                    <td className="px-4 py-3 font-semibold text-text-dark">
                      <div className="flex items-center gap-3">
                        <Avatar cliente={c} />
                        <span>{c.nome}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-text-gray">
                      {c.contato_nome || '—'}
                      {/* telefone saiu daqui: ganhou coluna propria */}
                    </td>
                    <td className="px-4 py-3 text-text-gray whitespace-nowrap">{c.telefone || '—'}</td>
                    <td className="px-4 py-3 text-text-gray">
                      {c.cidade ? `${c.cidade}${c.estado ? '/' + c.estado : ''}` : '—'}
                    </td>
                    {ativo ? (
                      <>
                        <td className="px-4 py-3 text-text-gray">{c.qtd_lojas ?? '—'}</td>
                        <td className="px-4 py-3 text-text-gray">
                          {tempoDeCliente(c.data_inicio)}
                          {/* Data de inicio embaixo: evita ter que abrir o cadastro */}
                          {c.data_inicio && (
                            <span className="block text-[11px] text-text-gray/70">
                              desde {dataBr(c.data_inicio)}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-text-gray">{c.plano || '—'}</td>
                        <td className="px-4 py-3">
                          {Number(c.desconto) > 0 ? (
                            <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-xs font-semibold">
                              &minus; {dinheiro(c.desconto)}
                            </span>
                          ) : <span className="text-text-gray">—</span>}
                        </td>
                        <td className="px-4 py-3 text-text-dark font-medium">
                          {dinheiro(valorFinal(c))}
                          {/* Preco cheio riscado deixa o desconto visivel na lista */}
                          {Number(c.desconto) > 0 && (
                            <span className="block text-[11px] text-text-gray line-through">
                              {dinheiro(c.valor_mensal)}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {c.subdominio ? (
                            <a
                              href={`https://${c.subdominio}.kontrataai.com.br`}
                              target="_blank" rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-purple-800 hover:underline text-xs"
                            >
                              {c.subdominio} <ExternalLink className="w-3 h-3" />
                            </a>
                          ) : '—'}
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${est?.cor || ''}`}>
                            {est?.rotulo || c.estagio}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <SeloTeste cliente={c} />
                        </td>
                        <td className="px-4 py-3 text-text-gray">{c.proxima_acao || '—'}</td>
                        <td className="px-4 py-3 text-text-gray">{dataBr(c.data_proxima_acao)}</td>
                      </>
                    )}
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button onClick={() => setEditando(c)}
                        className="p-1.5 rounded hover:bg-purple-100 text-purple-800" title="Editar">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => excluir(c)}
                        className="p-1.5 rounded hover:bg-red-100 text-red-600" title="Excluir">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {editando && (
        <FormCliente
          registro={editando}
          ativo={ativo}
          planos={planos}
          aoFechar={() => setEditando(null)}
          aoSalvar={() => { setEditando(null); carregar(); aoMudar?.(); }}
        />
      )}
    </div>
  );
}

function FormCliente({ registro, ativo, planos, aoFechar, aoSalvar }) {
  const [f, setF] = useState(registro);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const mudar = (campo) => (e) => setF({ ...f, [campo]: e.target.value });

  // Trocar o plano traz o preco da tabela. Fica editavel: se voce combinou
  // outro valor com o cliente, e so digitar por cima.
  const escolherPlano = (e) => {
    const nome = e.target.value;
    const p = planos.find((x) => x.nome === nome);
    setF({ ...f, plano: nome, valor_mensal: p ? Number(p.valor) : f.valor_mensal });
  };

  const salvar = async () => {
    if (!f.nome?.trim()) return setErro('O nome é obrigatório.');
    setSalvando(true);
    setErro('');
    try {
      if (f.id) await api.put(`/clientes/${f.id}`, f);
      else await api.post('/clientes', f);
      aoSalvar();
    } catch (err) {
      setErro(err.message);
      setSalvando(false);
    }
  };

  const campo = 'w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-purple-600';
  const rotulo = 'block text-xs font-semibold text-gray-600 mb-1';

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      onClick={aoFechar}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}>
        <div className="bg-purple-800 text-white px-5 py-3 rounded-t-xl">
          <h3 className="font-display font-bold text-lg">
            {f.id ? 'Editar' : 'Novo'} {ativo ? 'cliente' : 'prospect'}
          </h3>
        </div>

        <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className={rotulo}>Nome *</label>
            <input value={f.nome || ''} onChange={mudar('nome')} className={campo} />
          </div>
          <div className="md:col-span-2">
            <label className={rotulo}>Logotipo (link da imagem)</label>
            <div className="flex items-center gap-3">
              <Avatar cliente={f} />
              <input value={f.logo_url || ''} onChange={mudar('logo_url')}
                placeholder="https://... (link do logo do cliente)"
                className={campo} />
            </div>
            <p className="text-[11px] text-text-gray mt-1">
              Aparece na bolinha ao lado do nome na lista. Sem link, mostra a inicial.
            </p>
          </div>
          <div>
            <label className={rotulo}>Razão social</label>
            <input value={f.razao_social || ''} onChange={mudar('razao_social')} className={campo} />
          </div>
          <div>
            <label className={rotulo}>CNPJ</label>
            <input value={f.cnpj || ''} onChange={mudar('cnpj')} className={campo} />
          </div>
          <div>
            <label className={rotulo}>Contato</label>
            <input value={f.contato_nome || ''} onChange={mudar('contato_nome')} className={campo} />
          </div>
          <div>
            <label className={rotulo}>Cargo do contato</label>
            <input value={f.contato_cargo || ''} onChange={mudar('contato_cargo')} className={campo} />
          </div>
          <div>
            <label className={rotulo}>Telefone</label>
            <input value={f.telefone || ''} onChange={mudar('telefone')} className={campo} />
          </div>
          <div>
            <label className={rotulo}>E-mail</label>
            <input type="email" value={f.email || ''} onChange={mudar('email')} className={campo} />
          </div>
          <div>
            <label className={rotulo}>Cidade</label>
            <input value={f.cidade || ''} onChange={mudar('cidade')} className={campo} />
          </div>
          <div>
            <label className={rotulo}>UF</label>
            <input maxLength={2} value={f.estado || ''} onChange={mudar('estado')} className={campo} />
          </div>

          {ativo ? (
            <>
              <div>
                <label className={rotulo}>Plano</label>
                <select value={f.plano || ''} onChange={escolherPlano} className={campo}>
                  <option value="">—</option>
                  {planos.map((p) => <option key={p.id} value={p.nome}>{p.nome}</option>)}
                </select>
                <p className="text-[11px] text-text-gray mt-1">
                  Cadastrados em <strong>Planos</strong>. Escolher preenche o valor.
                </p>
              </div>
              <div>
                <label className={rotulo}>Valor mensal (R$)</label>
                <input type="number" step="0.01" value={f.valor_mensal || ''}
                  onChange={mudar('valor_mensal')} className={campo} />
              </div>
              <div>
                <label className={rotulo}>Desconto (R$)</label>
                <input type="number" step="0.01" min="0" value={f.desconto ?? 0}
                  onChange={mudar('desconto')} className={campo} />
                <p className="text-[11px] text-text-gray mt-1">Valor abatido da mensalidade.</p>
              </div>
              <div className="flex items-end pb-1">
                {/* Mostra a conta pronta: evita o "quanto ele paga mesmo?" */}
                <div className="w-full bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                  <p className="text-[10px] uppercase tracking-wider text-emerald-800">Cobrança final</p>
                  <p className="font-display font-bold text-emerald-900 text-lg">
                    {dinheiro(valorFinal(f))}
                  </p>
                </div>
              </div>
              <div>
                <label className={rotulo}>Subdomínio do sistema</label>
                <input value={f.subdominio || ''} onChange={mudar('subdominio')}
                  placeholder="tradicao" className={campo} />
                <p className="text-[11px] text-text-gray mt-1">
                  Vira o link {f.subdominio || 'cliente'}.kontrataai.com.br
                </p>
              </div>
              <div>
                <label className={rotulo}>Cliente desde</label>
                <input type="date" value={(f.data_inicio || '').slice(0, 10)}
                  onChange={mudar('data_inicio')} className={campo} />
              </div>
              <div>
                <label className={rotulo}>Qtd. de lojas</label>
                <input type="number" value={f.qtd_lojas || ''} onChange={mudar('qtd_lojas')} className={campo} />
              </div>
              <div>
                <label className={rotulo}>Dia de vencimento</label>
                <select value={f.dia_vencimento || ''} onChange={mudar('dia_vencimento')} className={campo}>
                  <option value="">—</option>
                  {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                    <option key={d} value={d}>dia {d}</option>
                  ))}
                </select>
                <p className="text-[11px] text-text-gray mt-1">
                  Usado na grade do Financeiro. Dia 31 em mês curto cai no último dia.
                </p>
              </div>
            </>
          ) : (
            <>
              <div>
                <label className={rotulo}>Estágio</label>
                <select value={f.estagio || 'novo'} onChange={mudar('estagio')} className={campo}>
                  {ESTAGIOS.map((e) => <option key={e.v} value={e.v}>{e.rotulo}</option>)}
                </select>
              </div>
              <div>
                <label className={rotulo}>Origem</label>
                <input value={f.origem || ''} onChange={mudar('origem')}
                  placeholder="Indicação, Instagram…" className={campo} />
              </div>
              <div>
                <label className={rotulo}>Próxima ação</label>
                <input value={f.proxima_acao || ''} onChange={mudar('proxima_acao')}
                  placeholder="Ligar, mandar proposta…" className={campo} />
              </div>
              <div>
                <label className={rotulo}>Data da próxima ação</label>
                <input type="date" value={(f.data_proxima_acao || '').slice(0, 10)}
                  onChange={mudar('data_proxima_acao')} className={campo} />
              </div>

              <div>
                <label className={rotulo}>Início do teste</label>
                <input type="date" value={(f.teste_inicio || '').slice(0, 10)}
                  onChange={mudar('teste_inicio')} className={campo} />
              </div>
              <div>
                <label className={rotulo}>Dias de teste</label>
                <select value={f.teste_dias || ''} onChange={mudar('teste_dias')} className={campo}>
                  <option value="">—</option>
                  {DIAS_TESTE.map((d) => (
                    <option key={d} value={d}>{d} dias</option>
                  ))}
                </select>
              </div>

              {/* Resultado na hora: evita ter que salvar e voltar pra conferir */}
              {restaTeste(f) !== null && (
                <div className="md:col-span-2 bg-purple-50 border border-purple-200 rounded-lg px-3 py-2 flex items-center gap-3">
                  <span className="text-xs text-purple-900">Situação do teste:</span>
                  <SeloTeste cliente={f} />
                </div>
              )}
            </>
          )}

          <div className="md:col-span-2">
            <label className={rotulo}>Observações</label>
            <textarea rows={3} value={f.observacoes || ''} onChange={mudar('observacoes')} className={campo} />
          </div>

          {/* Prospect que fechou vira cliente ativo sem perder o histórico. */}
          {!ativo && (
            <div className="md:col-span-2 bg-emerald-50 border border-emerald-200 rounded-lg p-3">
              <label className="flex items-center gap-2 text-sm text-emerald-900 cursor-pointer">
                <input type="checkbox" checked={f.situacao === 'ativo'}
                  onChange={(e) => setF({ ...f, situacao: e.target.checked ? 'ativo' : 'prospeccao', estagio: e.target.checked ? 'ganho' : f.estagio })}
                  className="w-4 h-4 accent-emerald-600" />
                <span><strong>Fechou!</strong> Mover para Clientes Ativos.</span>
              </label>
            </div>
          )}

          {erro && (
            <p className="md:col-span-2 text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs">
              {erro}
            </p>
          )}
        </div>

        <div className="border-t px-5 py-3 flex justify-end gap-2">
          <button onClick={aoFechar}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-semibold">
            Cancelar
          </button>
          <button onClick={salvar} disabled={salvando}
            className="px-6 py-2 bg-purple-800 hover:bg-purple-600 text-white rounded-lg text-sm font-bold disabled:opacity-60">
            {salvando ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
}
