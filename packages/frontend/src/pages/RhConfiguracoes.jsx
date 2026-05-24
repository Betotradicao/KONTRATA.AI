import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Sidebar from '../components/Sidebar';
import { api } from '../utils/api';
import toast from 'react-hot-toast';
import RadarLoading from '../components/RadarLoading';
import EmployeesTab from '../components/configuracoes/EmployeesTab';

const TABS = [
  { key: 'liberacao_acesso', label: '🔑 Liberação de Acesso', custom: true },
  { key: 'empresas', label: 'Empresas', custom: true },
  { key: 'turnos', label: 'Turnos', custom: true },
  { key: 'cargos', label: 'Cargos', custom: true },
  { key: 'jornadas', label: 'Jornadas', endpoint: '/rh/configuracoes/jornadas', fields: ['nome', 'carga_horaria', 'descricao'] },
  { key: 'escolaridades', label: 'Escolaridades', endpoint: '/rh/configuracoes/escolaridades', fields: ['nome'] },
  { key: 'escalas', label: 'Escalas', endpoint: '/rh/configuracoes/escalas', fields: ['nome', 'descricao'] },
  { key: 'escalas_domingo', label: 'Escala Domingo', endpoint: '/rh/configuracoes/escalas-domingo', fields: ['nome', 'descricao'] },
  { key: 'regimes', label: 'Regimes', endpoint: '/rh/configuracoes/regimes-trabalho', fields: ['nome', 'descricao'] },
  { key: 'formas_pagamento', label: 'Formas Pgto', endpoint: '/rh/configuracoes/formas-pagamento', fields: ['nome', 'descricao'] },
  { key: 'prazos', label: 'Prazos Exp.', endpoint: '/rh/configuracoes/prazos-experiencia', fields: ['nome', 'dias', 'descricao'] },
  { key: 'tipos_desligamento', label: 'Tipos Deslig.', endpoint: '/rh/configuracoes/tipos-desligamento', fields: ['nome', 'descricao'] },
  { key: 'motivos_desligamento', label: 'Motivos Deslig.', endpoint: '/rh/configuracoes/motivos-desligamento', fields: ['nome', 'descricao'] },
  { key: 'departamentos', label: 'Setores', endpoint: '/rh/configuracoes/departamentos', fields: ['nome', 'descricao'] },
  { key: 'tipos_ausencia', label: 'Tipos Ausencia', endpoint: '/rh/configuracoes/tipos-ausencia', fields: ['nome', 'cor'] },
  { key: 'tipos_treinamento', label: 'Tipos Trein.', endpoint: '/rh/configuracoes/tipos-treinamento', fields: ['nome', 'categoria'] },
  { key: 'status_treinamento', label: 'Status Trein.', endpoint: '/rh/configuracoes/status-treinamento', fields: ['nome', 'cor'] },
  { key: 'beneficios', label: 'Benefícios', endpoint: '/rh/configuracoes/beneficios', fields: ['nome', 'descricao', 'valor'] },
  { key: 'feriados', label: 'Feriados', custom: true },
  { key: 'epis_epcs', label: 'EPIs e EPCs', custom: true },
  { key: 'mensagens', label: '💬 Mensagens', custom: true },
];

const FIELD_LABELS = {
  nome: 'Nome',
  descricao: 'Descricao',
  cnpj: 'CNPJ',
  endereco: 'Endereco',
  carga_horaria: 'Carga Horaria',
  dias: 'Dias',
  cor: 'Cor',
  categoria: 'Categoria',
  codLoja: 'Loja',
  cod_loja: 'Loja',
  apelido: 'Apelido',
  nomeFantasia: 'Nome Fantasia',
  cidade: 'Cidade',
  valor: 'Valor (R$)',
  date: 'Data',
  name: 'Feriado',
  type: 'Tipo',
};

export default function RhConfiguracoes() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [searchParams] = useSearchParams();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState(() => {
    const t = searchParams.get('tab');
    if (t && TABS.some(tab => tab.key === t)) return t;
    return 'empresas';
  });
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [formData, setFormData] = useState({});
  const [saving, setSaving] = useState(false);

  const currentTab = TABS.find(t => t.key === activeTab);

  useEffect(() => {
    if (currentTab?.custom) { setLoading(false); setRecords([]); return; }
    fetchRecords();
    // eslint-disable-next-line
  }, [activeTab]);

  const fetchRecords = async () => {
    try {
      setLoading(true);
      if (!currentTab?.endpoint) { setRecords([]); return; }
      const response = await api.get(currentTab.endpoint);
      let data = Array.isArray(response.data) ? response.data : [];
      // Tab Empresas: ordena por codLoja ASC (matriz com codLoja null vai por ultimo)
      if (activeTab === 'empresas') {
        data = data.slice().sort((a, b) => {
          const ca = a.codLoja ?? 999999;
          const cb = b.codLoja ?? 999999;
          return ca - cb;
        });
      }
      // Tab Setores: ordena por cod_loja ASC e depois nome
      if (activeTab === 'departamentos') {
        data = data.slice().sort((a, b) => {
          const ca = a.cod_loja ?? 999999;
          const cb = b.cod_loja ?? 999999;
          if (ca !== cb) return ca - cb;
          return String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR');
        });
      }
      // Tab Feriados: ordena por data ASC
      if (activeTab === 'feriados') {
        data = data.slice().sort((a, b) => {
          const da = a.date ? new Date(a.date).getTime() : 0;
          const db = b.date ? new Date(b.date).getTime() : 0;
          return da - db;
        });
      }
      setRecords(data);
    } catch (err) {
      console.error('Erro ao carregar registros:', err);
      toast.error('Erro ao carregar registros');
    } finally {
      setLoading(false);
    }
  };

  const openAddModal = () => {
    setEditingRecord(null);
    const empty = {};
    currentTab.fields.forEach(f => { empty[f] = ''; });
    setFormData(empty);
    setShowModal(true);
  };

  const openEditModal = (record) => {
    setEditingRecord(record);
    const data = {};
    currentTab.fields.forEach(f => { data[f] = record[f] || ''; });
    setFormData(data);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formData.nome || !formData.nome.trim()) {
      toast.error('O campo Nome e obrigatorio');
      return;
    }
    try {
      setSaving(true);
      if (editingRecord) {
        await api.put(`${currentTab.endpoint}/${editingRecord.id}`, formData);
        toast.success('Registro atualizado com sucesso');
      } else {
        await api.post(currentTab.endpoint, formData);
        toast.success('Registro criado com sucesso');
      }
      setShowModal(false);
      fetchRecords();
    } catch (err) {
      console.error('Erro ao salvar:', err);
      if (err.response?.status === 409) {
        toast.error('Registro duplicado');
      } else {
        toast.error('Erro ao salvar registro');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (record) => {
    if (!window.confirm(`Deseja desativar "${record.nome}"?`)) return;
    try {
      await api.delete(`${currentTab.endpoint}/${record.id}`);
      toast.success('Registro desativado com sucesso');
      fetchRecords();
    } catch (err) {
      console.error('Erro ao deletar:', err);
      toast.error('Erro ao desativar registro');
    }
  };

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar
        user={user}
        onLogout={logout}
        isMobileMenuOpen={isMobileMenuOpen}
        setIsMobileMenuOpen={setIsMobileMenuOpen}
      />

      <div className="flex-1 overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-purple-500 text-white px-6 py-4">
          <h1 className="text-2xl font-bold">Configuracoes RH</h1>
          <p className="text-orange-100 text-sm">Gerencie tabelas auxiliares do RH</p>
        </div>

        {/* Tabs */}
        <div className="bg-white border-b shadow-sm">
          <div className="flex overflow-x-auto px-4">
            {TABS.filter(tab => {
              // Liberacao de Acesso so para ADMIN ou Master
              if (tab.key === 'liberacao_acesso') {
                const isMaster = user?.isMaster;
                const isAdmin = user?.role_kontrata === 'admin' || user?.role === 'admin';
                return isMaster || isAdmin;
              }
              return true;
            }).map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  activeTab === tab.key
                    ? 'border-orange-500 text-orange-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {currentTab?.custom && activeTab === 'liberacao_acesso' ? (
            <EmployeesTab />
          ) : currentTab?.custom && activeTab === 'mensagens' ? (
            <MensagensTab />
          ) : currentTab?.custom && activeTab === 'feriados' ? (
            <FeriadosTab />
          ) : currentTab?.custom && activeTab === 'empresas' ? (
            <EmpresasTab />
          ) : currentTab?.custom && activeTab === 'turnos' ? (
            <TurnosTab />
          ) : currentTab?.custom && activeTab === 'cargos' ? (
            <CargosTab />
          ) : currentTab?.custom && activeTab === 'epis_epcs' ? (
            <EpisEpcsTab />
          ) : (
          <div className="bg-white rounded-lg shadow">
            {/* Toolbar */}
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-semibold text-gray-700">{currentTab.label}</h2>
              {currentTab.readOnly ? (
                <button
                  onClick={() => navigate(currentTab.redirectTo || '/configuracoes')}
                  className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  Gerenciar em Configurações →
                </button>
              ) : (
                <button
                  onClick={openAddModal}
                  className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  + Adicionar
                </button>
              )}
            </div>

            {/* Table */}
            {loading ? (
              <div className="flex justify-center py-20">
                <RadarLoading size="sm" message="" />
              </div>
            ) : records.length === 0 ? (
              <div className="text-center py-20 text-gray-400">
                Nenhum registro encontrado
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-600 text-white">
                      {currentTab.fields.map(f => (
                        <th key={f} className="text-left px-6 py-3 text-sm font-medium">
                          {FIELD_LABELS[f] || f}
                        </th>
                      ))}
                      <th className="text-left px-6 py-3 text-sm font-medium">ID</th>
                      {!currentTab.readOnly && (
                        <th className="text-right px-6 py-3 text-sm font-medium">Acoes</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {records.map(record => (
                      <tr key={record.id} className="hover:bg-gray-50">
                        {currentTab.fields.map(f => (
                          <td key={f} className="px-6 py-3 text-sm text-gray-700">
                            {(f === 'codLoja' || f === 'cod_loja')
                              ? (record[f] != null ? `Loja ${record[f]}` : 'Matriz')
                              : f === 'date' && record[f]
                                ? new Date(record[f]).toLocaleDateString('pt-BR')
                                : f === 'type' && record[f]
                                  ? (record[f] === 'national' ? '🇧🇷 Nacional' : record[f] === 'regional' ? '📍 Regional' : record[f])
                                  : (record[f] ?? '-')}
                          </td>
                        ))}
                        <td className="px-6 py-3 text-xs text-gray-400 font-mono">{record.id}</td>
                        {!currentTab.readOnly && (
                          <td className="px-6 py-3 text-right">
                            <button
                              onClick={() => openEditModal(record)}
                              className="text-orange-600 hover:text-orange-800 text-sm font-medium mr-3"
                            >
                              Editar
                            </button>
                            <button
                              onClick={() => handleDelete(record)}
                              className="text-red-600 hover:text-red-800 text-sm font-medium"
                            >
                              Excluir
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="px-6 py-4 border-b">
              <h3 className="text-lg font-semibold text-gray-700">
                {editingRecord ? 'Editar' : 'Adicionar'} {currentTab.label}
              </h3>
            </div>
            <div className="px-6 py-4 space-y-4">
              {currentTab.fields.map(f => (
                <div key={f}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {FIELD_LABELS[f] || f}
                  </label>
                  {f === 'descricao' || f === 'endereco' ? (
                    <textarea
                      value={formData[f] || ''}
                      onChange={e => setFormData({ ...formData, [f]: e.target.value.toUpperCase() })}
                      rows={3}
                      style={{ textTransform: 'uppercase' }}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    />
                  ) : f === 'carga_horaria' ? (
                    <input
                      type="text"
                      value={formData[f] || ''}
                      onChange={e => {
                        // permite apenas numeros e dois pontos, formato HH:MM
                        const raw = e.target.value.replace(/[^\d:]/g, '');
                        setFormData({ ...formData, [f]: raw });
                      }}
                      placeholder="HH:MM (ex: 06:00, 07:20, 08:48)"
                      maxLength={5}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    />
                  ) : f === 'cor' ? (
                    <input
                      type="text"
                      value={formData[f] || ''}
                      onChange={e => setFormData({ ...formData, [f]: e.target.value })}
                      placeholder="#000000"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    />
                  ) : f === 'dias' || f === 'valor' ? (
                    <input
                      type="number"
                      step={f === 'valor' ? '0.01' : undefined}
                      value={formData[f] || ''}
                      onChange={e => setFormData({ ...formData, [f]: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    />
                  ) : (
                    <input
                      type="text"
                      value={formData[f] || ''}
                      onChange={e => setFormData({ ...formData, [f]: e.target.value.toUpperCase() })}
                      style={{ textTransform: 'uppercase' }}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    />
                  )}
                </div>
              ))}
            </div>
            <div className="px-6 py-4 border-t flex justify-end gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 rounded-lg transition-colors disabled:opacity-50"
              >
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============ Tab customizado: Mensagens (templates de WhatsApp etc) ============
// Mensagem padrao que vem ja preenchida quando ainda nao tem nada salvo
const MSG_ENTREVISTA_PADRAO = `Olá {nome}! Tudo bem?

Sou a {recrutadora} do {supermercado}. Vimos seu currículo e gostaríamos de te chamar pra uma entrevista.

Você tem disponibilidade?`;

function MensagensTab() {
  const [msgEntrevista, setMsgEntrevista] = useState(MSG_ENTREVISTA_PADRAO);
  const [recrutadora, setRecrutadora] = useState('');
  const [supermercado, setSupermercado] = useState('');
  const [ativo, setAtivo] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [sucesso, setSucesso] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const [r1, r2, r3, r4, r5] = await Promise.all([
          api.get('/configurations/rh_msg_whatsapp_entrevista').catch(() => null),
          api.get('/configurations/rh_recrutadora_nome').catch(() => null),
          api.get('/configurations/client_brand_name').catch(() => null),
          api.get('/configurations/rh_msg_whatsapp_ativo').catch(() => null),
          // Fallback pro nome do supermercado: se client_brand_name vazio, pega da 1a empresa cadastrada
          api.get('/rh/empresas').catch(() => ({ data: [] })),
        ]);
        if (r1?.data?.value && r1.data.value.trim() && r1.data.value.trim() !== '') {
          setMsgEntrevista(r1.data.value);
        }
        if (r2?.data?.value) setRecrutadora(r2.data.value);
        if (r3?.data?.value && r3.data.value.trim()) {
          setSupermercado(r3.data.value);
        } else {
          // Fallback: nome da primeira empresa cadastrada
          const lojas = Array.isArray(r5?.data) ? r5.data : (r5?.data?.empresas || []);
          if (lojas.length > 0) setSupermercado(lojas[0].nomeFantasia || lojas[0].apelido || '');
        }
        if (r4?.data?.value === 'false') setAtivo(false);
      } catch {}
    })();
  }, []);

  const salvar = async () => {
    setSalvando(true);
    setSucesso('');
    try {
      await Promise.all([
        api.put('/configurations/rh_msg_whatsapp_entrevista', { value: msgEntrevista || ' ' }),
        api.put('/configurations/rh_recrutadora_nome', { value: recrutadora || ' ' }),
        api.put('/configurations/rh_msg_whatsapp_ativo', { value: ativo ? 'true' : 'false' }),
      ]);
      setSucesso(ativo
        ? '✅ Mensagem salva e ATIVADA! Agora ao clicar no WhatsApp do candidato ela vai pré-preenchida.'
        : '✅ Mensagem salva mas DESATIVADA — ao clicar no WhatsApp vai abrir sem texto.');
      setTimeout(() => setSucesso(''), 4000);
    } catch (e) {
      setSucesso('❌ Erro ao salvar: ' + (e?.response?.data?.error || e.message));
    } finally {
      setSalvando(false);
    }
  };

  // Preview do que sera enviado
  const previewMsg = (msgEntrevista || '')
    .replace(/\{nome\}/gi, 'João Silva')
    .replace(/\{supermercado\}/gi, supermercado || 'Sua Empresa')
    .replace(/\{recrutadora\}/gi, recrutadora || 'Maria');

  return (
    <div className="bg-white rounded-lg shadow p-6 space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-bold text-gray-800 mb-1">💬 Mensagens automáticas</h2>
          <p className="text-sm text-gray-600">
            Quando você clica no WhatsApp do candidato no <strong>Banco de Currículos</strong>, abre o WhatsApp Web/App com essa mensagem já pré-preenchida.
          </p>
        </div>
        <label className="inline-flex items-center gap-2 cursor-pointer select-none px-3 py-2 rounded-lg border-2 border-gray-200 hover:border-gray-300">
          <input
            type="checkbox"
            checked={ativo}
            onChange={e => setAtivo(e.target.checked)}
            className="w-5 h-5 accent-emerald-500"
          />
          <span className={`text-sm font-bold ${ativo ? 'text-emerald-700' : 'text-gray-400'}`}>
            {ativo ? '✓ Ativada' : '✗ Desativada'}
          </span>
        </label>
      </div>
      {!ativo && (
        <div className="bg-amber-50 border border-amber-300 rounded p-3 text-sm text-amber-900">
          ⚠️ Mensagem desativada. Ao clicar no WhatsApp do candidato, vai abrir sem texto pré-preenchido.
        </div>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded p-3 text-sm text-blue-900">
        <strong>📌 Placeholders disponíveis</strong> (use no texto que serão substituídos automaticamente):
        <div className="mt-1 grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
          <div><code className="bg-white px-1.5 py-0.5 rounded border">{'{nome}'}</code> → nome do candidato</div>
          <div><code className="bg-white px-1.5 py-0.5 rounded border">{'{supermercado}'}</code> → nome do seu supermercado</div>
          <div><code className="bg-white px-1.5 py-0.5 rounded border">{'{recrutadora}'}</code> → nome da recrutadora (campo abaixo)</div>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Nome da Recrutadora *</label>
        <input
          type="text"
          value={recrutadora}
          onChange={e => setRecrutadora(e.target.value)}
          placeholder="Ex: Maria Silva"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
        />
        <p className="text-xs text-gray-500 mt-1">Esse nome substitui {'{recrutadora}'} na mensagem.</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Mensagem para entrevista (WhatsApp) *</label>
        <textarea
          value={msgEntrevista}
          onChange={e => setMsgEntrevista(e.target.value)}
          rows={6}
          placeholder={`Olá {nome}! Tudo bem?\n\nSou a {recrutadora} do {supermercado}. Vimos seu currículo e gostaríamos de te chamar pra uma entrevista.\n\nVocê tem disponibilidade?`}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 font-mono text-sm"
        />
      </div>

      {previewMsg && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">👁️ Pré-visualização (com nome de exemplo)</label>
          <div className="bg-green-50 border border-green-300 rounded p-3 text-sm text-gray-800 whitespace-pre-wrap">
            {previewMsg}
          </div>
        </div>
      )}

      {sucesso && (
        <div className={`p-3 rounded text-sm ${sucesso.startsWith('❌') ? 'bg-red-50 border border-red-200 text-red-800' : 'bg-emerald-50 border border-emerald-200 text-emerald-800'}`}>
          {sucesso}
        </div>
      )}

      <div className="flex justify-end">
        <button
          onClick={salvar}
          disabled={salvando}
          className="px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 font-semibold"
        >
          {salvando ? 'Salvando…' : 'Salvar mensagem'}
        </button>
      </div>
    </div>
  );
}

// ============ Tab customizado: Feriados ============
function FeriadosTab() {
  const [lojas, setLojas] = useState([]);
  const [codLoja, setCodLoja] = useState('');
  const [feriados, setFeriados] = useState([]);
  const [loadingFer, setLoadingFer] = useState(false);
  const [modalAberto, setModalAberto] = useState(null); // null | { id, name, date } (dia-mes DD/MM)

  // Carrega lojas (via /rh/empresas/stores/list - tabela local do RH)
  useEffect(() => {
    (async () => {
      try {
        const r = await api.get('/rh/empresas/stores/list');
        const data = Array.isArray(r.data) ? r.data : (r.data?.companies || []);
        setLojas(data);
      } catch { /* ignore */ }
    })();
  }, []);

  const carregar = async () => {
    if (!codLoja) { setFeriados([]); return; }
    setLoadingFer(true);
    try {
      const r = await api.get(`/holidays?cod_loja=${codLoja}`);
      const list = Array.isArray(r.data) ? r.data : [];
      // Ordena por MM-DD
      list.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
      setFeriados(list);
    } catch {
      toast.error('Erro ao carregar feriados');
    } finally { setLoadingFer(false); }
  };
  useEffect(() => { carregar(); /* eslint-disable-next-line */ }, [codLoja]);

  const seedNacionais = async () => {
    if (!codLoja) return;
    try {
      await api.post(`/holidays/seed/${codLoja}`);
      toast.success('Feriados nacionais adicionados');
      await carregar();
    } catch {
      toast.error('Erro ao adicionar nacionais');
    }
  };

  const salvar = async () => {
    if (!modalAberto) return;
    if (!modalAberto.name?.trim() || !modalAberto.date?.match(/^\d{2}\/\d{2}$/)) {
      toast.error('Preencha nome e data no formato DD/MM');
      return;
    }
    const [dd, mm] = modalAberto.date.split('/');
    const dateMMDD = `${mm}-${dd}`;
    try {
      if (modalAberto.id) {
        await api.put(`/holidays/${modalAberto.id}`, { name: modalAberto.name.trim().toUpperCase(), date: dateMMDD });
      } else {
        await api.post('/holidays', { name: modalAberto.name.trim().toUpperCase(), date: dateMMDD, cod_loja: parseInt(codLoja) });
      }
      toast.success('Feriado salvo');
      setModalAberto(null);
      await carregar();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Erro ao salvar');
    }
  };

  const excluir = async (f) => {
    if (f.type === 'national') { toast.error('Não é possível excluir feriados nacionais'); return; }
    if (!window.confirm(`Excluir "${f.name}"?`)) return;
    try {
      await api.delete(`/holidays/${f.id}`);
      toast.success('Excluído');
      await carregar();
    } catch { toast.error('Erro ao excluir'); }
  };

  const formatarDDMM = (mmdd) => {
    if (!mmdd || mmdd.length !== 5) return '-';
    const [mm, dd] = mmdd.split('-');
    return `${dd}/${mm}`;
  };

  const nacionais = feriados.filter(f => f.type === 'national');
  const regionais = feriados.filter(f => f.type === 'regional');

  return (
    <div className="bg-white rounded-lg shadow">
      {/* Toolbar: seletor de loja + acao */}
      <div className="px-6 py-4 border-b">
        <div className="flex items-end gap-3 flex-wrap">
          <div className="flex-1 min-w-[280px]">
            <label className="block text-xs font-semibold uppercase text-gray-600 mb-1">Loja</label>
            <select value={codLoja} onChange={e => setCodLoja(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500">
              <option value="">Selecione a loja para ver e cadastrar feriados</option>
              {lojas.map(l => (
                <option key={l.id} value={l.cod_loja}>
                  {l.apelido ? `Loja ${l.cod_loja} - ${l.apelido}` : (l.label || l.nome_fantasia || `Loja ${l.cod_loja}`)}
                </option>
              ))}
            </select>
          </div>
          {codLoja && (
            <>
              <button onClick={seedNacionais}
                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm font-semibold">
                🇧🇷 Preencher Nacionais
              </button>
              <button onClick={() => setModalAberto({ id: null, name: '', date: '' })}
                className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-semibold">
                + Novo Feriado Regional
              </button>
            </>
          )}
        </div>
        {codLoja && (
          <div className="mt-2 text-xs text-gray-500 flex gap-4">
            <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-semibold">{nacionais.length} nacionais</span>
            <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold">{regionais.length} regionais</span>
          </div>
        )}
      </div>

      {/* Lista */}
      {!codLoja ? (
        <div className="text-center py-20 text-gray-400">
          <div className="text-5xl mb-2">🏪</div>
          <p className="font-semibold">Selecione uma loja pra ver os feriados</p>
        </div>
      ) : loadingFer ? (
        <div className="flex justify-center py-20"><RadarLoading size="sm" message="" /></div>
      ) : feriados.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          Nenhum feriado cadastrado. Clique em <strong>🇧🇷 Preencher Nacionais</strong> pra começar.
        </div>
      ) : (
        <table className="w-full">
          <thead>
            <tr className="bg-gray-600 text-white">
              <th className="text-left px-6 py-3 text-sm font-medium">Data</th>
              <th className="text-left px-6 py-3 text-sm font-medium">Feriado</th>
              <th className="text-left px-6 py-3 text-sm font-medium">Tipo</th>
              <th className="text-right px-6 py-3 text-sm font-medium">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {feriados.map(f => (
              <tr key={f.id} className="hover:bg-gray-50">
                <td className="px-6 py-3 text-sm font-semibold text-gray-800">{formatarDDMM(f.date)}</td>
                <td className="px-6 py-3 text-sm text-gray-700">{f.name}</td>
                <td className="px-6 py-3 text-sm">
                  {f.type === 'national' ? (
                    <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-semibold">🇧🇷 Nacional</span>
                  ) : (
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold">📍 Regional</span>
                  )}
                </td>
                <td className="px-6 py-3 text-right">
                  {f.type === 'regional' ? (
                    <>
                      <button onClick={() => setModalAberto({ id: f.id, name: f.name, date: formatarDDMM(f.date) })}
                        className="text-orange-600 hover:text-orange-800 text-sm font-medium mr-3">Editar</button>
                      <button onClick={() => excluir(f)}
                        className="text-red-600 hover:text-red-800 text-sm font-medium">Excluir</button>
                    </>
                  ) : (
                    <span className="text-xs text-gray-400 italic">Feriado oficial</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Modal de edicao/criacao */}
      {modalAberto && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-800">{modalAberto.id ? 'Editar Feriado' : 'Novo Feriado Regional'}</h3>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="text-xs font-semibold uppercase text-gray-600">Nome do feriado *</label>
                <input type="text" value={modalAberto.name}
                  onChange={e => setModalAberto({ ...modalAberto, name: e.target.value.toUpperCase() })}
                  style={{ textTransform: 'uppercase' }}
                  placeholder="Ex: ANIVERSÁRIO DA CIDADE"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase text-gray-600">Data (DD/MM) *</label>
                <input type="text" value={modalAberto.date}
                  onChange={e => {
                    let v = e.target.value.replace(/[^\d]/g, '');
                    if (v.length > 2) v = v.slice(0, 2) + '/' + v.slice(2, 4);
                    setModalAberto({ ...modalAberto, date: v });
                  }}
                  maxLength={5}
                  placeholder="25/07"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                <p className="text-xs text-gray-500 mt-1">Ex: 25/07 pra 25 de julho. Todo ano se repete.</p>
              </div>
            </div>
            <div className="p-4 border-t border-gray-200 flex justify-end gap-2">
              <button onClick={() => setModalAberto(null)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-semibold">
                Cancelar
              </button>
              <button onClick={salvar}
                className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-semibold">
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============ Tab customizado: Empresas (CRUD inline, independente da tela de Configurações) ============
function EmpresasTab() {
  const [empresas, setEmpresas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState(null); // null | { ...formData }
  const [salvando, setSalvando] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [buscandoCep, setBuscandoCep] = useState(false);

  // Busca endereço pelo CEP via ViaCEP (auto-preenche rua, bairro, cidade, UF)
  const buscarCep = async (cepRaw) => {
    const cep = (cepRaw || '').replace(/\D/g, '');
    if (cep.length !== 8) return;
    setBuscandoCep(true);
    try {
      const r = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const d = await r.json();
      if (d?.erro) return;
      setModal(m => m && ({
        ...m,
        rua: (d.logradouro || m.rua || '').toUpperCase(),
        bairro: (d.bairro || m.bairro || '').toUpperCase(),
        cidade: (d.localidade || m.cidade || '').toUpperCase(),
        estado: (d.uf || m.estado || '').toUpperCase(),
      }));
    } catch {} finally { setBuscandoCep(false); }
  };

  const formatCep = (v) => {
    const d = (v || '').replace(/\D/g, '').slice(0, 8);
    return d.length > 5 ? `${d.slice(0,5)}-${d.slice(5)}` : d;
  };

  const VAZIO = {
    id: null,
    nomeFantasia: '',
    razaoSocial: '',
    cnpj: '',
    codLoja: '',
    apelido: '',
    cep: '',
    rua: '',
    numero: '',
    complemento: '',
    bairro: '',
    cidade: '',
    estado: '',
    telefone: '',
    email: '',
    responsavelNome: '',
    responsavelEmail: '',
    responsavelTelefone: '',
    fotoFachadaUrl: null,
    isPrincipal: false,
  };

  const carregar = async () => {
    setLoading(true);
    try {
      const r = await api.get('/rh/empresas');
      const list = Array.isArray(r.data) ? r.data : [];
      setEmpresas(list);
    } catch {
      toast.error('Erro ao carregar empresas');
    } finally { setLoading(false); }
  };
  useEffect(() => { carregar(); }, []);


  const proximoCodLoja = () => {
    const codigos = empresas.map(e => Number(e.codLoja)).filter(n => !isNaN(n));
    if (!codigos.length) return 1;
    return Math.max(...codigos) + 1;
  };

  const abrirNovo = () => {
    setModal({ ...VAZIO, codLoja: String(proximoCodLoja()) });
  };
  const abrirEdicao = (c) => {
    setModal({
      id: c.id,
      nomeFantasia: c.nomeFantasia || '',
      razaoSocial: c.razaoSocial || '',
      cnpj: c.cnpj || '',
      codLoja: c.codLoja ?? '',
      apelido: c.apelido || '',
      cep: c.cep || '',
      rua: c.rua || '',
      numero: c.numero || '',
      complemento: c.complemento || '',
      bairro: c.bairro || '',
      cidade: c.cidade || '',
      estado: c.estado || '',
      telefone: c.telefone || '',
      email: c.email || '',
      responsavelNome: c.responsavelNome || '',
      responsavelEmail: c.responsavelEmail || '',
      responsavelTelefone: c.responsavelTelefone || '',
      fotoFachadaUrl: c.fotoFachadaUrl || null,
      isPrincipal: !!c.isPrincipal,
    });
  };

  const upload = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('imagem', f);
      const r = await api.post('/checklist/upload-imagem', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      if (r.data?.url) setModal(m => ({ ...m, fotoFachadaUrl: r.data.url }));
    } catch {
      toast.error('Erro ao enviar foto');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const salvar = async () => {
    if (!modal) return;
    setSalvando(true);
    try {
      const payload = { ...modal };
      delete payload.id;
      delete payload.isPrincipal;
      if (payload.codLoja === '') payload.codLoja = null;
      else payload.codLoja = Number(payload.codLoja);
      if (modal.id) {
        await api.put(`/rh/empresas/${modal.id}`, payload);
        toast.success('Empresa atualizada');
      } else {
        await api.post('/rh/empresas', payload);
        toast.success('Empresa criada');
      }
      setModal(null);
      await carregar();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Erro ao salvar');
    } finally { setSalvando(false); }
  };

  const excluir = async (c) => {
    if (c.isPrincipal) { toast.error('Não é possível excluir a matriz'); return; }
    if (!window.confirm(`Excluir "${c.nomeFantasia || c.apelido || 'empresa'}"?`)) return;
    try {
      await api.delete(`/rh/empresas/${c.id}`);
      toast.success('Empresa excluída');
      await carregar();
    } catch {
      toast.error('Erro ao excluir');
    }
  };

  const setCampo = (k, v) => setModal(m => ({ ...m, [k]: v }));
  const setCampoUp = (k, v) => setModal(m => ({ ...m, [k]: (v || '').toUpperCase() }));

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="flex items-center justify-between px-6 py-4 border-b">
        <div>
          <h2 className="text-lg font-semibold text-gray-700">Empresas / Lojas</h2>
          <p className="text-xs text-gray-500">Cadastro exclusivo do RH — independente da tela de Configurações Gerais.</p>
        </div>
        <button onClick={abrirNovo} className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm font-medium">+ Nova Empresa</button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><RadarLoading size="sm" message="" /></div>
      ) : empresas.length === 0 ? (
        <div className="text-center py-20 text-gray-400">Nenhuma empresa cadastrada</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-600 text-white">
                <th className="text-left px-4 py-3 text-sm font-medium">Foto</th>
                <th className="text-left px-4 py-3 text-sm font-medium">Loja</th>
                <th className="text-left px-4 py-3 text-sm font-medium">Apelido</th>
                <th className="text-left px-4 py-3 text-sm font-medium">Nome Fantasia</th>
                <th className="text-left px-4 py-3 text-sm font-medium">CNPJ</th>
                <th className="text-left px-4 py-3 text-sm font-medium">Cidade/UF</th>
                <th className="text-right px-4 py-3 text-sm font-medium">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {empresas.map(c => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2">
                    {c.fotoFachadaUrl ? (
                      <img src={c.fotoFachadaUrl} alt="" className="w-12 h-12 object-cover rounded" />
                    ) : (
                      <div className="w-12 h-12 rounded bg-gray-200 flex items-center justify-center text-gray-400 text-xs">sem foto</div>
                    )}
                  </td>
                  <td className="px-4 py-2 text-sm">
                    {c.isPrincipal ? (
                      <span className="inline-flex items-center gap-1 bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full text-xs font-semibold">★ Matriz</span>
                    ) : (
                      <span className="text-gray-700 font-medium">Loja {c.codLoja ?? '-'}</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-sm text-gray-700">{c.apelido || '-'}</td>
                  <td className="px-4 py-2 text-sm text-gray-700">{c.nomeFantasia || '-'}</td>
                  <td className="px-4 py-2 text-sm text-gray-700">{c.cnpj || '-'}</td>
                  <td className="px-4 py-2 text-sm text-gray-700">{[c.cidade, c.estado].filter(Boolean).join('/') || '-'}</td>
                  <td className="px-4 py-2 text-right">
                    <button onClick={() => abrirEdicao(c)} className="text-orange-600 hover:text-orange-800 text-sm font-medium mr-3">Editar</button>
                    {!c.isPrincipal && (
                      <button onClick={() => excluir(c)} className="text-red-600 hover:text-red-800 text-sm font-medium">Excluir</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-gray-200 sticky top-0 bg-white z-10">
              <h3 className="text-lg font-bold text-gray-800">{modal.id ? (modal.isPrincipal ? 'Editar Matriz' : 'Editar Empresa') : 'Nova Empresa'}</h3>
            </div>

            <div className="p-4 space-y-4">
              {/* Foto da fachada */}
              <div>
                <label className="text-xs font-semibold uppercase text-gray-600 block mb-1">Foto da fachada</label>
                <div className="flex items-center gap-3">
                  {modal.fotoFachadaUrl ? (
                    <img src={modal.fotoFachadaUrl} alt="" className="w-20 h-20 object-cover rounded border" />
                  ) : (
                    <div className="w-20 h-20 rounded border bg-gray-100 flex items-center justify-center text-gray-400 text-xs">sem foto</div>
                  )}
                  <label className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-sm cursor-pointer">
                    {uploading ? 'Enviando...' : (modal.fotoFachadaUrl ? 'Trocar foto' : 'Escolher foto')}
                    <input type="file" accept="image/*" onChange={upload} className="hidden" disabled={uploading} />
                  </label>
                  {modal.fotoFachadaUrl && (
                    <button onClick={() => setCampo('fotoFachadaUrl', null)} className="px-3 py-2 text-red-600 hover:text-red-800 text-sm">Remover</button>
                  )}
                </div>
              </div>

              {/* Identificação */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold uppercase text-gray-600">Cód. Loja</label>
                  <input type="number" value={modal.codLoja} onChange={e => setCampo('codLoja', e.target.value)}
                    disabled={modal.isPrincipal}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm disabled:bg-gray-100" />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase text-gray-600">Apelido</label>
                  <input type="text" value={modal.apelido} onChange={e => setCampoUp('apelido', e.target.value)}
                    style={{ textTransform: 'uppercase' }}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase text-gray-600">CNPJ</label>
                  <input type="text" value={modal.cnpj} onChange={e => setCampo('cnpj', e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold uppercase text-gray-600">Nome Fantasia</label>
                  <input type="text" value={modal.nomeFantasia} onChange={e => setCampoUp('nomeFantasia', e.target.value)}
                    style={{ textTransform: 'uppercase' }}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase text-gray-600">Razão Social</label>
                  <input type="text" value={modal.razaoSocial} onChange={e => setCampoUp('razaoSocial', e.target.value)}
                    style={{ textTransform: 'uppercase' }}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>

              {/* Endereço */}
              <div className="border-t pt-3">
                <div className="text-xs font-bold text-gray-500 uppercase mb-2">Endereço</div>
                <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                  <div className="col-span-2 md:col-span-2">
                    <label className="text-xs font-semibold uppercase text-gray-600">CEP</label>
                    <div className="relative">
                      <input
                        type="text"
                        value={modal.cep}
                        onChange={e => {
                          const v = formatCep(e.target.value);
                          setCampo('cep', v);
                          if (v.replace(/\D/g, '').length === 8) buscarCep(v);
                        }}
                        onBlur={e => buscarCep(e.target.value)}
                        placeholder="00000-000"
                        maxLength={9}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      />
                      {buscandoCep && (
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-orange-500 animate-pulse">⏳</span>
                      )}
                    </div>
                  </div>
                  <div className="col-span-2 md:col-span-3">
                    <label className="text-xs font-semibold uppercase text-gray-600">Rua</label>
                    <input type="text" value={modal.rua} onChange={e => setCampoUp('rua', e.target.value)}
                      style={{ textTransform: 'uppercase' }}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase text-gray-600">Número</label>
                    <input type="text" value={modal.numero} onChange={e => setCampo('numero', e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mt-3">
                  <div className="col-span-2">
                    <label className="text-xs font-semibold uppercase text-gray-600">Complemento</label>
                    <input type="text" value={modal.complemento} onChange={e => setCampoUp('complemento', e.target.value)}
                      style={{ textTransform: 'uppercase' }}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs font-semibold uppercase text-gray-600">Bairro</label>
                    <input type="text" value={modal.bairro} onChange={e => setCampoUp('bairro', e.target.value)}
                      style={{ textTransform: 'uppercase' }}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div className="col-span-1">
                    <label className="text-xs font-semibold uppercase text-gray-600">Cidade</label>
                    <input type="text" value={modal.cidade} onChange={e => setCampoUp('cidade', e.target.value)}
                      style={{ textTransform: 'uppercase' }}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div className="col-span-1">
                    <label className="text-xs font-semibold uppercase text-gray-600">UF</label>
                    <input type="text" value={modal.estado} onChange={e => setCampoUp('estado', e.target.value.slice(0, 2))}
                      maxLength={2} style={{ textTransform: 'uppercase' }}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                  </div>
                </div>
              </div>

              {/* Contato */}
              <div className="border-t pt-3">
                <div className="text-xs font-bold text-gray-500 uppercase mb-2">Contato</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold uppercase text-gray-600">Telefone</label>
                    <input type="text" value={modal.telefone} onChange={e => setCampo('telefone', e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase text-gray-600">E-mail</label>
                    <input type="email" value={modal.email} onChange={e => setCampo('email', e.target.value.toLowerCase())}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                  </div>
                </div>
              </div>

              {/* Responsável */}
              <div className="border-t pt-3">
                <div className="text-xs font-bold text-gray-500 uppercase mb-2">Responsável</div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-semibold uppercase text-gray-600">Nome</label>
                    <input type="text" value={modal.responsavelNome} onChange={e => setCampoUp('responsavelNome', e.target.value)}
                      style={{ textTransform: 'uppercase' }}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase text-gray-600">E-mail</label>
                    <input type="email" value={modal.responsavelEmail} onChange={e => setCampo('responsavelEmail', e.target.value.toLowerCase())}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase text-gray-600">Telefone</label>
                    <input type="text" value={modal.responsavelTelefone} onChange={e => setCampo('responsavelTelefone', e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-gray-200 flex justify-end gap-2 sticky bottom-0 bg-white">
              <button onClick={() => setModal(null)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-semibold">Cancelar</button>
              <button onClick={salvar} disabled={salvando}
                className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-semibold disabled:opacity-50">
                {salvando ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============ Tab customizado: Turnos (catalogo da Escala) ============
function TurnosTab() {
  const [turnos, setTurnos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState(null);
  const [salvando, setSalvando] = useState(false);

  const TIPOS = [
    { value: 'turno', label: '🕐 Turno de trabalho', cor: '#FEF3C7' },
    { value: 'folga', label: '🏖️ Folga', cor: '#D1FAE5' },
    { value: 'ferias', label: '🌴 Férias', cor: '#E9D5FF' },
    { value: 'feriado', label: '🎉 Feriado', cor: '#FECACA' },
    { value: 'licenca', label: '🏥 Licença/Atestado', cor: '#E5E7EB' },
  ];

  const carregar = async () => {
    setLoading(true);
    try {
      const r = await api.get('/rh/escala/turnos');
      setTurnos(Array.isArray(r.data) ? r.data : []);
    } catch { toast.error('Erro ao carregar turnos'); }
    finally { setLoading(false); }
  };
  useEffect(() => { carregar(); }, []);

  // pausa em minutos <-> "HH:MM"
  const minutosParaHHMM = (min) => {
    if (!min || min <= 0) return '00:00';
    const h = Math.floor(min / 60);
    const m = min % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };
  const hhmmParaMinutos = (str) => {
    if (!str) return 0;
    const [h, m] = str.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  };

  const abrirNovo = () => setModal({
    codigo: '', nome: '', horaInicio: '', horaFim: '', totalHoras: '',
    pausaHHMM: '00:00',
    tipo: 'turno', cor: '#FEF3C7',
  });
  const abrirEdicao = (t) => setModal({
    id: t.id, codigo: t.codigo, nome: t.nome,
    horaInicio: t.horaInicio ? t.horaInicio.slice(0,5) : '',
    horaFim: t.horaFim ? t.horaFim.slice(0,5) : '',
    totalHoras: t.totalHoras != null ? String(t.totalHoras) : '',
    pausaHHMM: minutosParaHHMM(t.pausaMinutos || 0),
    tipo: t.tipo || 'turno',
    cor: t.cor || '#FEF3C7',
  });

  // Calcula horas liquidas: (fim - inicio) - pausa, resultado em horas decimais
  const calcularHoras = (ini, fim, pausaHHMM) => {
    if (!ini || !fim) return '';
    const [h1, m1] = ini.split(':').map(Number);
    const [h2, m2] = fim.split(':').map(Number);
    let min = (h2 * 60 + m2) - (h1 * 60 + m1);
    if (min < 0) min += 24 * 60; // atravessa meia-noite
    min -= hhmmParaMinutos(pausaHHMM || '00:00');
    if (min < 0) min = 0;
    return (min / 60).toFixed(2);
  };

  const salvar = async () => {
    if (!modal.codigo?.trim() || !modal.nome?.trim()) { toast.error('Código e nome obrigatórios'); return; }
    setSalvando(true);
    try {
      const payload = {
        codigo: modal.codigo.trim().toUpperCase(),
        nome: modal.nome.trim(),
        horaInicio: modal.horaInicio || null,
        horaFim: modal.horaFim || null,
        totalHoras: modal.totalHoras ? Number(modal.totalHoras) : null,
        pausaMinutos: hhmmParaMinutos(modal.pausaHHMM || '00:00'),
        tipo: modal.tipo,
        cor: modal.cor,
      };
      if (modal.id) await api.put(`/rh/escala/turnos/${modal.id}`, payload);
      else await api.post('/rh/escala/turnos', payload);
      toast.success('Turno salvo');
      setModal(null);
      await carregar();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Erro ao salvar');
    } finally { setSalvando(false); }
  };

  const excluir = async (t) => {
    if (!window.confirm(`Desativar "${t.codigo}"?`)) return;
    try {
      await api.delete(`/rh/escala/turnos/${t.id}`);
      toast.success('Turno desativado');
      await carregar();
    } catch { toast.error('Erro ao excluir'); }
  };

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="flex items-center justify-between px-6 py-4 border-b">
        <div>
          <h2 className="text-lg font-semibold text-gray-700">Turnos da Escala</h2>
          <p className="text-xs text-gray-500">Catálogo de códigos usados na Escala de Trabalho (TM 7:15, TT 13:00, FG, FE, etc)</p>
        </div>
        <button onClick={abrirNovo} className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm font-medium">+ Novo Turno</button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><RadarLoading size="sm" message="" /></div>
      ) : turnos.length === 0 ? (
        <div className="text-center py-20 text-gray-400">Nenhum turno cadastrado</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-600 text-white">
                <th className="text-left px-4 py-3 text-sm font-medium">Preview</th>
                <th className="text-left px-4 py-3 text-sm font-medium">Código</th>
                <th className="text-left px-4 py-3 text-sm font-medium">Nome</th>
                <th className="text-left px-4 py-3 text-sm font-medium">Horário</th>
                <th className="text-left px-4 py-3 text-sm font-medium">Pausa</th>
                <th className="text-left px-4 py-3 text-sm font-medium">Horas líq.</th>
                <th className="text-left px-4 py-3 text-sm font-medium">Tipo</th>
                <th className="text-right px-4 py-3 text-sm font-medium">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {turnos.map(t => (
                <tr key={t.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2">
                    <span className="inline-block px-3 py-1 rounded text-xs font-bold" style={{ backgroundColor: t.cor || '#E5E7EB' }}>
                      {t.codigo}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-sm font-semibold text-gray-800">{t.codigo}</td>
                  <td className="px-4 py-2 text-sm text-gray-700">{t.nome}</td>
                  <td className="px-4 py-2 text-sm text-gray-600">
                    {t.horaInicio && t.horaFim ? `${t.horaInicio.slice(0,5)} – ${t.horaFim.slice(0,5)}` : '—'}
                  </td>
                  <td className="px-4 py-2 text-sm text-gray-600">
                    {t.pausaMinutos > 0 ? minutosParaHHMM(t.pausaMinutos) : '—'}
                  </td>
                  <td className="px-4 py-2 text-sm text-gray-700 font-semibold">{t.totalHoras ? `${t.totalHoras}h` : '—'}</td>
                  <td className="px-4 py-2 text-xs">
                    {TIPOS.find(x => x.value === t.tipo)?.label || t.tipo}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button onClick={() => abrirEdicao(t)} className="text-orange-600 hover:text-orange-800 text-sm font-medium mr-3">Editar</button>
                    <button onClick={() => excluir(t)} className="text-red-600 hover:text-red-800 text-sm font-medium">Excluir</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setModal(null)}>
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b">
              <h3 className="font-bold text-gray-800">{modal.id ? 'Editar' : 'Novo'} Turno</h3>
            </div>
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs uppercase text-gray-500 font-semibold">Código *</label>
                  <input type="text" value={modal.codigo} onChange={e => setModal(m => ({ ...m, codigo: e.target.value.toUpperCase() }))}
                    placeholder="TM 7:15"
                    style={{ textTransform: 'uppercase' }}
                    className="w-full border rounded px-3 py-2 text-sm font-semibold" />
                </div>
                <div className="col-span-2">
                  <label className="text-xs uppercase text-gray-500 font-semibold">Nome *</label>
                  <input type="text" value={modal.nome} onChange={e => setModal(m => ({ ...m, nome: e.target.value }))}
                    placeholder="Turno Manhã 07:15"
                    className="w-full border rounded px-3 py-2 text-sm" />
                </div>
              </div>
              <div>
                <label className="text-xs uppercase text-gray-500 font-semibold">Tipo</label>
                <select value={modal.tipo}
                  onChange={e => {
                    const novoTipo = e.target.value;
                    const corPadrao = TIPOS.find(x => x.value === novoTipo)?.cor || modal.cor;
                    setModal(m => ({ ...m, tipo: novoTipo, cor: corPadrao }));
                  }}
                  className="w-full border rounded px-3 py-2 text-sm">
                  {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              {modal.tipo === 'turno' && (
                <>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="text-xs uppercase text-gray-500 font-semibold">Hora início</label>
                      <input type="time" value={modal.horaInicio}
                        onChange={e => {
                          const ini = e.target.value;
                          const horas = calcularHoras(ini, modal.horaFim, modal.pausaHHMM);
                          setModal(m => ({ ...m, horaInicio: ini, totalHoras: horas }));
                        }}
                        className="w-full border rounded px-3 py-2 text-sm" />
                    </div>
                    <div>
                      <label className="text-xs uppercase text-gray-500 font-semibold">Hora fim</label>
                      <input type="time" value={modal.horaFim}
                        onChange={e => {
                          const fim = e.target.value;
                          const horas = calcularHoras(modal.horaInicio, fim, modal.pausaHHMM);
                          setModal(m => ({ ...m, horaFim: fim, totalHoras: horas }));
                        }}
                        className="w-full border rounded px-3 py-2 text-sm" />
                    </div>
                    <div>
                      <label className="text-xs uppercase text-gray-500 font-semibold">Pausa obrigatória</label>
                      <input type="time" value={modal.pausaHHMM}
                        onChange={e => {
                          const p = e.target.value;
                          const horas = calcularHoras(modal.horaInicio, modal.horaFim, p);
                          setModal(m => ({ ...m, pausaHHMM: p, totalHoras: horas }));
                        }}
                        className="w-full border rounded px-3 py-2 text-sm" />
                      <p className="text-[10px] text-gray-500 mt-1">CLT: &gt;6h = 1:00 · 4-6h = 0:15</p>
                    </div>
                  </div>
                  <div className="bg-amber-50 border border-amber-200 rounded px-3 py-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-700 font-medium">Horas líquidas (descontada a pausa):</span>
                      <span className="font-bold text-orange-700 text-lg">{modal.totalHoras || '0.00'}h</span>
                    </div>
                    <p className="text-[10px] text-gray-500 mt-0.5">
                      Você pode editar manualmente abaixo se precisar:
                    </p>
                    <input type="text" inputMode="decimal" value={modal.totalHoras}
                      onChange={e => setModal(m => ({ ...m, totalHoras: e.target.value }))}
                      placeholder="7.33"
                      className="mt-1 w-full border rounded px-3 py-1.5 text-sm" />
                  </div>
                </>
              )}
              <div>
                <label className="text-xs uppercase text-gray-500 font-semibold">Cor (preview abaixo)</label>
                <div className="flex items-center gap-2">
                  <input type="color" value={modal.cor} onChange={e => setModal(m => ({ ...m, cor: e.target.value }))}
                    className="w-12 h-9 border rounded cursor-pointer" />
                  <input type="text" value={modal.cor} onChange={e => setModal(m => ({ ...m, cor: e.target.value }))}
                    className="flex-1 border rounded px-3 py-2 text-sm font-mono" />
                  <span className="inline-block px-3 py-2 rounded text-xs font-bold" style={{ backgroundColor: modal.cor }}>
                    {modal.codigo || 'Preview'}
                  </span>
                </div>
              </div>
            </div>
            <div className="p-4 border-t flex justify-end gap-2">
              <button onClick={() => setModal(null)}
                className="px-4 py-2 bg-gray-100 rounded text-sm">Cancelar</button>
              <button onClick={salvar} disabled={salvando}
                className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded text-sm font-semibold disabled:opacity-50">
                {salvando ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Tab customizada: EPIs e EPCs (catalogo de equipamentos de protecao)
// ============================================================================
function EpisEpcsTab() {
  const [items, setItems] = useState([]);
  const [filtroTipo, setFiltroTipo] = useState('todos');
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const VAZIO = { id: null, nome: '', tipo: 'epi', descricao: '', ca: '', validade_meses: '' };

  const carregar = async () => {
    setLoading(true);
    try {
      const r = await api.get('/rh/configuracoes/epis-epcs');
      setItems(Array.isArray(r.data) ? r.data : []);
    } catch { toast.error('Erro ao carregar EPIs/EPCs'); }
    finally { setLoading(false); }
  };
  useEffect(() => { carregar(); }, []);

  const salvar = async () => {
    if (!modal.nome?.trim()) { toast.error('Nome obrigatório'); return; }
    setSalvando(true);
    try {
      const payload = {
        nome: modal.nome.trim(), tipo: modal.tipo,
        descricao: modal.descricao || null, ca: modal.ca || null,
        validade_meses: modal.validade_meses ? Number(modal.validade_meses) : null,
      };
      if (modal.id) await api.put(`/rh/configuracoes/epis-epcs/${modal.id}`, payload);
      else await api.post('/rh/configuracoes/epis-epcs', payload);
      toast.success('Salvo'); setModal(null); await carregar();
    } catch (err) { toast.error(err?.response?.data?.error || 'Erro'); }
    finally { setSalvando(false); }
  };

  const excluir = async (item) => {
    if (!window.confirm(`Excluir "${item.nome}"?`)) return;
    try { await api.delete(`/rh/configuracoes/epis-epcs/${item.id}`); toast.success('Excluído'); await carregar(); }
    catch { toast.error('Erro ao excluir'); }
  };

  const lista = filtroTipo === 'todos' ? items : items.filter(i => i.tipo === filtroTipo);

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="flex items-center justify-between px-6 py-4 border-b">
        <div>
          <h2 className="text-lg font-semibold text-gray-700">EPIs e EPCs</h2>
          <p className="text-xs text-gray-500">Catálogo de Equipamentos de Proteção Individual e Coletiva. Use depois nos Cargos pra marcar quais são obrigatórios.</p>
        </div>
        <div className="flex gap-2">
          <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm">
            <option value="todos">Todos ({items.length})</option>
            <option value="epi">EPI ({items.filter(i => i.tipo === 'epi').length})</option>
            <option value="epc">EPC ({items.filter(i => i.tipo === 'epc').length})</option>
          </select>
          <button onClick={() => setModal({ ...VAZIO })}
            className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm font-medium">+ Novo</button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><RadarLoading size="sm" message="" /></div>
      ) : lista.length === 0 ? (
        <div className="text-center py-20 text-gray-400">Nenhum item cadastrado</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-600 text-white">
                <th className="text-left px-4 py-3 text-sm font-medium">Tipo</th>
                <th className="text-left px-4 py-3 text-sm font-medium">Nome</th>
                <th className="text-left px-4 py-3 text-sm font-medium">CA</th>
                <th className="text-left px-4 py-3 text-sm font-medium">Validade</th>
                <th className="text-left px-4 py-3 text-sm font-medium">Descrição</th>
                <th className="text-right px-4 py-3 text-sm font-medium">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {lista.map(item => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${item.tipo === 'epi' ? 'bg-blue-100 text-blue-800 border border-blue-300' : 'bg-purple-100 text-purple-800 border border-purple-300'}`}>
                      {item.tipo === 'epi' ? '🦺 EPI' : '🛡️ EPC'}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-sm font-semibold text-gray-800">{item.nome}</td>
                  <td className="px-4 py-2 text-sm text-gray-600 font-mono">{item.ca || '—'}</td>
                  <td className="px-4 py-2 text-sm text-gray-600">{item.validade_meses ? `${item.validade_meses} meses` : '—'}</td>
                  <td className="px-4 py-2 text-sm text-gray-600 max-w-md truncate">{item.descricao || '—'}</td>
                  <td className="px-4 py-2 text-right">
                    <button onClick={() => setModal({ id: item.id, nome: item.nome, tipo: item.tipo, descricao: item.descricao || '', ca: item.ca || '', validade_meses: item.validade_meses || '' })}
                      className="text-orange-600 hover:text-orange-800 text-sm font-medium mr-3">Editar</button>
                    <button onClick={() => excluir(item)}
                      className="text-red-600 hover:text-red-800 text-sm font-medium">Excluir</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setModal(null)}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b">
              <h3 className="font-bold text-gray-800">{modal.id ? 'Editar' : 'Novo'} EPI/EPC</h3>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="text-xs uppercase text-gray-500 font-semibold">Tipo *</label>
                <div className="flex gap-2 mt-1">
                  <button onClick={() => setModal(m => ({ ...m, tipo: 'epi' }))}
                    className={`flex-1 px-3 py-2 rounded-lg border-2 text-sm font-bold ${modal.tipo === 'epi' ? 'bg-blue-100 border-blue-500 text-blue-800' : 'bg-gray-50 border-gray-200'}`}>🦺 EPI (Individual)</button>
                  <button onClick={() => setModal(m => ({ ...m, tipo: 'epc' }))}
                    className={`flex-1 px-3 py-2 rounded-lg border-2 text-sm font-bold ${modal.tipo === 'epc' ? 'bg-purple-100 border-purple-500 text-purple-800' : 'bg-gray-50 border-gray-200'}`}>🛡️ EPC (Coletivo)</button>
                </div>
              </div>
              <div>
                <label className="text-xs uppercase text-gray-500 font-semibold">Nome *</label>
                <input type="text" value={modal.nome}
                  onChange={e => setModal(m => ({ ...m, nome: e.target.value }))}
                  placeholder="Ex: Luva de açougueiro"
                  className="w-full border rounded px-3 py-2 text-sm" autoFocus />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs uppercase text-gray-500 font-semibold">CA (Certif. Aprov.)</label>
                  <input type="text" value={modal.ca}
                    onChange={e => setModal(m => ({ ...m, ca: e.target.value }))}
                    placeholder="Ex: 12345"
                    className="w-full border rounded px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="text-xs uppercase text-gray-500 font-semibold">Validade (meses)</label>
                  <input type="number" value={modal.validade_meses}
                    onChange={e => setModal(m => ({ ...m, validade_meses: e.target.value }))}
                    placeholder="Ex: 12"
                    className="w-full border rounded px-3 py-2 text-sm" />
                </div>
              </div>
              <div>
                <label className="text-xs uppercase text-gray-500 font-semibold">Descrição</label>
                <textarea value={modal.descricao}
                  onChange={e => setModal(m => ({ ...m, descricao: e.target.value }))}
                  rows={2}
                  placeholder="Para que serve, em quais setores é obrigatório, etc."
                  className="w-full border rounded px-3 py-2 text-sm" />
              </div>
            </div>
            <div className="p-4 border-t flex justify-end gap-2">
              <button onClick={() => setModal(null)} className="px-4 py-2 bg-gray-100 rounded text-sm">Cancelar</button>
              <button onClick={salvar} disabled={salvando}
                className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded text-sm font-semibold disabled:opacity-50">
                {salvando ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Tab customizada: Cargos (com salário base, atividades e EPIs/EPCs)
// ============================================================================
function CargosTab() {
  const [cargos, setCargos] = useState([]);
  const [epis, setEpis] = useState([]);
  const [sugestoesSalarios, setSugestoesSalarios] = useState({});
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const VAZIO = { id: null, nome: '', descricao: '', salario_base: '', descritivo_atividades: '', requisitos: '', epis_epcs_obrigatorios_ids: [] };

  const carregar = async () => {
    setLoading(true);
    try {
      const [cargosR, episR, sugR] = await Promise.all([
        api.get('/rh/configuracoes/cargos'),
        api.get('/rh/configuracoes/epis-epcs'),
        api.get('/rh/configuracoes/cargos/sugestao-salarios').catch(() => ({ data: [] })),
      ]);
      setCargos(Array.isArray(cargosR.data) ? cargosR.data : []);
      setEpis(Array.isArray(episR.data) ? episR.data : []);
      const map = {};
      (sugR.data || []).forEach(s => { map[s.cargo_id] = s; });
      setSugestoesSalarios(map);
    } catch { toast.error('Erro ao carregar cargos'); }
    finally { setLoading(false); }
  };
  useEffect(() => { carregar(); }, []);

  const abrirNovo = () => setModal({ ...VAZIO });
  const abrirEdicao = (c) => setModal({
    id: c.id, nome: c.nome || '', descricao: c.descricao || '',
    salario_base: c.salario_base || (sugestoesSalarios[c.id]?.salario_medio || ''),
    descritivo_atividades: c.descritivo_atividades || '',
    requisitos: c.requisitos || '',
    epis_epcs_obrigatorios_ids: Array.isArray(c.epis_epcs_obrigatorios_ids) ? c.epis_epcs_obrigatorios_ids : [],
  });

  const salvar = async () => {
    if (!modal.nome?.trim()) { toast.error('Nome obrigatório'); return; }
    setSalvando(true);
    try {
      const payload = {
        nome: modal.nome.trim().toUpperCase(),
        descricao: modal.descricao || null,
        salario_base: modal.salario_base ? Number(modal.salario_base) : null,
        descritivo_atividades: modal.descritivo_atividades || null,
        requisitos: modal.requisitos || null,
        epis_epcs_obrigatorios_ids: modal.epis_epcs_obrigatorios_ids || [],
      };
      if (modal.id) await api.put(`/rh/configuracoes/cargos/${modal.id}`, payload);
      else await api.post('/rh/configuracoes/cargos', payload);
      toast.success('Salvo'); setModal(null); await carregar();
    } catch (err) { toast.error(err?.response?.data?.error || 'Erro'); }
    finally { setSalvando(false); }
  };

  const excluir = async (c) => {
    if (!window.confirm(`Excluir "${c.nome}"?`)) return;
    try { await api.delete(`/rh/configuracoes/cargos/${c.id}`); toast.success('Excluído'); await carregar(); }
    catch { toast.error('Erro ao excluir'); }
  };

  const toggleEpi = (id) => {
    setModal(m => {
      const lista = m.epis_epcs_obrigatorios_ids || [];
      const novo = lista.includes(id) ? lista.filter(x => x !== id) : [...lista, id];
      return { ...m, epis_epcs_obrigatorios_ids: novo };
    });
  };

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="flex items-center justify-between px-6 py-4 border-b">
        <div>
          <h2 className="text-lg font-semibold text-gray-700">Cargos</h2>
          <p className="text-xs text-gray-500">Cargos com salário base, descritivo de atividades e EPIs/EPCs obrigatórios.</p>
        </div>
        <button onClick={abrirNovo} className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm font-medium">+ Novo Cargo</button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><RadarLoading size="sm" message="" /></div>
      ) : cargos.length === 0 ? (
        <div className="text-center py-20 text-gray-400">Nenhum cargo cadastrado</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-600 text-white">
                <th className="text-left px-4 py-3 text-sm font-medium">Nome</th>
                <th className="text-left px-4 py-3 text-sm font-medium">Salário Base da Categoria</th>
                <th className="text-left px-4 py-3 text-sm font-medium">EPIs/EPCs</th>
                <th className="text-left px-4 py-3 text-sm font-medium">Atividades</th>
                <th className="text-left px-4 py-3 text-sm font-medium">Requisitos</th>
                <th className="text-right px-4 py-3 text-sm font-medium">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {cargos.map(c => {
                const sug = sugestoesSalarios[c.id];
                const ids = Array.isArray(c.epis_epcs_obrigatorios_ids) ? c.epis_epcs_obrigatorios_ids : [];
                return (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-sm font-semibold text-gray-800">{c.nome}</td>
                    <td className="px-4 py-2 text-sm font-semibold text-gray-800">
                      {(() => {
                        const cadastrado = c.salario_base != null && c.salario_base !== '' ? Number(c.salario_base) : null;
                        if (cadastrado && !isNaN(cadastrado)) return `R$ ${cadastrado.toFixed(2)}`;
                        return <span className="text-gray-300">—</span>;
                      })()}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-700">
                      {ids.length > 0 ? (
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {ids.map(id => {
                            const epi = epis.find(e => e.id === id);
                            if (!epi) return null;
                            return (
                              <span key={id}
                                className="inline-block bg-purple-50 border border-purple-300 text-purple-800 px-2 py-0.5 rounded-full text-xs font-semibold"
                                title={epi.descricao || epi.nome}>
                                {epi.tipo === 'epi' ? '🦺' : '🛡️'} {epi.nome}
                              </span>
                            );
                          })}
                        </div>
                      ) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-700 max-w-xs truncate">
                      {c.descritivo_atividades || <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-700 max-w-xs truncate">
                      {c.requisitos || <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <button onClick={() => abrirEdicao(c)} className="text-orange-600 hover:text-orange-800 text-sm font-medium mr-3">Editar</button>
                      <button onClick={() => excluir(c)} className="text-red-600 hover:text-red-800 text-sm font-medium">Excluir</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setModal(null)}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b sticky top-0 bg-white z-10">
              <h3 className="font-bold text-gray-800">{modal.id ? 'Editar' : 'Novo'} Cargo</h3>
            </div>
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-2">
                  <label className="text-xs uppercase text-gray-500 font-semibold">Nome *</label>
                  <input type="text" value={modal.nome}
                    onChange={e => setModal(m => ({ ...m, nome: e.target.value.toUpperCase() }))}
                    style={{ textTransform: 'uppercase' }}
                    className="w-full border rounded px-3 py-2 text-sm font-semibold" autoFocus />
                </div>
                <div>
                  <label className="text-xs uppercase text-gray-500 font-semibold">Salário Base (R$)</label>
                  <input type="number" step="0.01" value={modal.salario_base}
                    onChange={e => setModal(m => ({ ...m, salario_base: e.target.value }))}
                    placeholder="0,00"
                    className="w-full border rounded px-3 py-2 text-sm" />
                </div>
              </div>
              <div>
                <label className="text-xs uppercase text-gray-500 font-semibold">Descritivo de Atividades</label>
                <textarea value={modal.descritivo_atividades}
                  onChange={e => setModal(m => ({ ...m, descritivo_atividades: e.target.value }))}
                  rows={5}
                  placeholder="Descreva as atividades obrigatórias do cargo, uma por linha..."
                  className="w-full border rounded px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs uppercase text-gray-500 font-semibold">Requisitos</label>
                <p className="text-[10px] text-gray-500 mb-1">Pode trazer estes requisitos automaticamente ao criar uma vaga deste cargo.</p>
                <textarea value={modal.requisitos}
                  onChange={e => setModal(m => ({ ...m, requisitos: e.target.value }))}
                  rows={4}
                  placeholder="Ex: Ensino Médio completo, experiência mínima de 6 meses, disponibilidade de horário..."
                  className="w-full border rounded px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs uppercase text-gray-500 font-semibold">EPIs e EPCs Obrigatórios</label>
                <p className="text-[10px] text-gray-500 mb-2">Marque os equipamentos obrigatórios pra esse cargo. Cadastre novos na aba <strong>EPIs e EPCs</strong>.</p>
                {epis.length === 0 ? (
                  <div className="text-xs text-gray-400 italic bg-gray-50 rounded p-3">
                    Nenhum EPI/EPC cadastrado ainda. Vá na aba <strong>EPIs e EPCs</strong> pra criar.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-1 max-h-72 overflow-y-auto bg-gray-50 rounded p-2 border">
                    {epis.map(e => {
                      const checked = (modal.epis_epcs_obrigatorios_ids || []).includes(e.id);
                      return (
                        <label key={e.id}
                          className={`flex items-center gap-2 p-2 rounded cursor-pointer text-sm transition ${checked ? 'bg-orange-50 border border-orange-300' : 'hover:bg-white'}`}>
                          <input type="checkbox" checked={checked} onChange={() => toggleEpi(e.id)} className="accent-orange-500" />
                          <span className={`text-xs px-1.5 py-0.5 rounded font-bold ${e.tipo === 'epi' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>{e.tipo === 'epi' ? 'EPI' : 'EPC'}</span>
                          <span className="flex-1">{e.nome}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
            <div className="p-4 border-t flex justify-end gap-2 sticky bottom-0 bg-white">
              <button onClick={() => setModal(null)} className="px-4 py-2 bg-gray-100 rounded text-sm">Cancelar</button>
              <button onClick={salvar} disabled={salvando}
                className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded text-sm font-semibold disabled:opacity-50">
                {salvando ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
