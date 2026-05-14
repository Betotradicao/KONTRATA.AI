import { useState, useEffect } from 'react';
import api from '../../services/api';

const ACOES_LABEL = {
  GET: '👁️ Visualizou',
  POST: '➕ Criou',
  PUT: '✏️ Atualizou',
  PATCH: '✏️ Atualizou',
  DELETE: '🗑️ Excluiu',
};

export default function LogsAcessoTab() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filtros, setFiltros] = useState({
    dataInicio: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    dataFim: new Date().toISOString().slice(0, 10),
    user: '',
    metodo: '',
  });
  const [paginacao, setPaginacao] = useState({ page: 1, limit: 50, total: 0 });

  const carregar = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: paginacao.page,
        limit: paginacao.limit,
        data_inicio: filtros.dataInicio,
        data_fim: filtros.dataFim,
      });
      if (filtros.user) params.append('user', filtros.user);
      if (filtros.metodo) params.append('metodo', filtros.metodo);

      const { data } = await api.get(`/access-logs?${params}`);
      setLogs(data.data || []);
      setPaginacao(p => ({ ...p, total: data.total || 0 }));
    } catch (err) {
      console.error('Erro ao carregar logs:', err);
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { carregar(); }, [paginacao.page]);

  const exportar = async () => {
    const params = new URLSearchParams({
      data_inicio: filtros.dataInicio,
      data_fim: filtros.dataFim,
    });
    if (filtros.user) params.append('user', filtros.user);
    if (filtros.metodo) params.append('metodo', filtros.metodo);
    window.open(`/api/access-logs/export?${params}`, '_blank');
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-3">📋 Logs de Acesso (LGPD)</h3>
        <p className="text-sm text-gray-600 mb-4">
          Registro de todas as ações realizadas no sistema. Conforme Marco Civil da Internet (Lei 12.965/2014, art. 15).
        </p>

        {/* Filtros */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Data Início</label>
            <input
              type="date"
              value={filtros.dataInicio}
              onChange={(e) => setFiltros(f => ({ ...f, dataInicio: e.target.value }))}
              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Data Fim</label>
            <input
              type="date"
              value={filtros.dataFim}
              onChange={(e) => setFiltros(f => ({ ...f, dataFim: e.target.value }))}
              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Usuário</label>
            <input
              type="text"
              value={filtros.user}
              onChange={(e) => setFiltros(f => ({ ...f, user: e.target.value }))}
              placeholder="Nome ou username"
              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Ação</label>
            <select
              value={filtros.metodo}
              onChange={(e) => setFiltros(f => ({ ...f, metodo: e.target.value }))}
              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
            >
              <option value="">Todas</option>
              <option value="GET">Visualizações</option>
              <option value="POST">Criações</option>
              <option value="PUT,PATCH">Atualizações</option>
              <option value="DELETE">Exclusões</option>
            </select>
          </div>
          <div className="flex items-end gap-2">
            <button
              onClick={() => { setPaginacao(p => ({ ...p, page: 1 })); carregar(); }}
              className="px-3 py-1.5 bg-purple-700 text-white text-sm rounded hover:bg-purple-800"
            >
              🔍 Filtrar
            </button>
            <button
              onClick={exportar}
              className="px-3 py-1.5 bg-green-600 text-white text-sm rounded hover:bg-green-700"
              title="Exportar CSV"
            >
              📥 CSV
            </button>
          </div>
        </div>

        {/* Tabela */}
        {loading ? (
          <div className="text-center py-8 text-gray-500">Carregando...</div>
        ) : logs.length === 0 ? (
          <div className="text-center py-8 text-gray-500">Nenhum log encontrado no período</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left p-2">Data/Hora</th>
                  <th className="text-left p-2">Usuário</th>
                  <th className="text-left p-2">Ação</th>
                  <th className="text-left p-2">Recurso</th>
                  <th className="text-left p-2">IP</th>
                  <th className="text-left p-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log, idx) => (
                  <tr key={log.id || idx} className="border-b hover:bg-gray-50">
                    <td className="p-2 whitespace-nowrap">{new Date(log.created_at).toLocaleString('pt-BR')}</td>
                    <td className="p-2">
                      {log.user_name || log.user_id ? (
                        log.user_name || log.user_id
                      ) : (
                        <span className="text-gray-400 italic text-xs">(Anônimo)</span>
                      )}
                    </td>
                    <td className="p-2">{ACOES_LABEL[log.method] || log.method}</td>
                    <td className="p-2 font-mono text-xs">{log.path}</td>
                    <td className="p-2 font-mono text-xs">{log.ip}</td>
                    <td className="p-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold ${log.status_code < 400 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {log.status_code}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Paginação */}
        {paginacao.total > paginacao.limit && (
          <div className="flex items-center justify-between mt-4 text-sm">
            <span className="text-gray-600">
              Total: <strong>{paginacao.total}</strong> registros
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPaginacao(p => ({ ...p, page: Math.max(1, p.page - 1) }))}
                disabled={paginacao.page === 1}
                className="px-3 py-1 border rounded disabled:opacity-50"
              >
                ← Anterior
              </button>
              <span className="px-3 py-1">Página {paginacao.page}</span>
              <button
                onClick={() => setPaginacao(p => ({ ...p, page: p.page + 1 }))}
                disabled={paginacao.page * paginacao.limit >= paginacao.total}
                className="px-3 py-1 border rounded disabled:opacity-50"
              >
                Próxima →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
