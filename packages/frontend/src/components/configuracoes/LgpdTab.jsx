import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../utils/api';
import toast from 'react-hot-toast';
import { TERMOS_LGPD as TERMOS } from '../../constants/lgpdTermos';

// Renderizador markdown leve — converte markdown comum em HTML pra exibir bem formatado
function renderMarkdown(md) {
  if (!md) return '';
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  let html = esc(md);
  // Inline formatting
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/`([^`]+?)`/g, '<code>$1</code>');
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
  // Headers
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
  // HR
  html = html.replace(/^---$/gm, '<hr/>');
  // Tables — captura blocos de tabela markdown
  html = html.replace(/((?:^\|.+\|\n?)+)/gm, (block) => {
    const rows = block.trim().split('\n');
    if (rows.length < 2) return block;
    const headerCells = rows[0].split('|').filter(c => c.trim()).map(c => `<th>${c.trim()}</th>`).join('');
    const bodyRows = rows.slice(2).map(r => {
      const cells = r.split('|').filter(c => c.trim()).map(c => `<td>${c.trim()}</td>`).join('');
      return `<tr>${cells}</tr>`;
    }).join('');
    return `<table><thead><tr>${headerCells}</tr></thead><tbody>${bodyRows}</tbody></table>`;
  });
  // Listas
  html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>\n?)+/g, (m) => `<ul>${m}</ul>`);
  html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');
  // Parágrafos (linhas em branco viram quebra)
  html = html.split(/\n\n+/).map(block => {
    if (/^<(h[1-6]|ul|ol|table|hr)/.test(block.trim())) return block;
    return `<p>${block.replace(/\n/g, '<br/>')}</p>`;
  }).join('\n');
  return html;
}

const DOWNLOADS = [
  { titulo: 'Consentimento de Currículo (modelo)', arquivo: '/docs/legal/04-CONSENTIMENTO-CURRICULO.md' },
  { titulo: 'Consentimento Biométrico (Vision Facial)', arquivo: '/docs/legal/05-CONSENTIMENTO-BIOMETRICO.md' },
  { titulo: 'Aviso de Câmeras (afixar nas lojas)', arquivo: '/docs/legal/08-AVISO-CAMERAS.md' },
  { titulo: 'Plano de Resposta a Incidente', arquivo: '/docs/legal/07-PLANO-RESPOSTA-INCIDENTE.md' },
];

const SUB_OPERADORES = [
  { nome: 'Hostinger International Ltd', finalidade: 'Hospedagem (VPS)', pais: 'Brasil/Lituânia' },
  { nome: 'Cloudflare Inc.', finalidade: 'CDN, DNS, proteção DDoS', pais: 'Global' },
  { nome: 'Anthropic PBC', finalidade: 'IA Recrutador (quando ativo)', pais: 'EUA' },
  { nome: 'OpenAI LLC', finalidade: 'IA alternativa (quando ativo)', pais: 'EUA' },
  { nome: 'Meta Platforms Inc.', finalidade: 'WhatsApp Business API (quando ativo)', pais: 'Global' },
];

export default function LgpdTab() {
  const { user } = useAuth();
  const [aceites, setAceites] = useState([]);
  const [config, setConfig] = useState({
    dpo_nome: '',
    dpo_email: '',
    dpo_telefone: '',
    retencao_curriculos_meses: 12,
    retencao_logs_meses: 12,
    retencao_gravacoes_dias: 30,
  });
  const [salvandoConfig, setSalvandoConfig] = useState(false);
  const [aceitando, setAceitando] = useState(null);
  const [modalTermo, setModalTermo] = useState(null);
  const [conteudoTermo, setConteudoTermo] = useState('');
  const [carregandoConteudo, setCarregandoConteudo] = useState(false);
  const [subOpAberto, setSubOpAberto] = useState(false);

  useEffect(() => {
    carregar();
  }, []);

  const carregar = async () => {
    try {
      const [aceitesRes, configRes] = await Promise.all([
        api.get('/lgpd/aceites').catch(() => ({ data: [] })),
        api.get('/lgpd/configuracoes').catch(() => ({ data: null })),
      ]);
      setAceites(aceitesRes.data || []);
      if (configRes.data) setConfig({ ...config, ...configRes.data });
    } catch (err) {
      console.error('Erro ao carregar LGPD:', err);
    }
  };

  const aceiteAtivo = (tipo) => {
    return aceites.find(a => a.tipo === tipo && !a.revogado_em);
  };

  const handleAceitar = async (termo) => {
    if (!user) return;
    if (!window.confirm(
      `Você está prestes a aceitar "${termo.titulo}" (${termo.versao}) em nome da empresa.\n\n` +
      `Esta ação é registrada com data, hora e endereço IP, e tem valor legal.\n\n` +
      `Confirme apenas se você tem poderes de representação da empresa.`
    )) return;
    try {
      setAceitando(termo.id);
      await api.post('/lgpd/aceites', {
        tipo: termo.id,
        versao: termo.versao,
        titular_tipo: 'cliente',
        titular_id: String(user.id || user.companyId || 'master'),
        titular_nome: user.name || user.username || '',
        titular_email: user.email || '',
      });
      toast.success(`${termo.titulo} aceito com sucesso`);
      await carregar();
    } catch (err) {
      toast.error('Erro ao registrar aceite: ' + (err?.response?.data?.error || err.message));
    } finally {
      setAceitando(null);
    }
  };

  const handleSalvarConfig = async () => {
    try {
      setSalvandoConfig(true);
      await api.put('/lgpd/configuracoes', config);
      toast.success('Configurações de privacidade salvas');
      await carregar();
    } catch (err) {
      toast.error('Erro ao salvar: ' + (err?.response?.data?.error || err.message));
    } finally {
      setSalvandoConfig(false);
    }
  };

  const verTermo = async (termo) => {
    setModalTermo(termo);
    setCarregandoConteudo(true);
    setConteudoTermo('');
    try {
      const resp = await fetch(termo.arquivo);
      if (resp.ok) {
        const txt = await resp.text();
        setConteudoTermo(txt);
      } else {
        setConteudoTermo('Erro ao carregar documento (HTTP ' + resp.status + ')');
      }
    } catch (err) {
      setConteudoTermo('Erro ao carregar: ' + err.message);
    } finally {
      setCarregandoConteudo(false);
    }
  };

  const fmtData = (iso) => iso ? new Date(iso).toLocaleString('pt-BR') : '-';

  const todosAceitos = TERMOS.filter(t => t.obrigatorio).every(t => aceiteAtivo(t.id));

  return (
    <div className="space-y-6">
      {/* Aviso de status geral */}
      <div className={`rounded-xl border-2 p-5 ${todosAceitos ? 'bg-green-50 border-green-300' : 'bg-amber-50 border-amber-300'}`}>
        <div className="flex items-start gap-3">
          <div className="text-3xl">{todosAceitos ? '✅' : '⚠️'}</div>
          <div className="flex-1">
            <h3 className={`font-bold text-lg ${todosAceitos ? 'text-green-900' : 'text-amber-900'}`}>
              {todosAceitos ? 'Sua empresa está em conformidade com os termos' : 'Aceite dos termos pendente'}
            </h3>
            <p className={`text-sm mt-1 ${todosAceitos ? 'text-green-800' : 'text-amber-800'}`}>
              {todosAceitos
                ? 'Todos os termos obrigatórios foram aceitos pelo representante da empresa.'
                : 'Para usar o sistema em conformidade com a LGPD, é necessário que o representante legal da empresa aceite os termos abaixo.'}
            </p>
          </div>
        </div>
      </div>

      {/* Termos Obrigatórios */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="font-bold text-gray-900">📋 Documentos Legais</h2>
          <p className="text-sm text-gray-600">Termos que precisam ser aceitos pelo representante da empresa.</p>
        </div>
        <div className="divide-y divide-gray-100">
          {TERMOS.map((termo) => {
            const aceite = aceiteAtivo(termo.id);
            return (
              <div key={termo.id} className="px-6 py-4 flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-gray-900">{termo.titulo}</h3>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 font-mono">{termo.versao}</span>
                    {aceite ? (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-800 font-bold">✓ Aceito</span>
                    ) : (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold">Pendente</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 mt-1">{termo.descricao}</p>
                  {aceite && (
                    <div className="text-xs text-gray-500 mt-2 bg-gray-50 rounded px-3 py-2">
                      <div><b>Aceito por:</b> {aceite.titular_nome || '—'}</div>
                      <div><b>Em:</b> {fmtData(aceite.aceito_em)}</div>
                      <div><b>IP:</b> {aceite.ip || '—'}</div>
                      <div className="font-mono text-[10px] break-all"><b>Hash:</b> {aceite.hash_conteudo}</div>
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-2 shrink-0">
                  <button
                    onClick={() => verTermo(termo)}
                    className="px-3 py-1.5 text-xs font-medium bg-gray-100 hover:bg-gray-200 rounded text-gray-700"
                  >
                    📄 Ver Termo
                  </button>
                  {!aceite && (
                    <button
                      onClick={() => handleAceitar(termo)}
                      disabled={aceitando === termo.id}
                      className="px-3 py-1.5 text-xs font-bold bg-green-600 hover:bg-green-700 text-white rounded disabled:opacity-50"
                    >
                      {aceitando === termo.id ? 'Aceitando...' : '✍️ Aceitar'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Configurações de Privacidade */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="font-bold text-gray-900">⚙️ Configurações de Privacidade da Empresa</h2>
          <p className="text-sm text-gray-600">Encarregado de Dados (DPO) e políticas de retenção da sua empresa.</p>
        </div>
        <div className="px-6 py-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">DPO (Encarregado de Dados) — Nome</label>
              <input
                type="text"
                value={config.dpo_nome || ''}
                onChange={(e) => setConfig({ ...config, dpo_nome: e.target.value })}
                placeholder="Nome do responsável pela LGPD na sua empresa"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">DPO — E-mail</label>
              <input
                type="email"
                value={config.dpo_email || ''}
                onChange={(e) => setConfig({ ...config, dpo_email: e.target.value })}
                placeholder="dpo@suaempresa.com.br"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">DPO — Telefone</label>
              <input
                type="text"
                value={config.dpo_telefone || ''}
                onChange={(e) => setConfig({ ...config, dpo_telefone: e.target.value })}
                placeholder="(00) 00000-0000"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="border-t border-gray-200 pt-4">
            <h3 className="font-semibold text-gray-800 mb-3">Política de Retenção</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Currículos não contratados (meses)</label>
                <input
                  type="number"
                  min="1"
                  max="60"
                  value={config.retencao_curriculos_meses || 12}
                  onChange={(e) => setConfig({ ...config, retencao_curriculos_meses: parseInt(e.target.value) || 12 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-xs text-gray-500">Após este prazo, currículos são anonimizados</span>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Logs de acesso (meses)</label>
                <input
                  type="number"
                  min="6"
                  max="60"
                  value={config.retencao_logs_meses || 12}
                  onChange={(e) => setConfig({ ...config, retencao_logs_meses: parseInt(e.target.value) || 12 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-xs text-gray-500">Mínimo 6 meses (Marco Civil)</span>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Gravações de câmera (dias)</label>
                <input
                  type="number"
                  min="7"
                  max="180"
                  value={config.retencao_gravacoes_dias || 30}
                  onChange={(e) => setConfig({ ...config, retencao_gravacoes_dias: parseInt(e.target.value) || 30 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-xs text-gray-500">Padrão: 30 dias</span>
              </div>
            </div>
          </div>

          <button
            onClick={handleSalvarConfig}
            disabled={salvandoConfig}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold disabled:opacity-50"
          >
            {salvandoConfig ? 'Salvando...' : '💾 Salvar Configurações'}
          </button>
        </div>
      </div>

      {/* Sub-operadores */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <button
          onClick={() => setSubOpAberto(v => !v)}
          className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition"
        >
          <div className="text-left">
            <h2 className="font-bold text-gray-900">🔗 Sub-Operadores</h2>
            <p className="text-sm text-gray-600">Terceiros com quem o Kontrata.ai compartilha dados (todos vinculados a obrigações de proteção).</p>
          </div>
          <span className={`w-7 h-7 inline-flex items-center justify-center rounded-full bg-blue-100 text-blue-700 hover:bg-blue-200 font-bold text-base transition ${subOpAberto ? 'rotate-45' : ''}`}>
            +
          </span>
        </button>
        {subOpAberto && (
          <div className="overflow-x-auto border-t border-gray-200">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
                <tr>
                  <th className="px-6 py-3 text-left">Sub-Operador</th>
                  <th className="px-6 py-3 text-left">Finalidade</th>
                  <th className="px-6 py-3 text-left">País</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {SUB_OPERADORES.map((s, i) => (
                  <tr key={i}>
                    <td className="px-6 py-3 font-medium">{s.nome}</td>
                    <td className="px-6 py-3 text-gray-600">{s.finalidade}</td>
                    <td className="px-6 py-3 text-gray-600">{s.pais}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Documentos para Download */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="font-bold text-gray-900">📥 Modelos para Download</h2>
          <p className="text-sm text-gray-600">Documentos pra você imprimir/usar com seus colaboradores e candidatos.</p>
        </div>
        <div className="px-6 py-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          {DOWNLOADS.map((d, i) => (
            <button
              key={i}
              onClick={() => verTermo({ titulo: d.titulo, arquivo: d.arquivo, versao: '' })}
              className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-blue-300 text-left"
            >
              <span className="text-2xl">📄</span>
              <span className="text-sm font-medium text-gray-800">{d.titulo}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Direitos do Titular */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="font-bold text-gray-900">👤 Direitos dos Titulares (LGPD Art. 18)</h2>
          <p className="text-sm text-gray-600">Como atender solicitações dos colaboradores e candidatos sobre seus dados.</p>
        </div>
        <div className="px-6 py-4">
          <div className="prose prose-sm max-w-none text-gray-700">
            <p>
              Seus colaboradores e candidatos têm direito a solicitar (prazo legal de <b>15 dias</b> pra responder):
            </p>
            <ul className="list-disc list-inside text-sm space-y-1 mt-2">
              <li><b>Acesso</b> aos dados que você guarda sobre eles</li>
              <li><b>Correção</b> de dados incompletos ou desatualizados</li>
              <li><b>Exclusão</b> ou anonimização (respeitando obrigações legais como CLT/eSocial)</li>
              <li><b>Portabilidade</b> (exportar em formato legível por máquina)</li>
              <li><b>Revogação</b> de consentimentos previamente dados</li>
              <li><b>Revisão de decisão automatizada</b> (Recrutador IA)</li>
            </ul>
            <p className="mt-3">
              <b>Canais recomendados:</b> e-mail do DPO da sua empresa (configurado acima) + telas "Meus Dados" do sistema.
            </p>
          </div>
        </div>
      </div>

      {/* Contato Kontrata.ai */}
      <div className="bg-blue-50 rounded-xl border-2 border-blue-200 p-5">
        <h3 className="font-bold text-blue-900 mb-2">📞 Encarregado de Dados (DPO) do Kontrata.ai</h3>
        <p className="text-sm text-blue-900">
          Para questões sobre privacidade que envolvam o Kontrata.ai enquanto Operador, contate:
        </p>
        <div className="mt-2 text-sm">
          <div><b>E-mail:</b> dpo@kontrataai.com.br</div>
          <div><b>Atendimento:</b> dias úteis, das 9h às 18h</div>
          <div><b>Prazo:</b> até 15 dias corridos</div>
        </div>
      </div>

      {/* Modal pra ver termo */}
      {modalTermo && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => { setModalTermo(null); setConteudoTermo(''); }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
            {/* Header roxo Kontrata */}
            <div className="px-6 py-4 flex items-center justify-between text-white" style={{ background: 'linear-gradient(135deg, #6B21A8 0%, #3D1B7E 100%)' }}>
              <div className="flex items-center gap-3">
                <span className="text-2xl">🛡️</span>
                <div>
                  <h2 className="text-lg font-bold tracking-tight">{modalTermo.titulo}</h2>
                  {modalTermo.versao && <p className="text-xs text-purple-100/80">Versão {modalTermo.versao}</p>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={modalTermo.arquivo}
                  download
                  className="px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-xs font-bold transition-colors"
                  title="Baixar documento"
                >
                  📥 Baixar
                </a>
                <button onClick={() => { setModalTermo(null); setConteudoTermo(''); }} className="text-white hover:bg-white/20 rounded-lg w-8 h-8 flex items-center justify-center transition-colors" title="Fechar">
                  ✕
                </button>
              </div>
            </div>
            {/* Conteúdo formatado */}
            <div className="flex-1 overflow-y-auto bg-gray-50">
              {carregandoConteudo ? (
                <div className="text-center py-16 text-gray-500">
                  <div className="inline-block w-8 h-8 border-4 border-purple-200 border-t-purple-700 rounded-full animate-spin mb-3"></div>
                  <p>Carregando documento...</p>
                </div>
              ) : (
                <article
                  className="prose prose-sm max-w-none px-8 py-6 text-gray-800
                    prose-headings:text-purple-900 prose-headings:font-bold
                    prose-h1:text-2xl prose-h1:border-b prose-h1:border-purple-200 prose-h1:pb-2 prose-h1:mb-4
                    prose-h2:text-xl prose-h2:mt-6 prose-h2:mb-3
                    prose-h3:text-base prose-h3:mt-4 prose-h3:mb-2
                    prose-p:leading-relaxed prose-p:my-2
                    prose-strong:text-purple-900
                    prose-a:text-purple-700 prose-a:no-underline hover:prose-a:underline
                    prose-table:text-xs prose-table:border prose-table:border-gray-300
                    prose-th:bg-purple-100 prose-th:p-2 prose-th:border prose-th:border-gray-300 prose-th:text-purple-900
                    prose-td:p-2 prose-td:border prose-td:border-gray-300
                    prose-hr:border-purple-200 prose-hr:my-6
                    prose-li:my-1
                    prose-code:bg-purple-50 prose-code:text-purple-800 prose-code:px-1 prose-code:py-0.5 prose-code:rounded"
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(conteudoTermo) }}
                />
              )}
            </div>
            <div className="px-6 py-3 border-t border-gray-200 bg-purple-50 flex items-center justify-between">
              <p className="text-xs text-purple-900 italic flex items-center gap-2">
                <span>⚠️</span>
                <span>Documento em revisão jurídica. Recomendamos baixar e levar a um advogado especialista em LGPD.</span>
              </p>
              <button
                onClick={() => { setModalTermo(null); setConteudoTermo(''); }}
                className="px-4 py-1.5 bg-purple-700 hover:bg-purple-800 text-white text-sm font-medium rounded-lg transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
