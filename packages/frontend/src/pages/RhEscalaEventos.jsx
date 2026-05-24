import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import Sidebar from '../components/Sidebar';
import { api } from '../utils/api';
import toast from 'react-hot-toast';

const ABAS = [
  { key: 'ferias', label: '🏖️ Férias', endpoint: '/rh/escala/ferias', hasMotivo: false },
  { key: 'licencas', label: '🏥 Licenças/Atestados', endpoint: '/rh/escala/licencas', hasMotivo: true },
  { key: 'excessoes', label: '🔄 Excessões', endpoint: '/rh/escala/excessoes', isExcessao: true },
];

export default function RhEscalaEventos() {
  const { user, logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [aba, setAba] = useState('ferias');
  const [colaboradores, setColaboradores] = useState([]);
  const [turnos, setTurnos] = useState([]);
  const [registros, setRegistros] = useState([]);
  const [modal, setModal] = useState(null);

  const abaAtual = ABAS.find(a => a.key === aba);

  useEffect(() => {
    (async () => {
      const [c, t] = await Promise.all([
        api.get('/rh/colaboradores?status=ativo&limit=500'),
        api.get('/rh/escala/turnos'),
      ]);
      const list = c.data?.data || c.data || [];
      setColaboradores(Array.isArray(list) ? list : []);
      setTurnos(Array.isArray(t.data) ? t.data : []);
    })();
  }, []);

  const carregar = async () => {
    try {
      const r = await api.get(abaAtual.endpoint);
      setRegistros(Array.isArray(r.data) ? r.data : []);
    } catch { toast.error('Erro ao carregar'); }
  };
  useEffect(() => { carregar(); /* eslint-disable-next-line */ }, [aba]);

  const colabNome = (id) => colaboradores.find(c => c.id === id)?.nome || `#${id}`;

  const abrirNovo = () => {
    if (abaAtual.isExcessao) {
      setModal({ colaboradorId: '', data: '', turnoId: '', motivo: '' });
    } else {
      setModal({ colaboradorId: '', dataInicio: '', dataFim: '', motivo: '', observacao: '' });
    }
  };

  const salvar = async () => {
    if (!modal.colaboradorId) { toast.error('Selecione o colaborador'); return; }
    try {
      await api.post(abaAtual.endpoint, modal);
      toast.success('Salvo');
      setModal(null);
      await carregar();
    } catch { toast.error('Erro ao salvar'); }
  };

  const excluir = async (id) => {
    if (!window.confirm('Excluir?')) return;
    try {
      await api.delete(`${abaAtual.endpoint}/${id}`);
      toast.success('Excluído');
      await carregar();
    } catch { toast.error('Erro'); }
  };

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar user={user} onLogout={logout} isMobileMenuOpen={isMobileMenuOpen} setIsMobileMenuOpen={setIsMobileMenuOpen} />
      <div className="flex-1 overflow-y-auto">
        <div className="bg-gradient-to-r from-purple-600 to-purple-500 text-white px-6 py-4">
          <h1 className="text-2xl font-bold">Eventos da Escala</h1>
          <p className="text-orange-100 text-sm">Férias, licenças/atestados e excessões — sobrepõem a escala automaticamente</p>
        </div>

        <div className="bg-white border-b px-4">
          <div className="flex gap-1">
            {ABAS.map(a => (
              <button key={a.key} onClick={() => setAba(a.key)}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${aba === a.key ? 'border-orange-500 text-orange-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                {a.label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-6">
          <div className="bg-white rounded-lg shadow">
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <h2 className="font-semibold text-gray-700">{abaAtual.label}</h2>
              <button onClick={abrirNovo} className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm font-semibold">+ Novo</button>
            </div>
            {registros.length === 0 ? (
              <div className="text-center py-10 text-gray-400">Nenhum registro</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-600 text-white">
                  <tr>
                    <th className="text-left px-4 py-2">Colaborador</th>
                    {abaAtual.isExcessao ? (
                      <>
                        <th className="text-left px-4 py-2">Data</th>
                        <th className="text-left px-4 py-2">Turno</th>
                      </>
                    ) : (
                      <>
                        <th className="text-left px-4 py-2">Início</th>
                        <th className="text-left px-4 py-2">Fim</th>
                      </>
                    )}
                    <th className="text-left px-4 py-2">{abaAtual.isExcessao ? 'Motivo' : (abaAtual.hasMotivo ? 'Motivo' : 'Observação')}</th>
                    <th className="text-right px-4 py-2">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {registros.map(r => (
                    <tr key={r.id}>
                      <td className="px-4 py-2">{colabNome(r.colaboradorId || r.colaborador_id)}</td>
                      {abaAtual.isExcessao ? (
                        <>
                          <td className="px-4 py-2">{r.data}</td>
                          <td className="px-4 py-2">{turnos.find(t => t.id === r.turnoId || t.id === r.turno_id)?.codigo || '—'}</td>
                        </>
                      ) : (
                        <>
                          <td className="px-4 py-2">{r.dataInicio || r.data_inicio}</td>
                          <td className="px-4 py-2">{r.dataFim || r.data_fim}</td>
                        </>
                      )}
                      <td className="px-4 py-2 text-gray-600">{r.motivo || r.observacao || '—'}</td>
                      <td className="px-4 py-2 text-right">
                        <button onClick={() => excluir(r.id)} className="text-red-600 hover:text-red-800 text-sm font-medium">Excluir</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {modal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setModal(null)}>
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b"><h3 className="font-bold">Novo {abaAtual.label}</h3></div>
            <div className="p-4 space-y-3">
              <div>
                <label className="text-xs uppercase text-gray-500 font-semibold">Colaborador *</label>
                <select value={modal.colaboradorId} onChange={e => setModal({ ...modal, colaboradorId: e.target.value })}
                  className="w-full border rounded px-3 py-2 text-sm">
                  <option value="">Selecione…</option>
                  {colaboradores.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </div>
              {abaAtual.isExcessao ? (
                <>
                  <div>
                    <label className="text-xs uppercase text-gray-500 font-semibold">Data *</label>
                    <input type="date" value={modal.data} onChange={e => setModal({ ...modal, data: e.target.value })} className="w-full border rounded px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs uppercase text-gray-500 font-semibold">Turno substituto</label>
                    <select value={modal.turnoId} onChange={e => setModal({ ...modal, turnoId: e.target.value })} className="w-full border rounded px-3 py-2 text-sm">
                      <option value="">Selecione…</option>
                      {turnos.map(t => <option key={t.id} value={t.id}>{t.codigo} — {t.nome}</option>)}
                    </select>
                  </div>
                </>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs uppercase text-gray-500 font-semibold">Início *</label>
                    <input type="date" value={modal.dataInicio} onChange={e => setModal({ ...modal, dataInicio: e.target.value })} className="w-full border rounded px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs uppercase text-gray-500 font-semibold">Fim *</label>
                    <input type="date" value={modal.dataFim} onChange={e => setModal({ ...modal, dataFim: e.target.value })} className="w-full border rounded px-3 py-2 text-sm" />
                  </div>
                </div>
              )}
              <div>
                <label className="text-xs uppercase text-gray-500 font-semibold">{abaAtual.hasMotivo || abaAtual.isExcessao ? 'Motivo' : 'Observação'}</label>
                <textarea rows={2} value={modal.motivo || modal.observacao || ''}
                  onChange={e => setModal(m => ({ ...m, [abaAtual.hasMotivo || abaAtual.isExcessao ? 'motivo' : 'observacao']: e.target.value }))}
                  className="w-full border rounded px-3 py-2 text-sm" />
              </div>
            </div>
            <div className="p-4 border-t flex justify-end gap-2">
              <button onClick={() => setModal(null)} className="px-4 py-2 bg-gray-100 rounded text-sm">Cancelar</button>
              <button onClick={salvar} className="px-4 py-2 bg-orange-500 text-white rounded text-sm font-semibold">Salvar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
