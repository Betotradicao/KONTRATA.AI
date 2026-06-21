import { useEffect, useState } from 'react';
import api from '../../utils/api';
import toast from 'react-hot-toast';

// Painel "Cláusulas por Função" do Contrato de Trabalho.
// O RH escolhe um CARGO e monta a lista de cláusulas dele:
//  - Acrescenta da BIBLIOTECA (14 padrão) OU cria novas.
//  - Edita / exclui / reordena.
// Ao gerar o contrato, o backend injeta essas cláusulas (do cargo do colaborador)
// no lugar de $CLAUSULAS$.

export default function ContratoClausulasPanel() {
  const [cargos, setCargos] = useState([]);
  const [cargoId, setCargoId] = useState('');
  const [clausulas, setClausulas] = useState([]);
  const [biblioteca, setBiblioteca] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editando, setEditando] = useState(null); // { id?, titulo, conteudo }
  const [mostrarBib, setMostrarBib] = useState(false);

  useEffect(() => {
    api.get('/rh/configuracoes/cargos')
      .then(r => setCargos(Array.isArray(r.data) ? r.data : (r.data?.data || [])))
      .catch(() => {});
    api.get('/rh/contrato/clausulas/biblioteca')
      .then(r => setBiblioteca(Array.isArray(r.data) ? r.data : []))
      .catch(() => {});
  }, []);

  const carregar = async (cid) => {
    if (!cid) { setClausulas([]); return; }
    setLoading(true);
    try {
      // ensure: se o cargo é novo (nunca teve cláusulas), já vem com as 14 padrão.
      const r = await api.post(`/rh/contrato/clausulas/ensure/${cid}`);
      setClausulas(Array.isArray(r.data) ? r.data : []);
    } catch { /* ignore */ } finally { setLoading(false); }
  };

  useEffect(() => { carregar(cargoId); }, [cargoId]);

  const addBiblioteca = async (idx) => {
    try {
      await api.post('/rh/contrato/clausulas/add-biblioteca', { cargoId: Number(cargoId), idxs: [idx] });
      await carregar(cargoId);
      toast.success('Cláusula acrescentada');
    } catch (e) { toast.error(e?.response?.data?.error || 'Erro'); }
  };

  const addTodasBiblioteca = async () => {
    try {
      await api.post('/rh/contrato/clausulas/add-biblioteca', { cargoId: Number(cargoId), idxs: biblioteca.map(b => b.idx) });
      await carregar(cargoId);
      toast.success('14 cláusulas padrão acrescentadas');
    } catch (e) { toast.error(e?.response?.data?.error || 'Erro'); }
  };

  const salvarClausula = async () => {
    if (!editando?.conteudo?.trim()) { toast.error('Conteúdo obrigatório'); return; }
    try {
      if (editando.id) {
        await api.put(`/rh/contrato/clausulas/${editando.id}`, { titulo: editando.titulo, conteudo: editando.conteudo });
      } else {
        await api.post('/rh/contrato/clausulas', { cargoId: Number(cargoId), titulo: editando.titulo, conteudo: editando.conteudo });
      }
      setEditando(null);
      await carregar(cargoId);
      toast.success('Salvo');
    } catch (e) { toast.error(e?.response?.data?.error || 'Erro ao salvar'); }
  };

  const excluir = async (c) => {
    if (!window.confirm('Excluir esta cláusula?')) return;
    try { await api.delete(`/rh/contrato/clausulas/${c.id}`); await carregar(cargoId); } catch { toast.error('Erro'); }
  };

  const mover = async (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= clausulas.length) return;
    const arr = [...clausulas];
    [arr[i], arr[j]] = [arr[j], arr[i]];
    setClausulas(arr);
    try { await api.put('/rh/contrato/clausulas/reordenar', { ordem: arr.map((c, idx) => ({ id: c.id, ordem: idx + 1 })) }); } catch { /* ignore */ }
  };

  return (
    <div className="border-t-2 border-indigo-200 pt-3 mt-3">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div>
          <h3 className="text-base font-bold text-indigo-900">📑 Cláusulas por Função</h3>
          <p className="text-xs text-gray-500">Monte as cláusulas de cada cargo. Ao gerar o contrato, elas entram no lugar de <span className="font-mono text-indigo-700">$CLAUSULAS$</span> (conforme o cargo do colaborador).</p>
        </div>
      </div>

      <div className="mb-3">
        <label className="text-sm font-bold uppercase text-gray-700 block mb-1">Função (cargo)</label>
        <select
          value={cargoId}
          onChange={(e) => setCargoId(e.target.value)}
          className="w-full md:w-96 border border-gray-300 rounded px-3 py-2 text-base"
        >
          <option value="">— selecione um cargo —</option>
          {cargos.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
      </div>

      {!cargoId ? (
        <div className="text-center py-6 text-sm text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg">
          Escolha um cargo pra montar as cláusulas dele.
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <button type="button" onClick={() => setEditando({ titulo: '', conteudo: '' })}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm px-4 py-2 rounded shadow">➕ Nova cláusula</button>
            <button type="button" onClick={() => setMostrarBib(v => !v)}
              className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold text-sm px-4 py-2 rounded">
              📚 Biblioteca (14 padrão) {mostrarBib ? '▲' : '▼'}
            </button>
            {clausulas.length === 0 && (
              <button type="button" onClick={addTodasBiblioteca}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm px-4 py-2 rounded shadow">✨ Acrescentar as 14 de uma vez</button>
            )}
          </div>

          {/* Biblioteca das 14 padrão */}
          {/* Cláusulas do cargo (EM CIMA, pra ver na hora que adiciona) */}
          <div className="text-sm font-bold text-indigo-900 mb-2">
            📋 Cláusulas deste cargo ({clausulas.length})
          </div>
          {loading ? (
            <p className="text-sm text-gray-400 py-3">Carregando...</p>
          ) : clausulas.length === 0 ? (
            <div className="text-center py-5 text-sm text-gray-500 bg-gray-50 border border-gray-200 rounded-lg mb-4">
              Nenhuma cláusula nesse cargo ainda. Use <strong>✨ Acrescentar as 14</strong>, <strong>📚 Biblioteca → ➕ Add</strong> ou <strong>➕ Nova cláusula</strong>.
            </div>
          ) : (
            <div className="space-y-2 mb-4">
              {clausulas.map((c, i) => (
                <div key={c.id} className="p-3 bg-indigo-50 border border-indigo-200 rounded">
                  <div className="flex items-start gap-2">
                    <span className="font-bold text-indigo-700 text-base">{i + 1}.</span>
                    <div className="flex-1">
                      {c.titulo && <div className="text-base font-bold text-indigo-900 leading-tight">{c.titulo}</div>}
                      <div className="text-[15px] text-gray-800 leading-relaxed">{c.conteudo}</div>
                    </div>
                  </div>
                  <div className="flex justify-end gap-1 mt-2 pt-2 border-t border-indigo-100">
                    <button type="button" onClick={() => mover(i, -1)} disabled={i === 0} title="Subir"
                      className="bg-white border border-gray-300 hover:bg-gray-50 rounded p-1 text-xs disabled:opacity-30">▲</button>
                    <button type="button" onClick={() => mover(i, 1)} disabled={i === clausulas.length - 1} title="Descer"
                      className="bg-white border border-gray-300 hover:bg-gray-50 rounded p-1 text-xs disabled:opacity-30">▼</button>
                    <button type="button" onClick={() => setEditando({ ...c })} title="Editar"
                      className="bg-white border border-blue-300 hover:bg-blue-50 text-blue-600 rounded px-2 py-1 text-sm font-semibold">✏️ Editar</button>
                    <button type="button" onClick={() => excluir(c)} title="Excluir"
                      className="bg-white border border-red-300 hover:bg-red-50 text-red-600 rounded px-2 py-1 text-sm font-semibold">🗑️ Excluir</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Biblioteca das 14 padrão (embaixo) */}
          {mostrarBib && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 bg-gray-50 border border-gray-200 rounded-lg p-3">
              <div className="md:col-span-2 text-xs font-bold uppercase text-gray-500">📚 Biblioteca — modelos padrão (clique em Add pra incluir no cargo)</div>
              {biblioteca.map(b => (
                <div key={b.idx} className="p-2 bg-white border border-gray-200 rounded text-[13px] flex items-start justify-between gap-2">
                  <div>
                    <div className="font-bold text-gray-800">{b.titulo}</div>
                    <div className="text-gray-500 line-clamp-2">{b.conteudo}</div>
                  </div>
                  <button type="button" onClick={() => addBiblioteca(b.idx)}
                    className="text-indigo-600 hover:bg-indigo-50 border border-indigo-200 rounded px-2 py-1 font-bold whitespace-nowrap">➕ Add</button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Modal nova/editar cláusula */}
      {editando && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg">
            <div className="p-4 border-b">
              <h3 className="text-lg font-bold text-indigo-900">{editando.id ? '✏️ Editar cláusula' : '➕ Nova cláusula'}</h3>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="text-xs font-bold uppercase text-gray-600">Título (opcional)</label>
                <input type="text" value={editando.titulo || ''}
                  onChange={e => setEditando({ ...editando, titulo: e.target.value })}
                  placeholder="Ex: Horas extraordinárias"
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs font-bold uppercase text-gray-600">Conteúdo *</label>
                <textarea value={editando.conteudo || ''}
                  onChange={e => setEditando({ ...editando, conteudo: e.target.value })}
                  rows={6}
                  placeholder="Texto da cláusula. Pode usar variáveis: $DATA_INICIO$, $SALARIO$, $CARGO$..."
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
                <p className="text-[10px] text-gray-500 mt-1">Aceita variáveis ($DATA_INICIO$, $EXP_FIM_1$, $EXP_FIM_2$, $SALARIO$, $NOME$...).</p>
              </div>
            </div>
            <div className="p-4 border-t flex justify-end gap-2">
              <button type="button" onClick={() => setEditando(null)} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded text-sm font-semibold">Cancelar</button>
              <button type="button" onClick={salvarClausula} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-sm font-bold shadow">{editando.id ? '💾 Salvar' : '➕ Criar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
