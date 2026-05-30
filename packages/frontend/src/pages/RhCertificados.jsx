import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import Sidebar from '../components/Sidebar';
import { api } from '../utils/api';
import toast from 'react-hot-toast';

/**
 * Página de Certificados de Treinamento.
 *
 * Fluxo: lista os treinamentos existentes → o RH escolhe um → escolhe nome
 * do Diretor e do Instrutor (prefilled a partir do campo `instrutor` do
 * treinamento) → preview e impressão.
 *
 * O logo da empresa é puxado automaticamente das configurações
 * (client_logo_url) — mesma fonte usada pelos outros docs padronizados.
 */
export default function RhCertificados() {
  const { user, logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const [treinamentos, setTreinamentos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [logoEmpresa, setLogoEmpresa] = useState(null);
  const [nomeEmpresa, setNomeEmpresa] = useState('');

  // Seleção atual
  const [treinamentoSel, setTreinamentoSel] = useState(null);
  const [diretor, setDiretor] = useState('');
  const [instrutor, setInstrutor] = useState('');
  const [busca, setBusca] = useState('');

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const [trei, logoR, brandR] = await Promise.all([
          api.get('/rh/treinamentos'),
          api.get('/configurations/client_logo_url').catch(() => null),
          api.get('/configurations/client_brand_name').catch(() => null),
        ]);
        const asArray = (resp, key) => {
          const d = resp?.data;
          if (Array.isArray(d)) return d;
          if (key && Array.isArray(d?.[key])) return d[key];
          if (Array.isArray(d?.data)) return d.data;
          return [];
        };
        setTreinamentos(asArray(trei));
        if (logoR?.data?.value) setLogoEmpresa(logoR.data.value);
        if (brandR?.data?.value) setNomeEmpresa(brandR.data.value);
      } catch (e) {
        toast.error('Erro ao carregar dados');
        console.error(e);
      } finally { setLoading(false); }
    })();
  }, []);

  const treinamentosFiltrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return treinamentos;
    return treinamentos.filter(t =>
      (t.colaborador_nome || '').toLowerCase().includes(q) ||
      (t.nome_treinamento || '').toLowerCase().includes(q) ||
      (t.empresa_nome || '').toLowerCase().includes(q)
    );
  }, [treinamentos, busca]);

  const escolherTreinamento = (t) => {
    setTreinamentoSel(t);
    setInstrutor((t.instrutor || '').toUpperCase());
    // Diretor mantém o último valor digitado (RH normalmente é o mesmo)
  };

  const cargaHorariaTxt = (ch) => {
    if (!ch) return '___';
    const n = Number(ch);
    if (n === 1) return '1 HORA';
    return `${n % 1 === 0 ? n : n.toFixed(1)} HORAS`;
  };

  const imprimir = () => {
    if (!treinamentoSel) { toast.error('Escolha um treinamento'); return; }
    if (!diretor.trim() || !instrutor.trim()) { toast.error('Preencha Diretor e Instrutor'); return; }

    const t = treinamentoSel;
    const colaborador = (t.colaborador_nome || '').toUpperCase();
    const tema = (t.nome_treinamento || '').toUpperCase();
    const ch = cargaHorariaTxt(t.carga_horaria);
    const escola = (t.instituicao || nomeEmpresa || 'EMPRESA').toUpperCase();
    const logoHtml = logoEmpresa
      ? `<img src="${logoEmpresa}" alt="Logo" style="max-height:60px;max-width:140px;object-fit:contain" />`
      : `<div style="font-size:14pt;font-weight:bold;color:#ef4444">${nomeEmpresa || ''}</div>`;

    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><title>Certificado - ${colaborador}</title>
      <style>
        @page { size: A4 landscape; margin: 0 }
        body { margin: 0; font-family: Arial, sans-serif }
        .cert { position: relative; width: 297mm; height: 210mm; box-sizing: border-box; padding: 20mm 25mm; background: #fff; overflow: hidden }
        /* triângulos decorativos cantos */
        .tri { position: absolute; width: 0; height: 0 }
        .tl1 { top: 0;  left: 0;  border-top: 70mm solid #f97316; border-right: 90mm solid transparent }
        .tl2 { top: 0;  left: 0;  border-top: 50mm solid #ec4899; border-right: 130mm solid transparent }
        .tl3 { top: 0;  left: 0;  border-top: 30mm solid #06b6d4; border-right: 180mm solid transparent }
        .br1 { bottom: 0; right: 0; border-bottom: 70mm solid #f97316; border-left: 90mm solid transparent }
        .br2 { bottom: 0; right: 0; border-bottom: 50mm solid #ec4899; border-left: 130mm solid transparent }
        .br3 { bottom: 0; right: 0; border-bottom: 30mm solid #06b6d4; border-left: 180mm solid transparent }
        /* mini triângulos espalhados */
        .ti { position: absolute; width: 0; height: 0; opacity: 0.85 }
        .ti1 { top: 35mm; left: 35mm; border-top: 8mm solid transparent; border-bottom: 8mm solid transparent; border-left: 12mm solid #06b6d4 }
        .ti2 { top: 75mm; left: 25mm; border-top: 6mm solid transparent; border-bottom: 6mm solid transparent; border-right: 10mm solid #f97316 }
        .ti3 { bottom: 50mm; right: 35mm; border-top: 8mm solid transparent; border-bottom: 8mm solid transparent; border-right: 12mm solid #ec4899 }
        .ti4 { bottom: 70mm; right: 25mm; border-top: 6mm solid transparent; border-bottom: 6mm solid transparent; border-left: 10mm solid #06b6d4 }
        /* medalha estrela canto superior direito */
        .medalha { position: absolute; top: 18mm; right: 30mm; width: 38mm; height: 50mm; z-index: 5 }
        /* conteúdo */
        .conteudo { position: relative; z-index: 10; text-align: center; height: 100%; display: flex; flex-direction: column; justify-content: space-between }
        h1 { font-size: 56pt; color: #ef4444; margin: 0 0 4mm; font-weight: 900; letter-spacing: 2px }
        .sub { font-size: 14pt; color: #1f2937; letter-spacing: 4px; margin-bottom: 14mm }
        .colab { font-size: 32pt; color: #ef4444; font-weight: 900; margin: 0; letter-spacing: 1px; border-bottom: 2px dashed #9ca3af; padding-bottom: 4mm; margin: 0 30mm }
        .linha-meio { font-size: 11pt; color: #1f2937; letter-spacing: 1px; margin: 6mm 0 0 }
        .linha-meio em { font-style: italic; font-weight: 800; color: #ef4444; font-style: normal; letter-spacing: 2px }
        .tema { font-size: 32pt; color: #ef4444; font-weight: 900; margin: 4mm 0 6mm; letter-spacing: 2px }
        .ch { font-size: 12pt; color: #1f2937; letter-spacing: 2px; font-weight: 700 }
        .logo-wrap { margin: 8mm 0; display: flex; justify-content: center }
        .assinaturas { display: flex; justify-content: space-around; gap: 20mm; padding: 0 30mm }
        .ass { text-align: center; flex: 1; max-width: 80mm }
        .ass-linha { border-top: 1.5px solid #1f2937; padding-top: 2mm }
        .ass-nome { font-size: 12pt; font-weight: 900; color: #1f2937; letter-spacing: 1px }
        .ass-cargo { font-size: 10pt; color: #1f2937; letter-spacing: 2px; font-style: italic }
      </style></head><body>
      <div class="cert">
        <!-- decoração canto superior esquerdo -->
        <div class="tri tl3"></div>
        <div class="tri tl2"></div>
        <div class="tri tl1"></div>
        <!-- decoração canto inferior direito -->
        <div class="tri br3"></div>
        <div class="tri br2"></div>
        <div class="tri br1"></div>
        <!-- mini triângulos -->
        <div class="ti ti1"></div>
        <div class="ti ti2"></div>
        <div class="ti ti3"></div>
        <div class="ti ti4"></div>
        <!-- medalha estrela -->
        <svg class="medalha" viewBox="0 0 100 130" xmlns="http://www.w3.org/2000/svg">
          <!-- fitas -->
          <polygon points="35,75 35,125 50,110 65,125 65,75" fill="#ef4444"/>
          <polygon points="42,75 42,115 50,107 58,115 58,75" fill="#dc2626"/>
          <!-- borda da medalha (denticulado) -->
          <circle cx="50" cy="50" r="36" fill="#fbbf24"/>
          <circle cx="50" cy="50" r="32" fill="#f59e0b"/>
          <circle cx="50" cy="50" r="28" fill="#fbbf24"/>
          <!-- estrela -->
          <polygon points="50,28 56,44 72,44 59,54 64,70 50,60 36,70 41,54 28,44 44,44"
                   fill="#ef4444"/>
        </svg>

        <div class="conteudo">
          <div>
            <h1>CERTIFICADO</h1>
            <div class="sub">CERTIFICAMOS QUE</div>
            <div class="colab">${colaborador}</div>
            <div class="linha-meio">CONCLUIU PELA ESCOLA DE TREINAMENTOS <em>${escola}</em></div>
            <div class="linha-meio">O TREINAMENTO DE :</div>
            <div class="tema">${tema}</div>
            <div class="ch">COM CARGA HORÁRIA DE ${ch}</div>
          </div>
          <div class="logo-wrap">${logoHtml}</div>
          <div class="assinaturas">
            <div class="ass">
              <div class="ass-linha">
                <div class="ass-nome">${diretor.toUpperCase()}</div>
                <div class="ass-cargo">DIRETOR</div>
              </div>
            </div>
            <div class="ass">
              <div class="ass-linha">
                <div class="ass-nome">${instrutor.toUpperCase()}</div>
                <div class="ass-cargo">INSTRUTOR(A)</div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <script>window.onload=()=>{window.print()}</script>
    </body></html>`);
    w.document.close();
  };

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar user={user} onLogout={logout} isMobileMenuOpen={isMobileMenuOpen} setIsMobileMenuOpen={setIsMobileMenuOpen} />
      <div className="flex-1 overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-purple-500 text-white px-6 py-4">
          <h1 className="text-2xl font-bold">🏆 Certificados de Treinamento</h1>
          <p className="text-orange-100 text-sm mt-1">Gere certificados a partir dos treinamentos cadastrados</p>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Coluna esquerda — lista de treinamentos */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <h2 className="font-bold text-gray-800 mb-3">1. Escolha o treinamento</h2>
              <input type="text" value={busca} onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar por colaborador, tema ou loja..."
                className="w-full px-3 py-2 border border-gray-300 rounded mb-3 text-sm" />
              {loading ? (
                <div className="text-center py-8 text-gray-400">Carregando...</div>
              ) : treinamentosFiltrados.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-sm">
                  {treinamentos.length === 0
                    ? 'Nenhum treinamento cadastrado. Cadastre um em "Cadastrar Treinamento" primeiro.'
                    : 'Nenhum resultado pra essa busca.'}
                </div>
              ) : (
                <div className="space-y-2 max-h-[600px] overflow-y-auto">
                  {treinamentosFiltrados.map(t => {
                    const ativo = treinamentoSel?.id === t.id;
                    return (
                      <button key={t.id} type="button" onClick={() => escolherTreinamento(t)}
                        className={`w-full text-left p-3 rounded border transition ${
                          ativo
                            ? 'bg-orange-50 border-orange-400 ring-1 ring-orange-300'
                            : 'bg-white border-gray-200 hover:border-orange-300 hover:bg-orange-50/40'
                        }`}>
                        <div className="font-bold text-sm text-gray-800">{t.nome_treinamento}</div>
                        <div className="text-xs text-gray-600 mt-0.5">{t.colaborador_nome || '— sem colaborador —'}</div>
                        <div className="flex items-center gap-2 mt-1 text-[10px] text-gray-500">
                          {t.empresa_nome && <span className="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">{t.empresa_nome}</span>}
                          {t.carga_horaria && <span>{t.carga_horaria}h</span>}
                          {t.instrutor && <span>· Instrutor: {t.instrutor}</span>}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Coluna direita — diretor/instrutor + preview/imprimir */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <h2 className="font-bold text-gray-800 mb-3">2. Quem assina</h2>
              {!treinamentoSel ? (
                <div className="text-center py-12 text-gray-400 text-sm">
                  Escolha um treinamento ao lado.
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="bg-orange-50 border border-orange-200 rounded p-3 text-sm">
                    <div className="font-bold text-orange-900">{treinamentoSel.nome_treinamento}</div>
                    <div className="text-orange-800 text-xs">{treinamentoSel.colaborador_nome}</div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase text-gray-600 mb-1">Nome do Diretor *</label>
                    <input type="text" value={diretor} onChange={(e) => setDiretor(e.target.value.toUpperCase())}
                      placeholder="EX: ROBERTO BASTOS RUIVO"
                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm uppercase" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase text-gray-600 mb-1">Nome do Instrutor *</label>
                    <input type="text" value={instrutor} onChange={(e) => setInstrutor(e.target.value.toUpperCase())}
                      placeholder="EX: BRUNO CARVALHO"
                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm uppercase" />
                    <p className="text-[10px] text-gray-500 mt-1">Pré-preenchido com o instrutor do treinamento, mas você pode editar.</p>
                  </div>
                  <div className="bg-gray-50 border border-gray-200 rounded p-3 text-xs space-y-1">
                    <div><span className="font-semibold text-gray-700">Carga horária:</span> {treinamentoSel.carga_horaria || '—'}h</div>
                    <div><span className="font-semibold text-gray-700">Escola/Instituição:</span> {treinamentoSel.instituicao || nomeEmpresa || '—'}</div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-700">Logo da empresa:</span>
                      {logoEmpresa
                        ? <img src={logoEmpresa} alt="logo" className="h-6 max-w-[100px] object-contain" />
                        : <span className="text-gray-400">não cadastrado</span>}
                    </div>
                  </div>
                  <button onClick={imprimir}
                    className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-2 px-4 rounded shadow flex items-center justify-center gap-2">
                    🖨️ Gerar Certificado / Imprimir
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
