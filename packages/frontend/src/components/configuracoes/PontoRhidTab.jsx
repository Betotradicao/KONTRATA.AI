import { useState, useEffect } from 'react';
import api from '../../utils/api';

// Configuração do Cartão de Ponto (nuvem RHiD). Tudo vem/salva da config — nada hardcode.
export default function PontoRhidTab() {
  const [form, setForm] = useState({ email: '', senha: '', dominio: '', base: '' });
  const [showSenha, setShowSenha] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const [lojas, setLojas] = useState([]);              // nossas lojas (rh_empresas)
  const [rhidEmpresas, setRhidEmpresas] = useState([]); // empresas da conta RHiD
  const [lojaMap, setLojaMap] = useState({});          // { nossaLojaId: rhidEmpresaId }
  const [loadingEmpresas, setLoadingEmpresas] = useState(false);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  useEffect(() => {
    (async () => {
      try {
        const r = await api.get('/config/configurations');
        const c = r.data?.data || {};
        setForm({
          email: c.rhid_email || '', senha: c.rhid_senha || '',
          dominio: c.rhid_dominio || '', base: c.rhid_base || '',
        });
        try { setLojaMap(JSON.parse(c.rhid_loja_map || '{}') || {}); } catch { setLojaMap({}); }
      } catch { /* ignore */ }
      try {
        const r = await api.get('/rh/empresas/stores/list');
        setLojas(Array.isArray(r.data) ? r.data : (r.data?.companies || []));
      } catch { /* ignore */ }
      setLoading(false);
    })();
  }, []);

  const testar = async () => {
    if (!form.email || !form.senha) { setTestResult({ success: false, message: 'Preencha e-mail e senha' }); return; }
    setTesting(true); setTestResult(null);
    try {
      const r = await api.post('/rh/ponto/relogio/testar', form);
      setTestResult(r.data);
    } catch (e) {
      setTestResult({ success: false, message: `Erro: ${e.message}` });
    } finally { setTesting(false); }
  };

  const carregarEmpresasRhid = async () => {
    setLoadingEmpresas(true);
    try {
      const r = await api.get('/rh/ponto/rhid/empresas');
      if (r.data?.success) setRhidEmpresas(r.data.empresas || []);
      else alert('❌ ' + (r.data?.message || 'Falha ao carregar empresas da RHiD. Salve as credenciais primeiro.'));
    } catch (e) {
      alert('❌ ' + (e?.response?.data?.message || 'Falha ao carregar. Salve as credenciais primeiro.'));
    } finally { setLoadingEmpresas(false); }
  };

  const salvar = async () => {
    setSaving(true);
    try {
      const payload = {
        rhid_email: form.email, rhid_senha: form.senha,
        rhid_dominio: form.dominio, rhid_base: form.base,
        rhid_loja_map: JSON.stringify(lojaMap || {}),
      };
      const r = await api.post('/config/configurations', payload);
      if (r.data?.success) alert('✅ Configuração do ponto salva! (senha criptografada)');
      else alert('❌ Erro ao salvar: ' + (r.data?.message || ''));
    } catch (e) {
      alert('❌ Erro ao salvar: ' + e.message);
    } finally { setSaving(false); }
  };

  const nomeLoja = (l) => l.apelido ? `Loja ${l.cod_loja} - ${l.apelido}` : (l.label || l.nome_fantasia || `Loja ${l.cod_loja || l.id}`);

  if (loading) return <div className="py-10 text-center text-gray-500">Carregando…</div>;

  return (
    <div className="space-y-4">
      <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
        <p className="text-sm text-purple-800 font-medium">⏰ Cartão de Ponto — Nuvem RHiD (Control iD)</p>
        <p className="text-xs text-purple-700 mt-1">Puxa marcações, banco de horas, HE e faltas já apurados pela RHiD. Conexão 100% nuvem — não precisa abrir porta na rede da loja.</p>
      </div>

      {/* Credenciais */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">E-mail (login RHiD)</label>
        <input type="text" value={form.email} onChange={e => set('email', e.target.value)}
          placeholder="ex: empresa@email.com"
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Senha RHiD</label>
        <div className="relative">
          <input type={showSenha ? 'text' : 'password'} value={form.senha} onChange={e => set('senha', e.target.value)}
            placeholder="Senha da conta RHiD"
            className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
          <button type="button" onClick={() => setShowSenha(s => !s)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 text-sm">
            {showSenha ? '🙈' : '👁️'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Domínio / Conta <span className="text-gray-400">(opcional)</span></label>
          <input type="text" value={form.dominio} onChange={e => set('dominio', e.target.value)}
            placeholder="ex: minhaempresa"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">URL base <span className="text-gray-400">(avançado, deixe vazio)</span></label>
          <input type="text" value={form.base} onChange={e => set('base', e.target.value)}
            placeholder="https://www.rhid.com.br/v2/api.svc"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
        </div>
      </div>

      {/* Testar */}
      <div className="pt-2">
        <button onClick={testar} disabled={testing}
          className={`px-4 py-2 rounded-lg font-medium text-white flex items-center gap-2 ${testing ? 'bg-gray-400' : 'bg-green-600 hover:bg-green-700'}`}>
          {testing ? 'Testando…' : '🔌 Testar Conexão'}
        </button>
        {testResult && (
          <div className={`mt-3 p-3 rounded-lg text-sm ${testResult.success ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-red-50 border border-red-200 text-red-800'}`}>
            {testResult.success ? '✅ ' : '❌ '}{testResult.message}
          </div>
        )}
      </div>

      {/* Associação Loja ↔ Empresa RHiD */}
      <div className="border-t pt-4">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h4 className="text-sm font-bold text-gray-800">🏪 Associação Loja ↔ Empresa RHiD</h4>
            <p className="text-xs text-gray-500">Vincule cada loja nossa à empresa correspondente na RHiD.</p>
          </div>
          <button onClick={carregarEmpresasRhid} disabled={loadingEmpresas}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium text-white ${loadingEmpresas ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'}`}>
            {loadingEmpresas ? 'Carregando…' : '↻ Carregar empresas da RHiD'}
          </button>
        </div>

        {rhidEmpresas.length === 0 ? (
          <div className="text-xs text-gray-400 bg-gray-50 border rounded-lg p-3">
            Clique em "Carregar empresas da RHiD" (salve as credenciais antes) pra listar as empresas e associar.
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-100 text-gray-600">
                <tr>
                  <th className="text-left px-3 py-2 font-semibold">Nossa Loja</th>
                  <th className="text-left px-3 py-2 font-semibold">Empresa na RHiD</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {lojas.map(l => (
                  <tr key={l.id}>
                    <td className="px-3 py-2 text-gray-700">{nomeLoja(l)}</td>
                    <td className="px-3 py-2">
                      <select value={lojaMap[l.id] || ''} onChange={e => setLojaMap(m => ({ ...m, [l.id]: e.target.value }))}
                        className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm">
                        <option value="">— não associada —</option>
                        {rhidEmpresas.map(re => <option key={re.id} value={re.id}>{re.nome} (id {re.id})</option>)}
                      </select>
                    </td>
                  </tr>
                ))}
                {lojas.length === 0 && <tr><td colSpan={2} className="px-3 py-4 text-center text-gray-400">Nenhuma loja cadastrada.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-[11px] text-gray-400 mt-1">💡 O espelho já casa colaborador↔RHiD pelo <b>PIS</b>. A associação de loja serve pra organizar/filtrar por unidade.</p>
      </div>

      {/* Salvar */}
      <div className="flex justify-end border-t pt-4">
        <button onClick={salvar} disabled={saving}
          className={`px-6 py-2 rounded-lg font-medium text-white ${saving ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'}`}>
          {saving ? 'Salvando…' : 'Salvar Configurações'}
        </button>
      </div>
    </div>
  );
}
