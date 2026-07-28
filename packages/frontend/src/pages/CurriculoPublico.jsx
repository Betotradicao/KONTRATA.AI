import { useEffect, useRef, useState } from 'react';
import api from '../utils/api';

export default function CurriculoPublico() {
  const [cargos, setCargos] = useState([]);
  const [habilidades, setHabilidades] = useState([]);
  const [tiposVaga, setTiposVaga] = useState([{ slug: 'clt', nome: 'CLT' }, { slug: 'aprendiz', nome: 'Menor Aprendiz' }]);
  const [lojas, setLojas] = useState([]);
  // Loja escolhida pelo candidato na tela inicial (usa id da empresa)
  const [lojaEscolhidaId, setLojaEscolhidaId] = useState(null);
  // Vagas abertas dessa loja (carregadas apos selecionar loja)
  const [vagasAbertas, setVagasAbertas] = useState([]);
  const [carregandoVagas, setCarregandoVagas] = useState(false);
  const [vagasInteresse, setVagasInteresse] = useState([]); // ids
  const [viuVagas, setViuVagas] = useState(false);
  const [buscaVaga, setBuscaVaga] = useState('');
  const [vagaDetalheId, setVagaDetalheId] = useState(null); // id da vaga em detalhe
  const [beneficiosCatalogo, setBeneficiosCatalogo] = useState([]); // [{nome, valor}]
  // Tela intermediaria de dicas (foto + redes sociais) entre loja e formulario
  const [viuDicas, setViuDicas] = useState(false);
  const [aceitouLgpd, setAceitouLgpd] = useState(false);
  const [aceitouTermoFinal, setAceitouTermoFinal] = useState(false);
  const [modalDoc, setModalDoc] = useState(null); // { titulo, tipo: 'consentimento' | 'privacidade' }

  const abrirDoc = (titulo, tipo) => {
    setModalDoc({ titulo, tipo });
  };
  // Configs do RH (DISC + pre-entrevista habilitados?)
  const [config, setConfig] = useState({ disc_habilitado: false, preentrevista_habilitada: false });
  // Estado da tela pos-envio (oferecer DISC e/ou pre-entrevista)
  const [posEnvioEtapa, setPosEnvioEtapa] = useState(null); // null | 'disc' | 'preentrevista' | 'finalizar'
  const [loading, setLoading] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  // ID do curriculo recem-criado (amarra DISC e pre-entrevista ao curriculo)
  const [curriculoId, setCurriculoId] = useState(null);
  const [erro, setErro] = useState('');
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [uploadingFoto, setUploadingFoto] = useState(false);
  const fotoInputRef = useRef(null);
  const continuarVagasRef = useRef(null);          // card "Continuar cadastro" — rola até ele ao marcar vaga
  const resumoRef = useRef(null);                  // campo obrigatório "Resumo Pessoal e Profissional" — rola até ele se vier vazio
  // Anexo opcional do PDF do currículo (pós-envio). Mora aqui e não no componente
  // porque a pergunta aparece em 2 telas — respondeu numa, não pergunta na outra.
  const [pdfCurriculo, setPdfCurriculo] = useState({ status: null, nome: '' });
  const [destaqueContinuar, setDestaqueContinuar] = useState(false);

  // Ao MARCAR uma vaga: rola suave até o card "Continuar cadastro" e dá um destaque
  // pulsante por alguns segundos. Resolve o problema de candidatos que marcam a vaga
  // e ficam parados achando que algo vai acontecer sozinho — guia direto pro próximo passo.
  const marcarVagaComFoco = (vagaId, jaMarcado) => {
    setVagasInteresse(prev => (jaMarcado ? prev.filter(x => x !== vagaId) : [...prev, vagaId]));
    if (jaMarcado) return; // desmarcou: não rola nem destaca
    setTimeout(() => {
      continuarVagasRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setDestaqueContinuar(true);
      setTimeout(() => setDestaqueContinuar(false), 2600);
    }, 120);
  };

  const [form, setForm] = useState({
    nome: '',
    foto_url: null,
    resumo: '',
    data_nascimento: '',
    whatsapp: '',
    email: '',
    instagram: '',
    interesse_vaga: '', // 'clt' | 'aprendiz' - obrigatorio
    cep: '',
    rua: '',
    numero: '',
    complemento: '',
    bairro: '',
    cidade: '',
    estado: '',
    // Checkboxes (apenas pra filtro rapido no banco)
    cargos: [],
    habilidades: [],
    // Lista dinamica com detalhes completos
    experiencias_detalhadas: [],
    formacoes: [],
    cursos_adicionais: [],
    experiencia_texto: '',
    disponibilidade_turnos: [],
  });

  // Quando o candidato escolhe a loja, carrega as vagas abertas
  useEffect(() => {
    if (lojaEscolhidaId == null) { setVagasAbertas([]); setViuVagas(false); setVagasInteresse([]); return; }
    const lj = lojas.find(l => l.id === lojaEscolhidaId);
    const codLoja = lj?.cod_loja ?? null;
    setCarregandoVagas(true);
    api.get(`/curriculos/publico/vagas${codLoja != null ? `?cod_loja=${codLoja}` : ''}`)
      .then(({ data }) => setVagasAbertas(Array.isArray(data?.vagas) ? data.vagas : []))
      .catch(() => setVagasAbertas([]))
      .finally(() => setCarregandoVagas(false));
  }, [lojaEscolhidaId, lojas]);

  // Quando a(s) vaga(s) marcada(s) JA definem tipo de vaga / turno, preenche
  // automaticamente esses campos no curriculo (e a UI trava — ver render).
  // Vagas sem essa info definida deixam o candidato escolher livremente.
  useEffect(() => {
    const sel = vagasAbertas.filter(v => vagasInteresse.includes(v.id));
    if (sel.length === 0) return;
    const tipos = [...new Set(sel.map(v => v.tipo_vaga_slug).filter(Boolean))];
    const turnos = [...new Set(sel.flatMap(v => Array.isArray(v.turnos) ? v.turnos : []))];
    // Vagas que EXIGEM experiencia: o cargo da vaga vem pre-marcado e a
    // experiencia dele passa a ser obrigatoria (validado no envio).
    const cargosObrig = [...new Set(
      sel.filter(v => v.experiencia_obrigatoria && v.cargo_nome).map(v => String(v.cargo_nome).toUpperCase())
    )];
    setForm(f => {
      const next = { ...f };
      if (tipos.length === 1) next.interesse_vaga = tipos[0];
      if (turnos.length > 0) next.disponibilidade_turnos = turnos;
      if (cargosObrig.length > 0) {
        const cargosArr = [...f.cargos];
        const novasExp = [...f.experiencias_detalhadas];
        cargosObrig.forEach(cg => {
          if (!cargosArr.includes(cg)) cargosArr.push(cg);
          if (!novasExp.some(e => e.funcao === cg)) {
            novasExp.push({ funcao: cg, empresa: '', empresa_instagram: '', tempo_anos: '', tempo_meses: '', descricao: '' });
          }
        });
        next.cargos = cargosArr;
        next.experiencias_detalhadas = novasExp;
      }
      return next;
    });
  }, [vagasInteresse, vagasAbertas]);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get('/curriculos/publico/formulario');
        setCargos(res.data?.cargos || []);
        setHabilidades(res.data?.habilidades || []);
        if (Array.isArray(res.data?.tipos_vaga) && res.data.tipos_vaga.length > 0) {
          setTiposVaga(res.data.tipos_vaga);
        }
        const listaLojas = res.data?.lojas || [];
        setLojas(listaLojas);
        // Catalogo de beneficios (com valor) pra mostrar nas vagas
        setBeneficiosCatalogo(Array.isArray(res.data?.beneficios_catalogo) ? res.data.beneficios_catalogo : []);
        // Configs (DISC + pre-entrevista)
        if (res.data?.config) setConfig(res.data.config);
        // SEMPRE mostra a tela de selecao de loja primeiro (mesmo com 1 unica loja),
        // pra o candidato entender pra qual loja esta se candidatando.
      } catch (e) {
        setErro('Nao foi possivel carregar o formulario. Tente novamente mais tarde.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const buscarCep = async (cepRaw) => {
    const cep = (cepRaw || '').replace(/\D/g, '');
    if (cep.length !== 8) return;
    setBuscandoCep(true);
    try {
      const r = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await r.json();
      if (!data.erro) {
        // Tudo MAIÚSCULO pra evitar variacoes ("Sao Paulo", "SAO PAULO", "são paulo" etc)
        setForm(f => ({
          ...f,
          rua: (data.logradouro || f.rua || '').toUpperCase(),
          bairro: (data.bairro || f.bairro || '').toUpperCase(),
          cidade: (data.localidade || f.cidade || '').toUpperCase(),
          estado: (data.uf || f.estado || '').toUpperCase(),
        }));
      }
    } catch {}
    finally { setBuscandoCep(false); }
  };

  const formatCep = (v) => {
    const d = (v || '').replace(/\D/g, '').slice(0, 8);
    return d.length > 5 ? `${d.slice(0,5)}-${d.slice(5)}` : d;
  };

  const subirFoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingFoto(true);
    try {
      const fd = new FormData();
      fd.append('foto', file);
      const r = await api.post('/curriculos/publico/upload-foto', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (r.data?.url) setForm(f => ({ ...f, foto_url: r.data.url }));
    } catch (err) {
      setErro('Erro ao enviar foto.');
    } finally {
      setUploadingFoto(false);
      if (fotoInputRef.current) fotoInputRef.current.value = '';
    }
  };

  const toggleItem = (campo, valor) => {
    setForm(f => {
      const atual = f[campo] || [];
      const nova = atual.includes(valor) ? atual.filter(x => x !== valor) : [...atual, valor];
      return { ...f, [campo]: nova };
    });
  };

  const addHabilidadeNova = () => {
    const nome = window.prompt('Qual habilidade você quer adicionar?');
    if (!nome?.trim()) return;
    const up = nome.trim().toUpperCase();
    if (habilidades.includes(up) || form.habilidades.includes(up)) return;
    setHabilidades(h => [...h, up]);
    setForm(f => ({ ...f, habilidades: [...f.habilidades, up] }));
  };

  // ===== Experiências detalhadas =====
  const addExperiencia = (funcaoInicial = '') => {
    setForm(f => ({
      ...f,
      experiencias_detalhadas: [
        ...f.experiencias_detalhadas,
        { funcao: funcaoInicial, empresa: '', empresa_instagram: '', tempo_anos: '', tempo_meses: '', descricao: '' },
      ],
    }));
  };

  const updateExperiencia = (idx, campo, valor) => {
    setForm(f => ({
      ...f,
      experiencias_detalhadas: f.experiencias_detalhadas.map((e, i) => i === idx ? { ...e, [campo]: valor } : e),
    }));
  };

  const removeExperiencia = (idx) => {
    setForm(f => ({
      ...f,
      experiencias_detalhadas: f.experiencias_detalhadas.filter((_, i) => i !== idx),
    }));
  };

  // ===== Formação acadêmica =====
  const addFormacao = () => {
    setForm(f => ({ ...f, formacoes: [...f.formacoes, { curso: '', nome_curso: '', status: 'concluido' }] }));
  };
  const updateFormacao = (idx, campo, valor) => {
    setForm(f => ({ ...f, formacoes: f.formacoes.map((x, i) => i === idx ? { ...x, [campo]: valor } : x) }));
  };
  const removeFormacao = (idx) => {
    setForm(f => ({ ...f, formacoes: f.formacoes.filter((_, i) => i !== idx) }));
  };

  // ===== Cursos complementares =====
  const addCursoAdic = () => {
    setForm(f => ({ ...f, cursos_adicionais: [...(f.cursos_adicionais || []), { nome: '', instituicao: '', tempo: '' }] }));
  };
  const updateCursoAdic = (idx, campo, valor) => {
    setForm(f => ({
      ...f,
      cursos_adicionais: (f.cursos_adicionais || []).map((x, i) => {
        if (i !== idx) return x;
        // Suporta valor antigo (string) convertendo pra objeto
        const base = typeof x === 'string' ? { nome: x, instituicao: '', tempo: '' } : x;
        return { ...base, [campo]: valor };
      }),
    }));
  };
  const removeCursoAdic = (idx) => {
    setForm(f => ({ ...f, cursos_adicionais: (f.cursos_adicionais || []).filter((_, i) => i !== idx) }));
  };

  // Quando marca/desmarca um cargo, cria/remove a experiência detalhada correspondente
  const toggleCargo = (cargo) => {
    setForm(f => {
      const jaMarcou = f.cargos.includes(cargo);
      if (jaMarcou) {
        // Remove cargo + primeira experiencia com essa função
        const novasExp = [...f.experiencias_detalhadas];
        const idx = novasExp.findIndex(e => e.funcao === cargo);
        if (idx !== -1) novasExp.splice(idx, 1);
        return { ...f, cargos: f.cargos.filter(x => x !== cargo), experiencias_detalhadas: novasExp };
      } else {
        return {
          ...f,
          cargos: [...f.cargos, cargo],
          experiencias_detalhadas: [
            ...f.experiencias_detalhadas,
            { funcao: cargo, empresa: '', empresa_instagram: '', tempo_anos: '', tempo_meses: '', descricao: '' },
          ],
        };
      }
    });
  };

  const addCargoNovo = () => {
    const nome = window.prompt('Nome da função (ex: GERENTE DE LOJA):');
    if (!nome?.trim()) return;
    const up = nome.trim().toUpperCase();
    if (cargos.includes(up)) { toggleCargo(up); return; }
    setCargos(c => [...c, up]);
    setForm(f => ({
      ...f,
      cargos: [...f.cargos, up],
      experiencias_detalhadas: [
        ...f.experiencias_detalhadas,
        { funcao: up, empresa: '', empresa_instagram: '', tempo_anos: '', tempo_meses: '', descricao: '' },
      ],
    }));
  };

  const enviar = async (e) => {
    e.preventDefault();
    setErro('');
    if (!form.nome.trim()) { setErro('Informe seu nome completo.'); return; }
    if (!form.data_nascimento) { setErro('Informe sua data de nascimento.'); window.scrollTo(0, 0); return; }
    // Resumo e obrigatorio: e o texto que o RH le primeiro na triagem. Como o campo fica no
    // meio do formulario, rola ate ele em vez de mandar o candidato pro topo procurar o erro.
    if (!form.resumo.trim()) {
      setErro('Preencha o Resumo Pessoal e Profissional.');
      resumoRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      resumoRef.current?.focus({ preventScroll: true });
      return;
    }
    if (!form.interesse_vaga) { setErro('Selecione o interesse de vaga.'); window.scrollTo(0, 0); return; }
    // Vagas que exigem experiencia: o tempo informado na funcao precisa
    // atingir o minimo exigido pela vaga (experiencia_meses_minimo).
    {
      const selv = vagasAbertas.filter(v => vagasInteresse.includes(v.id));
      const minPorCargo = {};
      selv.filter(v => v.experiencia_obrigatoria && v.cargo_nome).forEach(v => {
        const cg = String(v.cargo_nome).toUpperCase();
        minPorCargo[cg] = Math.max(minPorCargo[cg] || 0, Number(v.experiencia_meses_minimo) || 0);
      });
      for (const cg of Object.keys(minPorCargo)) {
        const exp = form.experiencias_detalhadas.find(e => e.funcao === cg);
        const meses = exp ? (Number(exp.tempo_anos) || 0) * 12 + (Number(exp.tempo_meses) || 0) : 0;
        if (meses <= 0) {
          setErro(`Esta vaga exige experiência em ${cg}. Preencha o tempo de experiência nessa função.`);
          window.scrollTo(0, 0); return;
        }
        const min = minPorCargo[cg];
        if (min > 0 && meses < min) {
          setErro(`Esta vaga exige no mínimo ${fmtTempoExp(min)} de experiência em ${cg}. Você informou ${fmtTempoExp(meses)}.`);
          window.scrollTo(0, 0); return;
        }
      }
    }
    setEnviando(true);
    try {
      const payload = {
        ...form,
        experiencias_detalhadas: form.experiencias_detalhadas.map(ex => ({
          ...ex,
          tempo_anos: ex.tempo_anos === '' ? null : Number(ex.tempo_anos),
          tempo_meses: ex.tempo_meses === '' ? null : Number(ex.tempo_meses),
        })),
        formacoes: form.formacoes.map(fm => ({
          ...fm,
          ano_conclusao: fm.ano_conclusao === '' ? null : Number(fm.ano_conclusao),
        })),
      };
      const lojaSel = lojas.find(l => l.id === lojaEscolhidaId);
      const r = await api.post('/curriculos/publico/enviar', { ...payload, cod_loja: lojaSel?.cod_loja ?? null, vagas_interesse_ids: vagasInteresse });
      // Captura o id retornado pra amarrar DISC e pre-entrevista a este curriculo
      if (r?.data?.id) setCurriculoId(r.data.id);
      setEnviado(true);
      window.scrollTo(0, 0);
    } catch (err) {
      setErro(err?.response?.data?.error || 'Erro ao enviar. Tente novamente.');
    } finally {
      setEnviando(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-100 via-rose-100 to-orange-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="text-4xl mb-3">⏳</div>
          <div className="text-gray-700">Carregando formulário…</div>
        </div>
      </div>
    );
  }

  // Tela inicial: selecao de loja (sempre aparece, exceto se houver apenas 1 loja cadastrada)
  if (lojaEscolhidaId == null) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 via-rose-50 to-orange-50 py-6 px-4 overflow-x-hidden">
        <div className="max-w-4xl mx-auto">
          <div className="bg-gradient-to-r from-purple-600 to-purple-500 text-white rounded-2xl shadow-lg p-6 mb-5">
            <div className="flex items-center gap-3">
              <div className="text-5xl">🏪</div>
              <div>
                <h1 className="text-2xl font-bold">Pra qual loja você quer se candidatar?</h1>
                <p className="text-sm opacity-90 mt-1">Escolha a loja abaixo pra começar a preencher seu currículo.</p>
              </div>
            </div>
          </div>

          {erro && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm mb-3">{erro}</div>}

          {lojas.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-md p-10 text-center">
              <div className="text-5xl mb-3">😕</div>
              <p className="text-gray-600 font-semibold">Nenhuma loja cadastrada no momento.</p>
              <p className="text-sm text-gray-500 mt-1">Tente novamente mais tarde ou entre em contato pelo WhatsApp.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {lojas.map(lj => {
                const titulo = lj.apelido || (lj.is_principal ? 'MATRIZ' : (lj.cod_loja ? `LOJA ${lj.cod_loja}` : 'LOJA'));
                return (
                  <button key={lj.id} onClick={() => setLojaEscolhidaId(lj.id)}
                    className="bg-white rounded-2xl shadow-md hover:shadow-xl hover:scale-[1.02] transition border-2 border-transparent hover:border-rose-400 overflow-hidden text-left">
                    {/* Foto - aspect-ratio fixo + object-contain pra todas ficarem mesmo tamanho SEM cortar */}
                    <div className="bg-gradient-to-br from-rose-100 to-pink-100 aspect-[4/3] w-full overflow-hidden flex items-center justify-center">
                      {lj.foto_fachada_url ? (
                        <img src={lj.foto_fachada_url} alt={titulo} className="w-full h-full object-contain block" />
                      ) : (
                        <div className="text-7xl">🏪</div>
                      )}
                    </div>
                    {/* Info */}
                    <div className="p-4">
                      <h3 className="text-xl font-extrabold text-gray-800 mb-1">{titulo}</h3>
                      {lj.nome && <p className="text-sm text-gray-600 font-semibold mb-1">{lj.nome}</p>}
                      <p className="text-xs text-gray-500">
                        📍 {[lj.bairro, lj.cidade].filter(Boolean).join(' · ') || 'Endereço não informado'}
                      </p>
                      <div className="mt-3 inline-flex items-center gap-1 text-sm font-bold text-rose-600">
                        Candidatar-se aqui <span>→</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Tela de DETALHE de uma vaga especifica
  if (lojaEscolhidaId != null && !viuVagas && vagaDetalheId != null) {
    const lj = lojas.find(l => l.id === lojaEscolhidaId);
    const tituloLoja = lj ? (lj.apelido || lj.nome || (lj.is_principal ? 'MATRIZ' : (lj.cod_loja ? `LOJA ${lj.cod_loja}` : 'LOJA'))) : '';
    const cidadeLoja = lj ? [lj.cidade, lj.estado].filter(Boolean).join(' - ') : '';
    const TURNO_LABEL = { manha: 'Manhã', intermediario: 'Intermediário', tarde: 'Tarde', qualquer: 'Qualquer horário' };
    const v = vagasAbertas.find(x => x.id === vagaDetalheId);
    if (!v) {
      // Vaga sumiu — volta pra lista
      setTimeout(() => setVagaDetalheId(null), 0);
      return null;
    }
    const marcado = vagasInteresse.includes(v.id);
    const turnos = Array.isArray(v.turnos) ? v.turnos : [];
    const beneficiosArr = (v.beneficios || '').split(',').map(s => s.trim()).filter(Boolean);

    return (
      <div className="min-h-screen bg-gray-50">
        {/* Header com voltar */}
        <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
          <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-3">
            <button
              onClick={() => setVagaDetalheId(null)}
              className="w-10 h-10 rounded-full hover:bg-gray-100 flex items-center justify-center text-2xl text-gray-600"
              title="Voltar pra lista de vagas"
            >‹</button>
            <div className="flex-1">
              <h1 className="font-bold text-lg text-gray-900 leading-tight">{v.cargo_nome || v.titulo}</h1>
              <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">{tituloLoja}</p>
            </div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 py-6 pb-32">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            {/* Linha de meta-infos */}
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-gray-700 mb-4 pb-4 border-b border-gray-100">
              <span className="flex items-center gap-1.5">📍 <span>{cidadeLoja || tituloLoja}</span></span>
              <span className="flex items-center gap-1.5">💼 <span>1 posição</span></span>
              <span className="flex items-center gap-1.5">💰 <span>{v.salario_min != null && Number(v.salario_min) > 0 ? `R$ ${Number(v.salario_min).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : 'Não informado'}</span></span>
              {turnos.length > 0 && <span className="flex items-center gap-1.5">⏰ <span>{turnos.map(t => TURNO_LABEL[t] || t).join(' / ')}</span></span>}
            </div>

            {/* Badges de modalidade */}
            <div className="flex flex-wrap gap-2 mb-5">
              {v.tipo_vaga_slug && (
                <span className="px-3 py-1 bg-blue-50 text-blue-700 text-xs font-semibold rounded-md">
                  {(tiposVaga.find(t => t.slug === v.tipo_vaga_slug) || {}).nome || v.tipo_vaga_slug}
                </span>
              )}
              {v.experiencia_obrigatoria && (
                <span className="px-3 py-1 bg-amber-50 text-amber-700 text-xs font-semibold rounded-md">
                  Experiência {v.experiencia_meses_minimo ? `${v.experiencia_meses_minimo} meses` : 'requerida'}
                </span>
              )}
            </div>

            {/* Descrição */}
            {v.descricao && (
              <section className="mb-6">
                <h2 className="text-base font-bold text-gray-900 mb-2 flex items-center gap-2">📝 Descrição da vaga / Atividades</h2>
                <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{v.descricao}</p>
              </section>
            )}

            {/* Requisitos */}
            {v.requisitos && (
              <section className="mb-6">
                <h2 className="text-base font-bold text-gray-900 mb-2 flex items-center gap-2">📋 Requisitos</h2>
                <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{v.requisitos}</p>
              </section>
            )}

            {/* Benefícios */}
            {beneficiosArr.length > 0 && (
              <section className="mb-6">
                <h2 className="text-base font-bold text-gray-900 mb-2 flex items-center gap-2">🎁 Benefícios</h2>
                <ul className="space-y-1">
                  {beneficiosArr.map((b, i) => (
                    <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                      <span className="text-emerald-500 mt-0.5">✓</span>
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Disponibilidade */}
            {turnos.length > 0 && (
              <section className="mb-6">
                <h2 className="text-base font-bold text-gray-900 mb-2 flex items-center gap-2">🕐 Disponibilidade de horário</h2>
                <div className="flex flex-wrap gap-2">
                  {turnos.map(t => (
                    <span key={t} className="px-3 py-1.5 bg-sky-50 border border-sky-200 text-sky-700 text-sm font-semibold rounded-full">
                      {TURNO_LABEL[t] || t}
                    </span>
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>

        {/* Botão fixo no rodapé */}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t-2 border-gray-200 p-4 shadow-lg z-20">
          <div className="max-w-4xl mx-auto flex items-center gap-3">
            <button
              onClick={() => setVagaDetalheId(null)}
              className="px-4 py-3 border-2 border-gray-300 text-gray-700 hover:bg-gray-50 font-semibold rounded-xl transition whitespace-nowrap"
            >
              ← Voltar
            </button>
            <button
              onClick={() => {
                if (!marcado) setVagasInteresse(prev => [...prev, v.id]);
                setVagaDetalheId(null);
              }}
              className={`flex-1 px-6 py-3.5 font-bold rounded-xl shadow-lg transition ${marcado ? 'bg-emerald-500 hover:bg-emerald-600 text-white' : 'bg-rose-500 hover:bg-rose-600 text-white'}`}
            >
              {marcado ? '✓ Já tenho interesse · Voltar à lista' : '❤️ Quero me candidatar'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Tela intermediaria: Vagas em aberto pra essa loja (apos escolher loja, antes das dicas)
  if (lojaEscolhidaId != null && !viuVagas) {
    const lj = lojas.find(l => l.id === lojaEscolhidaId);
    const tituloLoja = lj ? (lj.apelido || lj.nome || (lj.is_principal ? 'MATRIZ' : (lj.cod_loja ? `LOJA ${lj.cod_loja}` : 'LOJA'))) : '';
    const TURNO_LABEL = { manha: 'Manhã', intermediario: 'Intermediário', tarde: 'Tarde', qualquer: 'Qualquer horário' };
    const cidadeLoja = lj ? [lj.cidade, lj.estado].filter(Boolean).join(' - ') : '';

    // Filtro de busca local (igual no Solides)
    const vagasFiltradasBusca = vagasAbertas.filter(v => {
      if (!buscaVaga.trim()) return true;
      const q = buscaVaga.toLowerCase().trim();
      return (v.titulo || '').toLowerCase().includes(q)
        || (v.cargo_nome || '').toLowerCase().includes(q)
        || (v.descricao || '').toLowerCase().includes(q);
    });

    const diasDesde = (iso) => {
      if (!iso) return null;
      const d = new Date(iso);
      const hoje = new Date();
      const diff = Math.floor((hoje - d) / (1000 * 60 * 60 * 24));
      if (diff <= 0) return 'hoje';
      if (diff === 1) return 'há 1 dia';
      return `há ${diff} dias`;
    };

    return (
      <div className="min-h-screen bg-gray-50">
        {/* Faixa rosa superior — compacta, encostada no card de busca */}
        <div className="bg-gradient-to-r from-purple-600 to-purple-500 h-20 md:h-24 relative overflow-hidden">
          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 30%, white 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
        </div>

        <div className="max-w-6xl mx-auto px-4 -mt-10 pb-8">
          {/* Card de busca/filtro */}
          <div className="bg-white rounded-2xl shadow-lg p-5 md:p-6 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-[1fr_2fr_auto] gap-3 items-end">
              <div>
                <label className="text-xs font-bold text-gray-700 mb-1.5 block">Local</label>
                <div className="flex items-center gap-2 px-3 py-2.5 border border-gray-300 rounded-xl bg-white">
                  <span className="text-gray-500">📍</span>
                  <span className="px-2 py-0.5 bg-rose-500 text-white rounded-full text-xs font-bold">{tituloLoja}</span>
                  <button onClick={() => setLojaEscolhidaId(null)} className="ml-auto text-xs text-gray-500 hover:text-rose-600 font-medium">trocar</button>
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-700 mb-1.5 block">Qual vaga você procura?</label>
                <div className="flex items-center gap-2 px-3 py-2.5 border border-gray-300 rounded-xl bg-white">
                  <span className="text-gray-400">🔍</span>
                  <input
                    type="text"
                    value={buscaVaga}
                    onChange={(e) => setBuscaVaga(e.target.value)}
                    placeholder="Nome da vaga ou cargo"
                    className="flex-1 outline-none text-sm bg-transparent"
                  />
                </div>
              </div>
              <button
                onClick={() => {}}
                className="px-6 py-3 bg-rose-500 hover:bg-rose-600 text-white font-bold rounded-xl shadow transition whitespace-nowrap"
              >
                Buscar vagas
              </button>
            </div>
          </div>

          {/* Header com nome da empresa e contador */}
          <div className="mb-5">
            <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900">Vagas em <span className="text-rose-600">{tituloLoja}</span> {cidadeLoja && <span className="text-gray-500 text-lg font-normal">· {cidadeLoja}</span>}</h1>
            {vagasAbertas.length > 0 && (
              <p className="text-sm text-gray-600 mt-1">
                Mostrando {vagasFiltradasBusca.length === vagasAbertas.length ? `1 - ${vagasAbertas.length}` : vagasFiltradasBusca.length} de <strong>{vagasAbertas.length} vaga{vagasAbertas.length > 1 ? 's' : ''} encontrada{vagasAbertas.length > 1 ? 's' : ''}</strong>
                {vagasInteresse.length > 0 && <span className="ml-3 text-rose-600 font-bold">· ❤️ {vagasInteresse.length} marcada{vagasInteresse.length > 1 ? 's' : ''}</span>}
              </p>
            )}
            <div className="border-b border-gray-200 mt-3"></div>
          </div>

          {/* Estados de loading / vazio */}
          {carregandoVagas ? (
            <div className="bg-white rounded-2xl shadow p-12 text-center">
              <div className="inline-block animate-spin text-4xl mb-3">⏳</div>
              <p className="text-gray-500">Carregando vagas disponíveis…</p>
            </div>
          ) : vagasAbertas.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-lg p-10 text-center border-2 border-dashed border-gray-300">
              <div className="text-7xl mb-4">📭</div>
              <p className="text-gray-800 font-extrabold text-xl">Nenhuma vaga aberta no momento</p>
              <p className="text-sm text-gray-500 mt-2 max-w-md mx-auto">Mas não desanime! Cadastre seu currículo e te chamamos assim que abrir vaga compatível com seu perfil.</p>
              <button
                onClick={() => setViuVagas(true)}
                className="mt-6 px-8 py-3.5 bg-rose-500 hover:bg-rose-600 text-white font-bold rounded-2xl shadow-lg hover:shadow-xl transition"
              >
                Cadastrar mesmo assim →
              </button>
            </div>
          ) : vagasFiltradasBusca.length === 0 ? (
            <div className="bg-white rounded-2xl shadow p-10 text-center">
              <div className="text-5xl mb-3">🔍</div>
              <p className="text-gray-700 font-bold">Nenhuma vaga encontrada com "{buscaVaga}"</p>
              <button onClick={() => setBuscaVaga('')} className="mt-3 text-sm text-rose-600 hover:underline font-semibold">Limpar busca</button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {vagasFiltradasBusca.map(v => {
                  const marcado = vagasInteresse.includes(v.id);
                  const turnos = Array.isArray(v.turnos) ? v.turnos : [];
                  const beneficiosArr = (v.beneficios || '').split(',').map(s => s.trim()).filter(Boolean);
                  const dias = diasDesde(v.data_abertura);
                  return (
                    <div
                      key={v.id}
                      className={`bg-white rounded-2xl shadow-sm border transition-all overflow-hidden ${marcado ? 'border-rose-500 ring-2 ring-rose-200' : 'border-gray-200 hover:border-rose-300 hover:shadow-md'}`}
                    >
                      <div className="p-5">
                        {/* Título */}
                        <h3 className="font-bold text-gray-900 text-lg leading-tight mb-3">
                          {v.cargo_nome || v.titulo}
                        </h3>

                        {/* Linha de meta-infos compacta */}
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600 mb-3 pb-3 border-b border-gray-100">
                          <span className="flex items-center gap-1"><span className="text-rose-500">📍</span> {cidadeLoja || tituloLoja}</span>
                          <span className="flex items-center gap-1">💼 1 posição</span>
                          {v.salario_min != null && Number(v.salario_min) > 0 && (
                            <span className="flex items-center gap-1 font-semibold text-emerald-700">💰 R$ {Number(v.salario_min).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                          )}
                          {v.experiencia_obrigatoria && (
                            <span className="flex items-center gap-1">⏳ {v.experiencia_meses_minimo ? `${v.experiencia_meses_minimo} meses exp.` : 'Com experiência'}</span>
                          )}
                        </div>

                        {/* Badges de tipo + turno */}
                        <div className="flex flex-wrap gap-2 mb-4">
                          {v.tipo_vaga_slug && (
                            <span className="px-3 py-1 bg-blue-50 text-blue-700 text-xs font-semibold rounded-md">
                              {(tiposVaga.find(t => t.slug === v.tipo_vaga_slug) || {}).nome || v.tipo_vaga_slug}
                            </span>
                          )}
                          {turnos.map(t => (
                            <span key={t} className="px-3 py-1 bg-sky-50 text-sky-700 text-xs font-semibold rounded-md">
                              🕐 {TURNO_LABEL[t] || t}
                            </span>
                          ))}
                        </div>

                        {/* Descrição da vaga / Atividades */}
                        {v.descricao && (
                          <section className="mb-4">
                            <h4 className="text-sm font-bold text-gray-900 mb-1.5 flex items-center gap-1.5">📝 Descrição da vaga / Atividades</h4>
                            <p className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed">{v.descricao}</p>
                          </section>
                        )}

                        {/* Requisitos */}
                        {v.requisitos && (
                          <section className="mb-4">
                            <h4 className="text-sm font-bold text-gray-900 mb-1.5 flex items-center gap-1.5">📋 Requisitos</h4>
                            <p className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed">{v.requisitos}</p>
                          </section>
                        )}

                        {/* Benefícios com valor (do catálogo, se cadastrado) */}
                        {beneficiosArr.length > 0 && (
                          <section className="mb-4">
                            <h4 className="text-sm font-bold text-gray-900 mb-1.5 flex items-center gap-1.5">🎁 Benefícios</h4>
                            <ul className="space-y-1">
                              {beneficiosArr.map((b, i) => {
                                const cat = beneficiosCatalogo.find(x => (x.nome || '').trim().toUpperCase() === b.trim().toUpperCase());
                                const valor = cat?.valor != null && Number(cat.valor) > 0
                                  ? Number(cat.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                                  : null;
                                return (
                                  <li key={i} className="text-xs text-gray-700 flex items-start gap-1.5">
                                    <span className="text-emerald-500 mt-0.5">✓</span>
                                    <span>{b}{valor && <span className="ml-1 text-emerald-700 font-semibold">· {valor}</span>}</span>
                                  </li>
                                );
                              })}
                            </ul>
                          </section>
                        )}

                        {/* Disponibilidade de horário */}
                        {turnos.length > 0 && (
                          <section className="mb-2">
                            <h4 className="text-sm font-bold text-gray-900 mb-1.5 flex items-center gap-1.5">🕐 Disponibilidade de horário</h4>
                            <div className="flex flex-wrap gap-1.5">
                              {turnos.map(t => (
                                <span key={t} className="px-2.5 py-1 bg-sky-50 border border-sky-200 text-sky-700 text-xs rounded-full font-semibold">
                                  {TURNO_LABEL[t] || t}
                                </span>
                              ))}
                            </div>
                          </section>
                        )}

                        {/* Horarios especificos da vaga (entrada/almoco/saida) */}
                        {(v.hora_entrada || v.hora_saida || v.hora_almoco_ini) && (
                          <section className="mb-2 mt-3">
                            <h4 className="text-sm font-bold text-gray-900 mb-1.5 flex items-center gap-1.5">⏱️ Horário desta vaga</h4>
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-2.5 text-xs space-y-1">
                              {v.hora_entrada && (
                                <div className="flex items-center justify-between">
                                  <span className="text-blue-900 font-semibold">Entrada:</span>
                                  <span className="text-blue-700 font-mono font-bold">{String(v.hora_entrada).substring(0, 5)}</span>
                                </div>
                              )}
                              {(v.hora_almoco_ini || v.hora_almoco_fim) && (
                                <div className="flex items-center justify-between">
                                  <span className="text-blue-900 font-semibold">Almoço:</span>
                                  <span className="text-blue-700 font-mono font-bold">
                                    {v.hora_almoco_ini ? String(v.hora_almoco_ini).substring(0, 5) : '--:--'}
                                    {' às '}
                                    {v.hora_almoco_fim ? String(v.hora_almoco_fim).substring(0, 5) : '--:--'}
                                  </span>
                                </div>
                              )}
                              {v.hora_saida && (
                                <div className="flex items-center justify-between">
                                  <span className="text-blue-900 font-semibold">Saída:</span>
                                  <span className="text-blue-700 font-mono font-bold">{String(v.hora_saida).substring(0, 5)}</span>
                                </div>
                              )}
                            </div>
                          </section>
                        )}

                        {/* Data de postagem */}
                        {dias && (
                          <p className="text-[11px] text-gray-400 mt-3 pt-3 border-t border-gray-100">Postada {dias}</p>
                        )}
                      </div>

                      {/* Botão grande no rodapé — candidata direto */}
                      <button
                        onClick={() => marcarVagaComFoco(v.id, marcado)}
                        className={`w-full px-5 py-3 font-bold text-sm transition ${marcado ? 'bg-emerald-500 hover:bg-emerald-600 text-white' : 'bg-rose-500 hover:bg-rose-600 text-white'}`}
                      >
                        {marcado ? '✓ Vaga selecionada — clique pra desmarcar' : '❤️ Quero me candidatar'}
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Cards de ação no rodapé — estilo igual aos cards de vaga */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* CARD 1: Continuar com vagas selecionadas (rosa) */}
                <div
                  ref={continuarVagasRef}
                  className={`bg-white rounded-2xl shadow-sm border-2 transition-all duration-300 overflow-hidden ${
                    vagasInteresse.length > 0 ? 'border-rose-500 ring-2 ring-rose-200' : 'border-gray-200 opacity-60'
                  } ${destaqueContinuar ? 'ring-4 ring-rose-400 shadow-2xl scale-[1.03]' : ''}`}
                >
                  <div className="p-5">
                    <h3 className="font-bold text-gray-900 text-lg leading-tight mb-2 flex items-center gap-2">
                      <span className="text-rose-500">❤️</span>
                      {vagasInteresse.length > 0
                        ? <>{vagasInteresse.length} vaga{vagasInteresse.length > 1 ? 's' : ''} selecionada{vagasInteresse.length > 1 ? 's' : ''}</>
                        : <>Quero me candidatar</>}
                    </h3>
                    <p className="text-sm text-gray-700 mb-3 leading-relaxed">
                      {vagasInteresse.length > 0
                        ? <>Continue o cadastro pra <strong>concorrer às vagas marcadas</strong> e ainda ficar no banco de talentos da empresa.</>
                        : <>Marque uma ou mais vagas clicando em <strong className="text-rose-600">"Quero me candidatar"</strong> e continue por aqui.</>}
                    </p>
                    {vagasInteresse.length > 0 && (
                      <p className="text-xs text-gray-500">💡 Você pode marcar mais vagas antes de continuar</p>
                    )}
                  </div>
                  <button
                    onClick={() => setViuVagas(true)}
                    disabled={vagasInteresse.length === 0}
                    className="w-full px-5 py-3 font-bold text-sm transition bg-rose-500 hover:bg-rose-600 text-white disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed"
                  >
                    {vagasInteresse.length > 0 ? 'Continuar cadastro →' : 'Selecione vagas pra continuar'}
                  </button>
                </div>

                {/* CARD 2: Só deixar currículo (neutro/cinza) */}
                <div className="bg-white rounded-2xl shadow-sm border-2 border-gray-200 hover:border-gray-400 transition-all overflow-hidden">
                  <div className="p-5">
                    <h3 className="font-bold text-gray-900 text-lg leading-tight mb-2 flex items-center gap-2">
                      <span>📝</span>
                      Não tenho interesse nessas vagas
                    </h3>
                    <p className="text-sm text-gray-700 mb-3 leading-relaxed">
                      Deixe seu currículo no nosso <strong>banco de talentos</strong> e te chamamos quando abrir uma vaga compatível com seu perfil.
                    </p>
                    <p className="text-xs text-gray-500">✨ Sem compromisso de candidatura imediata</p>
                  </div>
                  <button
                    onClick={() => { setVagasInteresse([]); setViuVagas(true); }}
                    className="w-full px-5 py-3 font-bold text-sm transition bg-gray-700 hover:bg-gray-800 text-white"
                  >
                    Só deixar meu currículo →
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // Tela intermediaria: Dicas pra aumentar chances (foto + redes sociais)
  if (lojaEscolhidaId != null && !viuDicas) {
    const lj = lojas.find(l => l.id === lojaEscolhidaId);
    const tituloLoja = lj ? (lj.apelido || (lj.is_principal ? 'MATRIZ' : (lj.cod_loja ? `LOJA ${lj.cod_loja}` : 'LOJA'))) : '';
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50 flex items-center justify-center p-4">
        <div className="max-w-lg w-full">
          {/* Banner topo */}
          <div className="bg-gradient-to-r from-amber-400 to-orange-500 text-white rounded-t-2xl p-5 shadow-lg flex items-center gap-3">
            <div className="text-5xl">⚠️</div>
            <div>
              <h1 className="text-2xl font-extrabold tracking-wide">ATENÇÃO!</h1>
              <p className="text-sm opacity-95">Antes de começar, leia com carinho:</p>
            </div>
          </div>

          {/* Card com a mensagem */}
          <div className="bg-white rounded-b-2xl shadow-xl p-6 space-y-4">
            <div className="text-center">
              <div className="text-5xl mb-2">📸 ✨ 📱</div>
              <p className="text-lg font-bold text-gray-900 leading-snug">
                Currículos com <span className="text-rose-600">foto</span> e <span className="text-rose-600">redes sociais</span> possuem <span className="underline decoration-amber-400 decoration-4">muito mais chances</span> de seleção.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-4">
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-center">
                <div className="text-3xl mb-1">📸</div>
                <p className="text-xs font-bold text-rose-800">FOTO</p>
                <p className="text-[11px] text-rose-700 mt-0.5">Mostra que você é real e profissional</p>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-center">
                <div className="text-3xl mb-1">📱</div>
                <p className="text-xs font-bold text-blue-800">REDES SOCIAIS</p>
                <p className="text-[11px] text-blue-700 mt-0.5">Instagram, LinkedIn, TikTok ajudam a te conhecer</p>
              </div>
            </div>

            <div className="bg-amber-50 border-l-4 border-amber-500 p-3 rounded text-sm text-amber-900">
              💡 <strong>Dica:</strong> Capriche! Quanto mais completo for seu currículo, maiores as chances de te chamarmos pra entrevista. 🚀
            </div>

            <label className={`flex items-start gap-2 p-3 rounded border-2 cursor-pointer transition ${aceitouLgpd ? 'bg-emerald-50 border-emerald-400' : 'bg-gray-50 border-gray-300 hover:border-gray-400'}`}>
              <input
                type="checkbox"
                checked={aceitouLgpd}
                onChange={(e) => setAceitouLgpd(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-rose-600 shrink-0"
              />
              <span className="text-xs text-gray-700">
                🔒 Li e aceito o uso dos meus dados pessoais para processo seletivo, mantidos por até
                12 meses. Posso solicitar acesso, correção ou exclusão a qualquer momento conforme a
                <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); abrirDoc('Política de Privacidade (LGPD)', 'consentimento'); }} className="text-rose-600 underline ml-1 hover:text-rose-700">Política de Privacidade (LGPD)</button>.
              </span>
            </label>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setLojaEscolhidaId(null)}
                className="px-4 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 font-medium text-sm"
              >
                ← Trocar loja
              </button>
              <button
                onClick={() => setViuDicas(true)}
                disabled={!aceitouLgpd}
                className={`flex-1 px-4 py-3 rounded-xl font-bold text-base shadow-md transition ${
                  aceitouLgpd
                    ? 'bg-gradient-to-r from-purple-600 to-purple-500 hover:from-pink-600 hover:to-rose-700 text-white'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
              >
                {aceitouLgpd ? 'Entendi, vamos lá! →' : 'Marque o aceite para continuar'}
              </button>
            </div>
          </div>
        </div>

        {/* Modal de visualizacao de documentos LGPD (welcome) */}
        {modalDoc && (
          <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4" onClick={() => setModalDoc(null)}>
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
              <div className="px-5 py-3 border-b bg-gradient-to-r from-purple-600 to-purple-500 text-white rounded-t-xl flex items-center justify-between">
                <h2 className="font-bold text-base">{modalDoc.titulo}</h2>
                <button onClick={() => setModalDoc(null)} className="text-white text-xl hover:text-gray-200">✕</button>
              </div>
              <div className="flex-1 overflow-y-auto p-5">
                <DocumentoLgpd tipo={modalDoc.tipo} />
              </div>
              <div className="px-5 py-3 border-t bg-gray-50 rounded-b-xl flex justify-end">
                <button onClick={() => setModalDoc(null)} className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded text-sm font-bold">Fechar</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Após currículo enviado - oferece DISC e/ou pré-entrevista
  if (enviado) {
    const candidatoNome = form.nome || '';
    const candidatoTelefone = form.whatsapp || '';
    const candidatoEmail = form.email || '';

    // ============ TELA: Convidar pra DISC ============
    if (config.disc_habilitado && posEnvioEtapa === null) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-purple-50 via-indigo-50 to-blue-50 flex items-center justify-center p-4">
          <div className="max-w-lg w-full">
            <div className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-t-2xl p-5 shadow-lg flex items-center gap-3">
              <div className="text-5xl">🎯</div>
              <div>
                <h1 className="text-2xl font-extrabold">Atenção, candidatos(as)!</h1>
              </div>
            </div>
            <div className="bg-white rounded-b-2xl shadow-xl p-6 space-y-4">
              {/* Confirmacao de envio do curriculo */}
              <div className="bg-emerald-50 border-2 border-emerald-300 rounded-lg p-4 text-center">
                <div className="text-4xl mb-1">✅</div>
                <p className="font-bold text-emerald-800 text-lg">Currículo enviado com sucesso!</p>
                <p className="text-sm text-emerald-700 mt-1">
                  {candidatoNome ? `Obrigado, ${candidatoNome.split(' ')[0]}! ` : 'Obrigado! '}
                  Seu currículo foi recebido e em breve nossa equipe entrará em contato.
                </p>
              </div>

              <AnexarCurriculoPdf curriculoId={curriculoId} estado={pdfCurriculo} onEstado={setPdfCurriculo} />

              <div className="border-t border-gray-200 pt-4">
                <p className="text-center text-purple-900 font-bold mb-3">🎯 Quer aumentar suas chances?</p>
                <p className="text-gray-800 leading-relaxed">
                  Nós utilizamos um teste chamado <strong className="text-purple-700">DISC</strong> para conhecer melhor o perfil do candidato. 🎯
                </p>
                <p className="text-gray-800 leading-relaxed mt-2">
                  <strong>Não existem respostas certas ou erradas</strong> — o teste serve apenas
                  para conhecermos melhor o seu perfil. Fique tranquilo(a) e responda com sinceridade. 😊
                </p>
                <p className="text-gray-800 leading-relaxed mt-2">
                  Candidatos que preenchem o teste possuem <strong className="underline decoration-amber-400 decoration-4">muito mais chances</strong> de seleção. ✨
                </p>
              </div>
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 text-sm text-purple-900 text-center">
                ⏱️ Leva em torno de <strong>10 a 15 minutos</strong>
              </div>
              <p className="text-center text-gray-700 font-bold mt-2">Gostaria de preencher?</p>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setPosEnvioEtapa('skip_disc')}
                  className="flex-1 px-4 py-3 border-2 border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 font-bold">
                  ❌ NÃO, agora não
                </button>
                <button onClick={() => {
                  // Vai pra DISC ja amarrado ao curriculo. Quando voltar, oferece pré-entrevista (se habilitada).
                  // Salva dados do candidato pra prefilling apos o DISC.
                  if (config.preentrevista_habilitada) {
                    localStorage.setItem('apos_disc_oferecer_preentrevista', JSON.stringify({
                      nome: candidatoNome,
                      telefone: candidatoTelefone,
                      email: candidatoEmail,
                      curriculo_id: curriculoId,
                    }));
                  }
                  const qs = new URLSearchParams({ nome: candidatoNome });
                  if (curriculoId) qs.set('curriculo_id', String(curriculoId));
                  window.location.href = `/disc?${qs.toString()}`;
                }}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white rounded-xl font-bold">
                  ✅ SIM, vamos lá!
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // ============ TELA: Convidar pra Pré-Entrevista (se DISC desabilitado mas pré-entrevista sim) ============
    if (!config.disc_habilitado && config.preentrevista_habilitada && posEnvioEtapa === null) {
      return <ConvitePreEntrevista nome={candidatoNome} telefone={candidatoTelefone} email={candidatoEmail}
        curriculoId={curriculoId}
        onSkip={() => setPosEnvioEtapa('skip_preentrevista')} />;
    }

    // ============ TELA FINAL ============
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-100 via-teal-100 to-green-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 text-center max-w-md">
          <div className="text-6xl mb-3">🎉</div>
          <h1 className="text-2xl font-bold text-emerald-700 mb-2">Currículo enviado!</h1>
          <p className="text-sm text-gray-600">
            Recebemos seus dados. Se houver uma vaga compatível, nossa equipe de RH entrará em contato pelo WhatsApp ou e-mail.
          </p>

          <div className="mt-5 text-left">
            <AnexarCurriculoPdf curriculoId={curriculoId} estado={pdfCurriculo} onEstado={setPdfCurriculo} />
          </div>

          <p className="text-xs text-gray-400 mt-4">Você já pode fechar esta página.</p>
        </div>
      </div>
    );
  }

  // Trava de tipo de vaga / turno conforme a(s) vaga(s) marcada(s).
  // So trava quando a vaga JA define o valor; senao o candidato escolhe livre.
  const vagasSelLock = vagasAbertas.filter(v => vagasInteresse.includes(v.id));
  const tiposLock = [...new Set(vagasSelLock.map(v => v.tipo_vaga_slug).filter(Boolean))];
  const tipoVagaTravado = tiposLock.length === 1 ? tiposLock[0] : null;
  const turnosTravados = [...new Set(vagasSelLock.flatMap(v => Array.isArray(v.turnos) ? v.turnos : []))];
  const turnosTravadosAtivo = turnosTravados.length > 0;
  // Cargos cuja experiencia e EXIGIDA pela(s) vaga(s) marcada(s) + o tempo minimo (meses).
  const minExpPorCargo = {};
  vagasSelLock.filter(v => v.experiencia_obrigatoria && v.cargo_nome).forEach(v => {
    const cg = String(v.cargo_nome).toUpperCase();
    minExpPorCargo[cg] = Math.max(minExpPorCargo[cg] || 0, Number(v.experiencia_meses_minimo) || 0);
  });
  const cargosObrigatorios = Object.keys(minExpPorCargo);

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-rose-50 to-orange-50 py-6 px-4 overflow-x-hidden">
      <div className="max-w-3xl mx-auto">
        <div className="bg-gradient-to-r from-purple-600 to-purple-500 text-white rounded-2xl shadow-lg p-5 mb-4">
          <div className="flex items-center gap-3">
            <div className="text-4xl">📝</div>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold">Cadastro de Currículo</h1>
              <p className="text-xs opacity-90 mt-0.5">Preencha como em um currículo tradicional. Quanto mais detalhes, maiores suas chances.</p>
            </div>
          </div>
          {/* Loja selecionada com opcao de trocar */}
          {(() => {
            const lj = lojas.find(l => l.id === lojaEscolhidaId);
            if (!lj) return null;
            const titulo = lj.apelido || (lj.is_principal ? 'MATRIZ' : (lj.cod_loja ? `LOJA ${lj.cod_loja}` : 'LOJA'));
            return (
              <div className="mt-3 pt-3 border-t border-white/20 flex items-center justify-between gap-3 flex-wrap text-sm">
                <div className="flex items-center gap-2">
                  <span>🏪</span>
                  <span>
                    Candidatando-se na <strong>{titulo}</strong>
                    {lj.nome && <> · {lj.nome}</>}
                    {lj.bairro && <> · {lj.bairro}</>}
                  </span>
                </div>
                {lojas.length > 1 && (
                  <button type="button" onClick={() => setLojaEscolhidaId(null)}
                    className="text-xs px-3 py-1 bg-white/20 hover:bg-white/30 rounded-full font-semibold transition">
                    Trocar loja
                  </button>
                )}
              </div>
            );
          })()}
        </div>

        {erro && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm mb-3">{erro}</div>}

        {/* Lista de sugestões de cursos */}
        <datalist id="cursos-sugeridos">
          <option value="Analfabeto" />
          <option value="Ensino Fundamental" />
          <option value="Ensino Médio" />
          <option value="Ensino Técnico" />
          <option value="Ensino Superior" />
          <option value="Pós-graduação" />
          <option value="Mestrado" />
          <option value="Doutorado" />
        </datalist>

        <form onSubmit={enviar} className="bg-white rounded-2xl shadow-md p-5 space-y-6">
          {/* ===== FOTO + DADOS PESSOAIS ===== */}
          <section>
            <h2 className="text-sm font-bold text-gray-800 mb-3">👤 Dados pessoais</h2>
            <div className="flex flex-col md:flex-row gap-4 items-start">
              {/* Foto */}
              <div className="shrink-0 flex flex-col items-center gap-2">
                <div className="w-32 h-32 rounded-full border-4 border-rose-200 bg-rose-50 overflow-hidden flex items-center justify-center">
                  {form.foto_url ? (
                    <img src={form.foto_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <svg className="w-16 h-16 text-rose-300" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
                <input ref={fotoInputRef} type="file" accept="image/*" onChange={subirFoto} className="hidden" />
                <button type="button" onClick={() => fotoInputRef.current?.click()} disabled={uploadingFoto}
                  className={`text-xs px-3 py-1.5 rounded-full font-bold ${uploadingFoto ? 'bg-gray-300 text-gray-500' : 'bg-rose-100 text-rose-700 hover:bg-rose-200'}`}>
                  {uploadingFoto ? '⏳ Enviando…' : (form.foto_url ? '🔄 Trocar foto' : '📷 Adicionar foto')}
                </button>
                <span className="text-[10px] text-gray-400">(opcional)</span>
              </div>

              {/* Campos */}
              <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3 w-full">
                <FieldReq label="Nome completo" value={form.nome} onChange={v => setForm({ ...form, nome: v })} />
                <Field label="Data de nascimento *" type="date" value={form.data_nascimento} onChange={v => setForm({ ...form, data_nascimento: v })} />
                <Field label="WhatsApp" placeholder="(00) 00000-0000" value={form.whatsapp} onChange={v => setForm({ ...form, whatsapp: v })} caseSensitive />
                <Field label="E-mail" type="email" value={form.email} onChange={v => setForm({ ...form, email: v })} caseSensitive />
                <Field label="Instagram (@)" value={form.instagram} onChange={v => setForm({ ...form, instagram: v })} caseSensitive />
              </div>
            </div>
          </section>

          {/* ===== RESUMO / SOBRE ===== */}
          <section>
            <h2 className="text-sm font-bold text-gray-800 mb-1">🧾 Resumo Pessoal e Profissional <span className="text-red-500">*</span></h2>
            <p className="text-xs text-gray-500 mb-2">Fale brevemente sobre você, sua experiência e o que busca.</p>
            <textarea ref={resumoRef} value={form.resumo} onChange={e => setForm({ ...form, resumo: e.target.value.toUpperCase() })} rows={3}
              placeholder="EX: SOU ORGANIZADO, COM 4 ANOS DE EXPERIÊNCIA EM ATENDIMENTO E CAIXA. BUSCO UMA VAGA ONDE POSSA CRESCER NA ÁREA DE REPOSIÇÃO."
              style={{ textTransform: 'uppercase' }}
              required
              className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-rose-400" />
          </section>

          {/* ===== ENDEREÇO ===== */}
          <section>
            <h2 className="text-sm font-bold text-gray-800 mb-3">🏠 Endereço</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold uppercase text-gray-500 mb-1">CEP</label>
                <div className="relative">
                  <input
                    type="text"
                    value={form.cep}
                    onChange={e => {
                      const v = formatCep(e.target.value);
                      setForm({ ...form, cep: v });
                      if (v.replace(/\D/g, '').length === 8) buscarCep(v);
                    }}
                    onBlur={() => buscarCep(form.cep)}
                    maxLength={9}
                    placeholder="00000-000"
                    className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-rose-400"
                  />
                  {buscandoCep && <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-rose-500 animate-pulse">⏳</span>}
                </div>
                <p className="text-[11px] text-gray-500 mt-0.5">Digite o CEP — Rua, Bairro, Cidade e UF preenchem sozinhos</p>
              </div>
              <Field label="Rua" value={form.rua} onChange={v => setForm({ ...form, rua: (v || '').toUpperCase() })} />
              <Field label="Número" value={form.numero} onChange={v => setForm({ ...form, numero: v })} />
              <Field label="Complemento" value={form.complemento} onChange={v => setForm({ ...form, complemento: (v || '').toUpperCase() })} />
              <Field label="Bairro" value={form.bairro} onChange={v => setForm({ ...form, bairro: (v || '').toUpperCase() })} />
              <Field label="Cidade" value={form.cidade} onChange={v => setForm({ ...form, cidade: (v || '').toUpperCase() })} />
              <Field label="Estado (UF)" value={form.estado} onChange={v => setForm({ ...form, estado: v.toUpperCase().slice(0, 2) })} />
            </div>
          </section>

          {/* ===== INTERESSE DE VAGA (OBRIGATÓRIO) ===== */}
          <section>
            <h2 className="text-sm font-bold text-gray-800 mb-1">
              🎯 Interesse de vaga <span className="text-red-500">*</span>
            </h2>
            <p className="text-xs text-gray-500 mb-2">
              {tipoVagaTravado
                ? <span className="text-rose-600 font-semibold">🔒 Definido pela vaga selecionada</span>
                : 'Selecione UMA opção (obrigatório)'}
            </p>
            <div className={`grid gap-2 ${tiposVaga.length <= 2 ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3'}`}>
              {tiposVaga.map(t => {
                const travadoEste = !!tipoVagaTravado;
                const ehOEscolhido = form.interesse_vaga === t.slug;
                // Quando travado, mostra so o tipo da vaga (esconde os outros).
                if (travadoEste && tipoVagaTravado !== t.slug) return null;
                return (
                <label key={t.slug}
                  className={`flex items-center gap-2 p-3 border-2 rounded-lg transition ${
                    travadoEste ? 'cursor-default' : 'cursor-pointer'
                  } ${
                    ehOEscolhido
                      ? 'border-rose-500 bg-rose-50 ring-2 ring-rose-200'
                      : 'border-gray-200 hover:border-rose-300'
                  }`}>
                  <input type="radio" name="interesse_vaga" value={t.slug}
                    checked={ehOEscolhido}
                    disabled={travadoEste}
                    onChange={() => setForm({ ...form, interesse_vaga: t.slug })}
                    className="w-4 h-4 accent-rose-500" required />
                  <div>
                    <div className="text-sm font-bold text-gray-800">{t.nome}</div>
                  </div>
                </label>
                );
              })}
            </div>
          </section>

          {/* ===== EXPERIÊNCIAS COMO (cargos) ===== */}
          <section>
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-sm font-bold text-gray-800">💼 Experiências como</h2>
              <button type="button" onClick={addCargoNovo}
                className="text-xs px-3 py-1 bg-rose-100 text-rose-700 rounded-full font-bold hover:bg-rose-200">
                + Outra função
              </button>
            </div>
            <p className="text-xs text-gray-500 mb-2">Marque os cargos em que já trabalhou. Ao marcar, abaixo abre um campo pra detalhar a experiência.</p>
            {cargosObrigatorios.length > 0 && (
              <div className="mb-2 p-2.5 bg-amber-50 border-2 border-amber-300 rounded-lg text-xs text-amber-900">
                ⚠️ Esta vaga <strong>exige experiência</strong> na função <strong>{cargosObrigatorios.join(', ')}</strong>. Ela já vem marcada e o tempo de experiência é <strong>obrigatório</strong>. As demais funções são opcionais.
              </div>
            )}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {cargos.map(c => {
                const obrig = cargosObrigatorios.includes(c);
                return (
                <label key={c} className={`flex items-center gap-2 p-2 border-2 rounded-lg text-xs ${obrig ? 'cursor-default border-amber-400 bg-amber-50' : 'cursor-pointer'} ${!obrig && (form.cargos.includes(c) ? 'border-rose-400 bg-rose-50' : 'border-gray-200 hover:border-rose-200')}`}>
                  <input type="checkbox" checked={form.cargos.includes(c)} disabled={obrig} onChange={() => toggleCargo(c)}
                    className="w-4 h-4 accent-rose-500" />
                  <span className="text-gray-700 font-semibold">{c}</span>
                  {obrig && <span className="ml-auto text-[11px] bg-amber-500 text-white px-2 py-0.5 rounded-full font-bold whitespace-nowrap">EXIGIDO</span>}
                </label>
                );
              })}
            </div>
          </section>

          {/* ===== DETALHES DAS EXPERIÊNCIAS ===== */}
          {form.experiencias_detalhadas.length > 0 && (
            <section>
              <h2 className="text-sm font-bold text-gray-800 mb-2">📋 Detalhes das suas experiências</h2>
              <div className="space-y-3">
                {form.experiencias_detalhadas.map((ex, idx) => {
                  const obrig = cargosObrigatorios.includes(ex.funcao);
                  return (
                  <div key={idx} className={`rounded-xl p-3 relative border-2 ${obrig ? 'bg-amber-50/60 border-amber-300' : 'bg-rose-50/50 border-rose-200'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-bold text-rose-700 uppercase">
                        Função {idx + 1}
                        {obrig && <span className="ml-2 bg-amber-500 text-white px-1.5 py-0.5 rounded-full text-[9px] normal-case">Experiência obrigatória</span>}
                      </span>
                      {!obrig && (
                        <button type="button" onClick={() => removeExperiencia(idx)}
                          className="text-xs text-red-600 hover:text-red-800 font-bold">🗑️ Remover</button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      <Field label="Função / Cargo" value={ex.funcao} onChange={v => updateExperiencia(idx, 'funcao', v)} />
                      <Field label="Empresa" value={ex.empresa} onChange={v => updateExperiencia(idx, 'empresa', v)} />
                      <Field label="Instagram da empresa (opcional)" value={ex.empresa_instagram} onChange={v => updateExperiencia(idx, 'empresa_instagram', v)} placeholder="@empresa" caseSensitive />
                      <div className="grid grid-cols-2 gap-2">
                        <Field label="Quantos anos de Experiência" type="number" value={ex.tempo_anos} onChange={v => updateExperiencia(idx, 'tempo_anos', v)} />
                        <Field label="Quantos meses de Experiência" type="number" value={ex.tempo_meses} onChange={v => updateExperiencia(idx, 'tempo_meses', v)} />
                      </div>
                      {obrig && (
                        <div className="md:col-span-2 p-2 bg-amber-100 border border-amber-300 rounded-lg text-xs text-amber-900 font-semibold">
                          ⚠️ {minExpPorCargo[ex.funcao] > 0
                            ? <>Essa vaga exige no mínimo <strong>{fmtTempoExp(minExpPorCargo[ex.funcao])}</strong> de experiência nesta função.</>
                            : <>Essa vaga exige experiência nesta função (preenchimento obrigatório).</>}
                        </div>
                      )}
                      <div className="md:col-span-2">
                        <label className="block text-[11px] font-semibold uppercase text-gray-500 mb-1">O que você fazia</label>
                        <textarea value={ex.descricao} onChange={e => updateExperiencia(idx, 'descricao', e.target.value)} rows={2}
                          placeholder="Ex: atendimento no balcão, reposição das gôndolas, fechamento de caixa…"
                          className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-rose-400" />
                      </div>
                    </div>
                  </div>
                  );
                })}
              </div>
              <button type="button" onClick={() => addExperiencia('')}
                className="mt-3 w-full py-2 border-2 border-dashed border-rose-300 text-rose-600 rounded-lg text-sm font-bold hover:bg-rose-50">
                + Adicionar mais uma experiência
              </button>
            </section>
          )}

          {/* ===== HABILIDADES ===== */}
          <section>
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-sm font-bold text-gray-800">⭐ Pontos Fortes</h2>
              <button type="button" onClick={addHabilidadeNova}
                className="text-xs px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full font-bold hover:bg-indigo-200">
                + Outro ponto forte
              </button>
            </div>
            <p className="text-xs text-gray-500 mb-2">Marque o que mais combina com você</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {habilidades.map(h => (
                <label key={h} className={`flex items-center gap-2 p-2 border-2 rounded-lg cursor-pointer text-xs ${form.habilidades.includes(h) ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200 hover:border-indigo-200'}`}>
                  <input type="checkbox" checked={form.habilidades.includes(h)} onChange={() => toggleItem('habilidades', h)}
                    className="w-4 h-4 accent-indigo-500" />
                  <span className="text-gray-700">{h}</span>
                </label>
              ))}
            </div>
          </section>

          {/* ===== FORMAÇÃO ACADÊMICA ===== */}
          <section>
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-sm font-bold text-gray-800">🎓 Formação</h2>
              <button type="button" onClick={addFormacao}
                className="text-xs px-3 py-1 bg-amber-100 text-amber-700 rounded-full font-bold hover:bg-amber-200">
                + Adicionar
              </button>
            </div>
            {form.formacoes.length === 0 && (
              <p className="text-xs text-gray-400 italic">Nenhuma formação adicionada. Clique no botão acima.</p>
            )}
            <div className="space-y-2">
              {form.formacoes.map((fm, idx) => {
                const nivelExigeNome = ['Ensino Técnico', 'Ensino Superior', 'Pós-graduação', 'Mestrado', 'Doutorado']
                  .includes((fm.curso || '').trim());
                return (
                  <div key={idx} className="bg-amber-50/50 border-2 border-amber-200 rounded-xl p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-bold text-amber-700 uppercase">Formação {idx + 1}</span>
                      <button type="button" onClick={() => removeFormacao(idx)} className="text-xs text-red-600 hover:text-red-800 font-bold">🗑️</button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] font-semibold uppercase text-gray-500 mb-1">Nível</label>
                        <select value={fm.curso || ''} onChange={e => updateFormacao(idx, 'curso', e.target.value)}
                          className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-400">
                          <option value="">— selecione —</option>
                          <option value="Analfabeto">Analfabeto</option>
                          <option value="Ensino Fundamental">Ensino Fundamental</option>
                          <option value="Ensino Médio">Ensino Médio</option>
                          <option value="Ensino Técnico">Ensino Técnico</option>
                          <option value="Ensino Superior">Ensino Superior</option>
                          <option value="Pós-graduação">Pós-graduação</option>
                          <option value="Mestrado">Mestrado</option>
                          <option value="Doutorado">Doutorado</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold uppercase text-gray-500 mb-1">Situação</label>
                        <select value={fm.status} onChange={e => updateFormacao(idx, 'status', e.target.value)}
                          className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-400">
                          <option value="concluido">Concluído</option>
                          <option value="cursando">Cursando</option>
                          <option value="incompleto">Incompleto</option>
                        </select>
                      </div>
                      {nivelExigeNome && (
                        <div className="md:col-span-2">
                          <Field
                            label="Nome do curso"
                            value={fm.nome_curso}
                            onChange={v => updateFormacao(idx, 'nome_curso', v)}
                            placeholder="Ex: Administração, Técnico em Informática…"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* ===== CURSOS COMPLEMENTARES ===== */}
          <section>
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-sm font-bold text-gray-800">📖 Cursos complementares</h2>
              <button type="button" onClick={addCursoAdic}
                className="text-xs px-3 py-1 bg-sky-100 text-sky-700 rounded-full font-bold hover:bg-sky-200">
                + Adicionar curso
              </button>
            </div>
            <p className="text-xs text-gray-500 mb-2">Ex: NR-11 Empilhadeira, Manipulação de Alimentos, Excel, Inglês…</p>
            {(form.cursos_adicionais || []).length === 0 && (
              <p className="text-xs text-gray-400 italic">Nenhum curso adicionado.</p>
            )}
            <div className="space-y-2">
              {(form.cursos_adicionais || []).map((curso, idx) => {
                // Compat: aceita valor antigo (string)
                const c = typeof curso === 'string' ? { nome: curso, instituicao: '', tempo: '' } : curso;
                return (
                  <div key={idx} className="bg-sky-50/50 border-2 border-sky-200 rounded-xl p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-bold text-sky-700 uppercase">Curso {idx + 1}</span>
                      <button type="button" onClick={() => removeCursoAdic(idx)} className="text-xs text-red-600 hover:text-red-800 font-bold">🗑️</button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      <div className="md:col-span-2">
                        <label className="block text-[11px] font-semibold uppercase text-gray-500 mb-1">Nome do curso</label>
                        <input type="text" value={c.nome || ''} onChange={e => updateCursoAdic(idx, 'nome', e.target.value.toUpperCase())}
                          placeholder="Ex: NR-11 EMPILHADEIRA"
                          style={{ textTransform: 'uppercase' }}
                          className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-sky-400" />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold uppercase text-gray-500 mb-1">Escola / instituição</label>
                        <input type="text" value={c.instituicao || ''} onChange={e => updateCursoAdic(idx, 'instituicao', e.target.value.toUpperCase())}
                          placeholder="Ex: SENAC"
                          style={{ textTransform: 'uppercase' }}
                          className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-sky-400" />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold uppercase text-gray-500 mb-1">Tempo / carga horária</label>
                        <input type="text" value={c.tempo || ''} onChange={e => updateCursoAdic(idx, 'tempo', e.target.value.toUpperCase())}
                          placeholder="Ex: 40H, 3 MESES, 1 ANO"
                          style={{ textTransform: 'uppercase' }}
                          className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-sky-400" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* ===== DISPONIBILIDADE DE HORARIO ===== */}
          <section>
            <h2 className="text-sm font-bold text-gray-800 mb-1">⏰ Disponibilidade de horário</h2>
            <p className="text-xs text-gray-500 mb-2">
              {turnosTravadosAtivo
                ? <span className="text-rose-600 font-semibold">🔒 Definido pela vaga selecionada</span>
                : 'Marque os turnos que você pode trabalhar'}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {[
                { id: 'manha', label: 'Turno Manhã', emoji: '🌅' },
                { id: 'intermediario', label: 'Turno Intermediário', emoji: '☀️' },
                { id: 'tarde', label: 'Turno Tarde', emoji: '🌇' },
                { id: 'qualquer', label: 'Disponibilidade pra qualquer horário', emoji: '✨' },
              ].map(opt => {
                const checked = (form.disponibilidade_turnos || []).includes(opt.id);
                // Travado pela vaga: esconde os turnos que nao sao da vaga.
                if (turnosTravadosAtivo && !turnosTravados.includes(opt.id)) return null;
                return (
                  <label key={opt.id}
                    className={`flex items-center gap-2 p-2 border-2 rounded-lg text-xs transition ${
                      turnosTravadosAtivo ? 'cursor-default' : 'cursor-pointer'
                    } ${
                      checked ? 'border-rose-400 bg-rose-50' : 'border-gray-200 hover:border-rose-200'
                    }`}>
                    <input type="checkbox" checked={checked}
                      disabled={turnosTravadosAtivo}
                      onChange={() => {
                        setForm(f => {
                          const atual = f.disponibilidade_turnos || [];
                          // Se marcou "qualquer", desmarca os outros (e vice-versa)
                          if (opt.id === 'qualquer') {
                            return { ...f, disponibilidade_turnos: checked ? [] : ['qualquer'] };
                          }
                          const semQualquer = atual.filter(x => x !== 'qualquer');
                          const novo = checked
                            ? semQualquer.filter(x => x !== opt.id)
                            : [...semQualquer, opt.id];
                          return { ...f, disponibilidade_turnos: novo };
                        });
                      }}
                      className="w-4 h-4 accent-rose-500" />
                    <span className="text-base">{opt.emoji}</span>
                    <span className="font-medium">{opt.label}</span>
                  </label>
                );
              })}
            </div>
          </section>

          {/* ===== CAMPO LIVRE ===== */}
          <section>
            <h2 className="text-sm font-bold text-gray-800 mb-1">📝 Informações adicionais (opcional)</h2>
            <textarea value={form.experiencia_texto} onChange={e => setForm({ ...form, experiencia_texto: e.target.value })}
              rows={3} placeholder="Idiomas, CNH, particularidades, etc…"
              className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-rose-400" />
          </section>

          {/* ===== TERMO LGPD - aceite obrigatorio antes de enviar ===== */}
          <section className="border-2 border-rose-200 bg-rose-50/40 rounded-xl p-4 space-y-3">
            <h2 className="text-sm font-bold text-gray-800 flex items-center gap-2">
              🔒 Termo de Consentimento (LGPD)
            </h2>
            <div className="text-xs text-gray-700 leading-relaxed bg-white rounded-lg p-3 border border-gray-200 max-h-48 overflow-y-auto">
              <p className="font-semibold mb-2">Antes de enviar, leia atentamente:</p>
              <p className="mb-2">
                <strong>Quem coleta seus dados:</strong> a empresa (Controladora dos dados) em parceria com o Kontrata.ai (Operador).
              </p>
              <p className="mb-2">
                <strong>Para que serão usados:</strong> avaliar sua candidatura para vagas em aberto e futuras, comunicar sobre o processo seletivo e compor o banco de talentos.
              </p>
              <p className="mb-2">
                <strong>Por quanto tempo:</strong> até 12 meses (após esse prazo seus dados são excluídos ou anonimizados, exceto se você for contratado).
              </p>
              <p className="mb-2">
                <strong>Compartilhamento:</strong> apenas com a equipe de RH da empresa autorizada e sub-operadores técnicos da plataforma (hospedagem, IA quando aplicável).
              </p>
              <p className="mb-2">
                <strong>Decisões automatizadas:</strong> a pré-triagem por IA gera apenas uma sugestão — a decisão final é sempre humana. Você tem direito a solicitar revisão humana (Art. 20 LGPD).
              </p>
              <p className="mb-2">
                <strong>Seus direitos:</strong> acesso, correção, exclusão, portabilidade e revogação a qualquer momento.
              </p>
              <p>
                <strong>Texto completo:</strong>{' '}
                <button type="button" onClick={() => abrirDoc('Termo de Consentimento de Currículo', 'consentimento')} className="text-rose-600 underline hover:text-rose-700">
                  abrir Termo de Consentimento de Currículo
                </button>
                {' · '}
                <button type="button" onClick={() => abrirDoc('Política de Privacidade', 'privacidade')} className="text-rose-600 underline hover:text-rose-700">
                  Política de Privacidade
                </button>
              </p>
            </div>
            <label className={`flex items-start gap-2 p-3 rounded-lg border-2 cursor-pointer transition ${aceitouTermoFinal ? 'bg-emerald-50 border-emerald-400' : 'bg-white border-gray-300 hover:border-gray-400'}`}>
              <input
                type="checkbox"
                checked={aceitouTermoFinal}
                onChange={(e) => setAceitouTermoFinal(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-rose-600 shrink-0"
              />
              <span className="text-xs text-gray-800">
                <strong>Li e estou de acordo</strong> com o tratamento dos meus dados pessoais para
                participação em processos seletivos e composição do banco de talentos da empresa,
                pelo prazo de até 12 meses, conforme descrito acima.
              </span>
            </label>
          </section>

          <button type="submit" disabled={enviando || !aceitouTermoFinal}
            className={`w-full py-4 rounded-xl font-bold text-white text-base shadow-md transition ${
              enviando ? 'bg-gray-400' :
              !aceitouTermoFinal ? 'bg-gray-300 cursor-not-allowed' :
              'bg-gradient-to-r from-purple-600 to-purple-500 hover:shadow-lg hover:scale-[1.01]'
            }`}>
            {enviando ? 'Enviando…' : (!aceitouTermoFinal ? '🔒 Marque o aceite acima para enviar' : '🚀 Enviar currículo')}
          </button>
        </form>

        <p className="text-center text-[11px] text-gray-500 mt-4">Kontrata.ai · Banco de Currículos</p>
      </div>

      {/* Modal de visualizacao de documentos LGPD */}
      {modalDoc && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4" onClick={() => setModalDoc(null)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-3 border-b bg-gradient-to-r from-purple-600 to-purple-500 text-white rounded-t-xl flex items-center justify-between">
              <h2 className="font-bold text-base">{modalDoc.titulo}</h2>
              <button onClick={() => setModalDoc(null)} className="text-white text-xl hover:text-gray-200">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              <DocumentoLgpd tipo={modalDoc.tipo} />
            </div>
            <div className="px-5 py-3 border-t bg-gray-50 rounded-b-xl flex justify-end">
              <button onClick={() => setModalDoc(null)} className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded text-sm font-bold">Fechar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ===== DOCUMENTO LGPD - Texto limpo apresentado ao candidato =====
function DocumentoLgpd({ tipo }) {
  if (tipo === 'consentimento') {
    return (
      <div className="space-y-4 text-sm text-gray-800 leading-relaxed">
        <h3 className="font-bold text-base text-gray-900">Termo de Consentimento — Banco de Currículos</h3>
        <p className="text-xs text-gray-500">Última atualização: 18/06/2026</p>

        <div>
          <h4 className="font-bold text-gray-800">📌 Quem coleta seus dados</h4>
          <p>A empresa onde você está se candidatando (Controladora dos seus dados) em parceria com a plataforma <strong>Kontrata.ai</strong> (Operadora).</p>
        </div>

        <div>
          <h4 className="font-bold text-gray-800">📋 Quais dados coletamos</h4>
          <ul className="list-disc list-inside space-y-0.5">
            <li>Identificação: nome, CPF, RG, data de nascimento, sexo, estado civil</li>
            <li>Contato: telefone, WhatsApp, e-mail, redes sociais (opcional)</li>
            <li>Endereço residencial</li>
            <li>Foto pessoal (opcional)</li>
            <li>Currículo profissional, experiências, formação, habilidades</li>
            <li>Cargos de interesse</li>
            <li>Perfil comportamental DISC (se você optar por preencher)</li>
          </ul>
          <p className="text-xs text-gray-500 mt-1">
            No currículo, <strong>nome</strong> e <strong>data de nascimento</strong> são obrigatórios. A data de nascimento é usada para
            verificar idade mínima, enquadramento (ex.: Menor Aprendiz) e exigências trabalhistas — <strong>nunca</strong> como critério
            de exclusão por idade. Dados como CPF, RG, sexo e estado civil são solicitados apenas <strong>na admissão</strong>, se você for contratado.
          </p>
        </div>

        <div>
          <h4 className="font-bold text-gray-800">🎯 Para que usamos</h4>
          <ul className="list-disc list-inside space-y-0.5">
            <li>Avaliar sua candidatura para vagas em aberto e futuras</li>
            <li>Comunicar com você sobre o processo seletivo</li>
            <li>Compor o banco de talentos para oportunidades futuras</li>
            <li>Realizar entrevistas, inclusive por meio de IA (Recrutador IA)</li>
            <li>Calcular a distância aproximada entre o seu endereço (CEP) e a loja, como apoio logístico ao processo</li>
          </ul>
        </div>

        <div>
          <h4 className="font-bold text-gray-800">⏱️ Por quanto tempo</h4>
          <ul className="list-disc list-inside space-y-0.5">
            <li><strong>Se contratado</strong>: seus dados são integrados ao seu cadastro como colaborador. Nessa etapa podem ser coletados dados sensíveis para cumprir obrigações legais — <strong>raça/cor</strong> e <strong>deficiência</strong> (exigências do eSocial e da cota de PCD) — e, de forma <strong>opcional</strong>, <strong>tipo sanguíneo</strong> (apenas para casos de emergência). Esses dados têm acesso restrito.</li>
            <li><strong>Se não contratado</strong>: dados mantidos por <strong>até 12 meses</strong>, depois excluídos ou anonimizados</li>
          </ul>
        </div>

        <div>
          <h4 className="font-bold text-gray-800">🔗 Com quem compartilhamos</h4>
          <ul className="list-disc list-inside space-y-0.5">
            <li>Apenas com a equipe de RH da empresa autorizada</li>
            <li>Com a Kontrata.ai como Operadora da plataforma</li>
            <li>Com sub-operadores autorizados (hospedagem, IA quando aplicável, e serviços de geolocalização para calcular a distância a partir do seu CEP)</li>
            <li>Com autoridades quando legalmente exigido</li>
          </ul>
        </div>

        <div>
          <h4 className="font-bold text-gray-800">🤖 Decisões automatizadas (IA)</h4>
          <ul className="list-disc list-inside space-y-0.5">
            <li>Pré-triagem por IA gera apenas uma <strong>sugestão</strong>, não decisão final</li>
            <li>A <strong>decisão final é sempre humana</strong></li>
            <li>Você tem direito de solicitar revisão humana (Art. 20 LGPD)</li>
          </ul>
        </div>

        <div>
          <h4 className="font-bold text-gray-800">⚖️ Seus direitos</h4>
          <p>A qualquer momento você pode solicitar:</p>
          <ul className="list-disc list-inside space-y-0.5">
            <li>Acesso aos seus dados</li>
            <li>Correção de dados incompletos ou desatualizados</li>
            <li>Exclusão dos seus dados</li>
            <li>Portabilidade (exportar para outro sistema)</li>
            <li>Revogação deste consentimento</li>
          </ul>
        </div>

        <div>
          <h4 className="font-bold text-gray-800">📞 Como exercer seus direitos</h4>
          <ul className="list-disc list-inside space-y-0.5">
            <li>Por e-mail à empresa onde você se candidatou</li>
            <li>Pelo Encarregado de Dados do Kontrata.ai: <strong>dpo@kontrataai.com.br</strong></li>
            <li>ANPD: <strong>www.gov.br/anpd</strong></li>
          </ul>
        </div>

        <p className="text-xs italic text-gray-500 border-t pt-3">
          Ao marcar o aceite no formulário, você confirma que leu este termo e autoriza o tratamento dos seus dados conforme descrito acima.
        </p>
      </div>
    );
  }

  // Política de Privacidade resumida (versão para candidato)
  return (
    <div className="space-y-4 text-sm text-gray-800 leading-relaxed">
      <h3 className="font-bold text-base text-gray-900">Política de Privacidade — Kontrata.ai</h3>
      <p className="text-xs text-gray-500">Última atualização: 04/05/2026</p>

      <div>
        <h4 className="font-bold text-gray-800">Quem somos</h4>
        <p>O <strong>Kontrata.ai</strong> é uma plataforma utilizada por empresas para gerir RH, processos seletivos, prevenção de perdas e operações. Atuamos como <strong>Operadora</strong> dos dados que as empresas inserem na plataforma.</p>
      </div>

      <div>
        <h4 className="font-bold text-gray-800">Quem é o Controlador dos seus dados</h4>
        <p>A empresa que coleta seu currículo (onde você está se candidatando) é a <strong>Controladora</strong> dos seus dados. Ela define para que serão usados e por quanto tempo.</p>
      </div>

      <div>
        <h4 className="font-bold text-gray-800">Compromissos de segurança</h4>
        <ul className="list-disc list-inside space-y-0.5">
          <li>Conexão criptografada (HTTPS) em todas as interfaces</li>
          <li>Senhas armazenadas com criptografia (hash)</li>
          <li>Isolamento de dados por empresa-cliente</li>
          <li>Backups automatizados</li>
          <li>Controle de acesso por perfil</li>
          <li>Logs de auditoria de acesso a dados sensíveis</li>
        </ul>
      </div>

      <div>
        <h4 className="font-bold text-gray-800">Base legal do tratamento</h4>
        <p>Para candidatos a vagas: <strong>Consentimento</strong> (Art. 7, I da LGPD). Você pode revogar a qualquer momento.</p>
      </div>

      <div>
        <h4 className="font-bold text-gray-800">Em caso de incidente de segurança</h4>
        <p>Notificaremos a ANPD e os titulares afetados conforme exigido pela LGPD (Art. 48).</p>
      </div>

      <div>
        <h4 className="font-bold text-gray-800">ANPD (autoridade competente)</h4>
        <p>Caso entenda que seus direitos foram violados, você pode reclamar à <strong>www.gov.br/anpd</strong>.</p>
      </div>
    </div>
  );
}

// Campos de texto convertem automaticamente pra MAIUSCULA (padrao do sistema).
// Use caseSensitive={true} pra email, instagram, whatsapp etc.
// Formata um total de meses em "X ano(s) e Y mes(es)".
function fmtTempoExp(m) {
  const a = Math.floor(m / 12), mm = m % 12;
  return [a > 0 ? `${a} ano${a > 1 ? 's' : ''}` : null, mm > 0 ? `${mm} mes${mm > 1 ? 'es' : ''}` : null]
    .filter(Boolean).join(' e ') || '0 meses';
}

function Field({ label, value, onChange, type = 'text', placeholder, caseSensitive = false }) {
  const shouldUpper = !caseSensitive && (type === 'text' || type === undefined);
  return (
    <div>
      <label className="block text-[11px] font-semibold uppercase text-gray-500 mb-1">{label}</label>
      <input type={type} value={value || ''}
        onChange={e => onChange(shouldUpper ? e.target.value.toUpperCase() : e.target.value)}
        placeholder={placeholder}
        style={shouldUpper ? { textTransform: 'uppercase' } : undefined}
        className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-rose-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
    </div>
  );
}
function FieldReq({ label, value, onChange, type = 'text', placeholder, caseSensitive = false }) {
  const shouldUpper = !caseSensitive && (type === 'text' || type === undefined);
  return (
    <div>
      <label className="block text-[11px] font-semibold uppercase text-gray-500 mb-1">{label} <span className="text-red-500">*</span></label>
      <input type={type} value={value || ''}
        onChange={e => onChange(shouldUpper ? e.target.value.toUpperCase() : e.target.value)}
        placeholder={placeholder} required
        style={shouldUpper ? { textTransform: 'uppercase' } : undefined}
        className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-rose-400" />
    </div>
  );
}

// ============================================================================
// COMPONENTE: oferece anexar o PDF do currículo (opcional), após o envio
// ----------------------------------------------------------------------------
// O estado mora no componente PAI (CurriculoPublico) porque essa pergunta aparece
// em DUAS telas pós-envio (convite do DISC e tela final) — assim, se o candidato
// responder numa, não é perguntado de novo na outra.
// ============================================================================
// Mesmo teto do backend (curriculos.routes.ts). Cabe 4 páginas bem elaboradas em
// qualquer formato — inclusive PDF escaneado ou foto de celular.
const MAX_ARQUIVO_BYTES = 8 * 1024 * 1024;

function AnexarCurriculoPdf({ curriculoId, estado, onEstado }) {
  const [enviando, setEnviando] = useState(false);
  const [erroPdf, setErroPdf] = useState('');
  const inputRef = useRef(null);

  // Sem id do currículo não há onde anexar (não deve acontecer, mas evita botão morto)
  if (!curriculoId) return null;

  const escolherSim = () => {
    setErroPdf('');
    // Abre direto o seletor de arquivos — "Arquivos/Documentos" no celular,
    // Explorer/Finder no computador. SEM `capture`, senão o Android abre a câmera.
    inputRef.current?.click();
  };

  const subir = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Barra o arquivo grande AQUI, antes de subir: no 4G do candidato, descobrir o
    // limite só depois do upload inteiro seria péssimo. O backend também valida.
    if (file.size > MAX_ARQUIVO_BYTES) {
      const mb = (file.size / (1024 * 1024)).toFixed(1);
      setErroPdf(`Esse arquivo tem ${mb} MB e o limite é 8 MB. Tente salvar o currículo em PDF ou reduzir a qualidade da foto.`);
      if (inputRef.current) inputRef.current.value = '';
      return;
    }
    setEnviando(true);
    setErroPdf('');
    try {
      const fd = new FormData();
      fd.append('arquivo', file);
      fd.append('curriculo_id', String(curriculoId));
      await api.post('/curriculos/publico/upload-pdf', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      onEstado({ status: 'enviado', nome: file.name });
    } catch (err) {
      setErroPdf(err?.response?.data?.error || 'Não conseguimos enviar o arquivo. Tente novamente.');
    } finally {
      setEnviando(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  // ---- Já anexou: confirma e deixa trocar ----
  if (estado.status === 'enviado') {
    return (
      <div className="bg-sky-50 border-2 border-sky-300 rounded-lg p-3 text-center">
        <p className="font-bold text-sky-800 text-sm">📎 Currículo em PDF recebido!</p>
        {estado.nome && <p className="text-xs text-sky-700 mt-0.5 break-all">{estado.nome}</p>}
        <input ref={inputRef} type="file" accept=".pdf,.doc,.docx,.odt,.rtf,.jpg,.jpeg,.png,.heic,.heif,.webp,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/*" onChange={subir} className="hidden" />
        <button type="button" onClick={escolherSim} disabled={enviando}
          className="mt-2 text-xs text-sky-700 underline hover:text-sky-900 disabled:opacity-50">
          {enviando ? 'Enviando...' : 'Trocar arquivo'}
        </button>
      </div>
    );
  }

  // ---- Dispensou ----
  if (estado.status === 'nao') {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-center">
        <p className="text-sm text-gray-600">Tudo certo — seu currículo digital já foi recebido. 👍</p>
        <button type="button" onClick={() => onEstado({ status: null, nome: '' })}
          className="mt-1 text-xs text-gray-500 underline hover:text-gray-700">
          Mudei de ideia, quero anexar o PDF
        </button>
      </div>
    );
  }

  // ---- Pergunta ----
  return (
    <div className="bg-sky-50 border-2 border-sky-200 rounded-lg p-4">
      <p className="font-bold text-sky-900 text-sm text-center">📎 Quer deixar também o seu currículo em PDF?</p>
      <p className="text-xs text-sky-700 text-center mt-1">
        Se você já tem um currículo pronto no celular ou no computador, pode anexar aqui.
        Vale até <strong>foto do currículo impresso</strong>. É opcional.
      </p>

      <input ref={inputRef} type="file" accept=".pdf,.doc,.docx,.odt,.rtf,.jpg,.jpeg,.png,.heic,.heif,.webp,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/*" onChange={subir} className="hidden" />

      <div className="mt-3 space-y-2">
        <button type="button" onClick={escolherSim} disabled={enviando}
          className="w-full flex items-center gap-2 px-3 py-2.5 bg-white border-2 border-sky-300 rounded-lg text-left hover:bg-sky-100 disabled:opacity-60">
          <span className="w-4 h-4 rounded-full border-2 border-sky-500 shrink-0" />
          <span className="text-sm font-semibold text-sky-900">
            {enviando ? 'Enviando arquivo...' : 'Sim, quero anexar meu PDF'}
          </span>
        </button>
        <button type="button" onClick={() => onEstado({ status: 'nao', nome: '' })} disabled={enviando}
          className="w-full flex items-center gap-2 px-3 py-2.5 bg-white border-2 border-gray-200 rounded-lg text-left hover:bg-gray-50 disabled:opacity-60">
          <span className="w-4 h-4 rounded-full border-2 border-gray-400 shrink-0" />
          <span className="text-sm font-semibold text-gray-700">Não, digital já basta</span>
        </button>
      </div>

      {erroPdf && <p className="text-xs text-red-600 text-center mt-2">{erroPdf}</p>}
      <p className="text-[11px] text-gray-500 text-center mt-2">
        Aceita PDF, Word, ODT, RTF ou foto (JPG/PNG) — até 8 MB.
      </p>
    </div>
  );
}

// ============================================================================
// COMPONENTE: Convite pra Pré-Entrevista com Helen (após DISC ou direto)
// ============================================================================
function ConvitePreEntrevista({ nome, telefone, email, curriculoId, onSkip }) {
  const [criando, setCriando] = useState(false);

  const aceitar = async () => {
    setCriando(true);
    try {
      const r = await api.post('/recrutador/publico/criar-preentrevista', {
        candidato_nome: nome, candidato_telefone: telefone, candidato_email: email,
        curriculo_id: curriculoId || null,
      });
      window.location.href = `/recrutamento/${r.data.token}`;
    } catch (e) {
      alert('Erro ao iniciar pré-entrevista: ' + (e.response?.data?.error || e.message));
      setCriando(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-rose-50 to-pink-50 flex items-center justify-center p-4">
      <div className="max-w-lg w-full">
        <div className="bg-gradient-to-r from-orange-500 to-rose-600 text-white rounded-t-2xl p-5 shadow-lg flex items-center gap-3">
          <div className="text-5xl">🤖</div>
          <div>
            <h1 className="text-2xl font-extrabold">Mais uma etapa, {nome.split(' ')[0]}!</h1>
          </div>
        </div>
        <div className="bg-white rounded-b-2xl shadow-xl p-6 space-y-4">
          <p className="text-gray-800 leading-relaxed">
            Você gostaria de responder uma <strong className="text-rose-600">Pré-Entrevista com nossa Recrutadora Digital</strong>? 🎯
          </p>
          <p className="text-gray-800 leading-relaxed">
            Candidatos que preenchem essa etapa têm <strong className="underline decoration-amber-400 decoration-4">muito mais chances</strong> de contratação. ✨
          </p>
          <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 text-sm text-rose-900 text-center">
            ⏱️ Leva em torno de <strong>5 a 8 minutos</strong>
          </div>
          <div className="bg-blue-50 border-l-4 border-blue-400 p-3 rounded text-xs text-blue-900">
            💡 É uma conversa rápida pra a IA te conhecer melhor: sua trajetória, comportamento, sonhos. Não tem certo nem errado.
          </div>
          <p className="text-center text-gray-700 font-bold mt-2">Vamos lá?</p>
          <div className="flex gap-3 pt-2">
            <button onClick={onSkip} disabled={criando}
              className="flex-1 px-4 py-3 border-2 border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 font-bold disabled:opacity-50">
              ❌ NÃO, agora não
            </button>
            <button onClick={aceitar} disabled={criando}
              className="flex-1 px-4 py-3 bg-gradient-to-r from-orange-500 to-rose-600 hover:from-orange-600 hover:to-rose-700 text-white rounded-xl font-bold disabled:opacity-50">
              {criando ? 'Iniciando...' : '✅ SIM, vamos lá!'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
