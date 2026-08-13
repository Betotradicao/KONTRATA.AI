import { useState, useEffect, useRef } from 'react';
import api from '../../services/api';

/**
 * PADRÃO DE ENCARTE
 * -----------------
 * O RH sobe UMA arte de REFERÊNCIA por cargo (a que já tem a cara da empresa:
 * cores, logo, estilo), preenche os dados da vaga e clica em Criar.
 * A IA monta a arte nova mantendo a identidade visual da referência.
 *
 * ⚠️ A arte gerada NUNCA baixa sozinha: fica em conferência com botão de gerar
 * de novo. Modelo de imagem erra texto de vez em quando, e salário errado num
 * anúncio publicado é problema de verdade.
 */

const PRESETS = {
  feed_4_5:   { label: 'Feed 4:5 (retrato)' },
  feed_1_1:   { label: 'Feed 1:1 (quadrado)' },
  story_9_16: { label: 'Story / Reels' },
};

// A Jornada tem bloco proprio (select + horarios), igual a tela de Vagas —
// por isso nao entra nesta lista de campos de texto solto.
const CAMPOS = [
  { chave: 'cargo',       label: 'Cargo',       linhas: 1, dica: 'AUXILIAR ADMINISTRATIVO' },
  { chave: 'salario',     label: 'Salário',     linhas: 1, dica: 'R$ 2.101,34' },
  { chave: 'experiencia', label: 'Experiência', linhas: 2, dica: 'Não exige experiência' },
  { chave: 'atividades',  label: 'Atividades',  linhas: 5, dica: 'Recebimento e conferência de notas\nEntrada de notas fiscais no sistema' },
  { chave: 'beneficios',  label: 'Benefícios',  linhas: 3, dica: 'Vale-transporte\nVale-refeição\nPlano de saúde' },
  { chave: 'diferencial', label: 'Diferencial', linhas: 3, dica: 'Experiência com faturamento e rotinas sistêmicas' },
];

// MESMA lista da tela de Vagas (RhVagas.jsx) — encarte e vaga precisam falar a
// mesma língua, senão o RH marca "Tarde" na vaga e vê outro nome no encarte.
const TURNOS = [
  { key: 'manha',         label: 'Turno Manhã' },
  { key: 'intermediario', label: 'Turno Intermediário' },
  { key: 'tarde',         label: 'Turno Tarde' },
  { key: 'qualquer',      label: 'Qualquer horário' },
];

/** Monta o texto da jornada a partir do que foi escolhido — é isso que vai na arte. */
function textoJornada(j) {
  if (!j) return '';
  const linhas = [];
  const turnos = (j.turnos || []).map(k => TURNOS.find(t => t.key === k)?.label).filter(Boolean);
  if (turnos.length) linhas.push(turnos.join(' · '));
  if (j.escala_nome) linhas.push(`Escala ${j.escala_nome}`);
  if (j.jornada_nome) linhas.push(j.jornada_nome);
  if (j.hora_entrada && j.hora_saida) linhas.push(`Das ${j.hora_entrada} às ${j.hora_saida}`);
  else if (j.hora_entrada) linhas.push(`A partir das ${j.hora_entrada}`);
  if (j.hora_almoco_ini && j.hora_almoco_fim) linhas.push(`Intervalo das ${j.hora_almoco_ini} às ${j.hora_almoco_fim}`);
  return linhas.join('\n');
}

/**
 * Duas variações são geradas a cada clique, porque o destino muda a chamada:
 * - FEED (post orgânico): manda o candidato pro link da bio.
 * - ANÚNCIO (impulsionado): o botão fica ABAIXO da imagem, então a arte precisa
 *   apontar pra baixo. Dizer "link da bio" num anúncio manda a pessoa pro
 *   lugar errado e queima verba.
 */
const BASE_ORIENTACAO =
`Faça uma arte de divulgação de vaga seguindo FIELMENTE a imagem de referência: mesma paleta de cores, mesmo logotipo, mesmo estilo e mesma disposição dos blocos.
Troque apenas os dados da vaga pelos preenchidos abaixo, escrevendo cada texto exatamente como está.
Cada informação deve ficar em um cartão/bloco próprio, com o ícone correspondente, e o cargo deve ser o texto de maior destaque.`;

const ORIENTACAO_FEED =
`${BASE_ORIENTACAO}
Mantenha a chamada do topo ("TEMOS VAGA!") e o rodapé com o convite "INTERESSADO? CLIQUE NO LINK DA BIO".`;

const ORIENTACAO_ANUNCIO =
`${BASE_ORIENTACAO}
Esta versão é para ANÚNCIO PAGO (impulsionamento), não para post orgânico.
Mantenha a chamada do topo ("TEMOS VAGA!") e troque o rodapé por "INTERESSADO? CLIQUE NO LINK ABAIXO", com uma seta apontando para baixo.
Não escreva "link da bio" em lugar nenhum.`;

const VARIACOES = [
  { id: 'feed',    titulo: 'Feed (orgânico)',   sub: 'link da bio',    padrao: ORIENTACAO_FEED },
  { id: 'anuncio', titulo: 'Anúncio (pago)',    sub: 'link abaixo',    padrao: ORIENTACAO_ANUNCIO },
];

export default function PadraoEncarteTab() {
  const [cargos, setCargos] = useState([]);
  const [modelos, setModelos] = useState([]);
  const [cargoId, setCargoId] = useState('');
  const [modelo, setModelo] = useState(null);
  const [valores, setValores] = useState({});
  const [orientacoes, setOrientacoes] = useState({ feed: ORIENTACAO_FEED, anuncio: ORIENTACAO_ANUNCIO });
  const [preset, setPreset] = useState('feed_4_5');
  const [gerando, setGerando] = useState({});   // { feed: true, anuncio: true }
  const [salvando, setSalvando] = useState(false);
  const [resultados, setResultados] = useState({});  // { feed: url, anuncio: url }
  const [ampliada, setAmpliada] = useState(null);   // url em tela cheia
  const [msg, setMsg] = useState(null);
  // Bloco de jornada estruturado (espelha a tela de Vagas) + dados vindos da vaga
  const [jornadas, setJornadas] = useState([]);
  const [escalas, setEscalas] = useState([]);
  const [jornada, setJornada] = useState({ jornada_id: '', jornada_nome: '', escala_id: '', escala_nome: '', turnos: [], hora_entrada: '', hora_almoco_ini: '', hora_almoco_fim: '', hora_saida: '' });
  const [daVaga, setDaVaga] = useState(null);
  // Envio pro WhatsApp
  const [enviando, setEnviando] = useState(false);
  const [gruposWhats, setGruposWhats] = useState(null);   // null = ainda carregando
  const [legendaWhats, setLegendaWhats] = useState('');

  const arquivoRef = useRef(null);
  // `gerando` é objeto — {} é truthy, então NUNCA usar ele direto num disabled.
  const ocupado = Object.values(gerando).some(Boolean);

  useEffect(() => {
    api.get('/rh/configuracoes/cargos').then(r => setCargos(r.data?.data || r.data || [])).catch(() => setCargos([]));
    carregarGruposWhats();
    recarregar();
  }, []);

  const recarregar = () =>
    api.get('/rh/encarte/modelos').then(r => setModelos(r.data?.data || [])).catch(() => setModelos([]));

  /**
   * Grupos configurados pro envio. Precisa ser rechamavel: o RH salva os grupos
   * na aba de Rede, volta pra ca e o botao continuaria travado ate dar F5.
   */
  const carregarGruposWhats = (avisar = false) =>
    api.get('/rh/encarte/whatsapp/grupos').then(r => {
      const d = r.data?.data || {};
      setGruposWhats(d.grupos || []);
      if (!legendaWhats) setLegendaWhats(d.legendaPadrao || '');
      if (avisar) {
        setMsg((d.grupos || []).length
          ? { t: 'ok', m: `${d.grupos.length} grupo(s) encontrado(s).` }
          : { t: 'erro', m: 'Ainda nenhum grupo salvo em Grupos WhatsApp → Encartes de Vaga.' });
      }
    }).catch(() => setGruposWhats([]));

  // Troca de cargo: carrega a referência salva E os dados já cadastrados na vaga
  useEffect(() => {
    setResultados({});
    setDaVaga(null);
    const url = cargoId ? `/rh/encarte/modelos/cargo/${cargoId}` : '/rh/encarte/modelos';

    api.get(url).then(r => {
      let m = cargoId
        ? (r.data?.data || null)
        : ((r.data?.data || []).find(x => x.cargo_id === null) || null);
      if (cargoId && m && m.cargo_id !== Number(cargoId)) m = { ...m, id: null, cargo_id: Number(cargoId) };
      setModelo(m);
      setPreset(m?.preset_export || 'feed_4_5');
      const salvos = (m?.campos && typeof m.campos === 'object' && !Array.isArray(m.campos)) ? m.campos : {};
      setOrientacoes({
        feed: salvos.orientacao_feed || salvos.orientacao || ORIENTACAO_FEED,
        anuncio: salvos.orientacao_anuncio || ORIENTACAO_ANUNCIO,
      });

      if (!cargoId) { setValores(salvos); setJornadas([]); setEscalas([]); return; }

      // Puxa o que já está cadastrado na VAGA daquele cargo.
      // ⚠️ O que o RH já editou e salvou no modelo TEM PRECEDÊNCIA sobre a vaga —
      // senão a cada abertura da tela o ajuste manual dele seria sobrescrito.
      api.get(`/rh/encarte/dados-vaga/${cargoId}`).then(rv => {
        const d = rv.data?.data;
        setDaVaga(d);
        setJornadas(d?.jornadas || []);
        setEscalas(d?.escalas || []);
        const s = d?.sugestao || {};
        setValores({
          cargo:       salvos.cargo       || s.cargo       || '',
          salario:     salvos.salario     || s.salario     || '',
          experiencia: salvos.experiencia || s.experiencia || '',
          atividades:  salvos.atividades  || s.atividades  || '',
          beneficios:  salvos.beneficios  || s.beneficios  || '',
          diferencial: salvos.diferencial || s.diferencial || '',
        });
        const j = d?.jornada || {};
        setJornada({
          jornada_id: j.jornada_id || '',
          jornada_nome: j.jornada_nome || '',
          escala_id: '', escala_nome: '',
          turnos: Array.isArray(d?.turnos) ? d.turnos : [],
          hora_entrada: j.hora_entrada || '',
          hora_almoco_ini: j.hora_almoco_ini || '',
          hora_almoco_fim: j.hora_almoco_fim || '',
          hora_saida: j.hora_saida || '',
        });
        if (d?.tem_vaga) setMsg({ t: 'ok', m: 'Dados carregados da vaga cadastrada. Ajuste o que quiser.' });
      }).catch(() => setValores(salvos));
    }).catch(() => { setModelo(null); setValores({}); setOrientacoes({ feed: ORIENTACAO_FEED, anuncio: ORIENTACAO_ANUNCIO }); });
  }, [cargoId]);

  const alterarJornada = (patch) => setJornada(j => ({ ...j, ...patch }));

  /** Traz as atividades cadastradas na vaga, por cima do que estiver no campo. */
  const trazerAtividades = () => {
    const t = daVaga?.sugestao?.atividades;
    if (!t?.trim()) { setMsg({ t: 'erro', m: 'A vaga deste cargo não tem atividades cadastradas.' }); return; }
    alterar('atividades', t);
    setMsg({ t: 'ok', m: 'Atividades trazidas da vaga.' });
  };

  const alterar = (chave, v) => setValores(o => ({ ...o, [chave]: v }));

  // ---------- referência ----------
  const enviarReferencia = async (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) { setMsg({ t: 'erro', m: 'Envie uma imagem JPG ou PNG.' }); return; }
    setMsg({ t: 'info', m: 'Enviando referência…' });
    try {
      const fd = new FormData();
      fd.append('arquivo', file);
      const r = await api.post('/rh/encarte/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setModelo(m => ({ ...(m || {}), imagem_url: r.data?.url }));
      setMsg({ t: 'ok', m: 'Referência carregada.' });
    } catch (e) {
      setMsg({ t: 'erro', m: e.response?.data?.error || 'Falha ao enviar a referência.' });
    }
  };

  // ---------- criar ----------
  /** Gera UMA variação. Cada uma manda a sua própria orientação. */
  const gerarUma = async (id) => {
    const r = await api.post('/rh/encarte/gerar', {
      referencia_url: modelo.imagem_url,
      preset_export: preset,
      campos: { ...valores, jornada: textoJornada(jornada), orientacao: orientacoes[id] },
    });
    return r.data?.url;
  };

  /**
   * Sem argumento gera as DUAS em paralelo; com `id`, refaz só aquela.
   * Em paralelo de propósito: são ~30s cada, em série o RH esperaria o dobro.
   */
  const criar = async (id) => {
    if (!modelo?.imagem_url) { setMsg({ t: 'erro', m: 'Suba a arte de referência primeiro.' }); return; }
    if (!valores.cargo?.trim()) { setMsg({ t: 'erro', m: 'Preencha ao menos o Cargo.' }); return; }

    const alvos = id ? [id] : VARIACOES.map(v => v.id);
    setGerando(Object.fromEntries(alvos.map(a => [a, true])));
    setResultados(r => { const n = { ...r }; alvos.forEach(a => delete n[a]); return n; });
    setMsg({ t: 'info', m: alvos.length > 1 ? 'Criando as duas artes… leva alguns segundos.' : 'Recriando a arte…' });

    const saidas = await Promise.allSettled(alvos.map(a => gerarUma(a)));

    const novos = {};
    const falhas = [];
    saidas.forEach((s, i) => {
      const alvo = alvos[i];
      const titulo = VARIACOES.find(v => v.id === alvo)?.titulo || alvo;
      if (s.status === 'fulfilled' && s.value) novos[alvo] = s.value;
      else falhas.push(`${titulo}: ${s.reason?.response?.data?.error || 'falhou'}`);
    });

    setResultados(r => ({ ...r, ...novos }));
    setGerando({});
    // Uma pode dar certo e a outra falhar — o aviso precisa dizer qual.
    if (falhas.length && Object.keys(novos).length) setMsg({ t: 'erro', m: `Parcial. ${falhas.join(' · ')}` });
    else if (falhas.length) setMsg({ t: 'erro', m: falhas.join(' · ') });
    else setMsg({ t: 'ok', m: 'Pronto. Confira os números antes de publicar.' });
  };

  const salvar = async () => {
    if (!modelo?.imagem_url) { setMsg({ t: 'erro', m: 'Suba a arte de referência primeiro.' }); return; }
    setSalvando(true);
    try {
      const nomeCargo = cargos.find(c => String(c.id) === String(cargoId))?.nome;
      const r = await api.post('/rh/encarte/modelos', {
        id: modelo?.id || null,
        cargo_id: cargoId ? Number(cargoId) : null,
        nome: cargoId ? `Encarte — ${nomeCargo || 'Cargo'}` : 'Encarte padrão (todos os cargos)',
        imagem_url: modelo.imagem_url,
        preset_export: preset,
        campos: { ...valores, jornada: textoJornada(jornada), orientacao_feed: orientacoes.feed, orientacao_anuncio: orientacoes.anuncio },
      });
      // Preserva a referencia se a resposta vier sem ela — o save nunca deve
      // fazer a arte sumir da tela.
      setModelo(m => ({ ...(m || {}), ...(r.data?.data || {}), imagem_url: r.data?.data?.imagem_url || m?.imagem_url }));
      recarregar();
      setMsg({ t: 'ok', m: 'Modelo salvo para este cargo.' });
    } catch (e) {
      setMsg({ t: 'erro', m: e.response?.data?.error || 'Falha ao salvar.' });
    } finally { setSalvando(false); }
  };

  // ---------- envio pro WhatsApp ----------
  /**
   * Manda as artes pros grupos configurados em Grupos WhatsApp → Encartes de Vaga.
   * `quais` = ['feed'] | ['anuncio'] | os dois.
   */
  const enviarWhats = async (quais, teste = false) => {
    const urls = quais.map(q => resultados[q]).filter(Boolean);
    if (!urls.length) { setMsg({ t: 'erro', m: 'Gere a arte antes de enviar.' }); return; }
    setEnviando(true);
    setMsg({ t: 'info', m: teste ? 'Enviando pro primeiro grupo…' : 'Enviando pros grupos…' });
    try {
      const r = await api.post('/rh/encarte/whatsapp/enviar', { urls, legenda: legendaWhats, teste });
      const d = r.data || {};
      const falhou = (d.falhas || []).length;
      setMsg({
        t: falhou ? 'erro' : 'ok',
        m: `Enviado para ${d.enviados}/${d.total} grupo(s).` + (falhou ? ` Falhas: ${d.falhas.join(' · ')}` : ''),
      });
    } catch (e) {
      setMsg({ t: 'erro', m: e.response?.data?.error || 'Falha ao enviar pro WhatsApp.' });
    } finally { setEnviando(false); }
  };

  const baixar = (id) => {
    const url = resultados[id];
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = `encarte-${id}-${(valores.cargo || 'vaga').toLowerCase().replace(/\s+/g, '-')}.png`;
    a.target = '_blank';
    a.click();
  };

  return (
    <div className="bg-white rounded-lg shadow p-5">
      {/* Topo */}
      <div className="flex flex-wrap items-end gap-3 pb-4 border-b">
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Modelo de</label>
          <select value={cargoId} onChange={(e) => setCargoId(e.target.value)}
                  className="border rounded-lg px-3 py-2 text-sm min-w-[260px]">
            <option value="">⭐ Modelo padrão (todos os cargos)</option>
            {cargos.map(c => (
              <option key={c.id} value={c.id}>{c.nome}{modelos.some(m => m.cargo_id === c.id) ? ' ✓' : ''}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Formato</label>
          <select value={preset} onChange={(e) => setPreset(e.target.value)}
                  className="border rounded-lg px-3 py-2 text-sm">
            {Object.entries(PRESETS).map(([k, p]) => <option key={k} value={k}>{p.label}</option>)}
          </select>
        </div>
        <div className="flex-1" />
        <button onClick={salvar} disabled={salvando}
                className="px-4 py-2 text-sm font-semibold rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50">
          {salvando ? 'Salvando…' : '💾 Salvar modelo'}
        </button>
        {/* ⚠️ onClick precisa da arrow: `onClick={criar}` passaria o EVENTO do
            clique como se fosse o id da variação, e só uma arte seria gerada. */}
        <button onClick={() => criar()} disabled={ocupado}
                className="px-5 py-2 text-sm font-bold rounded-lg bg-purple-700 text-white hover:bg-purple-800 disabled:opacity-50">
          {ocupado ? '✨ Criando…' : '✨ Criar as 2 artes'}
        </button>
      </div>

      {msg && (
        <div className={`mt-3 px-4 py-2 rounded-lg text-sm ${
          msg.t === 'erro' ? 'bg-red-50 text-red-700 border border-red-200'
          : msg.t === 'ok' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
          : 'bg-blue-50 text-blue-700 border border-blue-200'}`}>{msg.m}</div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr_260px] gap-6 mt-5">
        {/* ---------- REFERÊNCIA (pequena) ---------- */}
        <div>
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Arte de referência</h3>
          <input ref={arquivoRef} type="file" accept="image/*" className="hidden"
                 onChange={(e) => { enviarReferencia(e.target.files?.[0]); e.target.value = ''; }} />
          {modelo?.imagem_url ? (
            <div>
              <button onClick={() => setAmpliada(modelo.imagem_url)}
                      className="block w-full rounded-lg overflow-hidden border border-gray-200 hover:border-purple-400 transition"
                      title="Clique para ampliar">
                <img src={modelo.imagem_url} alt="Referência" className="w-full block" />
              </button>
              <div className="flex gap-2 mt-2">
                <button onClick={() => setAmpliada(modelo.imagem_url)}
                        className="flex-1 text-xs px-2 py-1.5 rounded bg-gray-100 hover:bg-gray-200 text-gray-700">⤢ Ampliar</button>
                <button onClick={() => arquivoRef.current?.click()}
                        className="flex-1 text-xs px-2 py-1.5 rounded bg-purple-100 hover:bg-purple-200 text-purple-800">Trocar</button>
              </div>
            </div>
          ) : (
            <button onClick={() => arquivoRef.current?.click()}
                    className="w-full aspect-[4/5] border-2 border-dashed border-gray-300 rounded-lg grid place-items-center text-gray-400 hover:border-purple-400 hover:text-purple-500 text-center px-2">
              <div>
                <div className="text-3xl mb-1">🖼️</div>
                <div className="text-xs font-semibold">Subir arte de referência</div>
                <div className="text-[10px] mt-1">a IA copia daqui as cores, o logo e o estilo</div>
              </div>
            </button>
          )}
        </div>

        {/* ---------- DADOS ---------- */}
        <div>
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Dados da vaga</h3>
          {cargoId && daVaga && !daVaga.tem_vaga && (
            <div className="mb-3 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
              Este cargo ainda não tem vaga cadastrada — preenchi com o que existe no cadastro do cargo.
            </div>
          )}

          <div className="space-y-3">
            {CAMPOS.map(({ chave, label, linhas, dica }) => (
              <div key={chave}>
                <label className="flex items-center justify-between text-xs font-semibold text-gray-600 mb-1">
                  <span>{label}</span>
                  {chave === 'atividades' && cargoId && (
                    <button onClick={trazerAtividades}
                            className="text-[11px] font-semibold text-purple-600 hover:text-purple-800 hover:underline">
                      ↻ Trazer atividades da vaga
                    </button>
                  )}
                </label>
                {linhas === 1 ? (
                  <input type="text" value={valores[chave] || ''} placeholder={dica}
                         onChange={(e) => alterar(chave, e.target.value)}
                         className="w-full border rounded-lg px-3 py-2 text-sm" />
                ) : (
                  <textarea rows={linhas} value={valores[chave] || ''} placeholder={dica}
                            onChange={(e) => alterar(chave, e.target.value)}
                            className="w-full border rounded-lg px-3 py-2 text-sm resize-y" />
                )}

                {/* Bloco de JORNADA logo depois do Cargo — mesmo padrão da tela de Vagas */}
                {chave === 'cargo' && cargoId && (
                  <div className="mt-3 border border-gray-200 rounded-lg p-3 bg-gray-50/60">
                    {/* Turnos — mesmos rótulos da tela de Vagas, já vêm marcados da vaga */}
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Turno</label>
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {TURNOS.map(t => {
                        const marcado = (jornada.turnos || []).includes(t.key);
                        return (
                          <button key={t.key} type="button"
                                  onClick={() => alterarJornada({
                                    turnos: marcado
                                      ? (jornada.turnos || []).filter(k => k !== t.key)
                                      : [...(jornada.turnos || []), t.key],
                                  })}
                                  className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition ${
                                    marcado ? 'bg-purple-600 text-white border-purple-600'
                                            : 'bg-white text-gray-600 border-gray-300 hover:border-purple-400'}`}>
                            {t.label}
                          </button>
                        );
                      })}
                    </div>

                    {/* Escala — vem do cadastro (6x1, 5x2, 12x36…) */}
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Escala</label>
                    <select value={jornada.escala_id}
                            onChange={(e) => {
                              const id = e.target.value;
                              const es = escalas.find(x => String(x.id) === String(id));
                              alterarJornada({ escala_id: id, escala_nome: es?.nome || '' });
                            }}
                            className="w-full border rounded-lg px-3 py-2 text-sm bg-white mb-3">
                      <option value="">Selecione a escala…</option>
                      {escalas.map(es => (
                        <option key={es.id} value={es.id}>{es.nome}{es.descricao ? ` — ${es.descricao}` : ''}</option>
                      ))}
                    </select>

                    <label className="block text-xs font-semibold text-gray-600 mb-1">Jornada</label>
                    <select value={jornada.jornada_id}
                            onChange={(e) => {
                              const id = e.target.value;
                              const j = jornadas.find(x => String(x.id) === String(id));
                              alterarJornada({ jornada_id: id, jornada_nome: j?.nome || '' });
                            }}
                            className="w-full border rounded-lg px-3 py-2 text-sm bg-white">
                      <option value="">Selecione a jornada cadastrada…</option>
                      {jornadas.map(j => (
                        <option key={j.id} value={j.id}>{j.nome}{j.carga_horaria ? ` — ${j.carga_horaria}` : ''}</option>
                      ))}
                    </select>

                    <div className="grid grid-cols-2 gap-2 mt-2">
                      {[
                        ['hora_entrada', 'Entrada'],
                        ['hora_saida', 'Saída'],
                        ['hora_almoco_ini', 'Almoço início'],
                        ['hora_almoco_fim', 'Almoço fim'],
                      ].map(([campo, rot]) => (
                        <div key={campo}>
                          <label className="block text-[11px] text-gray-500 mb-0.5">{rot}</label>
                          <input type="time" value={jornada[campo] || ''}
                                 onChange={(e) => alterarJornada({ [campo]: e.target.value })}
                                 className="w-full border rounded-lg px-2 py-1.5 text-sm bg-white" />
                        </div>
                      ))}
                    </div>

                    <div className="mt-2 text-[11px] text-gray-500">
                      Vai sair na arte assim:
                      <span className="block mt-1 px-2 py-1 bg-white border rounded whitespace-pre-line text-gray-700">
                        {textoJornada(jornada) || '— preencha a jornada e os horários —'}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="mt-4 space-y-4">
            <p className="text-[11px] text-gray-500">
              São geradas <strong>duas artes</strong> a cada clique: uma para o post no feed
              (link da bio) e outra para anúncio pago (link abaixo). Cada uma tem sua própria orientação.
            </p>
            {VARIACOES.map(v => (
              <div key={v.id}>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  Orientação — {v.titulo}
                  <span className="ml-1.5 text-[10px] font-normal text-gray-400">({v.sub})</span>
                  <button onClick={() => setOrientacoes(o => ({ ...o, [v.id]: v.padrao }))}
                          className="ml-2 text-[10px] font-normal text-purple-600 hover:underline">restaurar padrão</button>
                </label>
                <textarea rows={4} value={orientacoes[v.id] || ''}
                          onChange={(e) => setOrientacoes(o => ({ ...o, [v.id]: e.target.value }))}
                          className="w-full border rounded-lg px-3 py-2 text-sm resize-y bg-purple-50/40 border-purple-200" />
              </div>
            ))}
            <p className="text-[11px] text-gray-500">
              Ajuste se quiser pedir algo específico — outra cor de fundo, outra pessoa na foto, mais destaque no salário.
            </p>
          </div>
        </div>

        {/* ---------- RESULTADOS (2 variações) ---------- */}
        <div className="space-y-5">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide">Artes geradas</h3>
          {VARIACOES.map(v => (
            <div key={v.id}>
              <div className="flex items-baseline justify-between mb-1.5">
                <span className="text-xs font-bold text-gray-700">{v.titulo}</span>
                <span className="text-[10px] text-gray-400">{v.sub}</span>
              </div>

              {gerando[v.id] ? (
                <div className="aspect-[4/5] rounded-lg border border-gray-200 grid place-items-center bg-gray-50 text-center px-3">
                  <div>
                    <div className="animate-pulse text-3xl mb-2">✨</div>
                    <div className="text-xs text-gray-500">Criando…</div>
                  </div>
                </div>
              ) : resultados[v.id] ? (
                <div>
                  <button onClick={() => setAmpliada(resultados[v.id])}
                          className="block w-full rounded-lg overflow-hidden border border-gray-200 hover:border-purple-400">
                    <img src={resultados[v.id]} alt={`Arte ${v.titulo}`} className="w-full block" />
                  </button>
                  <div className="flex gap-2 mt-2">
                    <button onClick={() => baixar(v.id)}
                            className="flex-1 text-xs px-2 py-2 rounded bg-emerald-600 text-white font-semibold hover:bg-emerald-700">⬇️ Baixar</button>
                    <button onClick={() => criar(v.id)}
                            className="flex-1 text-xs px-2 py-2 rounded bg-gray-100 hover:bg-gray-200 text-gray-700">🔄 Refazer</button>
                  </div>
                  <button onClick={() => enviarWhats([v.id])} disabled={enviando || !gruposWhats?.length}
                          className="w-full mt-1.5 text-xs px-2 py-2 rounded bg-[#25D366] text-white font-semibold hover:brightness-95 disabled:opacity-40 disabled:cursor-not-allowed">
                    {enviando ? 'Enviando…' : '📲 Enviar esta pro WhatsApp'}
                  </button>
                </div>
              ) : (
                <div className="aspect-[4/5] rounded-lg border-2 border-dashed border-gray-200 grid place-items-center text-gray-400 text-center px-3">
                  <div className="text-xs">Clique em <strong>Criar arte</strong></div>
                </div>
              )}
            </div>
          ))}

          <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded p-2 leading-relaxed">
            <strong>Confira os números antes de publicar.</strong> A IA às vezes erra um dígito do salário ou do horário.
          </p>

          {/* ---------- ENVIO PRO WHATSAPP ---------- */}
          <div className="border-t pt-4">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Enviar pro WhatsApp</h3>

            {gruposWhats === null ? (
              <p className="text-xs text-gray-400">Carregando grupos…</p>
            ) : gruposWhats.length === 0 ? (
              <div className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded p-2 leading-relaxed">
                Nenhum grupo configurado. Vá em <strong>Configurações de Rede → Grupos WhatsApp → 🖼️ Encartes de Vaga</strong>, escolha os grupos e salve.
                <button onClick={() => carregarGruposWhats(true)}
                        className="block mt-2 px-2.5 py-1 rounded bg-amber-600 text-white font-semibold hover:bg-amber-700">
                  ↻ Já salvei — procurar de novo
                </button>
              </div>
            ) : (
              <>
                <div className="text-[11px] text-gray-600 mb-2">
                  Vai para <strong>{gruposWhats.length} grupo(s)</strong>:
                  <span className="block text-gray-500 mt-0.5">
                    {gruposWhats.map(g => g.nome || g.id).join(' · ')}
                  </span>
                </div>

                <label className="block text-[11px] font-semibold text-gray-600 mb-1">Legenda</label>
                <textarea rows={3} value={legendaWhats} onChange={(e) => setLegendaWhats(e.target.value)}
                          placeholder={'🚀 TEMOS VAGA!\nCadastre seu currículo pelo link da bio.'}
                          className="w-full border rounded-lg px-2 py-1.5 text-xs resize-y mb-2" />

                <button onClick={() => enviarWhats(VARIACOES.map(v => v.id))}
                        disabled={enviando || !Object.keys(resultados).length}
                        className="w-full text-xs px-2 py-2.5 rounded bg-[#25D366] text-white font-bold hover:brightness-95 disabled:opacity-40 disabled:cursor-not-allowed">
                  {enviando ? 'Enviando…' : '📲 Enviar as artes pro grupo'}
                </button>
                <button onClick={() => enviarWhats(VARIACOES.map(v => v.id), true)}
                        disabled={enviando || !Object.keys(resultados).length}
                        className="w-full mt-1.5 text-xs px-2 py-2 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 disabled:opacity-40">
                  Testar — manda só pro 1º grupo
                </button>
                <p className="text-[10px] text-gray-400 mt-1.5 leading-relaxed">
                  A legenda vai só na primeira arte. Entre um grupo e outro há um intervalo anti-banimento.
                </p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Lightbox */}
      {ampliada && (
        <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-6"
             onClick={() => setAmpliada(null)}>
          <img src={ampliada} alt="" className="max-h-[92vh] max-w-full rounded-lg shadow-2xl" />
          <button onClick={() => setAmpliada(null)}
                  className="absolute top-5 right-6 text-white/80 hover:text-white text-3xl leading-none">×</button>
        </div>
      )}
    </div>
  );
}
