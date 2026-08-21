import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useLoja } from '../../contexts/LojaContext';
import Sidebar from '../../components/Sidebar';
import api from '../../utils/api';

// Formata link pra abrir direto a conversa no WhatsApp.
// Mobile: api.whatsapp.com/send (abre o app diretamente)
// Desktop: web.whatsapp.com/send (abre WhatsApp Web na conversa, sem tela intermediaria)
export const waLink = (numero, msg = '', placeholders = {}) => {
  if (!numero) return null;
  const digits = String(numero).replace(/\D/g, '');
  if (!digits) return null;
  const comDDI = digits.startsWith('55') ? digits : `55${digits}`;

  // Detecta mobile pra escolher o melhor URL
  const isMobile = typeof navigator !== 'undefined'
    && /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent || '');
  const base = isMobile
    ? `https://api.whatsapp.com/send?phone=${comDDI}`
    : `https://web.whatsapp.com/send?phone=${comDDI}`;

  let url = base;
  if (msg && msg.trim()) {
    let texto = msg;
    Object.entries(placeholders || {}).forEach(([k, v]) => {
      texto = texto.replace(new RegExp(`\\{${k}\\}`, 'gi'), v || '');
    });
    url += `&text=${encodeURIComponent(texto)}`;
  }
  return url;
};

// Formata handle pra link instagram.com
const igLink = (handle) => {
  if (!handle) return null;
  let h = String(handle).trim();
  if (!h) return null;
  if (h.startsWith('http')) return h;
  h = h.replace(/^@/, '').replace(/^instagram\.com\//i, '').replace(/^www\./i, '');
  return `https://instagram.com/${h}`;
};
const igHandle = (handle) => {
  if (!handle) return '';
  let h = String(handle).trim();
  h = h.replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/^@/, '').replace(/\/$/, '');
  return h ? `@${h}` : '';
};

const STATUS_LABEL = {
  novo: { label: 'Novo', emoji: '🆕', bg: 'bg-sky-100 text-sky-800 border-sky-200' },
  em_analise: { label: 'Vagas Futuras', emoji: '🔎', bg: 'bg-amber-100 text-amber-800 border-amber-200' },
  aprovado: { label: 'Selecionado', emoji: '✓', bg: 'bg-blue-100 text-blue-800 border-blue-200' },
  recusado: { label: 'Recusado', emoji: '🚫', bg: 'bg-rose-100 text-rose-800 border-rose-200' },
  contratado: { label: 'Contratado', emoji: '🎉', bg: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
};
// Alias antigo: vagas/curriculos antigos podem ter status='reprovado' — exibir igual a 'recusado'
STATUS_LABEL.reprovado = STATUS_LABEL.recusado;

// Cores e nomes dos perfis DISC (mesmo padrao do RhMetodoDiscResultados)
const DISC_NOME = { D: 'Dominância', I: 'Influência', S: 'Estabilidade', C: 'Conformidade' };
const DISC_COR = {
  D: { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-300' },
  I: { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-300' },
  S: { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-300' },
  C: { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-300' },
};

export default function BancoCurriculos() {
  const { user, logout } = useAuth();
  const { lojaSelecionada } = useLoja();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [curriculos, setCurriculos] = useState([]);
  const [resumo, setResumo] = useState({});
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');

  const [cargos, setCargos] = useState([]);
  const [habilidades, setHabilidades] = useState([]);
  const [tiposVaga, setTiposVaga] = useState([]);
  const [lojas, setLojas] = useState([]);
  // Mapa { slug -> nome } para exibicao das pills (resolve "HORISTA" no lugar de "Aprendiz")
  const tipoVagaNome = (slug) => {
    if (!slug) return '';
    const t = tiposVaga.find(x => x.slug === slug);
    return t ? t.nome : slug.toUpperCase();
  };
  const [emProcesso, setEmProcesso] = useState({}); // { curriculo_id: { vaga_titulo, etapa } }
  // Configs de mensagens (Configuracoes RH > Mensagens)
  const [msgWhatsApp, setMsgWhatsApp] = useState('');
  const [recrutadoraNome, setRecrutadoraNome] = useState('');
  const [supermercadoNome, setSupermercadoNome] = useState('');
  const [msgWhatsAppAtivo, setMsgWhatsAppAtivo] = useState(true);

  const [filtros, setFiltros] = useState({
    cidade: '', bairro: '', cargo: '', cargo_interesse: '', habilidade: '', status: '', dataDe: '', dataAte: '', q: '', interesse_vaga: '', loja: '',
  });

  const [selecionado, setSelecionado] = useState(null);
  // Topo (cards de resumo + filtros) some ao rolar a tabela pra baixo,
  // liberando espaço pra ver ~2x mais currículos. Volta ao subir ao topo.
  const [topVisivel, setTopVisivel] = useState(true);

  // Ordenação por coluna: clica no cabeçalho → A→Z; clica de novo → Z→A.
  const [ordenacao, setOrdenacao] = useState({ campo: null, dir: 'asc' });
  const ordenarPor = (campo) =>
    setOrdenacao(o => o.campo === campo ? { campo, dir: o.dir === 'asc' ? 'desc' : 'asc' } : { campo, dir: 'asc' });
  const idadeDe = (cv) => {
    if (!cv?.data_nascimento) return null;
    const n = new Date(cv.data_nascimento);
    if (isNaN(n.getTime())) return null;
    const h = new Date();
    let i = h.getFullYear() - n.getFullYear();
    const m = h.getMonth() - n.getMonth();
    if (m < 0 || (m === 0 && h.getDate() < n.getDate())) i--;
    return (i < 0 || i > 120) ? null : i;
  };
  const valorOrdenacao = (cv, campo) => {
    switch (campo) {
      case 'id': return cv.id ?? 0;
      case 'nome': return (cv.nome || '').toUpperCase();
      case 'curriculo_pdf': return cv.curriculo_pdf_url ? 0 : 1;
      case 'idade': return idadeDe(cv);
      case 'status': return (STATUS_LABEL[cv.status]?.label || '').toUpperCase();
      case 'interesse_vaga': return (tipoVagaNome(cv.interesse_vaga) || '').toUpperCase();
      case 'whatsapp': return (cv.whatsapp || '').replace(/\D/g, '');
      case 'instagram': return igHandle(cv.instagram).toUpperCase();
      case 'email': return (cv.email || '').toUpperCase();
      case 'localizacao': return [cv.bairro, cv.cidade].filter(Boolean).join(' ').toUpperCase();
      case 'cargos': return ((cv.cargos && cv.cargos[0]) || '').toUpperCase();
      case 'cargos_interesse': return ((cv.cargos_interesse && cv.cargos_interesse[0]) || '').toUpperCase();
      case 'disponibilidade': return ((cv.disponibilidade_turnos && cv.disponibilidade_turnos[0]) || '').toUpperCase();
      case 'data': return cv.created_at ? new Date(cv.created_at).getTime() : 0;
      default: return '';
    }
  };
  const curriculosOrdenados = (() => {
    if (!ordenacao.campo) return curriculos;
    return [...curriculos].sort((a, b) => {
      const va = valorOrdenacao(a, ordenacao.campo);
      const vb = valorOrdenacao(b, ordenacao.campo);
      const ea = va === null || va === undefined || va === '';
      const eb = vb === null || vb === undefined || vb === '';
      if (ea && eb) return 0;
      if (ea) return 1;   // vazios sempre por último
      if (eb) return -1;
      const r = (typeof va === 'number' && typeof vb === 'number')
        ? va - vb
        : String(va).localeCompare(String(vb), 'pt-BR');
      return ordenacao.dir === 'asc' ? r : -r;
    });
  })();

  const carregar = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      // Filtro de loja vem do select local; cod_loja vai separado pro backend
      Object.entries(filtros).forEach(([k, v]) => {
        if (!v) return;
        if (k === 'loja') params.set('cod_loja', String(v));
        else params.set(k, v);
      });
      const r = await api.get(`/curriculos?${params.toString()}`);
      setCurriculos(r.data?.curriculos || []);
      setResumo(r.data?.resumo || {});
    } catch (e) { setErro(e?.response?.data?.error || e.message); }
    finally { setLoading(false); }
  };

  // Auto-carrega sempre que filtros ou loja mudarem (com debounce pra inputs de texto)
  const debounceRef = useRef(null);
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { carregar(); }, 350);
    return () => debounceRef.current && clearTimeout(debounceRef.current);
    // eslint-disable-next-line
  }, [filtros, lojaSelecionada]);

  useEffect(() => {
    (async () => {
      try {
        const [c, h, t, e] = await Promise.all([
          api.get('/curriculos/cargos'),
          api.get('/curriculos/habilidades'),
          api.get('/curriculos/tipos-vaga').catch(() => ({ data: { tipos: [] } })),
          // Lojas vem do cadastro de Configuracoes RH > Empresas (rh_empresas)
          api.get('/rh/empresas').catch(() => ({ data: [] })),
        ]);
        setCargos((c.data?.cargos || []).filter(x => x.ativo));
        setHabilidades((h.data?.habilidades || []).filter(x => x.ativo));
        setTiposVaga((t.data?.tipos || []).filter(x => x.ativo));
        const lojasArr = Array.isArray(e.data) ? e.data : (e.data?.empresas || []);
        // Ordena por codLoja ASC (matriz com codLoja null vai por ultimo)
        setLojas(lojasArr.slice().sort((a, b) => (a.codLoja ?? 999999) - (b.codLoja ?? 999999)));
      } catch {}
      // Carrega configs de mensagem (Configuracoes RH > Mensagens)
      try {
        const [r1, r2, r3, r4] = await Promise.all([
          api.get('/configurations/rh_msg_whatsapp_entrevista').catch(() => null),
          api.get('/configurations/rh_recrutadora_nome').catch(() => null),
          api.get('/configurations/client_brand_name').catch(() => null),
          api.get('/configurations/rh_msg_whatsapp_ativo').catch(() => null),
        ]);
        if (r1?.data?.value) setMsgWhatsApp(r1.data.value);
        if (r2?.data?.value) setRecrutadoraNome(r2.data.value);
        if (r3?.data?.value) setSupermercadoNome(r3.data.value);
        if (r4?.data?.value === 'false') setMsgWhatsAppAtivo(false);
      } catch {}
      // Mapeia candidatos em processo (vagas com selecionados)
      try {
        const { data: vagas } = await api.get('/rh/vagas');
        const mapa = {};
        (vagas || []).forEach(v => {
          if (Array.isArray(v.selecionados)) {
            v.selecionados.forEach(s => {
              if (s.contratado) return; // ignora ja contratado
              mapa[s.curriculo_id] = {
                vaga_id: v.id,
                vaga_titulo: v.titulo || v.cargo_nome || `Vaga #${v.id}`,
                etapa: s.pos_entrevista || s.resultado_entrevista || s.entrevista || 'selecionado',
              };
            });
          }
        });
        setEmProcesso(mapa);
      } catch {}
    })();
    carregar();
    // eslint-disable-next-line
  }, []);

  // Mapa de etapa -> label amigavel pra badge
  const etapaLabel = (e) => ({
    selecionado: 'Selecionado',
    agendada: 'Entrevista agendada',
    realizada: 'Entrevista realizada',
    passou: 'Aprovado na entrevista',
    aguarda_decisao: 'Aguarda decisao',
    nao_compareceu: 'Nao compareceu',
    reprovado: 'Reprovado',
    desistiu: 'Desistiu',
    aguarda_agendar_exames: 'Agendar exames',
    aguarda_resultado_exames: 'Aguarda exames',
    aprovado_exames: 'Aprovado nos exames',
    reprovado_exames: 'Reprovado nos exames',
  }[e] || e);

  const fmtData = (iso) => iso ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

  const salvarStatus = async (id, campo, valor) => {
    try {
      await api.put(`/curriculos/${id}`, { [campo]: valor });
      await carregar();
      if (selecionado?.id === id) {
        const r = await api.get(`/curriculos/${id}`);
        setSelecionado(r.data?.curriculo || selecionado);
      }
    } catch (e) { setErro(e?.response?.data?.error || e.message); }
  };

  const excluirCV = async (cv) => {
    if (!window.confirm(`Excluir o currículo de "${cv.nome}"?`)) return;
    try {
      await api.delete(`/curriculos/${cv.id}`);
      setSelecionado(null);
      await carregar();
    } catch (e) { setErro(e?.response?.data?.error || e.message); }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar user={user} onLogout={logout} isMobileMenuOpen={isMobileMenuOpen} setIsMobileMenuOpen={setIsMobileMenuOpen} />
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        <div className="bg-gradient-to-r from-purple-600 to-purple-500 text-white p-4 shadow">
          <div className="flex items-center gap-3">
            <button onClick={() => setIsMobileMenuOpen(true)} className="lg:hidden bg-white/20 hover:bg-white/30 rounded-lg p-2 transition">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16"/></svg>
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold">📇 Banco de Currículos</h1>
              <p className="text-xs sm:text-sm opacity-90">Currículos recebidos via link público</p>
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-6 flex-1 flex flex-col min-h-0">
          {erro && <div className="mb-3 p-3 bg-red-50 border border-red-200 text-red-700 rounded text-sm">{erro}</div>}

          {/* TOPO COLAPSÁVEL: some ao rolar a tabela pra baixo, volta ao topo */}
          <div className={`shrink-0 overflow-hidden transition-all duration-300 ${topVisivel ? 'max-h-[640px] opacity-100' : 'max-h-0 opacity-0'}`}>
          {/* Resumo */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-3">
            <Tile emoji="📇" titulo="Total" valor={resumo.total} grad="from-slate-500 to-gray-600" />
            <Tile emoji="🆕" titulo="Novo" valor={resumo.novo} grad="from-sky-500 to-blue-600" />
            <Tile emoji="🔎" titulo="Vagas Futuras" valor={resumo.em_analise} grad="from-amber-500 to-orange-600" />
            <Tile emoji="✓" titulo="Selecionado" valor={resumo.aprovado} grad="from-blue-500 to-blue-700" />
            <Tile emoji="🎉" titulo="Contratado" valor={resumo.contratado} grad="from-indigo-500 to-purple-600" />
          </div>

          {/* Filtros */}
          <div className="bg-white border border-gray-200 rounded-lg p-2 shadow-sm mb-3">
            <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
              <FiltroInput label="Buscar" value={filtros.q} placeholder="nome, whatsapp…" onChange={v => setFiltros({ ...filtros, q: v })} />
              <FiltroSelect label="Loja" value={filtros.loja} onChange={v => setFiltros({ ...filtros, loja: v })}>
                <option value="">Todas</option>
                {lojas.map(l => (
                  <option key={l.id ?? l.codLoja ?? l.cod_loja} value={l.codLoja ?? l.cod_loja ?? ''}>
                    {(l.codLoja ?? l.cod_loja) != null ? `Loja ${l.codLoja ?? l.cod_loja} - ` : ''}{l.apelido || l.nomeFantasia || l.nome_fantasia || `Loja ${l.id}`}
                  </option>
                ))}
              </FiltroSelect>
              <FiltroSelect label="Cidade" value={filtros.cidade} onChange={v => setFiltros({ ...filtros, cidade: v })}>
                <option value="">Todas</option>
                {Array.from(new Set((curriculos || [])
                    .map(c => (c.cidade || '').trim().normalize('NFD').replace(/\p{Diacritic}/gu, '').toUpperCase())
                    .filter(Boolean)))
                  .sort((a, b) => a.localeCompare(b, 'pt-BR'))
                  .map(cid => <option key={cid} value={cid}>{cid}</option>)}
              </FiltroSelect>
              <FiltroSelect label="Bairro" value={filtros.bairro} onChange={v => setFiltros({ ...filtros, bairro: v })}>
                <option value="">Todos</option>
                {Array.from(new Set((curriculos || [])
                    .filter(c => !filtros.cidade || (c.cidade || '').trim().normalize('NFD').replace(/\p{Diacritic}/gu, '').toUpperCase() === filtros.cidade)
                    .map(c => (c.bairro || '').trim().normalize('NFD').replace(/\p{Diacritic}/gu, '').toUpperCase())
                    .filter(Boolean)))
                  .sort((a, b) => a.localeCompare(b, 'pt-BR'))
                  .map(b => <option key={b} value={b}>{b}</option>)}
              </FiltroSelect>
              <FiltroSelect label="Status" value={filtros.status} onChange={v => setFiltros({ ...filtros, status: v })}>
                <option value="">Todos</option>
                {['novo','em_analise','aprovado','recusado','contratado'].map(k => { const v = STATUS_LABEL[k]; return <option key={k} value={k}>{v.emoji} {v.label}</option>; })}
              </FiltroSelect>
              <FiltroSelect label="Tipo de vaga" value={filtros.interesse_vaga} onChange={v => setFiltros({ ...filtros, interesse_vaga: v })}>
                <option value="">Todos</option>
                {tiposVaga.map(t => (
                  <option key={t.slug} value={t.slug}>
                    {t.slug === 'clt' ? '💼' : t.slug === 'aprendiz' ? '🎓' : '🎯'} {t.nome}
                  </option>
                ))}
              </FiltroSelect>
              <FiltroSelect label="Cargos com Experiência" value={filtros.cargo} onChange={v => setFiltros({ ...filtros, cargo: v })}>
                <option value="">Todos</option>
                {cargos.map(c => <option key={c.id} value={c.nome}>{c.nome}</option>)}
              </FiltroSelect>
              <FiltroSelect label="Cargos de Interesse" value={filtros.cargo_interesse} onChange={v => setFiltros({ ...filtros, cargo_interesse: v })}>
                <option value="">Todos</option>
                {cargos.map(c => <option key={c.id} value={c.nome}>{c.nome}</option>)}
              </FiltroSelect>
              <FiltroSelect label="Habilidade" value={filtros.habilidade} onChange={v => setFiltros({ ...filtros, habilidade: v })}>
                <option value="">Todas</option>
                {habilidades.map(h => <option key={h.id} value={h.nome}>{h.nome}</option>)}
              </FiltroSelect>
              <FiltroInput label="De" type="date" value={filtros.dataDe} onChange={v => setFiltros({ ...filtros, dataDe: v })} />
              <FiltroInput label="Até" type="date" value={filtros.dataAte} onChange={v => setFiltros({ ...filtros, dataAte: v })} />
              <div className="flex items-end">
                <button
                  onClick={() => setFiltros({ cidade: '', bairro: '', cargo: '', cargo_interesse: '', habilidade: '', status: '', dataDe: '', dataAte: '', q: '', interesse_vaga: '', loja: '' })}
                  className="w-full text-sm px-3 py-1.5 bg-red-500 text-white rounded font-semibold hover:bg-red-600 transition">
                  🧹 Limpar filtros
                </button>
              </div>
            </div>
          </div>
          </div>{/* fim topo colapsável */}

          {/* Lista */}
          {loading ? (
            <div className="text-gray-500 py-10 text-center">Carregando…</div>
          ) : curriculos.length === 0 ? (
            <div className="bg-white border-2 border-dashed rounded-xl p-10 text-center">
              <div className="text-5xl mb-2">📭</div>
              <div className="text-gray-600 font-semibold">Nenhum currículo encontrado.</div>
              <div className="text-xs text-gray-400 mt-1">Envie o link público pra candidatos em <strong>Modelo de Currículo</strong>.</div>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-200 flex-1 min-h-0 flex flex-col">
              {/* Tabela com altura limitada à tela: rola por dentro.
                  → cabeçalho FIXO no topo (sticky) pra sempre ver o que é cada coluna
                  → barra de rolagem horizontal SEMPRE visível no rodapé da tela */}
              <div className="flex-1 min-h-0 overflow-auto"
                onScroll={(e) => {
                  const y = e.currentTarget.scrollTop;
                  // histerese: some ao passar de 40px, volta perto do topo (<8px)
                  setTopVisivel(prev => y > 40 ? false : (y < 8 ? true : prev));
                }}>
                <table className="w-full text-sm">
                  <thead className="bg-gray-600 text-white text-xs uppercase sticky top-0 z-20">
                    <tr>
                      <ThSort label="Nº" campo="id" align="text-left" ord={ordenacao} onSort={ordenarPor} />
                      <ThSort label="Candidato" campo="nome" align="text-left" ord={ordenacao} onSort={ordenarPor} />
                      <ThSort label="Currículo PDF" campo="curriculo_pdf" align="text-center" ord={ordenacao} onSort={ordenarPor} />
                      <ThSort label="Idade" campo="idade" align="text-center" ord={ordenacao} onSort={ordenarPor} />
                      <ThSort label="Status" campo="status" align="text-left" ord={ordenacao} onSort={ordenarPor} />
                      <ThSort label="Vaga" campo="interesse_vaga" align="text-left" ord={ordenacao} onSort={ordenarPor} />
                      <ThSort label="WhatsApp" campo="whatsapp" align="text-left" ord={ordenacao} onSort={ordenarPor} />
                      <ThSort label="Instagram" campo="instagram" align="text-left" ord={ordenacao} onSort={ordenarPor} />
                      <ThSort label="Email" campo="email" align="text-left" ord={ordenacao} onSort={ordenarPor} />
                      <ThSort label="Localização" campo="localizacao" align="text-left" ord={ordenacao} onSort={ordenarPor} />
                      <ThSort label="Cargos com Experiência" campo="cargos" align="text-left" ord={ordenacao} onSort={ordenarPor} />
                      <ThSort label="Cargos de Interesse" campo="cargos_interesse" align="text-left" ord={ordenacao} onSort={ordenarPor} />
                      <ThSort label="Disponibilidade" campo="disponibilidade" align="text-left" ord={ordenacao} onSort={ordenarPor} />
                      <th className="px-2 py-1.5 text-left font-semibold">Experiências</th>
                      <th className="px-2 py-1.5 text-left font-semibold">Perfil Primário</th>
                      <th className="px-2 py-1.5 text-left font-semibold">Perfil Secundário</th>
                      <th className="px-2 py-1.5 text-left font-semibold">Entrevista</th>
                      <th className="px-2 py-1.5 text-left font-semibold">Relatório</th>
                      <ThSort label="Data" campo="data" align="text-right" ord={ordenacao} onSort={ordenarPor} />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {curriculosOrdenados.map(cv => {
                      const st = STATUS_LABEL[cv.status] || STATUS_LABEL.novo;
                      return (
                        <tr key={cv.id} onClick={() => setSelecionado(cv)}
                          className="hover:bg-rose-50/40 cursor-pointer transition">
                          {/* Numero (ID do candidato) */}
                          <td className="px-2 py-1.5 whitespace-nowrap">
                            <span className="font-mono text-xs font-bold text-gray-600 bg-gray-100 border border-gray-200 rounded px-2 py-0.5">
                              {cv.id}
                            </span>
                          </td>
                          {/* Candidato (foto + nome) */}
                          <td className="px-2 py-1.5">
                            <div className="flex items-center gap-3">
                              {cv._lgpd_foto ? (
                                // Modo demonstracao LGPD: o rosto nem chega do servidor
                                <div title="Foto oculta pelo modo demonstração LGPD"
                                  className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center shrink-0 border border-slate-500">
                                  <span className="text-[10px] leading-none">🔒</span>
                                </div>
                              ) : cv.foto_url ? (
                                <img src={cv.foto_url} alt="" className="w-7 h-7 rounded-full object-cover border border-rose-200 shrink-0" />
                              ) : (
                                <div className="w-7 h-7 rounded-full bg-rose-100 text-rose-700 text-xs flex items-center justify-center font-bold shrink-0 border border-rose-200">
                                  {cv.nome?.charAt(0).toUpperCase() || '?'}
                                </div>
                              )}
                              <div className="flex flex-col">
                                <span className="font-bold text-gray-800 whitespace-nowrap">{cv.nome}</span>
                                {emProcesso[cv.id] && (
                                  <span
                                    title={`Em processo seletivo: ${emProcesso[cv.id].vaga_titulo}`}
                                    className="inline-flex items-center gap-1 mt-0.5 text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 border border-blue-300 font-bold whitespace-nowrap w-fit"
                                  >
                                    🎯 {emProcesso[cv.id].vaga_titulo} · {etapaLabel(emProcesso[cv.id].etapa)}
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                          {/* Currículo PDF (anexo opcional pós-envio) */}
                          <td className="px-1 py-1.5 text-center">
                            {cv.curriculo_pdf_url ? (
                              <a href={cv.curriculo_pdf_url} target="_blank" rel="noopener noreferrer"
                                onClick={e => e.stopPropagation()}
                                className="text-base hover:scale-125 inline-block transition"
                                title={`Abrir currículo anexado pelo candidato${cv.curriculo_pdf_nome ? `: ${cv.curriculo_pdf_nome}` : ''}`}>
                                📄
                              </a>
                            ) : (
                              <span className="text-gray-300" title="Candidato não anexou currículo">—</span>
                            )}
                          </td>
                          {/* Idade */}
                          <td className="px-2 py-1.5 text-center whitespace-nowrap">
                            {(() => {
                              if (!cv.data_nascimento) return <span className="text-gray-300 text-xs">—</span>;
                              const nasc = new Date(cv.data_nascimento);
                              if (isNaN(nasc.getTime())) return <span className="text-gray-300 text-xs">—</span>;
                              const hoje = new Date();
                              let idade = hoje.getFullYear() - nasc.getFullYear();
                              const m = hoje.getMonth() - nasc.getMonth();
                              if (m < 0 || (m === 0 && hoje.getDate() < nasc.getDate())) idade--;
                              if (idade < 0 || idade > 120) return <span className="text-gray-300 text-xs">—</span>;
                              return <span className="inline-block text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 font-semibold">{idade} anos</span>;
                            })()}
                          </td>
                          {/* Status */}
                          <td className="px-2 py-1.5 whitespace-nowrap">
                            <span className={`inline-block text-xs px-2.5 py-1 rounded-full font-bold border ${st.bg}`}>
                              {st.emoji} {st.label}
                            </span>
                          </td>
                          {/* Vaga */}
                          <td className="px-2 py-1.5 whitespace-nowrap">
                            {cv.interesse_vaga ? (
                              <span className="inline-block text-xs px-2.5 py-1 rounded-full font-bold border bg-slate-100 text-slate-700 border-slate-300">
                                {cv.interesse_vaga === 'clt' ? '💼' : cv.interesse_vaga === 'aprendiz' ? '🎓' : '🎯'} {tipoVagaNome(cv.interesse_vaga)}
                              </span>
                            ) : <span className="text-gray-300">—</span>}
                          </td>
                          {/* WhatsApp */}
                          <td className="px-2 py-1.5 text-gray-700 whitespace-nowrap">
                            {cv.whatsapp ? (
                              <a href={waLink(cv.whatsapp, msgWhatsAppAtivo ? msgWhatsApp : '', { nome: cv.nome, supermercado: supermercadoNome, recrutadora: recrutadoraNome })} target="whatsapp_web" rel="noopener noreferrer"
                                onClick={e => e.stopPropagation()}
                                className="inline-flex items-center gap-1.5 text-emerald-600 hover:text-emerald-700 hover:underline font-medium"
                                title="Abrir conversa no WhatsApp">
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.890-5.335 11.893-11.892a11.821 11.821 0 00-3.48-8.413z"/>
                                </svg>
                                {cv.whatsapp}
                              </a>
                            ) : <span className="text-gray-300">—</span>}
                          </td>
                          {/* Instagram */}
                          <td className="px-2 py-1.5 text-gray-700 whitespace-nowrap">
                            {cv.instagram ? (
                              <a href={igLink(cv.instagram)} target="_blank" rel="noopener noreferrer"
                                onClick={e => e.stopPropagation()}
                                className="inline-flex items-center gap-1.5 text-pink-600 hover:text-pink-700 hover:underline font-medium"
                                title="Abrir perfil no Instagram">
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                                </svg>
                                {igHandle(cv.instagram)}
                              </a>
                            ) : <span className="text-gray-300">—</span>}
                          </td>
                          {/* Email */}
                          <td className="px-2 py-1.5 text-gray-700 max-w-[200px] truncate">
                            {cv.email || <span className="text-gray-300">—</span>}
                          </td>
                          {/* Localização */}
                          <td className="px-2 py-1.5 text-gray-700">
                            {(cv.cidade || cv.bairro)
                              ? [cv.bairro, cv.cidade, cv.estado].filter(Boolean).join(', ')
                              : <span className="text-gray-300">—</span>}
                          </td>
                          {/* Cargos */}
                          <td className="px-2 py-1.5">
                            <div className="flex flex-wrap gap-1">
                              {(cv.cargos || []).slice(0, 3).map((c, i) => (
                                <span key={i} className="text-xs px-2 py-0.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-full whitespace-nowrap font-semibold">{c}</span>
                              ))}
                              {cv.cargos?.length > 3 && (
                                <span className="text-xs text-gray-400 self-center font-semibold">+{cv.cargos.length - 3}</span>
                              )}
                              {(!cv.cargos || cv.cargos.length === 0) && <span className="text-gray-300">—</span>}
                            </div>
                          </td>
                          {/* Cargos de Interesse (vagas futuras, sem experiencia exigida) */}
                          <td className="px-2 py-1.5">
                            <div className="flex flex-wrap gap-1">
                              {(cv.cargos_interesse || []).slice(0, 3).map((c, i) => (
                                <span key={i} className="text-xs px-2 py-0.5 bg-sky-50 border border-sky-200 text-sky-700 rounded-full whitespace-nowrap font-semibold">{c}</span>
                              ))}
                              {cv.cargos_interesse?.length > 3 && (
                                <span className="text-xs text-gray-400 self-center font-semibold">+{cv.cargos_interesse.length - 3}</span>
                              )}
                              {(!cv.cargos_interesse || cv.cargos_interesse.length === 0) && <span className="text-gray-300">—</span>}
                            </div>
                          </td>
                          {/* Disponibilidade de Horario */}
                          <td className="px-2 py-1.5">
                            {(cv.disponibilidade_turnos && cv.disponibilidade_turnos.length > 0) ? (
                              <div className="flex flex-wrap gap-1">
                                {cv.disponibilidade_turnos.includes('qualquer') ? (
                                  <span className="text-xs px-2 py-0.5 bg-emerald-50 border border-emerald-300 text-emerald-700 rounded-full font-semibold whitespace-nowrap">✨ Qualquer</span>
                                ) : (
                                  <>
                                    {cv.disponibilidade_turnos.includes('manha') && (
                                      <span className="text-xs px-2 py-0.5 bg-amber-50 border border-amber-300 text-amber-700 rounded-full font-semibold whitespace-nowrap">🌅 Manhã</span>
                                    )}
                                    {cv.disponibilidade_turnos.includes('intermediario') && (
                                      <span className="text-xs px-2 py-0.5 bg-yellow-50 border border-yellow-300 text-yellow-700 rounded-full font-semibold whitespace-nowrap">☀️ Interm.</span>
                                    )}
                                    {cv.disponibilidade_turnos.includes('tarde') && (
                                      <span className="text-xs px-2 py-0.5 bg-orange-50 border border-orange-300 text-orange-700 rounded-full font-semibold whitespace-nowrap">🌇 Tarde</span>
                                    )}
                                  </>
                                )}
                              </div>
                            ) : (
                              <span className="text-gray-300">—</span>
                            )}
                          </td>
                          {/* Experiencias */}
                          <td className="px-2 py-1.5">
                            {(cv.experiencias_detalhadas && cv.experiencias_detalhadas.length > 0) ? (
                              <div className="flex flex-col gap-0.5 text-xs text-gray-700 max-w-[280px]">
                                {cv.experiencias_detalhadas.slice(0, 2).map((exp, i) => {
                                  const anos = Number(exp.tempo_anos) || 0;
                                  const meses = Number(exp.tempo_meses) || 0;
                                  const tempo = anos > 0 && meses > 0 ? `${anos}a ${meses}m`
                                    : anos > 0 ? `${anos}a`
                                    : meses > 0 ? `${meses}m`
                                    : '';
                                  return (
                                    <div key={i} className="truncate">
                                      <span className="font-semibold text-gray-800">{exp.funcao || '—'}</span>
                                      {exp.empresa && <span className="text-gray-500"> · {exp.empresa}</span>}
                                      {tempo && <span className="text-rose-600 font-semibold"> ({tempo})</span>}
                                    </div>
                                  );
                                })}
                                {cv.experiencias_detalhadas.length > 2 && (
                                  <span className="text-xs text-gray-400 font-semibold">+{cv.experiencias_detalhadas.length - 2} experiência(s)</span>
                                )}
                              </div>
                            ) : (
                              <span className="text-gray-300">—</span>
                            )}
                          </td>
                          {/* Perfil Primário (DISC) */}
                          <td className="px-2 py-1.5 whitespace-nowrap">
                            {cv.disc?.perfil_primario ? (
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold border ${DISC_COR[cv.disc.perfil_primario]?.bg || 'bg-gray-100'} ${DISC_COR[cv.disc.perfil_primario]?.text || 'text-gray-700'} ${DISC_COR[cv.disc.perfil_primario]?.border || 'border-gray-300'}`}>
                                {cv.disc.perfil_primario} — {DISC_NOME[cv.disc.perfil_primario]}
                              </span>
                            ) : <span className="text-gray-300">—</span>}
                          </td>
                          {/* Perfil Secundário (DISC) */}
                          <td className="px-2 py-1.5 whitespace-nowrap">
                            {cv.disc?.perfil_secundario ? (
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold border ${DISC_COR[cv.disc.perfil_secundario]?.bg || 'bg-gray-100'} ${DISC_COR[cv.disc.perfil_secundario]?.text || 'text-gray-700'} ${DISC_COR[cv.disc.perfil_secundario]?.border || 'border-gray-300'}`}>
                                {cv.disc.perfil_secundario} — {DISC_NOME[cv.disc.perfil_secundario]}
                              </span>
                            ) : <span className="text-gray-300">—</span>}
                          </td>
                          {/* Entrevista (status) */}
                          <td className="px-2 py-1.5 whitespace-nowrap">
                            {cv.entrevista ? (
                              cv.entrevista.status === 'finalizada' ? (
                                <span className="inline-block text-xs px-2 py-0.5 rounded-full font-bold border bg-emerald-100 text-emerald-800 border-emerald-300">✅ Finalizada</span>
                              ) : cv.entrevista.status === 'em_andamento' ? (
                                <span className="inline-block text-xs px-2 py-0.5 rounded-full font-bold border bg-amber-100 text-amber-800 border-amber-300">⏳ Em andamento</span>
                              ) : (
                                <span className="inline-block text-xs px-2 py-0.5 rounded-full font-bold border bg-gray-100 text-gray-700 border-gray-300">📨 Pendente</span>
                              )
                            ) : <span className="text-gray-300">—</span>}
                          </td>
                          {/* Relatório (botão -> Entrevistas Realizadas) */}
                          <td className="px-2 py-1.5 whitespace-nowrap">
                            {cv.entrevista?.tem_relatorio ? (
                              <button onClick={e => {
                                e.stopPropagation();
                                window.location.href = `/rh/recrutador/entrevistas?entrevista=${cv.entrevista.id}`;
                              }}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-indigo-100 hover:bg-indigo-200 text-indigo-800 border border-indigo-300 text-xs font-bold">
                                📄 Ver
                              </button>
                            ) : cv.entrevista ? (
                              <span className="text-xs text-gray-400 italic">aguardando</span>
                            ) : <span className="text-gray-300">—</span>}
                          </td>
                          {/* Data */}
                          <td className="px-2 py-1.5 text-gray-600 text-right whitespace-nowrap text-xs">
                            {fmtData(cv.created_at)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal de detalhe do currículo */}
      {selecionado && (
        <DetalheCV
          cv={selecionado}
          tiposVaga={tiposVaga}
          msgWhatsApp={msgWhatsApp}
          msgWhatsAppAtivo={msgWhatsAppAtivo}
          supermercadoNome={supermercadoNome}
          recrutadoraNome={recrutadoraNome}
          onFechar={() => setSelecionado(null)}
          onAtualizarStatus={(status) => salvarStatus(selecionado.id, 'status', status)}
          onAtualizarObs={(obs) => salvarStatus(selecionado.id, 'observacao_rh', obs)}
          onAtualizarAvaliacao={(n) => salvarStatus(selecionado.id, 'avaliacao_rh', n)}
          onAtualizarCargosInteresse={(cargos_interesse) => salvarStatus(selecionado.id, 'cargos_interesse', cargos_interesse)}
          onExcluir={() => excluirCV(selecionado)}
        />
      )}
    </div>
  );
}

// Cabeçalho de coluna clicável pra ordenar (A→Z / Z→A) com indicador.
function ThSort({ label, campo, align = 'text-left', ord, onSort }) {
  const ativo = ord.campo === campo;
  const justify = align === 'text-center' ? 'justify-center' : align === 'text-right' ? 'justify-end' : 'justify-start';
  return (
    <th onClick={() => onSort(campo)} title="Clique pra ordenar"
      className={`px-2 py-1.5 font-semibold ${align} cursor-pointer select-none hover:bg-gray-700 transition`}>
      <span className={`inline-flex items-center gap-1 ${justify}`}>
        {label}
        <span className={`text-[10px] ${ativo ? 'text-amber-300' : 'text-gray-400/60'}`}>
          {ativo ? (ord.dir === 'asc' ? '▲' : '▼') : '↕'}
        </span>
      </span>
    </th>
  );
}

function Tile({ emoji, titulo, valor, grad }) {
  return (
    <div className={`bg-gradient-to-br ${grad} text-white rounded-xl p-5 shadow-md`}>
      <div className="text-3xl mb-1">{emoji}</div>
      <div className="text-4xl sm:text-5xl font-extrabold leading-tight">{Number(valor || 0)}</div>
      <div className="text-base sm:text-lg font-bold opacity-95 uppercase tracking-wide mt-1">{titulo}</div>
    </div>
  );
}

function FiltroInput({ label, value, onChange, type = 'text', placeholder }) {
  return (
    <div>
      <label className="block text-xs font-bold uppercase text-gray-600 mb-0.5">{label}</label>
      <input type={type} value={value} placeholder={placeholder} onChange={e => onChange(e.target.value)}
        className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-rose-400" />
    </div>
  );
}
function FiltroSelect({ label, value, onChange, children }) {
  return (
    <div>
      <label className="block text-xs font-bold uppercase text-gray-600 mb-0.5">{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)}
        className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-rose-400">
        {children}
      </select>
    </div>
  );
}

export function DetalheCV({
  cv, tiposVaga = [],
  // Props pra montar link do WhatsApp com mensagem pre-preenchida.
  // Quando o componente e usado fora do BancoCurriculos (ex: RhVagas), essas
  // props podem nao vir — defaults garantem que o link funciona sem texto.
  msgWhatsApp = '', msgWhatsAppAtivo = false, supermercadoNome = '', recrutadoraNome = '',
  onFechar, onAtualizarStatus, onAtualizarObs, onAtualizarAvaliacao, onExcluir, onAtualizarCargosInteresse,
}) {
  const tipoVagaNome = (slug) => {
    if (!slug) return '';
    const t = tiposVaga.find(x => x.slug === slug);
    return t ? t.nome : slug.toUpperCase();
  };
  // Separa o conteudo da observacao_rh em historico (linhas auto-geradas no
  // padrao [DD/MM/AAAA] Vaga "X": Resultado) e texto livre do RH.
  // Historico aparece destacado em amarelo; textarea so edita o texto livre.
  // Ao salvar, reconcatena: historico (preservado) + \n + texto livre.
  const HISTORICO_RE = /^\[\d{2}\/\d{2}\/\d{4}\]\s*Vaga/;
  const splitObs = (raw) => {
    const linhas = String(raw || '').split('\n');
    const historico = linhas.filter(l => HISTORICO_RE.test(l));
    const livre = linhas.filter(l => !HISTORICO_RE.test(l)).join('\n').trim();
    return { historico, livre };
  };
  const inicial = splitObs(cv.observacao_rh);
  const [historico] = useState(inicial.historico);
  const [obs, setObs] = useState(inicial.livre);
  const [entrevistasIA, setEntrevistasIA] = useState([]);
  // Status efetivo: quando aberto a partir de uma vaga (RhVagas injeta
  // cv._statusLocalNaVaga), usa o status LOCAL daquela vaga. Senao usa o
  // global do curriculo (Banco de Curriculos). Fonte unica: dentro e fora
  // do modal mostram o mesmo status pra mesma vaga.
  const statusEfetivo = cv._statusLocalNaVaga != null ? cv._statusLocalNaVaga : cv.status;
  const st = STATUS_LABEL[statusEfetivo] || STATUS_LABEL.novo;
  const salvarObs = () => {
    // Reconcatena: historico (preservado) + texto livre editado pelo RH.
    const reconcat = [...historico, obs.trim()].filter(Boolean).join('\n');
    onAtualizarObs(reconcat);
  };

  // === Foto expandida ao clicar ===
  const [showFotoZoom, setShowFotoZoom] = useState(false);

  // ESC fecha a foto ampliada. Só escuta enquanto ela está aberta pra não
  // roubar o ESC de outros modais/inputs da tela.
  useEffect(() => {
    if (!showFotoZoom) return;
    const onKey = (e) => { if (e.key === 'Escape') setShowFotoZoom(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showFotoZoom]);

  // === Migrar Loja ===
  const [showMigrarLoja, setShowMigrarLoja] = useState(false);
  const [lojasDisponiveis, setLojasDisponiveis] = useState([]);
  const [lojaDestino, setLojaDestino] = useState('');
  const [migrando, setMigrando] = useState(false);

  useEffect(() => {
    if (!showMigrarLoja) return;
    api.get('/rh/empresas')
      .then(r => {
        const arr = Array.isArray(r.data) ? r.data : (r.data?.data || []);
        setLojasDisponiveis(arr);
      })
      .catch(() => {});
  }, [showMigrarLoja]);

  // === Editar Cargos de Interesse ===
  const [showEditarInteresse, setShowEditarInteresse] = useState(false);
  const [cargosCatalogo, setCargosCatalogo] = useState([]);
  const [interesseTemp, setInteresseTemp] = useState([]);
  const [salvandoInteresse, setSalvandoInteresse] = useState(false);

  useEffect(() => {
    if (!showEditarInteresse) return;
    setInteresseTemp(cv.cargos_interesse || []);
    api.get('/curriculos/cargos')
      .then(r => setCargosCatalogo(Array.isArray(r.data?.cargos) ? r.data.cargos : []))
      .catch(() => {});
    // eslint-disable-next-line
  }, [showEditarInteresse]);

  const toggleInteresseTemp = (nome) => {
    setInteresseTemp(arr => arr.includes(nome) ? arr.filter(x => x !== nome) : [...arr, nome]);
  };

  const salvarInteresse = async () => {
    setSalvandoInteresse(true);
    try {
      await onAtualizarCargosInteresse?.(interesseTemp);
      setShowEditarInteresse(false);
    } finally {
      setSalvandoInteresse(false);
    }
  };

  const migrarLoja = async () => {
    if (!lojaDestino) { alert('Selecione uma loja de destino'); return; }
    if (String(lojaDestino) === String(cv.cod_loja)) { alert('Selecione uma loja DIFERENTE da atual'); return; }
    setMigrando(true);
    try {
      await api.put(`/curriculos/${cv.id}`, { cod_loja: parseInt(lojaDestino) });
      const loja = lojasDisponiveis.find(l => String(l.codLoja ?? l.cod_loja) === String(lojaDestino));
      const nomeLoja = loja?.apelido || loja?.nomeFantasia || loja?.nome_fantasia || `Loja ${lojaDestino}`;
      alert(`✅ ${cv.nome} migrada para: ${nomeLoja}`);
      setShowMigrarLoja(false);
      setLojaDestino('');
      onFechar?.();
    } catch (e) {
      alert('❌ Erro: ' + (e.response?.data?.error || e.message));
    } finally {
      setMigrando(false);
    }
  };

  // Busca entrevistas IA (pré-entrevista) deste candidato
  useEffect(() => {
    if (!cv?.id) return;
    api.get(`/rh/recrutador/entrevistas?curriculo_id=${cv.id}`)
      .then(({ data }) => setEntrevistasIA(Array.isArray(data) ? data : []))
      .catch(() => setEntrevistasIA([]));
  }, [cv?.id]);

  const experiencias = Array.isArray(cv.experiencias_detalhadas) ? cv.experiencias_detalhadas : [];
  const formacoes = Array.isArray(cv.formacoes) ? cv.formacoes : [];

  const tempoStr = (ex) => {
    const a = Number(ex.tempo_anos) || 0;
    const m = Number(ex.tempo_meses) || 0;
    const partes = [];
    if (a > 0) partes.push(`${a} ${a === 1 ? 'ano' : 'anos'}`);
    if (m > 0) partes.push(`${m} ${m === 1 ? 'mês' : 'meses'}`);
    return partes.join(' e ');
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-2 sm:p-4" onClick={onFechar}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-[900px] max-h-[95vh] min-h-[80vh] overflow-hidden flex flex-col area-imprimir-curriculo" onClick={e => e.stopPropagation()}>
        {/* Barra de ações do RH */}
        <div className="bg-gradient-to-r from-purple-600 to-purple-500 text-white p-4 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-sm px-3 py-1 rounded-full font-bold border-2 border-white/30 ${st.bg}`}>{st.emoji} {st.label}</span>
            {cv.interesse_vaga && (
              <span className="text-sm px-3 py-1 rounded-full font-bold border-2 border-white/30 bg-white/20 text-white">
                {cv.interesse_vaga === 'clt' ? '💼' : cv.interesse_vaga === 'aprendiz' ? '🎓' : '🎯'} {(tipoVagaNome(cv.interesse_vaga) || '').toUpperCase()}
              </span>
            )}
            <span className="text-sm opacity-90">Recebido em {new Date(cv.created_at).toLocaleString('pt-BR')}</span>
          </div>
          <div className="flex items-center gap-2 print:hidden">
            <button
              onClick={() => {
                document.body.classList.add('printing-curriculo');
                setTimeout(() => { window.print(); setTimeout(() => document.body.classList.remove('printing-curriculo'), 500); }, 100);
              }}
              title="Imprimir currículo em PDF"
              className="bg-white/15 hover:bg-white/30 text-white text-sm font-bold px-3 py-1.5 rounded-lg border border-white/30 flex items-center gap-1.5"
            >
              🖨️ PDF
            </button>
            <button onClick={onFechar} className="text-white/80 hover:text-white text-3xl font-bold leading-none">×</button>
          </div>
        </div>

        {/* CV — Layout 2 colunas (igual modelo Maria Sá Vieira) */}
        <div className="flex-1 min-w-0 overflow-auto overflow-x-hidden">
          <div className="grid grid-cols-1 md:grid-cols-[280px_1fr]">

            {/* ============ Coluna esquerda (escura) ============ */}
            <aside className="bg-slate-800 text-white p-5 space-y-5">
              {/* Foto */}
              <div className="flex justify-center">
                {cv._lgpd_foto ? (
                  // Modo demonstracao LGPD: o rosto nem chega do servidor
                  <div title="Foto oculta pelo modo demonstração LGPD"
                    className="w-36 h-36 rounded-full bg-slate-700 flex flex-col items-center justify-center gap-1 border-4 border-white/20">
                    <span className="text-4xl leading-none">🔒</span>
                    <span className="text-[10px] uppercase tracking-wider text-slate-300 font-bold">Foto oculta</span>
                  </div>
                ) : cv.foto_url ? (
                  <img src={cv.foto_url} alt="" onClick={() => setShowFotoZoom(true)}
                    title="Clique pra ampliar"
                    className="w-36 h-36 rounded-full object-cover border-4 border-white/20 cursor-zoom-in hover:border-white/60 transition" />
                ) : (
                  <div className="w-36 h-36 rounded-full bg-slate-600 text-slate-300 flex items-center justify-center text-5xl font-bold border-4 border-white/20">
                    {cv.nome?.charAt(0).toUpperCase() || '?'}
                  </div>
                )}
              </div>

              {/* Contato */}
              <section>
                <h4 className="text-sm font-bold uppercase tracking-wider border-b border-white/20 pb-2 mb-3">📞 Contato</h4>
                <div className="text-base space-y-2">
                  {cv.whatsapp && (
                    <a href={waLink(cv.whatsapp, msgWhatsAppAtivo ? msgWhatsApp : '', { nome: cv.nome, supermercado: supermercadoNome, recrutadora: recrutadoraNome })} target="whatsapp_web" rel="noopener noreferrer"
                      className="flex gap-2 items-center text-emerald-600 hover:text-emerald-700 hover:underline">
                      <span>📱</span><span className="font-medium">{cv.whatsapp}</span>
                      <svg className="w-3 h-3 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
                      </svg>
                    </a>
                  )}
                  {cv.email && <div className="flex gap-2 break-all"><span>✉️</span><span>{cv.email}</span></div>}
                  {cv.instagram && (
                    <a href={igLink(cv.instagram)} target="_blank" rel="noopener noreferrer"
                      className="flex gap-2 items-center text-pink-600 hover:text-pink-700 hover:underline break-all">
                      <span>📷</span><span className="font-medium">{igHandle(cv.instagram)}</span>
                      <svg className="w-3 h-3 ml-auto shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
                      </svg>
                    </a>
                  )}
                  {(cv.cidade || cv.bairro) && (
                    <div className="flex gap-2"><span>📍</span><span>{[cv.bairro, cv.cidade, cv.estado].filter(Boolean).join(', ')}</span></div>
                  )}
                  {cv.data_nascimento && (() => {
                    // Calcula idade respeitando mes/dia
                    const nasc = new Date(cv.data_nascimento);
                    let idade = null;
                    if (!isNaN(nasc.getTime())) {
                      const hoje = new Date();
                      idade = hoje.getFullYear() - nasc.getFullYear();
                      const m = hoje.getMonth() - nasc.getMonth();
                      if (m < 0 || (m === 0 && hoje.getDate() < nasc.getDate())) idade--;
                      if (idade < 0 || idade > 120) idade = null;
                    }
                    return (
                      <div className="flex gap-2">
                        <span>🎂</span>
                        <span>
                          {nasc.toLocaleDateString('pt-BR')}
                          {idade != null && (
                            <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-white/10 text-white/90 font-semibold">
                              {idade} anos
                            </span>
                          )}
                        </span>
                      </div>
                    );
                  })()}
                </div>
              </section>

              {/* Habilidades */}
              {cv.habilidades?.length > 0 && (
                <section>
                  <h4 className="text-sm font-bold uppercase tracking-wider border-b border-white/20 pb-2 mb-3">🔧 Habilidades</h4>
                  <ul className="text-base space-y-1.5">
                    {cv.habilidades.map((h, i) => (
                      <li key={i} className="flex gap-2"><span className="text-rose-300">•</span><span>{h}</span></li>
                    ))}
                  </ul>
                </section>
              )}

              {/* Formação acadêmica */}
              {formacoes.length > 0 && (
                <section>
                  <h4 className="text-sm font-bold uppercase tracking-wider border-b border-white/20 pb-2 mb-3">🎓 Formação</h4>
                  <div className="text-base space-y-2.5">
                    {formacoes.map((f, i) => (
                      <div key={i}>
                        <div className="font-semibold">
                          {f.curso || '—'}
                          {f.status && f.status !== 'concluido' && <span className="ml-1 text-slate-300 italic font-normal">({f.status})</span>}
                        </div>
                        {f.nome_curso && (
                          <div className="text-slate-300 text-sm">{f.nome_curso}</div>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Cursos complementares */}
              {Array.isArray(cv.cursos_adicionais) && cv.cursos_adicionais.length > 0 && (
                <section>
                  <h4 className="text-sm font-bold uppercase tracking-wider border-b border-white/20 pb-2 mb-3">📖 Cursos</h4>
                  <div className="text-base space-y-2.5">
                    {cv.cursos_adicionais
                      .map(c => typeof c === 'string' ? { nome: c, instituicao: '', tempo: '' } : c)
                      .filter(c => c?.nome && c.nome.trim())
                      .map((c, i) => (
                        <div key={i}>
                          <div className="flex gap-2 font-semibold">
                            <span className="text-sky-300">•</span>
                            <span className="flex-1">{c.nome}</span>
                          </div>
                          {(c.instituicao || c.tempo) && (
                            <div className="text-slate-300 text-sm ml-4">
                              {[c.instituicao, c.tempo].filter(Boolean).join(' · ')}
                            </div>
                          )}
                        </div>
                      ))}
                  </div>
                </section>
              )}

              {/* Informações adicionais */}
              {cv.experiencia_texto && (
                <section>
                  <h4 className="text-sm font-bold uppercase tracking-wider border-b border-white/20 pb-2 mb-3">ℹ️ Informações</h4>
                  <div className="text-base whitespace-pre-wrap text-slate-200">{cv.experiencia_texto}</div>
                </section>
              )}
            </aside>

            {/* ============ Coluna direita (claro) ============ */}
            <main className="p-6 space-y-5 bg-white">
              {/* Nome destaque */}
              <div>
                <h2 className="text-3xl sm:text-4xl font-bold text-rose-700 leading-tight">{cv.nome}</h2>
                {cv.cargos?.length > 0 && (
                  <div className="text-base text-gray-600 mt-2 font-semibold">{cv.cargos.slice(0, 3).join(' · ')}</div>
                )}
              </div>

              {/* PDF que o proprio candidato anexou na tela de sucesso (opcional) */}
              {cv.curriculo_pdf_url && (
                <section>
                  <h3 className="text-base font-bold uppercase tracking-wider text-rose-700 border-b-2 border-rose-200 pb-2 mb-3">Currículo em PDF</h3>
                  <a href={cv.curriculo_pdf_url} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-sky-50 border-2 border-sky-300 rounded-lg text-sky-800 font-semibold hover:bg-sky-100">
                    📎 <span className="break-all">{cv.curriculo_pdf_nome || 'Abrir arquivo enviado pelo candidato'}</span>
                  </a>
                </section>
              )}

              {/* Resumo */}
              {cv.resumo && (
                <section>
                  <h3 className="text-base font-bold uppercase tracking-wider text-rose-700 border-b-2 border-rose-200 pb-2 mb-3">Resumo</h3>
                  <p className="text-base text-gray-700 whitespace-pre-wrap leading-relaxed">{cv.resumo}</p>
                </section>
              )}

              {/* Experiências detalhadas */}
              {experiencias.length > 0 && (
                <section>
                  <h3 className="text-base font-bold uppercase tracking-wider text-rose-700 border-b-2 border-rose-200 pb-2 mb-3">Experiências</h3>
                  <div className="space-y-4">
                    {experiencias.map((ex, i) => (
                      <div key={i} className="border-l-4 border-rose-300 pl-4">
                        <div className="flex items-baseline justify-between gap-2 flex-wrap">
                          <h4 className="text-lg font-bold text-gray-800">{ex.funcao || '(sem função)'}</h4>
                          {tempoStr(ex) && <span className="text-sm text-gray-500 font-semibold">{tempoStr(ex)}</span>}
                        </div>
                        {ex.empresa && (
                          <div className="text-base text-gray-600 mt-0.5">
                            {ex.empresa}
                            {ex.empresa_instagram && (
                              <span className="ml-2 text-rose-600">· {ex.empresa_instagram}</span>
                            )}
                          </div>
                        )}
                        {ex.descricao && (
                          <p className="text-base text-gray-700 mt-2 whitespace-pre-wrap leading-relaxed">{ex.descricao}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Fallback: apenas lista de cargos sem detalhes */}
              {experiencias.length === 0 && cv.cargos?.length > 0 && (
                <section>
                  <h3 className="text-base font-bold uppercase tracking-wider text-rose-700 border-b-2 border-rose-200 pb-2 mb-3">Experiências como</h3>
                  <div className="flex flex-wrap gap-2">
                    {cv.cargos.map((c, i) => <span key={i} className="text-sm px-3 py-1 bg-rose-100 border border-rose-300 text-rose-800 rounded-full font-semibold">{c}</span>)}
                  </div>
                </section>
              )}

              {/* Cargo se Candidatado (auto, da vaga que ele se candidatou) + Cargos de Interesse (voluntario) */}
              {(() => {
                const vagaAplicada = cv.cargos_vaga_aplicada || [];
                const interesseTodos = cv.cargos_interesse || [];
                const interesseVoluntario = interesseTodos.filter(c => !vagaAplicada.includes(c));
                return (
                <>
                  {vagaAplicada.length > 0 && (
                    <section>
                      <h3 className="text-base font-bold uppercase tracking-wider text-amber-700 border-b-2 border-amber-200 pb-2 mb-3">Cargo se Candidatado</h3>
                      <div className="flex flex-wrap gap-2">
                        {vagaAplicada.map((c, i) => (
                          <span key={i} className="text-sm px-3 py-1 bg-amber-100 border border-amber-300 text-amber-800 rounded-full font-semibold">{c}</span>
                        ))}
                      </div>
                    </section>
                  )}
                  <section>
                    <div className="flex items-center justify-between border-b-2 border-sky-200 pb-2 mb-3">
                      <h3 className="text-base font-bold uppercase tracking-wider text-sky-700">Outros Cargos de Interesse</h3>
                      {onAtualizarCargosInteresse && (
                        <button onClick={() => setShowEditarInteresse(true)}
                          className="text-xs px-3 py-1 bg-sky-100 text-sky-700 rounded-full font-bold hover:bg-sky-200">
                          ✏️ Editar
                        </button>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {interesseVoluntario.map((c, i) => (
                        <span key={i} className="text-sm px-3 py-1 bg-sky-100 border border-sky-300 text-sky-800 rounded-full font-semibold">{c}</span>
                      ))}
                      {interesseVoluntario.length === 0 && <span className="text-gray-400 text-sm">Nenhum</span>}
                    </div>
                  </section>
                </>
                );
              })()}

              {/* Endereço completo */}
              {(cv.rua || cv.cidade) && (
                <section>
                  <h3 className="text-base font-bold uppercase tracking-wider text-rose-700 border-b-2 border-rose-200 pb-2 mb-3">Endereço completo</h3>
                  <p className="text-base text-gray-700 leading-relaxed">
                    {[cv.rua, cv.numero, cv.complemento].filter(Boolean).join(', ')}
                    {cv.bairro && <>, {cv.bairro}</>}
                    <br />
                    {[cv.cidade, cv.estado].filter(Boolean).join(' - ')}
                    {cv.cep && <> · CEP {cv.cep}</>}
                  </p>
                </section>
              )}

              {/* Seção: Perfil DISC */}
              {(cv.disc?.perfil_primario || cv.disc?.perfil_secundario) && (
                <section className="pt-5 border-t-2 border-gray-100">
                  <h3 className="text-base font-bold uppercase tracking-wider text-gray-700 mb-3">🧠 Perfil DISC</h3>
                  <div className="flex flex-wrap gap-3">
                    {cv.disc?.perfil_primario && (
                      <div className={`px-4 py-3 rounded-lg border-2 ${DISC_COR[cv.disc.perfil_primario]?.bg || 'bg-gray-100'} ${DISC_COR[cv.disc.perfil_primario]?.border || 'border-gray-300'}`}>
                        <div className="text-[10px] uppercase font-bold tracking-wider opacity-70">Primário</div>
                        <div className={`text-lg font-bold ${DISC_COR[cv.disc.perfil_primario]?.text || 'text-gray-800'}`}>
                          {cv.disc.perfil_primario} — {DISC_NOME[cv.disc.perfil_primario]}
                        </div>
                      </div>
                    )}
                    {cv.disc?.perfil_secundario && (
                      <div className={`px-4 py-3 rounded-lg border-2 ${DISC_COR[cv.disc.perfil_secundario]?.bg || 'bg-gray-100'} ${DISC_COR[cv.disc.perfil_secundario]?.border || 'border-gray-300'}`}>
                        <div className="text-[10px] uppercase font-bold tracking-wider opacity-70">Secundário</div>
                        <div className={`text-lg font-bold ${DISC_COR[cv.disc.perfil_secundario]?.text || 'text-gray-800'}`}>
                          {cv.disc.perfil_secundario} — {DISC_NOME[cv.disc.perfil_secundario]}
                        </div>
                      </div>
                    )}
                  </div>
                </section>
              )}

              {/* Seção: Pré-Entrevista IA */}
              {entrevistasIA.length > 0 && (
                <section className="pt-5 border-t-2 border-gray-100">
                  <h3 className="text-base font-bold uppercase tracking-wider text-gray-700 mb-3">🤖 Pré-Entrevista IA</h3>
                  <div className="space-y-2">
                    {entrevistasIA.map(e => (
                      <a
                        key={e.id}
                        href={`/rh/recrutador/entrevistas/${e.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between p-3 bg-violet-50 hover:bg-violet-100 border-2 border-violet-200 rounded-lg transition group"
                      >
                        <div>
                          <div className="font-semibold text-violet-900 group-hover:underline">
                            {e.vaga_titulo || 'Entrevista'} →
                          </div>
                          <div className="text-xs text-violet-700 mt-0.5">
                            {e.created_at && new Date(e.created_at).toLocaleString('pt-BR')}
                            {' · '}
                            <span className="px-1.5 py-0.5 bg-white rounded text-[10px] font-bold uppercase">{e.status}</span>
                            {e.score_final != null && <span className="ml-2">Score: <strong>{e.score_final}</strong></span>}
                          </div>
                        </div>
                        <span className="text-violet-600 text-2xl">▶</span>
                      </a>
                    ))}
                  </div>
                </section>
              )}

              {/* Seção de avaliação do RH */}
              <section className="pt-5 border-t-2 border-gray-100">
                <h3 className="text-base font-bold uppercase tracking-wider text-gray-700 mb-3">⭐ Avaliação do RH</h3>
                <div className="flex items-center gap-1 mb-3">
                  {[1, 2, 3, 4, 5].map(n => (
                    <button key={n} onClick={() => onAtualizarAvaliacao(n)}
                      className={`text-4xl transition ${cv.avaliacao_rh >= n ? 'text-amber-400' : 'text-gray-300 hover:text-amber-300'}`}>★</button>
                  ))}
                  {cv.avaliacao_rh != null && (
                    <button onClick={() => onAtualizarAvaliacao(null)} className="ml-2 text-sm text-gray-500 hover:text-gray-700 underline">limpar</button>
                  )}
                </div>
                <label className="text-sm font-bold uppercase text-gray-600 block mb-1">Observação interna</label>
                {/* Historico de processo seletivo (auto-gerado, somente leitura) */}
                {historico.length > 0 && (
                  <div className="mb-2 bg-amber-50 border-2 border-amber-300 rounded-lg p-3">
                    <div className="text-xs font-bold uppercase text-amber-700 mb-1">📋 Histórico de processo seletivo</div>
                    <ul className="space-y-1">
                      {historico.map((l, i) => (
                        <li key={i} className="text-sm text-amber-900 font-medium">{l}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <textarea value={obs} onChange={e => setObs(e.target.value)} onBlur={salvarObs} rows={3}
                  placeholder="Ex: entrevistei, gostei, mandar pro gerente…"
                  className="w-full border-2 border-gray-200 rounded-lg px-3 py-2.5 text-base focus:outline-none focus:border-rose-400" />
              </section>
            </main>
          </div>
        </div>

        {/* Rodapé com ações */}
        <div className="p-4 border-t bg-gray-50 flex justify-between gap-2 flex-wrap">
          <div className="flex gap-2 flex-wrap">
            {['novo','em_analise','aprovado','recusado','contratado'].map((key) => {
              const s = STATUS_LABEL[key];
              // Marca botao Recusado como ativo se status atual for 'recusado' ou alias antigo 'reprovado'
              const ativo = statusEfetivo === key || (key === 'recusado' && statusEfetivo === 'reprovado');
              return (
                <button key={key} onClick={() => onAtualizarStatus(key)}
                  className={`text-sm px-4 py-2 border-2 rounded-lg font-bold ${ativo ? s.bg + ' border-current' : 'border-gray-200 text-gray-600 hover:bg-gray-100'}`}>
                  {s.emoji} {s.label}
                </button>
              );
            })}
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowMigrarLoja(true)} className="text-sm px-4 py-2 border-2 border-purple-200 text-purple-700 rounded-lg font-bold hover:bg-purple-50">🔄 Migrar Loja</button>
            <button onClick={onExcluir} className="text-sm px-4 py-2 border-2 border-red-200 text-red-600 rounded-lg font-bold hover:bg-red-50">🗑️ Excluir</button>
            <button onClick={onFechar} className="text-sm px-4 py-2 bg-gray-200 rounded-lg font-bold hover:bg-gray-300">Fechar</button>
          </div>
        </div>
      </div>

      {/* Foto ampliada (clicar no avatar) */}
      {showFotoZoom && cv.foto_url && (
        <div className="fixed inset-0 bg-black/85 z-[70] flex items-center justify-center p-4 cursor-zoom-out"
          onClick={() => setShowFotoZoom(false)}>
          {/* Nome e Fechar ficam ABAIXO da foto (não sobrepostos), por isso a
              imagem cede altura: 92vh não caberia junto com os dois. */}
          <div className="flex flex-col items-center gap-3">
            <img src={cv.foto_url} alt={cv.nome}
              className="max-w-[92vw] max-h-[74vh] object-contain rounded-lg shadow-2xl" />
            <div className="bg-black/60 text-white text-sm px-4 py-2 rounded-full">{cv.nome}</div>
            <button onClick={() => setShowFotoZoom(false)}
              className="px-8 py-2.5 bg-white/90 hover:bg-white text-gray-800 rounded-lg font-bold text-sm shadow-lg">
              Fechar
            </button>
            <div className="text-white/50 text-[11px]">ou aperte ESC</div>
          </div>
          <button onClick={() => setShowFotoZoom(false)}
            className="absolute top-4 right-4 text-white/80 hover:text-white text-5xl leading-none">×</button>
        </div>
      )}

      {/* CSS print: imprime SO o conteudo do modal usando visibility (nao display)
          pra preservar a hierarquia React. Forca grid 2 colunas + cores
          de fundo (slate-800 do aside) usando print-color-adjust: exact */}
      <style>{`
        @media print {
          @page { size: A4; margin: 0; }
          html, body { background: white !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          body.printing-curriculo * { visibility: hidden !important; }
          body.printing-curriculo .area-imprimir-curriculo,
          body.printing-curriculo .area-imprimir-curriculo * { visibility: visible !important; }
          body.printing-curriculo .area-imprimir-curriculo {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            min-height: 100vh !important;
            max-height: none !important;
            box-shadow: none !important;
            border-radius: 0 !important;
            overflow: visible !important;
            display: block !important;
          }
          /* Forca o grid 2 colunas igual desktop (Tailwind md: nao ativa no print) */
          body.printing-curriculo .area-imprimir-curriculo .grid {
            display: grid !important;
            grid-template-columns: 280px 1fr !important;
          }
          /* Garante que a aside escura imprime com fundo (Chrome respeita print-color-adjust) */
          body.printing-curriculo .area-imprimir-curriculo aside {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          /* Permite o conteudo fluir entre paginas */
          body.printing-curriculo .area-imprimir-curriculo .flex-1 { overflow: visible !important; }
          body.printing-curriculo .print\\:hidden { display: none !important; }
        }
      `}</style>

      {/* Modal: Migrar Loja */}
      {showMigrarLoja && (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4" onClick={() => !migrando && setShowMigrarLoja(false)}>
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full" onClick={e => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white p-4 rounded-t-xl">
              <h3 className="font-bold text-lg">🔄 Migrar candidata pra outra loja</h3>
              <p className="text-xs opacity-90 mt-0.5">{cv.nome}</p>
            </div>
            <div className="p-5 space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800">
                ℹ️ Isso muda a <strong>loja de origem</strong> do currículo no banco. A candidata vai sumir do filtro da loja atual e aparecer no filtro da loja escolhida.
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Loja atual</label>
                <input value={`Loja ${cv.cod_loja ?? '—'}`} readOnly className="w-full bg-gray-50 border-2 border-gray-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Migrar para *</label>
                <select value={lojaDestino} onChange={e => setLojaDestino(e.target.value)}
                  className="w-full border-2 border-purple-300 focus:border-purple-500 rounded-lg px-3 py-2 text-sm outline-none">
                  <option value="">Selecione a loja de destino...</option>
                  {lojasDisponiveis
                    .filter(l => (l.codLoja ?? l.cod_loja) != null && String(l.codLoja ?? l.cod_loja) !== String(cv.cod_loja))
                    .map(l => (
                      <option key={l.id ?? l.codLoja ?? l.cod_loja} value={l.codLoja ?? l.cod_loja}>
                        Loja {l.codLoja ?? l.cod_loja} - {l.apelido || l.nomeFantasia || l.nome_fantasia || `Loja ${l.id}`}
                      </option>
                    ))}
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t">
                <button onClick={() => setShowMigrarLoja(false)} disabled={migrando} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded font-semibold">Cancelar</button>
                <button onClick={migrarLoja} disabled={migrando || !lojaDestino}
                  className="px-5 py-2 text-sm font-bold bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50 text-white rounded-lg shadow">
                  {migrando ? '⏳ Migrando...' : '🚀 Confirmar migração'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Editar Cargos de Interesse */}
      {showEditarInteresse && (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4" onClick={() => !salvandoInteresse && setShowEditarInteresse(false)}>
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-sky-600 to-blue-600 text-white p-4 rounded-t-xl">
              <h3 className="font-bold text-lg">🔭 Cargos de Interesse</h3>
              <p className="text-xs opacity-90 mt-0.5">{cv.nome} · marque ou tire as áreas de interesse</p>
            </div>
            <div className="p-5 overflow-y-auto">
              <div className="grid grid-cols-2 gap-2">
                {cargosCatalogo.map(c => (
                  <label key={c.id} className={`flex items-center gap-2 p-2 border-2 rounded-lg cursor-pointer text-sm ${interesseTemp.includes(c.nome) ? 'border-sky-400 bg-sky-50' : 'border-gray-200 hover:border-sky-200'}`}>
                    <input type="checkbox" checked={interesseTemp.includes(c.nome)} onChange={() => toggleInteresseTemp(c.nome)}
                      className="w-4 h-4 accent-sky-500" />
                    <span className="text-gray-700 font-semibold">{c.nome}</span>
                  </label>
                ))}
                {cargosCatalogo.length === 0 && <div className="text-sm text-gray-400 col-span-2">Carregando cargos…</div>}
              </div>
            </div>
            <div className="flex justify-end gap-2 p-4 border-t bg-gray-50 rounded-b-xl">
              <button onClick={() => setShowEditarInteresse(false)} disabled={salvandoInteresse} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded font-semibold">Cancelar</button>
              <button onClick={salvarInteresse} disabled={salvandoInteresse}
                className="px-5 py-2 text-sm font-bold bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-700 hover:to-blue-700 disabled:opacity-50 text-white rounded-lg shadow">
                {salvandoInteresse ? '⏳ Salvando...' : '💾 Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

