import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Check, EyeOff } from 'lucide-react';
import { api } from '../api';

/**
 * Tabela de preços. É a fonte do valor que entra sozinho na ficha do cliente
 * quando se escolhe o plano — mexer no preço aqui NÃO altera contrato de quem
 * já é cliente (o valor fica gravado na ficha dele).
 */

const dinheiro = (v) =>
  (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function Planos() {
  const [lista, setLista] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [editando, setEditando] = useState(null);

  const carregar = async () => {
    setCarregando(true);
    try { setLista(await api.get('/planos')); }
    catch { setLista([]); } finally { setCarregando(false); }
  };

  useEffect(() => { carregar(); }, []);

  // Liga/desliga o "Em breve" do site sem abrir o formulario.
  const alternarSite = async (p) => {
    await api.put(`/planos/${p.id}`, {
      ...p,
      em_breve: !p.em_breve,
      // Sai do "Em breve" sem texto de botao definido? Poe um padrao,
      // senao o site mostraria um botao sem rotulo.
      cta: !p.em_breve ? 'Em breve' : (p.cta === 'Em breve' ? 'Quero este plano' : p.cta),
    });
    carregar();
  };

  const excluir = async (p) => {
    if (!window.confirm(`Excluir o plano "${p.nome}"? Clientes que já estão nele mantêm o valor gravado na ficha.`)) return;
    await api.del(`/planos/${p.id}`);
    carregar();
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-border-light">
      <div className="p-4 border-b border-border-light flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-display font-bold text-text-dark text-lg">Planos</h2>
          <p className="text-xs text-text-gray">
            Preço e o que está incluído em cada um. O valor entra sozinho ao escolher
            o plano na ficha do cliente.
          </p>
        </div>
        <button onClick={() => setEditando({ ativo: true, recursos: [], ordem: lista.length + 1 })}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-purple-800 text-white text-sm font-semibold hover:bg-purple-600 transition-colors">
          <Plus className="w-4 h-4" /> Novo plano
        </button>
      </div>

      {carregando ? (
        <p className="p-8 text-center text-text-gray text-sm">Carregando…</p>
      ) : !lista.length ? (
        <p className="p-8 text-center text-text-gray text-sm">Nenhum plano cadastrado.</p>
      ) : (
        <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          {lista.map((p) => (
            <div key={p.id}
              className={`rounded-xl border p-5 flex flex-col ${
                p.ativo ? 'border-border-light' : 'border-gray-200 opacity-60'
              }`}>
              <div className="flex items-start justify-between gap-2 mb-1">
                <h3 className="font-display font-bold text-text-dark text-xl">{p.nome}</h3>
                <div className="flex flex-col items-end gap-1">
                  {!p.ativo && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 text-[10px] font-bold">
                      <EyeOff className="w-3 h-3" /> INATIVO
                    </span>
                  )}
                  {p.badge && (
                    <span className="px-2 py-0.5 rounded-full bg-amber-400 text-text-dark text-[10px] font-bold">
                      {p.badge}
                    </span>
                  )}
                  {!p.no_site && (
                    <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 text-[10px] font-bold">
                      FORA DO SITE
                    </span>
                  )}
                </div>
              </div>
              <p className="text-text-gray text-xs mb-4">{p.descricao}</p>

              <div className="flex items-baseline gap-1 mb-4">
                <span className="text-text-gray text-sm">R$</span>
                <span className="font-display font-bold text-text-dark text-3xl">
                  {Number(p.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
                <span className="text-text-gray text-sm">/mês</span>
              </div>

              <ul className="space-y-2 mb-5 flex-1">
                {(p.recursos || []).map((r, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-text-gray">
                    <Check className="w-3.5 h-3.5 text-success flex-shrink-0 mt-0.5" />
                    <span>{r}</span>
                  </li>
                ))}
                {!(p.recursos || []).length && (
                  <li className="text-xs text-text-gray/60 italic">Nada listado ainda.</li>
                )}
              </ul>

              {/* Chave rapida: e o que o usuario mais vai mexer. Evita abrir
                  o formulario so pra tirar um plano do "Em breve". */}
              <button onClick={() => alternarSite(p)}
                className={`w-full mb-3 px-3 py-2 rounded-lg text-xs font-bold transition-colors ${
                  p.em_breve
                    ? 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    : 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                }`}>
                {p.em_breve ? '🔒 No site: EM BREVE — clique para liberar' : '✅ No site: DISPONÍVEL — clique para "Em breve"'}
              </button>

              <div className="flex gap-1 border-t border-border-light pt-3">
                <button onClick={() => setEditando(p)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded hover:bg-purple-100 text-purple-800 text-xs font-semibold">
                  <Pencil className="w-3.5 h-3.5" /> Editar
                </button>
                <button onClick={() => excluir(p)}
                  className="p-1.5 rounded hover:bg-red-100 text-red-600" title="Excluir">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editando && (
        <FormPlano registro={editando} aoFechar={() => setEditando(null)}
          aoSalvar={() => { setEditando(null); carregar(); }} />
      )}
    </div>
  );
}

function FormPlano({ registro, aoFechar, aoSalvar }) {
  const [f, setF] = useState(registro);
  // Recursos editados como texto, um por linha — é como a pessoa pensa a lista.
  const [texto, setTexto] = useState((registro.recursos || []).join('\n'));
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  const salvar = async () => {
    if (!f.nome?.trim()) return setErro('Informe o nome do plano.');
    setSalvando(true);
    setErro('');
    try {
      const dados = {
        nome: f.nome.trim(),
        descricao: f.descricao || null,
        valor: Number(f.valor) || 0,
        recursos: texto.split('\n').map((l) => l.trim()).filter(Boolean),
        ordem: Number(f.ordem) || 0,
        ativo: !!f.ativo,
        no_site: f.no_site !== false,
        em_breve: !!f.em_breve,
        destaque: !!f.destaque,
        badge: f.badge || null,
        cta: f.cta || null,
        link_pagamento: f.link_pagamento || null,
      };
      if (f.id) await api.put(`/planos/${f.id}`, dados);
      else await api.post('/planos', dados);
      aoSalvar();
    } catch (err) { setErro(err.message); setSalvando(false); }
  };

  const campo = 'w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-purple-600';
  const rotulo = 'block text-xs font-semibold text-gray-600 mb-1';

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={aoFechar}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}>
        <div className="bg-purple-800 text-white px-5 py-3 rounded-t-xl">
          <h3 className="font-display font-bold text-lg">{f.id ? 'Editar' : 'Novo'} plano</h3>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className={rotulo}>Nome *</label>
            <input value={f.nome || ''} onChange={(e) => setF({ ...f, nome: e.target.value })} className={campo} />
          </div>
          <div>
            <label className={rotulo}>Descrição</label>
            <input value={f.descricao || ''} onChange={(e) => setF({ ...f, descricao: e.target.value })}
              placeholder="Para acabar com o caos da contratação." className={campo} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={rotulo}>Valor mensal (R$)</label>
              <input type="number" step="0.01" value={f.valor ?? ''}
                onChange={(e) => setF({ ...f, valor: e.target.value })} className={campo} />
            </div>
            <div>
              <label className={rotulo}>Ordem</label>
              <input type="number" value={f.ordem ?? 0}
                onChange={(e) => setF({ ...f, ordem: e.target.value })} className={campo} />
            </div>
          </div>

          <div>
            <label className={rotulo}>O que vai neste plano</label>
            <textarea rows={9} value={texto} onChange={(e) => setTexto(e.target.value)}
              placeholder={'Um item por linha:\nPágina de vagas com a sua marca\nBanco de currículos automático'}
              className={campo + ' font-mono text-xs'} />
            <p className="text-[11px] text-text-gray mt-1">
              Um item por linha. Linha em branco é ignorada.
            </p>
          </div>

          <div className="border-t border-border-light pt-4 space-y-3">
            <p className="text-xs font-bold text-text-dark uppercase tracking-wider">
              Como aparece no site
            </p>

            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={f.no_site !== false}
                onChange={(e) => setF({ ...f, no_site: e.target.checked })}
                className="w-4 h-4 accent-purple-600" />
              Mostrar em kontrataai.com.br
            </label>

            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={!!f.em_breve}
                onChange={(e) => setF({ ...f, em_breve: e.target.checked })}
                className="w-4 h-4 accent-gray-500" />
              <span><strong>Em breve</strong> — mostra cadeado, sem botão de compra</span>
            </label>

            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={!!f.destaque}
                onChange={(e) => setF({ ...f, destaque: e.target.checked })}
                className="w-4 h-4 accent-amber-500" />
              Destacar (borda roxa e sombra maior)
            </label>

            <div>
              <label className={rotulo}>Selo (ex: MAIS ESCOLHIDO)</label>
              <input value={f.badge || ''} onChange={(e) => setF({ ...f, badge: e.target.value })}
                className={campo} />
            </div>

            {!f.em_breve && (
              <>
                <div>
                  <label className={rotulo}>Texto do botão</label>
                  <input value={f.cta || ''} onChange={(e) => setF({ ...f, cta: e.target.value })}
                    placeholder="Começar pelo Recrutamento" className={campo} />
                </div>
                <div>
                  <label className={rotulo}>Link de pagamento</label>
                  <input value={f.link_pagamento || ''}
                    onChange={(e) => setF({ ...f, link_pagamento: e.target.value })}
                    placeholder="https://www.asaas.com/c/..." className={campo} />
                </div>
              </>
            )}
          </div>

          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={!!f.ativo}
              onChange={(e) => setF({ ...f, ativo: e.target.checked })}
              className="w-4 h-4 accent-purple-600" />
            Plano ativo (aparece na escolha do cliente)
          </label>

          {erro && (
            <p className="text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs">{erro}</p>
          )}
        </div>

        <div className="border-t px-5 py-3 flex justify-end gap-2">
          <button onClick={aoFechar} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-semibold">
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
