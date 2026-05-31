import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import Sidebar from '../components/Sidebar';
import { api } from '../utils/api';
import toast from 'react-hot-toast';

/**
 * Biblioteca de materiais de treinamento.
 * Lista tema + arquivo + botão Baixar. RH guarda slides, PDFs, vídeos pra
 * reusar em treinamentos futuros.
 */
export default function RhTreinamentosBiblioteca() {
  const { user, logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [materiais, setMateriais] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');

  // Modal upload
  const [modalAberto, setModalAberto] = useState(false);
  const [form, setForm] = useState({ nome: '', tema: '', descricao: '', tags: '' });
  const [arquivo, setArquivo] = useState(null);
  const [salvando, setSalvando] = useState(false);

  const carregar = async () => {
    try {
      setLoading(true);
      const r = await api.get('/rh/treinamentos-materiais');
      setMateriais(Array.isArray(r.data) ? r.data : []);
    } catch (e) { console.error(e); toast.error('Erro ao carregar materiais'); }
    finally { setLoading(false); }
  };
  useEffect(() => { carregar(); }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    // UPPERCASE em todos os campos textuais (padrao Kontrata.ai)
    setForm(prev => ({ ...prev, [name]: name === 'descricao' ? value : value.toUpperCase() }));
  };

  const salvar = async () => {
    if (!form.nome.trim()) { toast.error('Nome do material obrigatório'); return; }
    if (!arquivo) { toast.error('Selecione um arquivo'); return; }
    setSalvando(true);
    try {
      const fd = new FormData();
      fd.append('arquivo', arquivo);
      fd.append('nome', form.nome.trim());
      fd.append('tema', form.tema.trim());
      fd.append('descricao', form.descricao || '');
      fd.append('tags', form.tags || '');
      await api.post('/rh/treinamentos-materiais', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success('Material adicionado');
      setForm({ nome: '', tema: '', descricao: '', tags: '' });
      setArquivo(null);
      setModalAberto(false);
      carregar();
    } catch (e) {
      console.error(e);
      toast.error(e.response?.data?.error || 'Erro ao enviar arquivo');
    } finally { setSalvando(false); }
  };

  const excluir = async (m) => {
    if (!window.confirm(`Excluir material "${m.nome}"?`)) return;
    try {
      await api.delete(`/rh/treinamentos-materiais/${m.id}`);
      toast.success('Excluído');
      carregar();
    } catch (e) { toast.error('Erro ao excluir'); }
  };

  const baixar = (m) => {
    if (!m.arquivo_url) { toast.error('Arquivo sem URL'); return; }
    window.open(m.arquivo_url, '_blank', 'noopener,noreferrer');
  };

  const fmtTamanho = (bytes) => {
    if (!bytes) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  const iconePorTipo = (mime) => {
    if (!mime) return '📄';
    if (mime.includes('pdf')) return '📕';
    if (mime.includes('powerpoint') || mime.includes('presentation')) return '📊';
    if (mime.includes('word') || mime.includes('document')) return '📝';
    if (mime.includes('excel') || mime.includes('spreadsheet')) return '📈';
    if (mime.includes('video')) return '🎥';
    if (mime.includes('image')) return '🖼️';
    if (mime.includes('zip') || mime.includes('compressed')) return '🗜️';
    return '📄';
  };

  const filtrados = materiais.filter(m => {
    const q = busca.trim().toLowerCase();
    if (!q) return true;
    return (m.nome || '').toLowerCase().includes(q)
        || (m.tema || '').toLowerCase().includes(q)
        || (m.tags || '').toLowerCase().includes(q);
  });

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar user={user} onLogout={logout} isMobileMenuOpen={isMobileMenuOpen} setIsMobileMenuOpen={setIsMobileMenuOpen} />
      <div className="flex-1 overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-purple-500 text-white px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">📚 Biblioteca de Treinamentos</h1>
              <p className="text-orange-100 text-sm mt-1">Slides, PDFs, vídeos e materiais pra reusar em treinamentos futuros</p>
            </div>
            <button onClick={() => setModalAberto(true)}
              className="bg-white text-orange-600 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-orange-50 transition">
              + Novo Material
            </button>
          </div>
        </div>

        <div className="p-6">
          {/* Busca */}
          <div className="mb-4">
            <input type="text" value={busca} onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por tema, nome ou tags..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm" />
          </div>

          {/* Lista */}
          {loading ? (
            <div className="text-center py-12 text-gray-400">Carregando...</div>
          ) : filtrados.length === 0 ? (
            <div className="bg-white rounded-lg border-2 border-dashed border-gray-300 p-12 text-center">
              <div className="text-5xl mb-3">📁</div>
              <h2 className="text-xl font-bold text-gray-800 mb-1">{materiais.length === 0 ? 'Biblioteca vazia' : 'Nenhum resultado'}</h2>
              <p className="text-gray-600 text-sm">
                {materiais.length === 0
                  ? 'Clique em "+ Novo Material" pra subir o primeiro slide/PDF do treinamento.'
                  : 'Tente outra busca.'}
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase w-12"></th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tema</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nome do Material</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tags</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tamanho</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Ações</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filtrados.map(m => (
                    <tr key={m.id} className="hover:bg-orange-50/40">
                      <td className="px-4 py-3 text-2xl">{iconePorTipo(m.mime_type)}</td>
                      <td className="px-4 py-3 text-sm font-bold text-gray-900">{m.tema || '—'}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        <div>{m.nome}</div>
                        {m.descricao && <div className="text-xs text-gray-400 italic mt-0.5">{m.descricao}</div>}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {m.tags ? m.tags.split(',').map((t, i) => (
                          <span key={i} className="inline-block bg-gray-100 text-gray-700 text-[10px] px-1.5 py-0.5 rounded mr-1 mb-1">{t.trim()}</span>
                        )) : '—'}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">{fmtTamanho(m.tamanho_bytes)}</td>
                      <td className="px-4 py-3 text-right text-sm">
                        <button onClick={() => baixar(m)}
                          className="bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-1.5 rounded text-xs font-bold mr-2">
                          ⬇️ Baixar
                        </button>
                        <button onClick={() => excluir(m)}
                          className="text-red-600 hover:text-red-800 text-xs font-medium">
                          Excluir
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal Upload */}
        {modalAberto && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
              <div className="px-6 py-4 border-b flex items-center justify-between">
                <h3 className="text-lg font-bold">Novo Material de Treinamento</h3>
                <button onClick={() => setModalAberto(false)} className="text-gray-400 hover:text-gray-600">✕</button>
              </div>
              <div className="p-6 space-y-3">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Tema *</label>
                  <input type="text" name="tema" value={form.tema} onChange={handleChange}
                    placeholder="EX: NR-1, NR-6, ATENDIMENTO AO CLIENTE..."
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm uppercase" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Nome do Material *</label>
                  <input type="text" name="nome" value={form.nome} onChange={handleChange}
                    placeholder="EX: SLIDES NR-1 2026, APOSTILA ATENDIMENTO..."
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm uppercase" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Descrição</label>
                  <textarea name="descricao" value={form.descricao} onChange={handleChange} rows={2}
                    placeholder="Observação opcional sobre o material..."
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Tags (separadas por vírgula)</label>
                  <input type="text" name="tags" value={form.tags} onChange={handleChange}
                    placeholder="EX: NR, SEGURANÇA, OBRIGATÓRIO"
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm uppercase" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Arquivo *</label>
                  <input type="file" onChange={(e) => setArquivo(e.target.files[0] || null)}
                    className="w-full text-sm" />
                  {arquivo && (
                    <p className="text-xs text-gray-600 mt-1">
                      {arquivo.name} ({fmtTamanho(arquivo.size)})
                    </p>
                  )}
                  <p className="text-[10px] text-gray-500 mt-1">PDF, PPT, Word, Excel, vídeo, imagem... (até 30MB)</p>
                </div>
              </div>
              <div className="px-6 py-4 border-t flex justify-end gap-2">
                <button onClick={() => setModalAberto(false)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded text-sm font-semibold">
                  Cancelar
                </button>
                <button onClick={salvar} disabled={salvando}
                  className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded text-sm font-bold shadow disabled:opacity-50">
                  {salvando ? 'Enviando...' : '⬆️ Enviar'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
