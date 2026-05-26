import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import Sidebar from '../components/Sidebar';
import { api } from '../utils/api';
import toast from 'react-hot-toast';
import RadarLoading from '../components/RadarLoading';
import { DiscTabs } from './RhMetodoDisc';

const PERFIL_NOME = {
  D: 'Dominância',
  I: 'Influência',
  S: 'Estabilidade',
  C: 'Conformidade',
};
const PERFIL_COR = {
  D: { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-300' },
  I: { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-300' },
  S: { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-300' },
  C: { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-300' },
};

const DESCRICOES = {
  D: 'Dominante: pessoa direta, decidida, orientada a resultados. Assume liderança, encara desafios e gosta de controlar situações. Pontos fortes: assertividade, iniciativa, rapidez em decidir. A desenvolver: escutar mais, paciência, delegação.',
  I: 'Influente: pessoa sociável, otimista, comunicativa. Inspira pessoas, gosta de interagir e trabalha bem em equipe. Pontos fortes: persuasão, entusiasmo, rede de contatos. A desenvolver: organização, foco em tarefas, atenção a detalhes.',
  S: 'Estável: pessoa calma, paciente, leal. Valoriza segurança e estabilidade. Excelente ouvinte e busca harmonia. Pontos fortes: confiabilidade, paciência, trabalho em equipe. A desenvolver: adaptação a mudanças, assertividade, decisão rápida.',
  C: 'Conforme: pessoa analítica, detalhista, precisa. Valoriza qualidade e procedimentos. Pontos fortes: precisão, organização, conhecimento técnico. A desenvolver: flexibilidade, tomada de decisão sob pressão, relacionamento interpessoal.',
};

// Como cada perfil recebe feedback
const FEEDBACK = {
  D: {
    bem: 'Feedback direto, objetivo, focado em resultados. Vá direto ao ponto em poucas linhas. Ex: "Aqui não bateu a meta por X — ajuste Y pra corrigir."',
    mal: 'Feedback longo, cheio de rodeios, emocional ou que questione sua autoridade/autonomia. Não funciona com ele ficar "enrolando" pra chegar no ponto.',
    dica: '⚡ Seja breve, direto e focado no QUE precisa mudar, sem sermão.',
  },
  I: {
    bem: 'Feedback entusiasmado, começando com algo positivo. Sanduíche de elogios funciona bem. Ex: "Cara, sua energia na apresentação foi 10 — se ajustar X, vai ser perfeito."',
    mal: 'Feedback frio, crítico em público (destrói o ego), ou que ignore a pessoa por trás da tarefa. Tom sério demais desmotiva.',
    dica: '🎉 Use tom leve, reconheça o esforço emocional e envolvimento, só depois aponte o ajuste.',
  },
  S: {
    bem: 'Feedback empático, em ambiente privado, tom calmo e gentil. Ex: "Queria conversar um minuto contigo — notei X, como você se sente sobre isso?"',
    mal: 'Feedback abrupto, público, confrontador. Ele se retrai e fica ressentido sem demonstrar. Pressa atropela o processamento dele.',
    dica: '🤝 Converse em particular, dê tempo pra ele responder, ofereça suporte junto com o feedback.',
  },
  C: {
    bem: 'Feedback baseado em dados, com exemplos concretos e lógica. Ex: "Nos relatórios das últimas 3 semanas, X aconteceu em 4 das 5 entregas — podemos revisar a checklist?"',
    mal: 'Feedback vago, emocional, sem exemplos ("não tá bom" sem dizer o que exatamente). Ele desmonta argumentos fracos.',
    dica: '📊 Traga números, exemplos específicos e uma proposta lógica de correção.',
  },
};

// Como cada perfil recebe elogios
const ELOGIO = {
  D: {
    bem: 'Reconhecimento pelo RESULTADO atingido, pela liderança demonstrada. Ex: "Bateu a meta 20% acima, parabéns."',
    mal: 'Elogios exagerados, emotivos ou focando personalidade em vez de resultado. Soa falso pra ele.',
    dica: '🎯 Foco no que FOI entregue, em números e fatos.',
  },
  I: {
    bem: 'Elogio público, emotivo, com entusiasmo. Ex: "Gente, vocês viram o que o Fulano fez? Arrasou!"',
    mal: 'Reconhecimento discreto, formal ou só por e-mail sem alarde. Ele precisa sentir a vibração.',
    dica: '📣 De preferência em voz alta, em grupo, com energia.',
  },
  S: {
    bem: 'Elogio sincero, em privado, pelo esforço, dedicação e consistência. Ex: "Quero te agradecer pela entrega — você é o pilar do time."',
    mal: 'Exposição pública, alarde exagerado — deixa ele constrangido.',
    dica: '💬 Pessoal, quieto, focado no caráter e na confiabilidade.',
  },
  C: {
    bem: 'Reconhecimento pela qualidade técnica, precisão, detalhe do trabalho. Ex: "Esse relatório é impecável — atenção aos detalhes notável."',
    mal: 'Elogio genérico ("tá ótimo") sem reconhecer o TÉCNICO por trás. Parece superficial.',
    dica: '🔍 Específico, técnico, nomeando o que exatamente está bem feito.',
  },
};

// Matriz de afinidade/oposição entre perfis (quadrantes DISC)
// D & C = ambos "task-oriented"
// D & I = ambos "outgoing"
// I & S = ambos "people-oriented"
// S & C = ambos "reserved"
// D ↔ S e I ↔ C = OPOSTOS (diagonais)
const AFINIDADE = {
  D: { afinidade: ['I', 'C'], oposto: 'S' },
  I: { afinidade: ['D', 'S'], oposto: 'C' },
  S: { afinidade: ['I', 'C'], oposto: 'D' },
  C: { afinidade: ['D', 'S'], oposto: 'I' },
};

const OPOSICAO_DETALHE = {
  'D-S': 'D quer tudo rápido e direto; S precisa de tempo pra processar. D pode parecer agressivo; S pode parecer lento. Fricção: ritmo e estilo de decisão.',
  'S-D': 'S valoriza estabilidade e harmonia; D busca mudança e desafio. S se sente atropelado; D se sente travado. Fricção: mudanças bruscas vs segurança.',
  'I-C': 'I é emocional e espontâneo; C é lógico e metódico. I sente que C é frio; C acha I superficial. Fricção: processo vs relacionamento.',
  'C-I': 'C quer dados e procedimentos; I quer conexão humana e improvisação. C se irrita com "papo furado"; I se irrita com rigidez. Fricção: regras vs flexibilidade.',
};

function formatarData(d) {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
  catch { return String(d); }
}

export default function RhMetodoDiscResultados() {
  const { user, logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [resultados, setResultados] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busca, setBusca] = useState('');
  const [filtroPerfil, setFiltroPerfil] = useState('');
  const [selecionado, setSelecionado] = useState(null);

  const carregar = async () => {
    setLoading(true);
    try {
      const r = await api.get('/rh/disc-results');
      setResultados(Array.isArray(r.data) ? r.data : []);
    } catch { toast.error('Erro ao carregar resultados'); }
    finally { setLoading(false); }
  };
  useEffect(() => { carregar(); }, []);

  const filtrados = useMemo(() => {
    const busc = busca.trim().toLowerCase();
    return resultados.filter(r => {
      if (busc && !String(r.nome || '').toLowerCase().includes(busc)) return false;
      if (filtroPerfil && r.perfil_primario !== filtroPerfil) return false;
      return true;
    });
  }, [resultados, busca, filtroPerfil]);

  const stats = useMemo(() => {
    const contador = { D: 0, I: 0, S: 0, C: 0 };
    resultados.forEach(r => { if (contador[r.perfil_primario] !== undefined) contador[r.perfil_primario]++; });
    return contador;
  }, [resultados]);

  const excluir = async (r) => {
    if (!window.confirm(`Excluir o resultado de "${r.nome}"?`)) return;
    try {
      await api.delete(`/rh/disc-results/${r.id}`);
      toast.success('Excluído');
      if (selecionado?.id === r.id) setSelecionado(null);
      await carregar();
    } catch { toast.error('Erro ao excluir'); }
  };

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar user={user} onLogout={logout} isMobileMenuOpen={isMobileMenuOpen} setIsMobileMenuOpen={setIsMobileMenuOpen} />
      <div className="flex-1 overflow-y-auto">
        <div className="bg-gradient-to-r from-purple-600 to-purple-500 text-white px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Resultados — Método DISC</h1>
              <p className="text-orange-100 text-sm">Avaliações comportamentais por colaborador / candidato</p>
            </div>
            <button onClick={() => setIsMobileMenuOpen(true)} className="lg:hidden p-2 rounded-lg hover:bg-purple-700">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>

        {/* Tabs */}
        <DiscTabs />

        {/* Cards de stats por perfil */}
        <div className="px-6 py-4 grid grid-cols-2 md:grid-cols-5 gap-3">
          <button onClick={() => setFiltroPerfil('')}
            className={`bg-white rounded-lg border p-3 border-l-4 border-gray-300 text-left transition ${filtroPerfil === '' ? 'ring-2 ring-orange-400' : 'hover:shadow'}`}>
            <div className="text-[10px] uppercase text-gray-500 font-semibold">Total</div>
            <div className="text-2xl font-bold text-gray-800">{resultados.length}</div>
          </button>
          {['D', 'I', 'S', 'C'].map(p => (
            <button key={p} onClick={() => setFiltroPerfil(filtroPerfil === p ? '' : p)}
              className={`bg-white rounded-lg border p-3 border-l-4 text-left transition ${PERFIL_COR[p].border} ${filtroPerfil === p ? 'ring-2 ring-orange-400' : 'hover:shadow'}`}>
              <div className="text-[10px] uppercase text-gray-500 font-semibold">{p} — {PERFIL_NOME[p]}</div>
              <div className={`text-2xl font-bold ${PERFIL_COR[p].text}`}>{stats[p]}</div>
            </button>
          ))}
        </div>

        {/* Filtros */}
        <div className="px-6 pb-3">
          <input type="text" value={busca} onChange={e => setBusca(e.target.value)}
            placeholder="🔍 Buscar por nome..."
            className="w-full md:w-96 border rounded-lg px-4 py-2 text-sm" />
        </div>

        <div className="px-6 pb-6 grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Lista */}
          <div className="lg:col-span-2 bg-white rounded-lg shadow border">
            {loading ? (
              <div className="flex justify-center py-20"><RadarLoading size="sm" message="" /></div>
            ) : filtrados.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <div className="text-4xl mb-2">🧠</div>
                <p className="font-semibold">{resultados.length === 0 ? 'Nenhuma avaliação ainda' : 'Nenhum resultado bate com o filtro'}</p>
                {resultados.length === 0 && <p className="text-xs mt-1">Avaliações feitas em <strong>Método DISC</strong> aparecerão aqui.</p>}
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-600 text-white">
                  <tr>
                    <th className="text-left px-4 py-2">Nome</th>
                    <th className="text-left px-4 py-2">Perfil Primário</th>
                    <th className="text-left px-4 py-2">Secundário</th>
                    <th className="text-left px-4 py-2">Data</th>
                    <th className="text-right px-4 py-2">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filtrados.map(r => {
                    const cores = PERFIL_COR[r.perfil_primario] || PERFIL_COR.D;
                    return (
                      <tr key={r.id} className={`hover:bg-orange-50 cursor-pointer ${selecionado?.id === r.id ? 'bg-orange-50' : ''}`}
                          onClick={() => setSelecionado(r)}>
                        <td className="px-4 py-2 font-semibold text-gray-800">{r.nome}</td>
                        <td className="px-4 py-2">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold border ${cores.bg} ${cores.text} ${cores.border}`}>
                            {r.perfil_primario} — {PERFIL_NOME[r.perfil_primario]}
                          </span>
                        </td>
                        <td className="px-4 py-2">
                          {r.perfil_secundario ? (() => {
                            const c2 = PERFIL_COR[r.perfil_secundario] || PERFIL_COR.D;
                            return (
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold border ${c2.bg} ${c2.text} ${c2.border}`}>
                                {r.perfil_secundario} — {PERFIL_NOME[r.perfil_secundario]}
                              </span>
                            );
                          })() : <span className="text-gray-400">—</span>}
                        </td>
                        <td className="px-4 py-2 text-gray-500 text-xs">{formatarData(r.created_at)}</td>
                        <td className="px-4 py-2 text-right">
                          <button onClick={e => { e.stopPropagation(); excluir(r); }}
                            className="text-red-600 hover:text-red-800 text-sm font-medium">Excluir</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Detalhe */}
          <div className="bg-white rounded-lg shadow border p-5">
            {!selecionado ? (
              <div className="text-center py-10 text-gray-400">
                <div className="text-4xl mb-2">👆</div>
                <p className="text-base">Clique em um nome pra ver o detalhe</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <h3 className="font-bold text-gray-800 text-2xl">{selecionado.nome}</h3>
                  <p className="text-sm text-gray-500">{formatarData(selecionado.created_at)}</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className={`rounded-lg p-3 border-l-4 ${PERFIL_COR[selecionado.perfil_primario]?.bg || ''} ${PERFIL_COR[selecionado.perfil_primario]?.border || ''}`}>
                    <div className="text-xs uppercase text-gray-500 font-semibold">Primário</div>
                    <div className={`font-bold text-lg ${PERFIL_COR[selecionado.perfil_primario]?.text || ''}`}>
                      {selecionado.perfil_primario} — {PERFIL_NOME[selecionado.perfil_primario]}
                    </div>
                  </div>
                  {selecionado.perfil_secundario && (
                    <div className={`rounded-lg p-3 border-l-4 ${PERFIL_COR[selecionado.perfil_secundario]?.bg || ''} ${PERFIL_COR[selecionado.perfil_secundario]?.border || ''}`}>
                      <div className="text-xs uppercase text-gray-500 font-semibold">Secundário</div>
                      <div className={`font-bold text-lg ${PERFIL_COR[selecionado.perfil_secundario]?.text || ''}`}>
                        {selecionado.perfil_secundario} — {PERFIL_NOME[selecionado.perfil_secundario]}
                      </div>
                    </div>
                  )}
                </div>

                {/* Barras de pontuação */}
                {selecionado.scores && typeof selecionado.scores === 'object' && (
                  <div className="space-y-2">
                    <div className="text-xs uppercase text-gray-500 font-semibold">Pontuação</div>
                    {['D', 'I', 'S', 'C'].map(p => {
                      const val = selecionado.scores?.[p] || 0;
                      const maxVal = Math.max(...Object.values(selecionado.scores || {}).map(v => Number(v) || 0), 1);
                      const pct = Math.round((val / maxVal) * 100);
                      return (
                        <div key={p}>
                          <div className="flex justify-between text-sm mb-0.5">
                            <span className="font-semibold">{p} · {PERFIL_NOME[p]}</span>
                            <span className="text-gray-600">{val}</span>
                          </div>
                          <div className="h-3 bg-gray-200 rounded overflow-hidden">
                            <div className={`h-full ${PERFIL_COR[p].bg.replace('100', '500')}`} style={{ width: `${pct}%` }}></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="border-t pt-3">
                  <div className="text-xs uppercase text-gray-500 font-semibold mb-1.5">Sobre o perfil primário</div>
                  <p className="text-base text-gray-700 leading-relaxed">{DESCRICOES[selecionado.perfil_primario]}</p>
                </div>

                {/* Como dar feedback */}
                {FEEDBACK[selecionado.perfil_primario] && (
                  <div className="border-t pt-3 space-y-2">
                    <div className="text-sm uppercase text-gray-500 font-semibold">💬 Como dar feedback</div>
                    <div className="bg-emerald-50 border-l-4 border-emerald-400 rounded p-3">
                      <div className="text-xs font-bold text-emerald-700 uppercase mb-1">✓ Recebe bem</div>
                      <p className="text-base text-gray-700 leading-relaxed">{FEEDBACK[selecionado.perfil_primario].bem}</p>
                    </div>
                    <div className="bg-red-50 border-l-4 border-red-400 rounded p-3">
                      <div className="text-xs font-bold text-red-700 uppercase mb-1">✗ Recebe mal</div>
                      <p className="text-base text-gray-700 leading-relaxed">{FEEDBACK[selecionado.perfil_primario].mal}</p>
                    </div>
                    <div className="bg-amber-50 border-l-4 border-amber-400 rounded p-3">
                      <div className="text-xs font-bold text-amber-800 uppercase mb-1">Dica prática</div>
                      <p className="text-base text-gray-700 leading-relaxed">{FEEDBACK[selecionado.perfil_primario].dica}</p>
                    </div>
                  </div>
                )}

                {/* Como dar elogios */}
                {ELOGIO[selecionado.perfil_primario] && (
                  <div className="border-t pt-3 space-y-2">
                    <div className="text-sm uppercase text-gray-500 font-semibold">🏆 Como dar elogios</div>
                    <div className="bg-emerald-50 border-l-4 border-emerald-400 rounded p-3">
                      <div className="text-xs font-bold text-emerald-700 uppercase mb-1">✓ Recebe bem</div>
                      <p className="text-base text-gray-700 leading-relaxed">{ELOGIO[selecionado.perfil_primario].bem}</p>
                    </div>
                    <div className="bg-red-50 border-l-4 border-red-400 rounded p-3">
                      <div className="text-xs font-bold text-red-700 uppercase mb-1">✗ Recebe mal</div>
                      <p className="text-base text-gray-700 leading-relaxed">{ELOGIO[selecionado.perfil_primario].mal}</p>
                    </div>
                    <div className="bg-amber-50 border-l-4 border-amber-400 rounded p-3">
                      <div className="text-xs font-bold text-amber-800 uppercase mb-1">Dica prática</div>
                      <p className="text-base text-gray-700 leading-relaxed">{ELOGIO[selecionado.perfil_primario].dica}</p>
                    </div>
                  </div>
                )}

                {/* Afinidade / Oposição */}
                {AFINIDADE[selecionado.perfil_primario] && (
                  <div className="border-t pt-3 space-y-3">
                    <div className="text-sm uppercase text-gray-500 font-semibold">🤝 Relacionamento com outros perfis</div>

                    <div className="bg-blue-50 rounded p-3">
                      <div className="text-xs font-bold text-blue-700 uppercase mb-2">Maior Afinidade</div>
                      <div className="flex gap-2 flex-wrap mb-2">
                        {AFINIDADE[selecionado.perfil_primario].afinidade.map(p => (
                          <span key={p} className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-bold border ${PERFIL_COR[p].bg} ${PERFIL_COR[p].text} ${PERFIL_COR[p].border}`}>
                            {p} — {PERFIL_NOME[p]}
                          </span>
                        ))}
                      </div>
                      <p className="text-base text-gray-700 leading-relaxed">
                        Trabalha bem com esses perfis — compartilham dimensões (ritmo ou foco) e se complementam naturalmente.
                      </p>
                    </div>

                    <div className="bg-orange-50 border border-orange-200 rounded p-3">
                      <div className="text-xs font-bold text-orange-800 uppercase mb-2">⚠ Maior Dificuldade (Oposto)</div>
                      <div className="flex gap-2 mb-2">
                        <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-bold border ${PERFIL_COR[AFINIDADE[selecionado.perfil_primario].oposto].bg} ${PERFIL_COR[AFINIDADE[selecionado.perfil_primario].oposto].text} ${PERFIL_COR[AFINIDADE[selecionado.perfil_primario].oposto].border}`}>
                          {AFINIDADE[selecionado.perfil_primario].oposto} — {PERFIL_NOME[AFINIDADE[selecionado.perfil_primario].oposto]}
                        </span>
                      </div>
                      <p className="text-base text-gray-700 leading-relaxed">
                        {OPOSICAO_DETALHE[`${selecionado.perfil_primario}-${AFINIDADE[selecionado.perfil_primario].oposto}`]}
                      </p>
                    </div>
                  </div>
                )}

                {/* Compatibilidade com outros colaboradores avaliados */}
                {(() => {
                  const oposto = AFINIDADE[selecionado.perfil_primario]?.oposto;
                  const afins = AFINIDADE[selecionado.perfil_primario]?.afinidade || [];
                  const pares = resultados.filter(r => r.id !== selecionado.id);
                  const paresAfinidade = pares.filter(r => afins.includes(r.perfil_primario));
                  const paresOpostos = pares.filter(r => r.perfil_primario === oposto);
                  if (paresAfinidade.length === 0 && paresOpostos.length === 0) return null;
                  return (
                    <div className="border-t pt-3 space-y-3">
                      <div className="text-sm uppercase text-gray-500 font-semibold">👥 No time atual</div>
                      {paresAfinidade.length > 0 && (
                        <div>
                          <div className="text-xs font-bold text-blue-700 uppercase mb-2">Boa sintonia com:</div>
                          <ul className="space-y-1">
                            {paresAfinidade.slice(0, 8).map(r => (
                              <li key={r.id} className="text-base text-gray-700 flex gap-2">
                                <span className={`${PERFIL_COR[r.perfil_primario].text} font-bold`}>{r.perfil_primario}</span>
                                <span>{r.nome}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {paresOpostos.length > 0 && (
                        <div>
                          <div className="text-xs font-bold text-orange-800 uppercase mb-2">Pode gerar fricção com:</div>
                          <ul className="space-y-1">
                            {paresOpostos.slice(0, 8).map(r => (
                              <li key={r.id} className="text-base text-gray-700 flex gap-2">
                                <span className={`${PERFIL_COR[r.perfil_primario].text} font-bold`}>{r.perfil_primario}</span>
                                <span>{r.nome}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
