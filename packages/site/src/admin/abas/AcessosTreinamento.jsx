import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, KeyRound, Copy, Check } from 'lucide-react';
import { api } from '../api';

/**
 * Usuário e senha que cada cliente usa pra entrar em /treinamento.
 * A senha é gravada como hash — depois de salva, ninguém (nem aqui) consegue
 * ver de novo. Se o cliente esquecer, define-se uma nova.
 */

const quando = (d) => {
  if (!d) return 'nunca acessou';
  const dt = new Date(d);
  return dt.toLocaleDateString('pt-BR') + ' às ' + dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
};

export default function AcessosTreinamento() {
  const [lista, setLista] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [editando, setEditando] = useState(null);

  const carregar = async () => {
    setCarregando(true);
    try {
      const [ac, cl] = await Promise.all([
        api.get('/acessos-treinamento'),
        api.get('/clientes?situacao=ativo'),
      ]);
      setLista(ac);
      setClientes(cl);
    } catch { setLista([]); } finally { setCarregando(false); }
  };

  useEffect(() => { carregar(); }, []);

  const excluir = async (a) => {
    if (!window.confirm(`Remover o acesso "${a.usuario}"? A pessoa perde o acesso na hora.`)) return;
    await api.del(`/acessos-treinamento/${a.id}`);
    carregar();
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-border-light">
      <div className="p-4 border-b border-border-light flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-display font-bold text-text-dark text-lg">Acessos dos clientes</h2>
          <p className="text-xs text-text-gray">Quem pode entrar na área de treinamento.</p>
        </div>
        <button onClick={() => setEditando({ ativo: true })}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-purple-800 text-white text-sm font-semibold hover:bg-purple-600 transition-colors">
          <Plus className="w-4 h-4" /> Novo acesso
        </button>
      </div>

      {carregando ? (
        <p className="p-8 text-center text-text-gray text-sm">Carregando…</p>
      ) : !lista.length ? (
        <p className="p-8 text-center text-text-gray text-sm">
          Nenhum acesso cadastrado. Sem isso, ninguém entra na área de treinamento.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-purple-50 text-text-dark">
              <tr>
                <th className="text-left px-4 py-2.5 font-semibold">Usuário</th>
                <th className="text-left px-4 py-2.5 font-semibold">Cliente</th>
                <th className="text-left px-4 py-2.5 font-semibold">Último acesso</th>
                <th className="text-left px-4 py-2.5 font-semibold">Situação</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {lista.map((a, i) => (
                <tr key={a.id} className={i % 2 ? 'bg-purple-50/40' : 'bg-white'}>
                  <td className="px-4 py-2.5 font-semibold text-text-dark">{a.usuario}</td>
                  <td className="px-4 py-2.5 text-text-gray">{a.cliente_nome || '—'}</td>
                  <td className="px-4 py-2.5 text-text-gray text-xs">{quando(a.ultimo_acesso)}</td>
                  <td className="px-4 py-2.5">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                      a.ativo ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {a.ativo ? 'Ativo' : 'Bloqueado'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right whitespace-nowrap">
                    <button onClick={() => setEditando(a)}
                      className="p-1.5 rounded hover:bg-purple-100 text-purple-800" title="Editar">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => excluir(a)}
                      className="p-1.5 rounded hover:bg-red-100 text-red-600" title="Remover">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editando && (
        <FormAcesso registro={editando} clientes={clientes}
          aoFechar={() => setEditando(null)}
          aoSalvar={() => { setEditando(null); carregar(); }} />
      )}
    </div>
  );
}

// Sem caracteres que confundem na hora de ditar (0/O, 1/l).
const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
const sugerirSenha = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(10)))
    .map((b) => ALFABETO[b % ALFABETO.length])
    .join('');

function FormAcesso({ registro, clientes, aoFechar, aoSalvar }) {
  const [f, setF] = useState(registro);
  const [senha, setSenha] = useState('');
  const [copiado, setCopiado] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const novo = !f.id;

  const salvar = async () => {
    if (!f.usuario?.trim()) return setErro('Informe o usuário.');
    if (novo && !senha) return setErro('Defina uma senha.');
    setSalvando(true);
    setErro('');
    try {
      const dados = { cliente_id: f.cliente_id || null, usuario: f.usuario.trim(), ativo: !!f.ativo };
      if (senha) dados.senha = senha;
      if (novo) await api.post('/acessos-treinamento', dados);
      else await api.put(`/acessos-treinamento/${f.id}`, dados);
      aoSalvar();
    } catch (err) { setErro(err.message); setSalvando(false); }
  };

  const copiar = async () => {
    const texto = `Acesso aos treinamentos Kontrataai\nhttps://kontrataai.com.br/treinamento\nUsuário: ${f.usuario}\nSenha: ${senha}`;
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch { /* navegador bloqueou; a pessoa copia na mão */ }
  };

  const campo = 'w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-purple-600';
  const rotulo = 'block text-xs font-semibold text-gray-600 mb-1';

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={aoFechar}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        <div className="bg-purple-800 text-white px-5 py-3 rounded-t-xl">
          <h3 className="font-display font-bold text-lg">{novo ? 'Novo acesso' : 'Editar acesso'}</h3>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className={rotulo}>Cliente</label>
            <select value={f.cliente_id || ''} onChange={(e) => setF({ ...f, cliente_id: e.target.value })}
              className={campo}>
              <option value="">— sem vínculo —</option>
              {clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>

          <div>
            <label className={rotulo}>Usuário *</label>
            <input value={f.usuario || ''} onChange={(e) => setF({ ...f, usuario: e.target.value })}
              placeholder="tradicao" className={campo} />
            <p className="text-[11px] text-text-gray mt-1">
              É o que a pessoa digita pra entrar. Sem espaços, sem maiúscula.
            </p>
          </div>

          <div>
            <label className={rotulo}>{novo ? 'Senha *' : 'Nova senha'}</label>
            <div className="flex gap-2">
              <input value={senha} onChange={(e) => setSenha(e.target.value)}
                placeholder={novo ? 'Mínimo 6 caracteres' : 'Deixe em branco para manter a atual'}
                className={campo} />
              <button type="button" onClick={() => setSenha(sugerirSenha())}
                title="Gerar senha"
                className="px-3 rounded-lg border-2 border-gray-200 hover:bg-gray-50 text-purple-800">
                <KeyRound className="w-4 h-4" />
              </button>
            </div>
            {!novo && (
              <p className="text-[11px] text-text-gray mt-1">
                A senha atual não pode ser consultada — ela é guardada embaralhada.
                Se o cliente esqueceu, defina uma nova aqui.
              </p>
            )}
          </div>

          {senha && (
            <div className="bg-amber-50 border border-amber-300 rounded-lg p-3">
              <p className="text-xs text-amber-900 mb-2">
                <strong>Anote ou envie agora.</strong> Depois de salvar, esta senha não aparece mais.
              </p>
              <button type="button" onClick={copiar}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-amber-300 text-amber-900 text-xs font-semibold hover:bg-amber-100">
                {copiado ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copiado ? 'Copiado!' : 'Copiar dados de acesso'}
              </button>
            </div>
          )}

          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={!!f.ativo}
              onChange={(e) => setF({ ...f, ativo: e.target.checked })}
              className="w-4 h-4 accent-purple-600" />
            Acesso liberado
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
