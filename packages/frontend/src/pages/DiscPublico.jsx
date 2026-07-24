import { useState, useEffect } from 'react';
import { api } from '../utils/api';
import toast from 'react-hot-toast';
import { DISC_GROUPS } from './RhMetodoDisc';

const PERFIL_COR = {
  D: { bg: 'bg-red-500', text: 'text-red-700', light: 'bg-red-50' },
  I: { bg: 'bg-yellow-400', text: 'text-yellow-800', light: 'bg-yellow-50' },
  S: { bg: 'bg-emerald-500', text: 'text-emerald-700', light: 'bg-emerald-50' },
  C: { bg: 'bg-blue-500', text: 'text-blue-700', light: 'bg-blue-50' },
};
const PERFIL_NOME = { D: 'Dominância', I: 'Influência', S: 'Estabilidade', C: 'Conformidade' };

export default function DiscPublico() {
  const [step, setStep] = useState('info'); // info | quiz | results | thanks
  const [nome, setNome] = useState('');
  // Amarra o resultado do DISC ao curriculo de origem (quando vem do fluxo do curriculo)
  const [curriculoId, setCurriculoId] = useState(null);
  // Amarra ao COLABORADOR já contratado (quando o link foi gerado no modo Colaborador)
  const [colaboradorId, setColaboradorId] = useState(null);
  const [currentGroup, setCurrentGroup] = useState(0);
  const [answers, setAnswers] = useState({});
  const [scores, setScores] = useState(null);
  const [saving, setSaving] = useState(false);

  // Le ?nome=X&curriculo_id=Y da URL pra pre-preencher e amarrar ao curriculo
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const nomeParam = params.get('nome');
    if (nomeParam) setNome(nomeParam.toUpperCase());
    const cidParam = params.get('curriculo_id');
    if (cidParam) setCurriculoId(Number(cidParam) || null);
    const colabParam = params.get('colaborador_id');
    if (colabParam) setColaboradorId(Number(colabParam) || null);
  }, []);

  const handleStart = () => {
    if (!nome.trim()) { toast.error('Informe seu nome pra começar'); return; }
    setStep('quiz');
    setCurrentGroup(0);
    setAnswers({});
  };

  const handleSelect = (type, optionIndex) => {
    const groupId = DISC_GROUPS[currentGroup].id;
    const current = answers[groupId] || {};
    if (type === 'mais' && current.menos === optionIndex) return;
    if (type === 'menos' && current.mais === optionIndex) return;
    setAnswers(prev => ({ ...prev, [groupId]: { ...prev[groupId], [type]: optionIndex } }));
  };

  const currentAnswer = answers[DISC_GROUPS[currentGroup]?.id] || {};
  const canProceed = currentAnswer.mais !== undefined && currentAnswer.menos !== undefined;

  const handleNext = () => {
    if (!canProceed) { toast.error('Escolha uma palavra para MAIS e outra para MENOS'); return; }
    if (currentGroup < DISC_GROUPS.length - 1) setCurrentGroup(p => p + 1);
    else calculateAndSave();
  };

  const handlePrev = () => { if (currentGroup > 0) setCurrentGroup(p => p - 1); };

  const calculateAndSave = async () => {
    const totals = { D: 0, I: 0, S: 0, C: 0 };
    DISC_GROUPS.forEach(group => {
      const a = answers[group.id];
      if (!a) return;
      totals[group.options[a.mais].profile] += 1;
      totals[group.options[a.menos].profile] -= 1;
    });
    const sorted = Object.entries(totals).sort((a, b) => b[1] - a[1]);
    const perfil_primario = sorted[0][0];
    const perfil_secundario = sorted[1][0];
    setScores({ raw: totals, perfil_primario, perfil_secundario });

    setSaving(true);
    try {
      await api.post('/rh/disc-publico/submit', {
        nome: nome.trim(),
        scores: totals,
        perfil_primario,
        perfil_secundario,
        respostas: answers,
        curriculo_id: curriculoId || null,
        colaborador_id: colaboradorId || null,
      });
      setStep('results');
    } catch (err) {
      toast.error('Erro ao enviar. Tente novamente.');
      console.error(err);
    } finally { setSaving(false); }
  };

  const progresso = Math.round(((currentGroup + 1) / DISC_GROUPS.length) * 100);

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-gray-100" lang="pt-BR" translate="no">
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-600 to-orange-500 text-white px-6 py-6 shadow">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl font-bold">Método DISC — Perfil Comportamental</h1>
          <p className="text-orange-100 mt-1">Avaliação baseada na metodologia de William Marston</p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto p-4 md:p-6">
        {/* INFO */}
        {step === 'info' && (
          <div className="bg-white rounded-xl shadow-md p-6 md:p-8">
            <div className="flex justify-center mb-4">
              <div className="bg-orange-100 rounded-full p-4">
                <svg className="w-12 h-12 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
                </svg>
              </div>
            </div>

            <h2 className="text-2xl font-bold text-center text-gray-800 mb-2">Bem-vindo à Avaliação DISC</h2>
            <p className="text-center text-gray-500 mb-6">⏱️ São <strong>18 grupos</strong> no total. Leva <strong>8 a 10 minutos</strong>.</p>

            {/* Bloco didatico com exemplo pratico */}
            <div className="bg-gradient-to-br from-orange-50 to-amber-50 border-2 border-orange-200 rounded-xl p-5 mb-5 text-base text-gray-800 space-y-3">
              <p className="font-extrabold text-gray-900 text-lg">📋 Antes de começar, veja como é:</p>

              <p>Vai aparecer um grupo com <strong>4 palavras</strong>, mais ou menos assim:</p>

              {/* Exemplo visual de 4 palavras */}
              <div className="bg-white rounded-lg border-2 border-gray-200 p-3 grid grid-cols-2 gap-2 text-center font-semibold text-gray-800 my-2">
                <div className="bg-gray-50 rounded py-2">Determinado</div>
                <div className="bg-emerald-100 rounded py-2 ring-2 ring-emerald-400">
                  Alegre <span className="ml-1 text-xs bg-emerald-500 text-white px-1.5 py-0.5 rounded">+ MAIS</span>
                </div>
                <div className="bg-gray-50 rounded py-2">Paciente</div>
                <div className="bg-red-100 rounded py-2 ring-2 ring-red-400">
                  Caprichoso <span className="ml-1 text-xs bg-red-500 text-white px-1.5 py-0.5 rounded">– MENOS</span>
                </div>
              </div>

              <p>
                <strong>Pergunta:</strong> qual <strong className="text-emerald-700">MAIS</strong> se parece com você?
                Imagina que você se acha alegre — então marca <strong className="text-emerald-700">"+MAIS"</strong> em <em>Alegre</em>.
              </p>

              <p>
                <strong>Pergunta:</strong> qual <strong className="text-red-700">MENOS</strong> se parece com você?
                Imagina que você não é nada caprichoso — então marca <strong className="text-red-700">"-MENOS"</strong> em <em>Caprichoso</em>.
              </p>

              <p>
                As outras <strong>2 palavras ficam em branco</strong>. Pronto, próximo grupo! ✨
              </p>

              <div className="bg-yellow-100 border-l-4 border-yellow-500 p-3 rounded text-sm text-gray-800 mt-3">
                🤷 <strong>Não tem resposta certa.</strong> Cada perfil tem suas qualidades.
              </div>
            </div>

            <label className="block text-sm font-semibold text-gray-700 mb-2">Seu nome completo</label>
            <input type="text" value={nome} onChange={e => setNome(e.target.value.toUpperCase())}
              style={{ textTransform: 'uppercase' }}
              placeholder="DIGITE SEU NOME"
              className="w-full border-2 border-gray-200 rounded-lg px-4 py-3 text-base focus:border-orange-500 focus:outline-none" />

            <button onClick={handleStart}
              className="w-full mt-5 bg-orange-500 hover:bg-orange-600 text-white font-bold py-4 rounded-lg text-lg transition">
              Iniciar Avaliação
            </button>
          </div>
        )}

        {/* QUIZ */}
        {step === 'quiz' && (
          <div className="bg-white rounded-xl shadow-md p-5 md:p-6">
            <div className="mb-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-semibold text-gray-600">Grupo {currentGroup + 1} de {DISC_GROUPS.length}</span>
                <span className="text-sm text-gray-500">{progresso}%</span>
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full bg-orange-500 transition-all" style={{ width: `${progresso}%` }}></div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-300 rounded-xl p-4 mb-5">
              <h3 className="text-center font-extrabold text-blue-900 mb-3">📋 Como responder este grupo</h3>
              <div className="space-y-2 text-sm text-gray-800">
                <div className="flex items-start gap-2">
                  <span className="bg-emerald-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold flex-shrink-0">1</span>
                  <p>Olhe as <strong>4 palavras</strong> e escolha <strong className="text-emerald-700">apenas UMA</strong> que <strong className="text-emerald-700">MAIS combina</strong> com você → clique em <strong className="text-emerald-700">MAIS</strong></p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold flex-shrink-0">2</span>
                  <p>Escolha <strong className="text-red-700">apenas UMA</strong> que <strong className="text-red-700">MENOS combina</strong> com você → clique em <strong className="text-red-700">MENOS</strong></p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="bg-gray-400 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold flex-shrink-0">3</span>
                  <p>As outras <strong>2 palavras</strong> ficam <strong>SEM marcação</strong>. ⚠️ <strong>Não marque tudo!</strong></p>
                </div>
              </div>
            </div>

            <div className="space-y-3 mb-6">
              {DISC_GROUPS[currentGroup].options.map((opt, idx) => {
                const isMais = currentAnswer.mais === idx;
                const isMenos = currentAnswer.menos === idx;
                return (
                  <div key={idx} className={`flex items-center gap-3 p-3 rounded-lg border-2 ${isMais ? 'border-emerald-500 bg-emerald-50' : isMenos ? 'border-red-500 bg-red-50' : 'border-gray-200'}`}>
                    <div className="flex-1 text-base font-medium text-gray-800">{opt.text}</div>
                    <button onClick={() => handleSelect('mais', idx)}
                      className={`px-4 py-2 rounded-lg font-bold text-sm transition ${isMais ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-emerald-100'}`}>
                      MAIS
                    </button>
                    <button onClick={() => handleSelect('menos', idx)}
                      className={`px-4 py-2 rounded-lg font-bold text-sm transition ${isMenos ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-red-100'}`}>
                      MENOS
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-between gap-3">
              <button onClick={handlePrev} disabled={currentGroup === 0}
                className="px-5 py-3 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold disabled:opacity-40">
                ← Anterior
              </button>
              <button onClick={handleNext} disabled={!canProceed || saving}
                className="flex-1 px-5 py-3 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-bold disabled:opacity-40">
                {saving ? 'Enviando...' : currentGroup === DISC_GROUPS.length - 1 ? '✓ Finalizar' : 'Próximo →'}
              </button>
            </div>
          </div>
        )}

        {/* RESULTS */}
        {step === 'results' && scores && (
          <div className="bg-white rounded-xl shadow-md p-6 md:p-8 text-center">
            <div className="flex justify-center mb-4">
              <div className={`rounded-full p-5 ${PERFIL_COR[scores.perfil_primario].light}`}>
                <svg className={`w-14 h-14 ${PERFIL_COR[scores.perfil_primario].text}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/>
                </svg>
              </div>
            </div>

            <h2 className="text-2xl font-bold text-gray-800 mb-2">Obrigado, {nome}!</h2>
            <p className="text-gray-600 mb-6">Sua avaliação foi enviada com sucesso.</p>

            <div className="bg-gray-50 rounded-lg p-5 mb-5 text-left" translate="no">
              <div className="text-sm text-gray-500 mb-1 uppercase font-semibold">Seu Perfil Primário</div>
              <div className={`text-3xl font-bold ${PERFIL_COR[scores.perfil_primario].text} mb-3`} translate="no">
                <span translate="no">{scores.perfil_primario}</span> — <span translate="no">{PERFIL_NOME[scores.perfil_primario]}</span>
              </div>
              <div className="text-sm text-gray-500 mb-1 uppercase font-semibold">Secundário</div>
              <div className={`text-xl font-semibold ${PERFIL_COR[scores.perfil_secundario].text}`} translate="no">
                <span translate="no">{scores.perfil_secundario}</span> — <span translate="no">{PERFIL_NOME[scores.perfil_secundario]}</span>
              </div>
            </div>

            <div className="space-y-2 mb-6" translate="no">
              {['D', 'I', 'S', 'C'].map(p => {
                const val = scores.raw[p] || 0;
                const max = Math.max(...Object.values(scores.raw).map(v => Math.abs(v)), 1);
                const pct = Math.round((Math.abs(val) / max) * 100);
                return (
                  <div key={p}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-semibold" translate="no"><span translate="no">{p}</span> · <span translate="no">{PERFIL_NOME[p]}</span></span>
                      <span className="text-gray-600">{val}</span>
                    </div>
                    <div className="h-3 bg-gray-200 rounded overflow-hidden">
                      <div className={`h-full ${PERFIL_COR[p].bg}`} style={{ width: `${pct}%` }}></div>
                    </div>
                  </div>
                );
              })}
            </div>

            <p className="text-sm text-gray-500">
              O RH já recebeu seu resultado. Obrigado pelo seu tempo! 🎉
            </p>

            {/* Convite pra pré-entrevista (se veio do fluxo do currículo com flag setada) */}
            <ConvitePreEntrevistaPosDisc nome={nome} curriculoId={curriculoId} />
          </div>
        )}
      </div>
    </div>
  );
}

// Componente que aparece apos finalizar DISC convidando para a pre-entrevista
// (gated pelo flag curriculo_preentrevista_habilitada — sempre oferece se habilitado)
function ConvitePreEntrevistaPosDisc({ nome, curriculoId }) {
  const [show, setShow] = useState(false);
  const [dados, setDados] = useState({ nome, telefone: null, email: null, curriculo_id: curriculoId || null });
  const [criando, setCriando] = useState(false);

  useEffect(() => {
    // Le dados extras (telefone/email/curriculo_id) que possam ter vindo do fluxo do curriculo
    let dadosExtras = { nome, telefone: null, email: null, curriculo_id: curriculoId || null };
    try {
      const raw = localStorage.getItem('apos_disc_oferecer_preentrevista');
      if (raw) {
        const d = JSON.parse(raw);
        if (d) dadosExtras = {
          nome: d.nome || nome,
          telefone: d.telefone || null,
          email: d.email || null,
          curriculo_id: d.curriculo_id || curriculoId || null,
        };
      }
    } catch {}
    setDados(dadosExtras);

    // Checa no backend se o admin habilitou a pre-entrevista
    (async () => {
      try {
        const r = await api.get('/curriculos/publico/formulario');
        if (r.data?.config?.preentrevista_habilitada) setShow(true);
      } catch {}
    })();
  }, [nome, curriculoId]);

  if (!show) return null;

  const aceitar = async () => {
    setCriando(true);
    try {
      const r = await api.post('/recrutador/publico/criar-preentrevista', {
        candidato_nome: dados.nome || nome,
        candidato_telefone: dados.telefone || null,
        candidato_email: dados.email || null,
        curriculo_id: dados.curriculo_id || null,
      });
      localStorage.removeItem('apos_disc_oferecer_preentrevista');
      window.location.href = `/recrutamento/${r.data.token}`;
    } catch (e) {
      alert('Erro: ' + (e.response?.data?.error || e.message));
      setCriando(false);
    }
  };

  const recusar = () => {
    localStorage.removeItem('apos_disc_oferecer_preentrevista');
    setShow(false);
  };

  return (
    <div className="mt-6 bg-gradient-to-br from-orange-50 to-rose-50 border-2 border-orange-300 rounded-2xl p-5 text-left">
      <div className="flex items-center gap-3 mb-3">
        <span className="text-4xl">🤖</span>
        <div>
          <h3 className="font-extrabold text-gray-900">Mais uma etapa, {(dados?.nome || nome).split(' ')[0]}!</h3>
        </div>
      </div>
      <p className="text-sm text-gray-800 mb-2">
        Você gostaria de responder uma <strong className="text-rose-600">Pré-Entrevista com a Recrutadora Digital</strong>? 🎯
      </p>
      <p className="text-sm text-gray-800 mb-3">
        Candidatos que preenchem essa etapa têm <strong className="underline decoration-amber-400 decoration-4">muito mais chances</strong> de contratação. ✨
      </p>
      <div className="bg-rose-50 border border-rose-200 rounded-lg p-2 text-xs text-rose-900 text-center mb-3">
        ⏱️ Leva em torno de <strong>5 a 8 minutos</strong>
      </div>
      <p className="text-center text-sm font-bold text-gray-800 mb-3">Vamos lá?</p>
      <div className="flex gap-2">
        <button onClick={recusar} disabled={criando}
          className="flex-1 px-3 py-2.5 border-2 border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 font-bold text-sm disabled:opacity-50">
          ❌ NÃO
        </button>
        <button onClick={aceitar} disabled={criando}
          className="flex-1 px-3 py-2.5 bg-gradient-to-r from-orange-500 to-rose-600 hover:from-orange-600 hover:to-rose-700 text-white rounded-xl font-bold text-sm disabled:opacity-50">
          {criando ? 'Iniciando...' : '✅ SIM, vamos lá!'}
        </button>
      </div>
    </div>
  );
}
