import { useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Sidebar from '../components/Sidebar';
import { api } from '../utils/api';
import toast from 'react-hot-toast';

// Barra de tabs compartilhada entre Avaliacao e Resultados
function DiscTabs() {
  const nav = useNavigate();
  const loc = useLocation();
  const isResults = loc.pathname.includes('/resultados');
  const tabBase = 'px-5 py-2.5 text-sm font-semibold border-b-2 transition cursor-pointer';
  const active = 'border-orange-500 text-orange-600';
  const inactive = 'border-transparent text-gray-500 hover:text-gray-800';
  return (
    <div className="bg-white border-b border-gray-200 px-6 flex gap-1 print:hidden">
      <button onClick={() => nav('/rh/metodo-disc')} className={`${tabBase} ${!isResults ? active : inactive}`}>
        📋 Método DISC
      </button>
      <button onClick={() => nav('/rh/metodo-disc/resultados')} className={`${tabBase} ${isResults ? active : inactive}`}>
        📊 Resultados DISC
      </button>
    </div>
  );
}
export { DiscTabs };

// 18 grupos selecionados — adjetivos mais comuns e claros, removidos os
// menos discriminativos (Autoritario, Dominador, Impulsivo, Audacioso,
// Intenso, Contagiante) por ambiguidade lexical no português brasileiro.
export const DISC_GROUPS = [
  { id: 1, options: [
    { text: 'Determinado', profile: 'D' },
    { text: 'Entusiasmado', profile: 'I' },
    { text: 'Paciente', profile: 'S' },
    { text: 'Cuidadoso', profile: 'C' },
  ]},
  { id: 2, options: [
    { text: 'Competitivo', profile: 'D' },
    { text: 'Alegre', profile: 'I' },
    { text: 'Leal', profile: 'S' },
    { text: 'Analitico', profile: 'C' },
  ]},
  { id: 3, options: [
    { text: 'Ousado', profile: 'D' },
    { text: 'Comunicativo', profile: 'I' },
    { text: 'Calmo', profile: 'S' },
    { text: 'Preciso', profile: 'C' },
  ]},
  { id: 4, options: [
    { text: 'Decidido', profile: 'D' },
    { text: 'Convincente', profile: 'I' },
    { text: 'Atencioso', profile: 'S' },
    { text: 'Perfeccionista', profile: 'C' },
  ]},
  { id: 5, options: [
    { text: 'Direto', profile: 'D' },
    { text: 'Otimista', profile: 'I' },
    { text: 'Tolerante', profile: 'S' },
    { text: 'Sistematico', profile: 'C' },
  ]},
  { id: 6, options: [
    { text: 'Independente', profile: 'D' },
    { text: 'Sociavel', profile: 'I' },
    { text: 'Gentil', profile: 'S' },
    { text: 'Organizado', profile: 'C' },
  ]},
  { id: 7, options: [
    { text: 'Assertivo', profile: 'D' },
    { text: 'Expressivo', profile: 'I' },
    { text: 'Estavel', profile: 'S' },
    { text: 'Detalhista', profile: 'C' },
  ]},
  { id: 8, options: [
    { text: 'Corajoso', profile: 'D' },
    { text: 'Inspirador', profile: 'I' },
    { text: 'Confiavel', profile: 'S' },
    { text: 'Diplomatico', profile: 'C' },
  ]},
  { id: 9, options: [
    { text: 'Arrojado', profile: 'D' },
    { text: 'Popular', profile: 'I' },
    { text: 'Moderado', profile: 'S' },
    { text: 'Disciplinado', profile: 'C' },
  ]},
  { id: 10, options: [
    { text: 'Exigente', profile: 'D' },
    { text: 'Animado', profile: 'I' },
    { text: 'Generoso', profile: 'S' },
    { text: 'Reservado', profile: 'C' },
  ]},
  { id: 11, options: [
    { text: 'Aventureiro', profile: 'D' },
    { text: 'Divertido', profile: 'I' },
    { text: 'Acolhedor', profile: 'S' },
    { text: 'Meticuloso', profile: 'C' },
  ]},
  { id: 12, options: [
    { text: 'Firme', profile: 'D' },
    { text: 'Motivador', profile: 'I' },
    { text: 'Pacificador', profile: 'S' },
    { text: 'Logico', profile: 'C' },
  ]},
  { id: 13, options: [
    { text: 'Destemido', profile: 'D' },
    { text: 'Espontaneo', profile: 'I' },
    { text: 'Dedicado', profile: 'S' },
    { text: 'Objetivo', profile: 'C' },
  ]},
  { id: 14, options: [
    { text: 'Autoconfiante', profile: 'D' },
    { text: 'Encantador', profile: 'I' },
    { text: 'Receptivo', profile: 'S' },
    { text: 'Pontual', profile: 'C' },
  ]},
  { id: 15, options: [
    { text: 'Desafiador', profile: 'D' },
    { text: 'Criativo', profile: 'I' },
    { text: 'Harmonioso', profile: 'S' },
    { text: 'Exato', profile: 'C' },
  ]},
  { id: 16, options: [
    { text: 'Pioneiro', profile: 'D' },
    { text: 'Influenciador', profile: 'I' },
    { text: 'Previsivel', profile: 'S' },
    { text: 'Prudente', profile: 'C' },
  ]},
  { id: 17, options: [
    { text: 'Empreendedor', profile: 'D' },
    { text: 'Carismatico', profile: 'I' },
    { text: 'Solidario', profile: 'S' },
    { text: 'Estrategico', profile: 'C' },
  ]},
  { id: 18, options: [
    { text: 'Persistente', profile: 'D' },
    { text: 'Envolvente', profile: 'I' },
    { text: 'Constante', profile: 'S' },
    { text: 'Reflexivo', profile: 'C' },
  ]},
];

const PROFILE_INFO = {
  D: {
    name: 'Dominante',
    color: 'red',
    bgColor: 'bg-red-500',
    textColor: 'text-red-600',
    borderColor: 'border-red-500',
    lightBg: 'bg-red-50',
    description: 'Voce e uma pessoa orientada a resultados, decidida e competitiva. Gosta de desafios e de ter controle sobre as situacoes. Toma decisoes rapidas e nao tem medo de assumir riscos. Em equipe, tende a liderar e buscar eficiencia. Pontos fortes: determinacao, foco em resultados, capacidade de decisao. Pontos a desenvolver: paciencia, ouvir mais os outros, delegar tarefas.',
  },
  I: {
    name: 'Influente',
    color: 'yellow',
    bgColor: 'bg-yellow-500',
    textColor: 'text-yellow-600',
    borderColor: 'border-yellow-500',
    lightBg: 'bg-yellow-50',
    description: 'Voce e uma pessoa comunicativa, entusiasmada e otimista. Valoriza relacionamentos e gosta de trabalhar em equipe. E persuasivo e sabe motivar as pessoas ao seu redor. Em equipe, traz energia e criatividade. Pontos fortes: comunicacao, carisma, capacidade de motivar. Pontos a desenvolver: foco em detalhes, organizacao, cumprir prazos.',
  },
  S: {
    name: 'Estavel',
    color: 'green',
    bgColor: 'bg-green-500',
    textColor: 'text-green-600',
    borderColor: 'border-green-500',
    lightBg: 'bg-green-50',
    description: 'Voce e uma pessoa calma, paciente e leal. Valoriza seguranca e estabilidade. E um excelente ouvinte e busca harmonia no ambiente de trabalho. Em equipe, e o pilar que mantem todos unidos. Pontos fortes: confiabilidade, paciencia, trabalho em equipe. Pontos a desenvolver: adaptacao a mudancas, assertividade, tomada de decisao rapida.',
  },
  C: {
    name: 'Conforme',
    color: 'blue',
    bgColor: 'bg-blue-500',
    textColor: 'text-blue-600',
    borderColor: 'border-blue-500',
    lightBg: 'bg-blue-50',
    description: 'Voce e uma pessoa analitica, detalhista e perfeccionista. Valoriza qualidade, precisao e segue regras e procedimentos rigorosamente. Em equipe, garante que o trabalho seja feito com excelencia. Pontos fortes: atencao a detalhes, qualidade, pensamento analitico. Pontos a desenvolver: flexibilidade, aceitar imperfeicoes, velocidade nas entregas.',
  },
};

const COMBINATION_DESCRIPTIONS = {
  DI: 'Perfil Dominante-Influente: Voce combina a determinacao e foco em resultados com habilidades de comunicacao e persuasao. E um lider natural que sabe motivar e conduzir equipes para alcancarem metas ambiciosas.',
  DS: 'Perfil Dominante-Estavel: Voce combina assertividade com paciencia. E uma pessoa que busca resultados, mas sabe manter a calma e a constancia necessarias para projetos de longo prazo.',
  DC: 'Perfil Dominante-Conforme: Voce combina a busca por resultados com atencao aos detalhes. E uma pessoa que toma decisoes firmes, mas sempre baseadas em dados e analises cuidadosas.',
  ID: 'Perfil Influente-Dominante: Voce combina carisma e comunicacao com determinacao. E uma pessoa que inspira os outros enquanto mantem o foco em objetivos concretos.',
  IS: 'Perfil Influente-Estavel: Voce combina entusiasmo com estabilidade. E uma pessoa acolhedora que sabe criar ambientes positivos e relacoes duradouras no trabalho.',
  IC: 'Perfil Influente-Conforme: Voce combina criatividade e comunicacao com atencao aos detalhes. E uma pessoa que sabe apresentar ideias de forma convincente e bem fundamentada.',
  SD: 'Perfil Estavel-Dominante: Voce combina paciencia com determinacao. E uma pessoa confiavel que, quando necessario, sabe tomar a frente e liderar com firmeza.',
  SI: 'Perfil Estavel-Influente: Voce combina calma e lealdade com habilidades sociais. E uma pessoa que mantem a harmonia da equipe enquanto cultiva relacionamentos positivos.',
  SC: 'Perfil Estavel-Conforme: Voce combina estabilidade com perfeccionismo. E uma pessoa extremamente confiavel que entrega trabalhos de alta qualidade com consistencia.',
  CD: 'Perfil Conforme-Dominante: Voce combina pensamento analitico com assertividade. E uma pessoa que toma decisoes baseadas em fatos e nao tem medo de implementa-las com firmeza.',
  CI: 'Perfil Conforme-Influente: Voce combina atencao aos detalhes com habilidades de comunicacao. E uma pessoa que sabe explicar conceitos complexos de forma acessivel e envolvente.',
  CS: 'Perfil Conforme-Estavel: Voce combina perfeccionismo com paciencia. E uma pessoa meticulosa e confiavel que garante qualidade em tudo que faz, com calma e constancia.',
};

export default function RhMetodoDisc() {
  const { user, logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [step, setStep] = useState('info'); // 'info' | 'quiz' | 'results'
  const [nome, setNome] = useState('');
  const [currentGroup, setCurrentGroup] = useState(0);
  const [answers, setAnswers] = useState({}); // { groupId: { mais: optionIndex, menos: optionIndex } }
  const [scores, setScores] = useState(null);
  const [saving, setSaving] = useState(false);
  const resultsRef = useRef(null);

  const handleStart = () => {
    if (!nome.trim()) {
      toast.error('Por favor, informe o nome do colaborador/candidato');
      return;
    }
    setStep('quiz');
    setCurrentGroup(0);
    setAnswers({});
  };

  const handleSelect = (type, optionIndex) => {
    const groupId = DISC_GROUPS[currentGroup].id;
    const current = answers[groupId] || {};

    // Can't select same option for both
    if (type === 'mais' && current.menos === optionIndex) return;
    if (type === 'menos' && current.mais === optionIndex) return;

    setAnswers(prev => ({
      ...prev,
      [groupId]: { ...prev[groupId], [type]: optionIndex },
    }));
  };

  const currentAnswer = answers[DISC_GROUPS[currentGroup]?.id] || {};
  const canProceed = currentAnswer.mais !== undefined && currentAnswer.menos !== undefined;

  const handleNext = () => {
    if (!canProceed) {
      toast.error('Selecione uma opcao para MAIS e uma para MENOS');
      return;
    }
    if (currentGroup < DISC_GROUPS.length - 1) {
      setCurrentGroup(prev => prev + 1);
    } else {
      calculateResults();
    }
  };

  const handlePrev = () => {
    if (currentGroup > 0) {
      setCurrentGroup(prev => prev - 1);
    }
  };

  const calculateResults = () => {
    const totals = { D: 0, I: 0, S: 0, C: 0 };

    DISC_GROUPS.forEach(group => {
      const answer = answers[group.id];
      if (!answer) return;
      const maisProfile = group.options[answer.mais].profile;
      const menosProfile = group.options[answer.menos].profile;
      totals[maisProfile] += 1;
      totals[menosProfile] -= 1;
    });

    // Normalize: shift so minimum is 0, then convert to percentage of max possible
    const minVal = Math.min(totals.D, totals.I, totals.S, totals.C);
    const shifted = {
      D: totals.D - minVal,
      I: totals.I - minVal,
      S: totals.S - minVal,
      C: totals.C - minVal,
    };
    const maxVal = Math.max(shifted.D, shifted.I, shifted.S, shifted.C, 1);
    const percentages = {
      D: Math.round((shifted.D / maxVal) * 100),
      I: Math.round((shifted.I / maxVal) * 100),
      S: Math.round((shifted.S / maxVal) * 100),
      C: Math.round((shifted.C / maxVal) * 100),
    };

    setScores({ raw: totals, percentages });
    setStep('results');
  };

  const getSortedProfiles = () => {
    if (!scores) return [];
    const entries = Object.entries(scores.raw).map(([key, val]) => ({ key, val }));
    entries.sort((a, b) => b.val - a.val);
    return entries;
  };

  const getPrimaryProfile = () => getSortedProfiles()[0]?.key || 'D';
  const getSecondaryProfile = () => getSortedProfiles()[1]?.key || 'I';

  const handleSave = async () => {
    const primary = getPrimaryProfile();
    const secondary = getSecondaryProfile();
    try {
      setSaving(true);
      await api.post('/rh/disc-results', {
        nome: nome.trim(),
        scores: scores.raw,
        perfil_primario: primary,
        perfil_secundario: secondary,
        respostas: answers,
      });
      toast.success('Resultado salvo com sucesso!');
    } catch (err) {
      console.error('Erro ao salvar resultado DISC:', err);
      toast.error('Erro ao salvar resultado. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  const handleNewAssessment = () => {
    setStep('info');
    setNome('');
    setCurrentGroup(0);
    setAnswers({});
    setScores(null);
  };

  const handlePrint = () => {
    window.print();
  };

  // ==================== RENDER ====================

  const renderInfo = () => (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-xl shadow-lg p-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-orange-100 mb-4">
            <svg className="w-10 h-10 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Metodo DISC - Perfil Comportamental</h2>
          <p className="text-gray-500 text-sm">Avaliacao baseada na metodologia DISC de William Marston</p>

          {/* Link publico para candidato responder */}
          <div className="mt-5 bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-lg p-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="text-left">
                <div className="text-xs uppercase font-bold text-purple-700 mb-0.5">🔗 Link público pro candidato</div>
                <div className="text-sm text-gray-700">Envie esse link por WhatsApp pra ele responder sozinho (não precisa login):</div>
                <div className="font-mono text-xs text-purple-900 bg-white px-2 py-1 rounded border mt-1 inline-block select-all">
                  {typeof window !== 'undefined' ? `${window.location.origin}/disc` : '/disc'}
                </div>
              </div>
              <button
                onClick={() => {
                  const url = `${window.location.origin}/disc`;
                  navigator.clipboard.writeText(url)
                    .then(() => toast.success('Link copiado! Cole no WhatsApp do candidato.'))
                    .catch(() => toast.error('Não foi possível copiar — selecione e copie manualmente.'));
                }}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-semibold shadow">
                📋 Copiar Link
              </button>
            </div>
          </div>
        </div>

        <div className="bg-gray-50 rounded-lg p-6 mb-8">
          <h3 className="font-semibold text-gray-700 mb-3">O que e o DISC?</h3>
          <p className="text-gray-600 text-sm leading-relaxed mb-4">
            O DISC e uma ferramenta de avaliacao comportamental que identifica quatro dimensoes principais
            do comportamento humano: <strong className="text-red-600">Dominancia (D)</strong>,{' '}
            <strong className="text-yellow-600">Influencia (I)</strong>,{' '}
            <strong className="text-green-600">Estabilidade (S)</strong> e{' '}
            <strong className="text-blue-600">Conformidade (C)</strong>.
          </p>
          <p className="text-gray-600 text-sm leading-relaxed mb-4">
            Cada pessoa possui uma combinacao unica desses quatro fatores, formando seu perfil comportamental.
            Nao existem perfis melhores ou piores - cada um tem seus pontos fortes e areas de desenvolvimento.
          </p>
          <h3 className="font-semibold text-gray-700 mb-2">Como funciona?</h3>
          <ul className="text-gray-600 text-sm space-y-1 list-disc list-inside">
            <li>Sao 24 grupos de 4 palavras/adjetivos</li>
            <li>Em cada grupo, escolha a palavra que <strong>MAIS</strong> descreve voce</li>
            <li>E a palavra que <strong>MENOS</strong> descreve voce</li>
            <li>Responda de forma espontanea, sem pensar demais</li>
            <li>Tempo estimado: 10 a 15 minutos</li>
          </ul>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Nome do colaborador / candidato
          </label>
          <input
            type="text"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Digite o nome completo..."
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-gray-700"
            onKeyDown={(e) => e.key === 'Enter' && handleStart()}
          />
        </div>

        <button
          onClick={handleStart}
          className="w-full py-3 px-6 bg-orange-600 hover:bg-orange-700 text-white font-semibold rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2"
        >
          Iniciar Avaliacao
        </button>
      </div>
    </div>
  );

  const renderQuiz = () => {
    const group = DISC_GROUPS[currentGroup];
    const answer = answers[group.id] || {};
    const progress = ((currentGroup + 1) / DISC_GROUPS.length) * 100;

    return (
      <div className="max-w-2xl mx-auto">
        {/* Progress */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">Pergunta {currentGroup + 1} de {DISC_GROUPS.length}</span>
            <span className="text-sm font-medium text-orange-600">{Math.round(progress)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className="bg-orange-500 h-3 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Question Card */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          {/* Instrucao visual clara */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-300 rounded-xl p-4 mb-5">
            <h3 className="text-center font-extrabold text-blue-900 mb-3 text-base">
              📋 Como responder
            </h3>
            <div className="space-y-2 text-sm text-gray-800">
              <div className="flex items-start gap-2">
                <span className="bg-green-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold flex-shrink-0">1</span>
                <p>Olhe as <strong>4 palavras</strong> abaixo e escolha <strong className="text-green-700">apenas UMA</strong> que <strong className="text-green-700">MAIS combina</strong> com você → clique em <strong className="text-green-700">+MAIS</strong></p>
              </div>
              <div className="flex items-start gap-2">
                <span className="bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold flex-shrink-0">2</span>
                <p>Escolha <strong className="text-red-700">apenas UMA</strong> que <strong className="text-red-700">MENOS combina</strong> com você → clique em <strong className="text-red-700">-MENOS</strong></p>
              </div>
              <div className="flex items-start gap-2">
                <span className="bg-gray-400 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold flex-shrink-0">3</span>
                <p>As outras <strong>2 palavras</strong> ficam <strong>SEM marcação</strong>. ⚠️ <strong>Não marque tudo!</strong></p>
              </div>
            </div>
          </div>

          {/* Legend */}
          <div className="flex justify-center gap-6 mb-4">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded border-2 border-green-500 bg-green-50" />
              <span className="text-xs text-gray-600">1 palavra MAIS</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded border-2 border-red-500 bg-red-50" />
              <span className="text-xs text-gray-600">1 palavra MENOS</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded border-2 border-gray-300 bg-white" />
              <span className="text-xs text-gray-600">2 vazias</span>
            </div>
          </div>

          {/* Options */}
          <div className="space-y-3">
            {group.options.map((option, idx) => {
              const isMais = answer.mais === idx;
              const isMenos = answer.menos === idx;

              let cardClass = 'border-2 rounded-xl p-4 cursor-pointer transition-all duration-200 ';
              if (isMais) {
                cardClass += 'border-green-500 bg-green-50 shadow-md';
              } else if (isMenos) {
                cardClass += 'border-red-500 bg-red-50 shadow-md';
              } else {
                cardClass += 'border-gray-200 hover:border-gray-300 hover:shadow-sm bg-white';
              }

              return (
                <div key={idx} className={cardClass}>
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-medium text-gray-800">{option.text}</span>
                    <div className="flex gap-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleSelect('mais', idx); }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 ${
                          isMais
                            ? 'bg-green-500 text-white shadow-md scale-105'
                            : isMenos
                              ? 'bg-gray-100 text-gray-300 cursor-not-allowed'
                              : 'bg-green-100 text-green-700 hover:bg-green-200'
                        }`}
                        disabled={isMenos}
                      >
                        + MAIS
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleSelect('menos', idx); }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 ${
                          isMenos
                            ? 'bg-red-500 text-white shadow-md scale-105'
                            : isMais
                              ? 'bg-gray-100 text-gray-300 cursor-not-allowed'
                              : 'bg-red-100 text-red-700 hover:bg-red-200'
                        }`}
                        disabled={isMais}
                      >
                        - MENOS
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Navigation */}
        <div className="flex justify-between">
          <button
            onClick={handlePrev}
            disabled={currentGroup === 0}
            className={`px-6 py-3 rounded-lg font-semibold transition-colors duration-200 ${
              currentGroup === 0
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300 shadow-sm'
            }`}
          >
            Anterior
          </button>
          <button
            onClick={handleNext}
            disabled={!canProceed}
            className={`px-6 py-3 rounded-lg font-semibold transition-colors duration-200 ${
              canProceed
                ? 'bg-orange-600 hover:bg-orange-700 text-white shadow-md'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            {currentGroup === DISC_GROUPS.length - 1 ? 'Ver Resultado' : 'Proximo'}
          </button>
        </div>
      </div>
    );
  };

  const renderResults = () => {
    if (!scores) return null;

    const primary = getPrimaryProfile();
    const secondary = getSecondaryProfile();
    const primaryInfo = PROFILE_INFO[primary];
    const secondaryInfo = PROFILE_INFO[secondary];
    const comboKey = primary + secondary;
    const comboDesc = COMBINATION_DESCRIPTIONS[comboKey] || '';

    const profileOrder = ['D', 'I', 'S', 'C'];

    return (
      <div className="max-w-3xl mx-auto print:max-w-none" ref={resultsRef}>
        {/* Header card */}
        <div className="bg-white rounded-xl shadow-lg p-8 mb-6 print:shadow-none print:border">
          <div className="text-center mb-2">
            <h2 className="text-2xl font-bold text-gray-800">Resultado DISC</h2>
            <p className="text-gray-500">{nome}</p>
            <p className="text-gray-400 text-xs mt-1">
              {new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
            </p>
          </div>
        </div>

        {/* Primary profile badge */}
        <div className="bg-white rounded-xl shadow-lg p-8 mb-6 print:shadow-none print:border">
          <div className="flex flex-col items-center mb-8">
            <div className={`w-28 h-28 rounded-full ${primaryInfo.bgColor} flex items-center justify-center mb-4 shadow-lg`}>
              <span className="text-5xl font-bold text-white">{primary}</span>
            </div>
            <h3 className="text-xl font-bold text-gray-800">Perfil Primario: {primaryInfo.name}</h3>
            <div className="flex items-center gap-2 mt-2">
              <div className={`w-10 h-10 rounded-full ${secondaryInfo.bgColor} flex items-center justify-center shadow`}>
                <span className="text-lg font-bold text-white">{secondary}</span>
              </div>
              <span className="text-sm text-gray-500">Perfil Secundario: {secondaryInfo.name}</span>
            </div>
          </div>

          {/* Score bars */}
          <div className="space-y-4 mb-8">
            {profileOrder.map(key => {
              const info = PROFILE_INFO[key];
              const pct = scores.percentages[key];
              const raw = scores.raw[key];
              return (
                <div key={key}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-full ${info.bgColor} flex items-center justify-center`}>
                        <span className="text-sm font-bold text-white">{key}</span>
                      </div>
                      <span className="font-medium text-gray-700">{info.name}</span>
                    </div>
                    <span className="text-sm font-semibold text-gray-600">{pct}% <span className="text-xs text-gray-400">(raw: {raw})</span></span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-5">
                    <div
                      className={`${info.bgColor} h-5 rounded-full transition-all duration-1000 ease-out`}
                      style={{ width: `${Math.max(pct, 2)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Radar-like visual using CSS grid */}
          <div className="flex justify-center mb-8">
            <div className="relative w-64 h-64">
              {/* Background circles */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-64 h-64 rounded-full border border-gray-200" />
              </div>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-48 h-48 rounded-full border border-gray-200" />
              </div>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-32 h-32 rounded-full border border-gray-200" />
              </div>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-16 h-16 rounded-full border border-gray-200" />
              </div>
              {/* Cross lines */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-px h-64 bg-gray-200" />
              </div>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-64 h-px bg-gray-200" />
              </div>
              {/* D - top */}
              <div className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center"
                style={{ top: `${Math.max(4, 50 - (scores.percentages.D / 100 * 46))}%` }}>
                <div className="w-10 h-10 rounded-full bg-red-500 flex items-center justify-center shadow-lg border-2 border-white">
                  <span className="text-sm font-bold text-white">D</span>
                </div>
              </div>
              {/* I - right */}
              <div className="absolute top-1/2 -translate-y-1/2 flex items-center"
                style={{ left: `${Math.min(88, 50 + (scores.percentages.I / 100 * 46))}%` }}>
                <div className="w-10 h-10 rounded-full bg-yellow-500 flex items-center justify-center shadow-lg border-2 border-white">
                  <span className="text-sm font-bold text-white">I</span>
                </div>
              </div>
              {/* S - bottom */}
              <div className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center"
                style={{ top: `${Math.min(88, 50 + (scores.percentages.S / 100 * 46))}%` }}>
                <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center shadow-lg border-2 border-white">
                  <span className="text-sm font-bold text-white">S</span>
                </div>
              </div>
              {/* C - left */}
              <div className="absolute top-1/2 -translate-y-1/2 flex items-center"
                style={{ left: `${Math.max(4, 50 - (scores.percentages.C / 100 * 46))}%` }}>
                <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center shadow-lg border-2 border-white">
                  <span className="text-sm font-bold text-white">C</span>
                </div>
              </div>
              {/* Labels */}
              <span className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1 text-xs font-semibold text-red-500">Dominancia</span>
              <span className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1 text-xs font-semibold text-green-500">Estabilidade</span>
              <span className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1 text-xs font-semibold text-yellow-500">Influencia</span>
              <span className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1 text-xs font-semibold text-blue-500">Conformidade</span>
            </div>
          </div>
        </div>

        {/* Primary description */}
        <div className={`bg-white rounded-xl shadow-lg p-6 mb-6 border-l-4 ${primaryInfo.borderColor} print:shadow-none print:border`}>
          <h3 className={`text-lg font-bold ${primaryInfo.textColor} mb-3`}>
            Perfil Primario: {primary} - {primaryInfo.name}
          </h3>
          <p className="text-gray-700 leading-relaxed">{primaryInfo.description}</p>
        </div>

        {/* Secondary description */}
        <div className={`bg-white rounded-xl shadow-lg p-6 mb-6 border-l-4 ${secondaryInfo.borderColor} print:shadow-none print:border`}>
          <h3 className={`text-lg font-bold ${secondaryInfo.textColor} mb-3`}>
            Perfil Secundario: {secondary} - {secondaryInfo.name}
          </h3>
          <p className="text-gray-700 leading-relaxed">{secondaryInfo.description}</p>
        </div>

        {/* Combination */}
        {comboDesc && (
          <div className="bg-white rounded-xl shadow-lg p-6 mb-6 border-l-4 border-orange-500 print:shadow-none print:border">
            <h3 className="text-lg font-bold text-orange-600 mb-3">Combinacao de Perfis</h3>
            <p className="text-gray-700 leading-relaxed">{comboDesc}</p>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex flex-wrap gap-3 justify-center print:hidden">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-3 bg-orange-600 hover:bg-orange-700 text-white font-semibold rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
          >
            {saving ? 'Salvando...' : 'Salvar Resultado'}
          </button>
          <button
            onClick={handleNewAssessment}
            className="px-6 py-3 bg-white text-gray-700 font-semibold rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 shadow-sm"
          >
            Nova Avaliacao
          </button>
          <button
            onClick={handlePrint}
            className="px-6 py-3 bg-white text-gray-700 font-semibold rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 shadow-sm"
          >
            Imprimir
          </button>
        </div>
      </div>
    );
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
        <div className="bg-gradient-to-r from-purple-600 to-purple-500 text-white px-6 py-4 print:hidden">
          <h1 className="text-2xl font-bold">Metodo DISC</h1>
          <p className="text-orange-100 text-sm">Avaliacao de Perfil Comportamental</p>
        </div>

        {/* Tabs */}
        <DiscTabs />

        {/* Content */}
        <div className="p-6">
          {step === 'info' && renderInfo()}
          {step === 'quiz' && renderQuiz()}
          {step === 'results' && renderResults()}
        </div>
      </div>
    </div>
  );
}
