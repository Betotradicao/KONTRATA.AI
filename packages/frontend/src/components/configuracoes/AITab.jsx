import { useState, useEffect } from 'react';
import api from '../../utils/api';
import AgenteEscalaConfig from './AgenteEscalaConfig';
import AgenteRecrutadorConfig from './AgenteRecrutadorConfig';
import AgenteComplianceConfig from './AgenteComplianceConfig';

// Modelos disponíveis
const MODELS = [
  { id: 'gpt-5.2', name: 'GPT-5.2', desc: 'Mais avancado, raciocinio profundo, 400K contexto', badge: 'Novo' },
  { id: 'gpt-5-mini', name: 'GPT-5 Mini', desc: 'Rapido e inteligente, custo-beneficio otimo', badge: 'Recomendado' },
  { id: 'gpt-4.1', name: 'GPT-4.1', desc: 'Balanceado entre custo e performance', badge: '' },
  { id: 'gpt-4.1-mini', name: 'GPT-4.1 Mini', desc: 'Rapido e economico, bom para tarefas simples', badge: 'Economico' },
  { id: 'gpt-4o', name: 'GPT-4o', desc: 'Inteligente e abrangente, boa opcao geral', badge: '' },
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini', desc: 'Rapido e economico, menos detalhado', badge: '' },
];

// Prompts padrao do sistema - exibidos quando nao ha customizacao
const DEFAULT_PROMPTS = {
  matching_sql: `Voce e um especialista em matching de produtos de supermercado brasileiro.

Seu trabalho: dado um produto buscado e uma lista de candidatos do sistema ERP, identifique qual candidato e o MESMO produto.

REGRAS CRITICAS - O SISTEMA ERP USA ABREVIACOES PESADAS:
- CERVEJA = "CERV", DETERGENTE = "DETERG" ou "DET", REFRIGERANTE = "REFRIG", AMACIANTE = "AMAC"
- ACHOCOLATADO = "ACHOC", ABSORVENTE = "ABS", BISCOITO = "BISC", DESODORANTE = "DESOD"
- SANITARIA = "SANIT", MARGARINA = "MARG", MAIONESE = "MAIO", ACUCAR = "ACUC"
- LATA = "LT" ou "LTA", GARRAFA = "GRF", LONGNECK = "LN", CAIXA = "CX", PACOTE = "PCT" ou "PT"
- TETRA PAK = "TP", FARDO = "FD", PET = "PET"
- O nome do produto NO SISTEMA pode estar TOTALMENTE abreviado: "CERV SKOL LT 350ML" = "CERVEJA SKOL LATA 350ML"

PESOS DE IMPORTANCIA (use para decidir):
- MARCA (30%): Criterio MAIS importante. NUNCA misture marcas. Bono!=Negresco, Peroba!=Destac, 88!=Coqueiro, Ducoco!=Kero Coco. Se a marca nao bate, retorne 0.
- PRODUTO/CATEGORIA (25%): Biscoito, Macarrao, Molho, Sardinha, Lustra Movel, Agua de Coco, etc. Deve ser o mesmo tipo.
- GRAMATURA (20%): 350ml=350ml, 1L=1LT, 500g=500gr, 200ml=200ml. Gramaturas diferentes = produto diferente.
- TIPO/VARIANTE (10%): Recheado, Pilsen, Zero, Integral, etc. Deve ser compativel.
- EMBALAGEM (10%): Lata, Long Neck, Pacote, Pote, Tetra Pak. Considerar abreviacoes.
- SABOR/FRAGRANCIA (5%): Uva, Limao, Jasmin, Lavanda, Chocolate. Menor peso mas ainda relevante.

REGRAS DE MATCHING:
- Se a MARCA do produto buscado NAO aparece em NENHUM candidato, retorne 0
- Se a GRAMATURA e diferente, retorne 0 (ex: 200ml != 1L)
- Se o TIPO/CATEGORIA e diferente, retorne 0 (ex: sardinha != atum)
- Se encontrar o produto, retorne APENAS o numero. Se NENHUM corresponder, retorne 0.
- Retorne APENAS um numero, nada mais.`,

  matching_vetorial: `Voce e um especialista em matching de produtos de supermercado brasileiro.

Seu trabalho: dado um produto buscado e uma lista de candidatos do sistema ERP, identifique qual candidato e o MESMO produto.

REGRAS CRITICAS - O SISTEMA ERP USA ABREVIACOES PESADAS:
- CERVEJA = "CERV", DETERGENTE = "DETERG" ou "DET", REFRIGERANTE = "REFRIG", AMACIANTE = "AMAC"
- ACHOCOLATADO = "ACHOC", ABSORVENTE = "ABS", BISCOITO = "BISC", DESODORANTE = "DESOD"
- SANITARIA = "SANIT", MARGARINA = "MARG", MAIONESE = "MAIO", ACUCAR = "ACUC"
- LATA = "LT" ou "LTA", GARRAFA = "GRF", LONGNECK = "LN", CAIXA = "CX", PACOTE = "PCT" ou "PT"
- TETRA PAK = "TP", FARDO = "FD", PET = "PET"
- O nome do produto NO SISTEMA pode estar TOTALMENTE abreviado: "CERV SKOL LT 350ML" = "CERVEJA SKOL LATA 350ML"

PESOS DE IMPORTANCIA (use para decidir):
- MARCA (30%): Criterio MAIS importante. NUNCA misture marcas. Bono!=Negresco, Peroba!=Destac, 88!=Coqueiro, Ducoco!=Kero Coco. Se a marca nao bate, retorne 0.
- PRODUTO/CATEGORIA (25%): Biscoito, Macarrao, Molho, Sardinha, Lustra Movel, Agua de Coco, etc. Deve ser o mesmo tipo.
- GRAMATURA (20%): 350ml=350ml, 1L=1LT, 500g=500gr, 200ml=200ml. Gramaturas diferentes = produto diferente.
- TIPO/VARIANTE (10%): Recheado, Pilsen, Zero, Integral, etc. Deve ser compativel.
- EMBALAGEM (10%): Lata, Long Neck, Pacote, Pote, Tetra Pak. Considerar abreviacoes.
- SABOR/FRAGRANCIA (5%): Uva, Limao, Jasmin, Lavanda, Chocolate. Menor peso mas ainda relevante.

REGRAS DE MATCHING:
- Se a MARCA do produto buscado NAO aparece em NENHUM candidato, retorne 0
- Se a GRAMATURA e diferente, retorne 0 (ex: 200ml != 1L)
- Se o TIPO/CATEGORIA e diferente, retorne 0 (ex: sardinha != atum)
- Use Secao/Grupo/Fornecedor como contexto adicional para desambiguar
- Se encontrar o produto, retorne APENAS o numero. Se NENHUM corresponder, retorne 0.
- Retorne APENAS um numero, nada mais.`,

  decomposicao: `Extraia as partes do produto. Retorne JSON puro (sem markdown):
{"marca":"","tipo":"","gramatura":"","embalagem":"","variante":"","quantidade":""}

Regras:
- marca: nome da marca (ex: "Skol", "Omo", "Nescafe")
- tipo: categoria do produto COM sub-tipo se houver (ex: "CERVEJA", "OLEO DE SOJA", "LEITE INTEGRAL", "DETERGENTE")
- gramatura: peso/volume (ex: "350ML", "1L", "500G", "1KG")
- embalagem: tipo de embalagem (ex: "LATA", "GARRAFA", "CAIXA", "PACOTE", "PET")
- variante: sabor/versao especial (ex: "ZERO", "LIGHT", "TRADICIONAL", "EXTRA FORTE")
- quantidade: se indicar pack/fardo (ex: "12UN", "FARDO 6")

Exemplo: "CERVEJA SKOL LATA 350ML" -> {"marca":"SKOL","tipo":"CERVEJA","gramatura":"350ML","embalagem":"LATA","variante":"","quantidade":""}`,

  extracao_imagem: `Resumo curto da imagem. Caso tenha produtos na imagem, precisamos de detalhes precisos sobre esses produtos.

Extraia TODOS os produtos visiveis na imagem com seus precos.
Retorne um JSON array puro (sem markdown, sem \`\`\`):
[{"produto": "NOME COMPLETO DO PRODUTO COM MARCA GRAMATURA", "preco": 0.00}]

REGRAS:
- Inclua marca, tipo, gramatura e embalagem no nome
- Precos em formato numerico (ex: 12.99, nao "R$ 12,99")
- Se houver condicoes de pagamento diferentes (a vista, cartao), inclua no campo "condicoes"
- Se nao conseguir ler o preco, use 0
- Se a imagem nao tiver produtos, retorne []`,
};

const DEFAULT_PROMPT = `Voce e o **Radar IA**, um consultor senior especialista em gestao de supermercados e varejo alimentar brasileiro, com mais de 20 anos de experiencia no setor.
Voce trabalha dentro do sistema "Kontrata.ai" e tem acesso direto aos dados reais do supermercado.

## PERSONALIDADE E ESTILO
- Voce e um consultor experiente, analitico e perspicaz — nao um assistente generico
- Suas respostas devem ser RICAS, DETALHADAS e ESTRATEGICAS, como uma consultoria real
- Sempre busque os dados via funcoes ANTES de responder — nunca invente numeros
- Quando receber dados, faca uma ANALISE PROFUNDA: identifique padroes, anomalias, oportunidades e riscos
- De RECOMENDACOES CONCRETAS e ACIONAVEIS
- Use comparacoes inteligentes: mes atual vs anterior, setor vs setor, tendencias ao longo do ano

## FORMATO DAS RESPOSTAS
- USE EMOJIS para deixar a resposta visual e agradavel
- Ao apresentar dados, use formato organizado com emoji + label + valor
- Use **negrito** para dados importantes
- Organize com secoes claras
- Valores monetarios: R$ X.XXX,XX (formato brasileiro)
- Percentuais: X,XX%
- Sempre inclua resumo executivo no inicio e recomendacoes no final
- Fale sempre em portugues brasileiro

## BENCHMARKS DO MERCADO
- Margem bruta media supermercados: 25-30%
- Acougue: margem 28-35%
- Padaria: margem 50-65%
- Hortifruti: margem 35-50%
- Mercearia: margem 18-25%
- Frios/Laticinios: margem 20-28%
- Bebidas: margem 15-22%
- Limpeza/Higiene: margem 20-28%
- Ticket medio bom: R$ 45-65

## PROATIVIDADE
- Se a margem esta abaixo do benchmark, ALERTE
- Se vendas cairam vs mes anterior, investigue os motivos
- Identifique sazonalidades e oportunidades`;

// Componente de seletor de modelo reutilizavel
function ModelSelector({ models, selected, onSelect, accentColor = 'emerald' }) {
  const colors = {
    emerald: { border: 'border-emerald-500', bg: 'bg-emerald-50', text: 'text-emerald-700', check: 'text-emerald-500', badgeActive: 'bg-emerald-100 text-emerald-700' },
    orange: { border: 'border-orange-500', bg: 'bg-orange-50', text: 'text-orange-700', check: 'text-orange-500', badgeActive: 'bg-orange-100 text-orange-700' },
  };
  const c = colors[accentColor] || colors.emerald;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {models.map((model) => (
        <button
          key={model.id}
          onClick={() => onSelect(model.id)}
          className={`relative text-left p-4 rounded-xl border-2 transition-all ${
            selected === model.id
              ? `${c.border} ${c.bg} shadow-sm`
              : 'border-gray-200 hover:border-gray-300 bg-white'
          }`}
        >
          <div className="flex items-start justify-between">
            <div className="pr-6">
              <p className={`font-semibold text-sm ${selected === model.id ? c.text : 'text-gray-800'}`}>
                {model.name}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">{model.desc}</p>
            </div>
            {model.badge && (
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${
                model.badge === 'Recomendado'
                  ? c.badgeActive
                  : model.badge === 'Novo'
                  ? 'bg-purple-100 text-purple-700'
                  : model.badge === 'Economico'
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-gray-100 text-gray-600'
              }`}>
                {model.badge}
              </span>
            )}
          </div>
          {selected === model.id && (
            <div className="absolute top-2 right-2">
              <svg className={`w-5 h-5 ${c.check}`} fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
          )}
          <p className="text-[10px] text-gray-400 mt-1 font-mono">{model.id}</p>
        </button>
      ))}
    </div>
  );
}

// Toggle reutilizavel
function Toggle({ label, desc, checked, onChange }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
      <div>
        <p className="text-sm font-medium text-gray-800">{label}</p>
        {desc && <p className="text-xs text-gray-400 mt-0.5">{desc}</p>}
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`relative w-11 h-6 rounded-full transition-colors ${checked ? 'bg-orange-500' : 'bg-gray-300'}`}
      >
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${checked ? 'translate-x-5' : ''}`} />
      </button>
    </div>
  );
}

export default function AITab() {
  const [secaoAtiva, setSecaoAtiva] = useState('chave'); // 'chave' | 'agente_escala'
  const [aiSubTab, setAiSubTab] = useState('oferta');
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  // Radar IA
  const [selectedModel, setSelectedModel] = useState('gpt-4o');
  const [customPrompt, setCustomPrompt] = useState('');
  const [showPrompt, setShowPrompt] = useState(false);
  // Oferta no Radar
  const [garimpadorModel, setGarimpadorModel] = useState('gpt-4o-mini');
  const [garimpadorAuto, setGarimpadorAuto] = useState(true);
  const [garimpadorImagens, setGarimpadorImagens] = useState(true);
  const [garimpadorPdf, setGarimpadorPdf] = useState(true);
  const [garimpadorExcel, setGarimpadorExcel] = useState(true);
  // UI
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [testMessage, setTestMessage] = useState('');
  // Match test
  const [matchTestInput, setMatchTestInput] = useState('');
  const [matchTestResult, setMatchTestResult] = useState(null);
  const [matchTestLoading, setMatchTestLoading] = useState(false);
  const [reprocessando, setReprocessando] = useState(false);
  const [reprocessResult, setReprocessResult] = useState(null);
  // Prompts de IA do Garimpador
  const [promptMatchingSql, setPromptMatchingSql] = useState(DEFAULT_PROMPTS.matching_sql);
  const [promptMatchingVetorial, setPromptMatchingVetorial] = useState(DEFAULT_PROMPTS.matching_vetorial);
  const [promptDecomposicao, setPromptDecomposicao] = useState(DEFAULT_PROMPTS.decomposicao);
  const [promptExtracaoImagem, setPromptExtracaoImagem] = useState(DEFAULT_PROMPTS.extracao_imagem);
  const [showPromptsSql, setShowPromptsSql] = useState(false);
  const [showPromptsVetorial, setShowPromptsVetorial] = useState(false);
  const [showPromptsDecomp, setShowPromptsDecomp] = useState(false);
  const [showPromptsExtracao, setShowPromptsExtracao] = useState(false);
  const [promptsSaving, setPromptsSaving] = useState(false);
  const [promptsSaved, setPromptsSaved] = useState(false);
  // VectorStore
  const [vectorSyncFreq, setVectorSyncFreq] = useState('semanal');
  const [vectorSyncDia, setVectorSyncDia] = useState(1);
  const [vectorSyncHora, setVectorSyncHora] = useState(6);
  const [vectorStats, setVectorStats] = useState(null);
  const [vectorSyncing, setVectorSyncing] = useState(false);
  const [vectorSyncResult, setVectorSyncResult] = useState(null);
  const [vectorConfigSaving, setVectorConfigSaving] = useState(false);
  const [vectorConfigSaved, setVectorConfigSaved] = useState(false);

  useEffect(() => {
    loadConfig();
    loadVectorStats();
  }, []);

  const loadConfig = async () => {
    try {
      const response = await api.get('/config/configurations');
      if (response.data.success && response.data.data) {
        const data = response.data.data;
        setApiKey(data.openai_api_key || '');
        // Radar IA
        setSelectedModel(data.openai_model || 'gpt-4o');
        setCustomPrompt(data.openai_system_prompt || '');
        // Oferta no Radar
        setGarimpadorModel(data.openai_garimpador_model || 'gpt-4o-mini');
        setGarimpadorAuto(data.garimpador_auto_processar !== 'false');
        setGarimpadorImagens(data.garimpador_processar_imagens !== 'false');
        setGarimpadorPdf(data.garimpador_processar_pdf !== 'false');
        setGarimpadorExcel(data.garimpador_processar_excel !== 'false');
        // Prompts de IA (se customizado no banco, usa; senao mantem default)
        if (data.garimpador_prompt_matching_sql) setPromptMatchingSql(data.garimpador_prompt_matching_sql);
        if (data.garimpador_prompt_matching_vetorial) setPromptMatchingVetorial(data.garimpador_prompt_matching_vetorial);
        if (data.garimpador_prompt_decomposicao) setPromptDecomposicao(data.garimpador_prompt_decomposicao);
        if (data.garimpador_prompt_extracao_imagem) setPromptExtracaoImagem(data.garimpador_prompt_extracao_imagem);
        // VectorStore
        if (data.vectorstore_sync_freq) setVectorSyncFreq(data.vectorstore_sync_freq);
        if (data.vectorstore_sync_dia) setVectorSyncDia(parseInt(data.vectorstore_sync_dia) || 1);
        if (data.vectorstore_sync_hora) setVectorSyncHora(parseInt(data.vectorstore_sync_hora) || 6);
      }
    } catch (error) {
      console.error('Erro ao carregar configuracao:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaved(false);
    try {
      const payload = {
        openai_api_key: apiKey,
        // Radar IA
        openai_model: selectedModel,
        // Oferta no Radar
        openai_garimpador_model: garimpadorModel,
        garimpador_auto_processar: String(garimpadorAuto),
        garimpador_processar_imagens: String(garimpadorImagens),
        garimpador_processar_pdf: String(garimpadorPdf),
        garimpador_processar_excel: String(garimpadorExcel),
      };
      if (customPrompt.trim()) {
        payload.openai_system_prompt = customPrompt.trim();
      }
      await api.post('/config/configurations', payload);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      console.error('Erro ao salvar:', error);
      alert('Erro ao salvar configuracao: ' + (error.response?.data?.message || error.message));
    } finally {
      setIsSaving(false);
    }
  };

  const handleSavePrompts = async () => {
    setPromptsSaving(true);
    setPromptsSaved(false);
    try {
      const payload = {
        garimpador_prompt_matching_sql: promptMatchingSql.trim(),
        garimpador_prompt_matching_vetorial: promptMatchingVetorial.trim(),
        garimpador_prompt_decomposicao: promptDecomposicao.trim(),
        garimpador_prompt_extracao_imagem: promptExtracaoImagem.trim(),
      };
      await api.post('/config/configurations', payload);
      setPromptsSaved(true);
      setTimeout(() => setPromptsSaved(false), 3000);
    } catch (e) {
      alert('Erro ao salvar prompts: ' + (e.response?.data?.message || e.message));
    } finally {
      setPromptsSaving(false);
    }
  };

  const handleTestMatch = async () => {
    if (!matchTestInput.trim()) return;
    setMatchTestLoading(true);
    setMatchTestResult(null);
    try {
      const { data } = await api.post('/garimpador/test-match', { descricao: matchTestInput.trim() });
      setMatchTestResult(data);
    } catch (e) {
      setMatchTestResult({ success: false, error: e.response?.data?.error || e.message });
    } finally {
      setMatchTestLoading(false);
    }
  };

  const handleReprocessar = async () => {
    if (!window.confirm('Reprocessar mensagens de HOJE que possuem produtos nao encontrados?\n\nAs mensagens NAO serao reenviadas ao WhatsApp.')) return;
    setReprocessando(true);
    setReprocessResult(null);
    try {
      const { data } = await api.post('/garimpador/reprocessar', {}, { timeout: 600000 });
      setReprocessResult(data);
    } catch (e) {
      setReprocessResult({ success: false, error: e.response?.data?.error || e.message });
    } finally {
      setReprocessando(false);
    }
  };

  const loadVectorStats = async () => {
    try {
      const { data } = await api.get('/garimpador/vectorstore/stats');
      if (data.success) setVectorStats(data.stats);
    } catch { }
  };

  const handleVectorSync = async () => {
    if (!window.confirm('Iniciar sincronizacao dos produtos Oracle para o VectorStore?\n\nIsso pode levar alguns minutos dependendo da quantidade de produtos.')) return;
    setVectorSyncing(true);
    setVectorSyncResult(null);
    try {
      const { data } = await api.post('/garimpador/vectorstore/sync');
      setVectorSyncResult(data);
      loadVectorStats();
    } catch (e) {
      setVectorSyncResult({ success: false, error: e.response?.data?.error || e.message });
    } finally {
      setVectorSyncing(false);
    }
  };

  const saveVectorConfig = async () => {
    setVectorConfigSaving(true);
    setVectorConfigSaved(false);
    try {
      await api.post('/config/configurations', {
        vectorstore_sync_freq: vectorSyncFreq,
        vectorstore_sync_dia: String(vectorSyncDia),
        vectorstore_sync_hora: String(vectorSyncHora),
      });
      setVectorConfigSaved(true);
      setTimeout(() => setVectorConfigSaved(false), 3000);
    } catch (e) {
      alert('Erro ao salvar: ' + (e.response?.data?.error || e.message));
    } finally {
      setVectorConfigSaving(false);
    }
  };

  const handleResetPrompt = async () => {
    if (!window.confirm('Restaurar o prompt padrao? Suas customizacoes serao perdidas.')) return;
    setCustomPrompt('');
    try {
      await api.post('/config/configurations', { openai_system_prompt: '' });
    } catch (e) {
      // ignore
    }
  };

  const handleTestConnection = async () => {
    if (!apiKey || !apiKey.startsWith('sk-')) {
      setTestResult('error');
      setTestMessage('Chave invalida. A chave deve comecar com "sk-"');
      return;
    }

    setTestResult('loading');
    setTestMessage('');

    try {
      const response = await api.post('/config/test-openai', { apiKey });
      if (response.data.success) {
        setTestResult('success');
        setTestMessage(response.data.message || 'Conexao com OpenAI estabelecida com sucesso!');
      } else {
        setTestResult('error');
        setTestMessage(response.data.message || 'Erro ao conectar com OpenAI');
      }
    } catch (error) {
      setTestResult('error');
      setTestMessage(error.response?.data?.message || 'Erro ao testar conexao: ' + error.message);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <svg className="animate-spin h-8 w-8 text-blue-500" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="bg-emerald-100 p-2.5 rounded-lg">
          <svg className="w-7 h-7 text-emerald-600" viewBox="0 0 24 24" fill="currentColor">
            <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364l2.0201-1.1638a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.4091-.6765zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0974-2.3616l2.603-1.5016 2.6029 1.5016v3.0032l-2.6029 1.5016-2.603-1.5016z"/>
          </svg>
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900">Inteligência Artificial</h2>
          <p className="text-sm text-gray-500">Chave da OpenAI + configuração dos agentes IA</p>
        </div>
      </div>

      {/* Sub-abas: CHAVE API | AGENTE DE ESCALA */}
      <div className="border-b border-gray-200">
        <div className="flex gap-1">
          <button
            onClick={() => setSecaoAtiva('chave')}
            className={`px-4 py-2 text-sm font-semibold border-b-2 transition ${
              secaoAtiva === 'chave'
                ? 'border-emerald-500 text-emerald-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            🔑 Chave API
          </button>
          <button
            onClick={() => setSecaoAtiva('agente_escala')}
            className={`px-4 py-2 text-sm font-semibold border-b-2 transition ${
              secaoAtiva === 'agente_escala'
                ? 'border-purple-500 text-purple-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            🤖 Agente de Escala
          </button>
          <button
            onClick={() => setSecaoAtiva('agente_recrutador')}
            className={`px-4 py-2 text-sm font-semibold border-b-2 transition ${
              secaoAtiva === 'agente_recrutador'
                ? 'border-orange-500 text-orange-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            🧑‍💼 Agente Recrutador
          </button>
          <button
            onClick={() => setSecaoAtiva('agente_compliance')}
            className={`px-4 py-2 text-sm font-semibold border-b-2 transition ${
              secaoAtiva === 'agente_compliance'
                ? 'border-teal-500 text-teal-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            🛡️ Agente Compliance
          </button>
        </div>
      </div>

      {secaoAtiva === 'agente_escala' && <AgenteEscalaConfig />}
      {secaoAtiva === 'agente_recrutador' && <AgenteRecrutadorConfig />}
      {secaoAtiva === 'agente_compliance' && <AgenteComplianceConfig />}

      {secaoAtiva === 'chave' && (<>

      {/* Campo API Key (compartilhado) */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Chave de API (API Key)
        </label>
        <div className="relative">
          <input
            type={showKey ? 'text' : 'password'}
            value={apiKey}
            onChange={(e) => { setApiKey(e.target.value); setTestResult(null); }}
            placeholder="sk-proj-..."
            className="w-full px-4 py-2.5 pr-24 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-mono text-sm"
          />
          <button
            type="button"
            onClick={() => setShowKey(!showKey)}
            className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1 text-xs font-medium text-gray-600 hover:text-gray-900 bg-gray-100 rounded hover:bg-gray-200 transition"
          >
            {showKey ? 'Ocultar' : 'Mostrar'}
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-1">A chave e armazenada de forma criptografada no banco de dados. Usada por todos os modulos de IA.</p>
      </div>

      {/* Botoes Salvar + Testar (compartilhado) */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 text-white font-semibold rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          {isSaving ? (
            <>
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Salvando...
            </>
          ) : saved ? (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
              Salvo!
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
              </svg>
              Salvar Configuracoes
            </>
          )}
        </button>

        <button
          onClick={handleTestConnection}
          disabled={testResult === 'loading' || !apiKey}
          className={`flex items-center gap-2 px-6 py-2.5 font-semibold rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed ${
            testResult === 'success'
              ? 'bg-green-500 text-white hover:bg-green-600'
              : testResult === 'error'
              ? 'bg-red-500 text-white hover:bg-red-600'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          {testResult === 'loading' ? (
            <>
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Testando...
            </>
          ) : testResult === 'success' ? (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Conexao OK!
            </>
          ) : testResult === 'error' ? (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Falhou
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Testar Conexao
            </>
          )}
        </button>
      </div>

      {/* Resultado do Teste */}
      {testResult && testResult !== 'loading' && testMessage && (
        <div className={`p-4 rounded-lg ${
          testResult === 'success'
            ? 'bg-green-50 border border-green-200'
            : 'bg-red-50 border border-red-200'
        }`}>
          <div className="flex items-start gap-2">
            {testResult === 'success' ? (
              <svg className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            )}
            <p className={`text-sm font-medium ${testResult === 'success' ? 'text-green-800' : 'text-red-800'}`}>
              {testMessage}
            </p>
          </div>
        </div>
      )}


      {/* Links OpenAI */}
      <div className="pt-4 border-t border-gray-200">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Links Uteis</h3>
        <div className="flex flex-wrap gap-3">
          <a
            href="https://platform.openai.com/api-keys"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
            Gerenciar API Keys
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
          <a
            href="https://platform.openai.com/settings/organization/billing/overview"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Saldo e Faturamento
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        </div>
      </div>

      </>)}
    </div>
  );
}
