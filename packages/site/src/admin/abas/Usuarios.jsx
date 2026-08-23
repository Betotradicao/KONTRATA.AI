import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, KeyRound, Crown } from 'lucide-react';
import { api } from '../api';

/**
 * Gestão dos usuários do painel. Só aparece pra quem é MASTER.
 * É por aqui que se cria a conta de mais alguém da equipe sem precisar de mim.
 */

const quando = (d) => {
  if (!d) return 'nunca entrou';
  const dt = new Date(d);
  return dt.toLocaleDateString('pt-BR') + ' às ' + dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
};

export default function Usuarios({ euId }) {
  const [lista, setLista] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [editando, setEditando] = useState(null);

  const carregar = async () => {
    setCarregando(true);
    try { setLista(await api.get('/usuarios')); }
    catch { setLista([]); } finally { setCarregando(false); }
  };

  useEffect(() => { carregar(); }, []);

  const excluir = async (u) => {
    if (!window.confirm(`Excluir o usuário "${u.usuario}"? Ele perde o acesso na hora.`)) return;
    try { await api.del(`/usuarios/${u.id}`); carregar(); }
    catch (e) { alert(e.message); }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-border-light">
      <div className="p-4 border-b border-border-light flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-display font-bold text-text-dark text-lg">Usuários do painel</h2>
          <p className="text-xs text-text-gray">Quem da equipe pode entrar aqui.</p>
        </div>
        <button onClick={() => setEditando({ ativo: true, master: false })}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-purple-800 text-white text-sm font-semibold hover:bg-purple-600 transition-colors">
          <Plus className="w-4 h-4" /> Novo usuário
        </button>
      </div>

      {carregando ? (
        <p className="p-8 text-center text-text-gray text-sm">Carregando…</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-purple-50 text-text-dark">
              <tr>
                <th className="text-left px-4 py-2.5 font-semibold">Usuário</th>
                <th className="text-left px-4 py-2.5 font-semibold">Nome</th>
                <th className="text-left px-4 py-2.5 font-semibold">Último acesso</th>
                <th className="text-left px-4 py-2.5 font-semibold">Situação</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {lista.map((u, i) => (
                <tr key={u.id} className={i % 2 ? 'bg-purple-50/40' : 'bg-white'}>
                  <td className="px-4 py-2.5 font-semibold text-text-dark">
                    <span className="inline-flex items-center gap-1.5">
                      {u.usuario}
                      {u.master && (
                        <span title="Usuário master" className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold">
                          <Crown className="w-3 h-3" /> MASTER
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-text-gray">{u.nome}</td>
                  <td className="px-4 py-2.5 text-text-gray text-xs">{quando(u.ultimo_acesso)}</td>
                  <td className="px-4 py-2.5">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                      u.ativo ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {u.ativo ? 'Ativo' : 'Bloqueado'}
                    </span>
                    {u.precisa_trocar_senha && (
                      <span className="ml-2 text-[10px] text-amber-700">senha temporária</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right whitespace-nowrap">
                    <button onClick={() => setEditando(u)}
                      className="p-1.5 rounded hover:bg-purple-100 text-purple-800" title="Editar">
                      <Pencil className="w-4 h-4" />
                    </button>
                    {u.id !== euId && (
                      <button onClick={() => excluir(u)}
                        className="p-1.5 rounded hover:bg-red-100 text-red-600" title="Excluir">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editando && (
        <FormUsuario registro={editando} euId={euId}
          aoFechar={() => setEditando(null)}
          aoSalvar={() => { setEditando(null); carregar(); }} />
      )}
    </div>
  );
}

const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
const sugerirSenha = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(12)))
    .map((b) => ALFABETO[b % ALFABETO.length])
    .join('');

function FormUsuario({ registro, euId, aoFechar, aoSalvar }) {
  const [f, setF] = useState(registro);
  const [senha, setSenha] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const novo = !f.id;
  const souEu = f.id === euId;

  const salvar = async () => {
    if (!f.nome?.trim()) return setErro('Informe o nome.');
    if (!f.usuario?.trim()) return setErro('Informe o usuário.');
    if (novo && !senha) return setErro('Defina uma senha inicial.');
    setSalvando(true);
    setErro('');
    try {
      const dados = {
        nome: f.nome.trim(),
        usuario: f.usuario.trim(),
        email: f.email || null,
        ativo: !!f.ativo,
        master: !!f.master,
      };
      if (senha) dados.senha = senha;
      if (novo) await api.post('/usuarios', dados);
      else await api.put(`/usuarios/${f.id}`, dados);
      aoSalvar();
    } catch (err) { setErro(err.message); setSalvando(false); }
  };

  const campo = 'w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-purple-600';
  const rotulo = 'block text-xs font-semibold text-gray-600 mb-1';

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={aoFechar}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        <div className="bg-purple-800 text-white px-5 py-3 rounded-t-xl">
          <h3 className="font-display font-bold text-lg">{novo ? 'Novo usuário' : 'Editar usuário'}</h3>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className={rotulo}>Nome *</label>
            <input value={f.nome || ''} onChange={(e) => setF({ ...f, nome: e.target.value })} className={campo} />
          </div>
          <div>
            <label className={rotulo}>Usuário *</label>
            <input value={f.usuario || ''} onChange={(e) => setF({ ...f, usuario: e.target.value })}
              autoCapitalize="none" placeholder="mari" className={campo} />
            <p className="text-[11px] text-text-gray mt-1">
              É o que a pessoa digita pra entrar. Maiúscula e minúscula dá no mesmo.
            </p>
          </div>
          <div>
            <label className={rotulo}>E-mail (opcional)</label>
            <input type="email" value={f.email || ''} onChange={(e) => setF({ ...f, email: e.target.value })} className={campo} />
          </div>

          <div>
            <label className={rotulo}>{novo ? 'Senha inicial *' : 'Nova senha'}</label>
            <div className="flex gap-2">
              <input value={senha} onChange={(e) => setSenha(e.target.value)}
                placeholder={novo ? 'Mínimo 8 caracteres' : 'Deixe em branco para manter'}
                className={campo} />
              <button type="button" onClick={() => setSenha(sugerirSenha())} title="Gerar senha"
                className="px-3 rounded-lg border-2 border-gray-200 hover:bg-gray-50 text-purple-800">
                <KeyRound className="w-4 h-4" />
              </button>
            </div>
            <p className="text-[11px] text-text-gray mt-1">
              A pessoa entra com esta senha e o painel obriga ela a criar a própria.
              Assim nem você fica sabendo a senha final dela.
            </p>
          </div>

          <label className={`flex items-center gap-2 text-sm ${souEu ? 'opacity-50' : 'cursor-pointer'}`}>
            <input type="checkbox" checked={!!f.master} disabled={souEu}
              onChange={(e) => setF({ ...f, master: e.target.checked })}
              className="w-4 h-4 accent-amber-500" />
            <span>
              <strong>Master</strong> — pode criar e remover usuários do painel
            </span>
          </label>

          <label className={`flex items-center gap-2 text-sm ${souEu ? 'opacity-50' : 'cursor-pointer'}`}>
            <input type="checkbox" checked={!!f.ativo} disabled={souEu}
              onChange={(e) => setF({ ...f, ativo: e.target.checked })}
              className="w-4 h-4 accent-purple-600" />
            Acesso liberado
          </label>

          {souEu && (
            <p className="text-[11px] text-text-gray bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
              Você não consegue remover o próprio master nem se bloquear — senão
              o painel ficaria sem dono e ninguém conseguiria mais entrar.
            </p>
          )}

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
