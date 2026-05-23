import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Sidebar from '../components/Sidebar';
import { api } from '../utils/api';
import toast from 'react-hot-toast';
import RadarLoading from '../components/RadarLoading';
import { celebrarContratacao } from '../utils/contratacaoCelebration';
import { DetalheCV, waLink } from './rh/BancoCurriculos';

const STATUS_COLORS = {
  'Aberta': 'bg-green-100 text-green-800',
  'Em Selecao': 'bg-blue-100 text-blue-800',
  'Contratado(a)': 'bg-purple-100 text-purple-800',
  'Fechada': 'bg-purple-100 text-purple-800', // alias antigo
  'Cancelada': 'bg-red-100 text-red-800',
};

// "Cancelada" removida — pra cancelar uma vaga, o cliente pode excluir direto
const STATUS_OPTIONS = ['Aberta', 'Em Selecao', 'Contratado(a)'];
// Vagas antigas usavam "Fechada" — tratamos como sinonimo de "Contratado(a)" pra nao perder historico
const STATUS_FINALIZADO_VALUES = ['Contratado(a)', 'Fechada'];

const TURNOS = [
  { key: 'manha', label: 'Turno Manhã', emoji: '🌅' },
  { key: 'intermediario', label: 'Turno Intermediário', emoji: '☀️' },
  { key: 'tarde', label: 'Turno Tarde', emoji: '🌆' },
  { key: 'qualquer', label: 'Qualquer horário', emoji: '✨' },
];

const initialForm = {
  titulo: '',
  cargo_id: '',
  departamento_id: '',
  descricao: '',
  quantidade_vagas: 1,
  salario_min: '',
  salario_max: '',
  data_abertura: '',
  status: 'Aberta',
  requisitos: '',
  beneficios: '',
  selecionados: [],
  cod_loja: '',
  experiencia_obrigatoria: false,
  experiencia_meses_minimo: '',
  turnos: [],
  jornada_id: '',
};

const novoSelecionado = (curriculo) => ({
  curriculo_id: curriculo.id,
  nome: curriculo.nome,
  // Snapshot dos dados do curriculo no momento da selecao — pra mostrar na tabela
  // sem precisar fazer JOIN com curriculos depois
  whatsapp: curriculo.whatsapp || null,
  email: curriculo.email || null,
  cidade: curriculo.cidade || null,
  created_at: curriculo.created_at || curriculo.createdAt || null,
  adicionado_em: new Date().toISOString(),
  entrevista: null,
  data_entrevista: null,
  entrevistador: null,
  resultado_entrevista: null,
  motivo_reprovacao: null,
  pos_entrevista: null,
  data_agendar_exames: null,
  data_resultado_exames: null,
  motivo_reprovacao_exames: null,
  contratado: false,
  colaborador_id: null,
});

export default function RhVagas() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [vagas, setVagas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cargos, setCargos] = useState([]);
  const [sugestoesSalarios, setSugestoesSalarios] = useState({}); // { cargo_id: salario_medio }
  const [departamentos, setDepartamentos] = useState([]);
  const [beneficiosCatalogo, setBeneficiosCatalogo] = useState([]);
  const [lojas, setLojas] = useState([]);
  const [jornadas, setJornadas] = useState([]);
  // Configs de mensagem WhatsApp (compartilhadas com Banco de Curriculos)
  const [msgWhatsApp, setMsgWhatsApp] = useState('');
  const [msgWhatsAppAtivo, setMsgWhatsAppAtivo] = useState(true);
  const [recrutadoraNome, setRecrutadoraNome] = useState('');
  const [supermercadoNome, setSupermercadoNome] = useState('');
  const [filtroLoja, setFiltroLoja] = useState(''); // '' = Todas
  const [filtroStatus, setFiltroStatus] = useState(''); // '' = Todos
  const [filtroCardCandidato, setFiltroCardCandidato] = useState(''); // '' | 'em_aberto' | 'novo' | 'recusado' | 'em_analise' | 'selecionado' | 'contratado'

  // Modal
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState(null);
  const [formData, setFormData] = useState(initialForm);
  const [salvando, setSalvando] = useState(false);

  // Selecionados (Em Selecao)
  const [buscaCurriculoId, setBuscaCurriculoId] = useState('');
  const [buscandoCurriculo, setBuscandoCurriculo] = useState(false);
  const [curriculoVisualizar, setCurriculoVisualizar] = useState(null);
  const [carregandoCurriculo, setCarregandoCurriculo] = useState(false);
  const [expandedVagaId, setExpandedVagaId] = useState(null);

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    try {
      setLoading(true);
      const [vagasRes, cargosRes, deptRes, benRes, sugRes, lojasRes, jornadasRes] = await Promise.all([
        api.get('/rh/vagas'),
        api.get('/rh/configuracoes/cargos'),
        api.get('/rh/configuracoes/departamentos'),
        api.get('/rh/configuracoes/beneficios'),
        api.get('/rh/configuracoes/cargos/sugestao-salarios').catch(() => ({ data: [] })),
        api.get('/rh/empresas').catch(() => ({ data: [] })),
        api.get('/rh/configuracoes/jornadas').catch(() => ({ data: [] })),
      ]);
      setVagas(vagasRes.data || []);
      setCargos(cargosRes.data || []);
      setDepartamentos(deptRes.data || []);
      const benData = benRes.data?.beneficios || benRes.data || [];
      setBeneficiosCatalogo(Array.isArray(benData) ? benData.filter(b => b.ativo !== false) : []);
      const sugMap = {};
      (sugRes.data || []).forEach(s => { sugMap[s.cargo_id] = s.salario_medio; });
      setSugestoesSalarios(sugMap);
      const lojasArr = Array.isArray(lojasRes.data) ? lojasRes.data : (lojasRes.data?.empresas || []);
      setLojas(lojasArr.slice().sort((a, b) => (a.codLoja ?? 999999) - (b.codLoja ?? 999999)));
      const jornadasArr = Array.isArray(jornadasRes.data) ? jornadasRes.data : (jornadasRes.data?.jornadas || []);
      setJornadas(jornadasArr);
      // Carrega configs de mensagem WhatsApp (em paralelo, sem bloquear)
      Promise.all([
        api.get('/configurations/rh_msg_whatsapp_entrevista').catch(() => null),
        api.get('/configurations/rh_recrutadora_nome').catch(() => null),
        api.get('/configurations/client_brand_name').catch(() => null),
        api.get('/configurations/rh_msg_whatsapp_ativo').catch(() => null),
      ]).then(([r1, r2, r3, r4]) => {
        if (r1?.data?.value) setMsgWhatsApp(r1.data.value);
        if (r2?.data?.value) setRecrutadoraNome(r2.data.value);
        if (r3?.data?.value) setSupermercadoNome(r3.data.value);
        else if (lojasArr.length > 0) setSupermercadoNome(lojasArr[0].nomeFantasia || lojasArr[0].apelido || '');
        if (r4?.data?.value === 'false') setMsgWhatsAppAtivo(false);
      });
    } catch (err) {
      toast.error('Erro ao carregar vagas');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (d) => {
    if (!d) return '-';
    return new Date(d).toLocaleDateString('pt-BR');
  };

  const formatCurrency = (v) => {
    if (!v && v !== 0) return '-';
    return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const abrirModal = (vaga = null) => {
    if (vaga) {
      setEditando(vaga);
      // Se a vaga nao tem salario salvo, puxa do cargo cadastrado em Configuracoes RH
      // Fallback: usa sugestao (media dos colaboradores ativos no cargo)
      let salarioInicial = vaga.salario_min;
      const temSalario = salarioInicial != null && salarioInicial !== '' && Number(salarioInicial) > 0;
      if (!temSalario && vaga.cargo_id) {
        const cargoSel = cargos.find(c => String(c.id) === String(vaga.cargo_id));
        if (cargoSel && cargoSel.salario_base != null && Number(cargoSel.salario_base) > 0) {
          salarioInicial = String(cargoSel.salario_base);
        } else if (sugestoesSalarios[Number(vaga.cargo_id)] != null) {
          salarioInicial = String(sugestoesSalarios[Number(vaga.cargo_id)]);
        }
      }
      setFormData({
        titulo: vaga.titulo || '',
        cargo_id: vaga.cargo_id || '',
        departamento_id: vaga.departamento_id || '',
        descricao: vaga.descricao || '',
        quantidade_vagas: vaga.quantidade_vagas || 1,
        salario_min: salarioInicial || '',
        salario_max: vaga.salario_max || '',
        data_abertura: vaga.data_abertura ? vaga.data_abertura.substring(0, 10) : '',
        status: vaga.status || 'Aberta',
        requisitos: vaga.requisitos || '',
        beneficios: vaga.beneficios || '',
        selecionados: Array.isArray(vaga.selecionados) ? vaga.selecionados : [],
        cod_loja: vaga.cod_loja != null ? String(vaga.cod_loja) : '',
        experiencia_obrigatoria: !!vaga.experiencia_obrigatoria,
        experiencia_meses_minimo: vaga.experiencia_meses_minimo != null ? String(vaga.experiencia_meses_minimo) : '',
        turnos: Array.isArray(vaga.turnos) ? vaga.turnos : [],
        jornada_id: vaga.jornada_id || '',
      });
    } else {
      setEditando(null);
      setFormData({ ...initialForm, data_abertura: new Date().toISOString().substring(0, 10) });
    }
    setBuscaCurriculoId('');
    setModalAberto(true);
  };

  // === Selecionados handlers ===
  const adicionarCandidato = async () => {
    const idNum = parseInt(String(buscaCurriculoId).replace(/\D/g, ''), 10);
    if (!idNum) {
      toast.error('Informe o numero do curriculo');
      return;
    }
    const lista = Array.isArray(formData.selecionados) ? formData.selecionados : [];
    if (lista.some(s => Number(s.curriculo_id) === idNum)) {
      toast.error('Esse candidato ja esta na lista');
      return;
    }
    try {
      setBuscandoCurriculo(true);
      const resp = await api.get(`/curriculos/${idNum}`);
      const data = resp?.data?.curriculo || resp?.data;
      if (!data || !data.id) {
        toast.error('Curriculo nao encontrado');
        return;
      }
      setFormData(prev => ({
        ...prev,
        selecionados: [...(Array.isArray(prev.selecionados) ? prev.selecionados : []), novoSelecionado(data)]
      }));
      setBuscaCurriculoId('');
      toast.success(`${data.nome} adicionado`);
    } catch (err) {
      const status = err?.response?.status;
      if (status === 404) toast.error('Curriculo nao encontrado');
      else if (status === 401 || status === 403) toast.error('Sem permissao pra ver curriculos');
      else toast.error(`Erro ao buscar curriculo${status ? ' (' + status + ')' : ''}: ${err?.message || ''}`);
    } finally {
      setBuscandoCurriculo(false);
    }
  };

  const atualizarSelecionado = (idx, patch) => {
    setFormData(prev => {
      const lista = [...prev.selecionados];
      lista[idx] = { ...lista[idx], ...patch };
      return { ...prev, selecionados: lista };
    });
  };

  const removerSelecionado = (idx) => {
    if (!window.confirm('Remover este candidato da selecao?')) return;
    setFormData(prev => ({ ...prev, selecionados: prev.selecionados.filter((_, i) => i !== idx) }));
  };

  const visualizarCurriculo = async (curriculoId) => {
    // Abre o curriculo direto em modal aqui mesmo (em vez de mandar pra tela do Banco)
    try {
      const r = await api.get(`/curriculos/${curriculoId}`);
      const cv = r?.data?.curriculo || r?.data;
      if (!cv || !cv.id) { toast.error('Currículo não encontrado'); return; }
      setCurriculoVisualizar(cv);
    } catch (err) {
      toast.error('Erro ao buscar currículo');
    }
  };

  // === Selecionados handlers DIRETO NA VAGA (sem precisar abrir modal) ===
  // Usados na linha expandida pra agendar entrevista, exames, etc inline
  const [buscaCurriculoIdLinha, setBuscaCurriculoIdLinha] = useState({}); // { vagaId: '25' }
  const [adicionandoLinha, setAdicionandoLinha] = useState(false);
  // Controla qual candidato esta com o painel de Entrevista/Resultado/Pos-Entrevista aberto
  const [candidatoExpandido, setCandidatoExpandido] = useState(null); // 'vagaId-curriculoId'
  // Modal de festa ao contratar — { nome, vaga_titulo }
  const [festa, setFesta] = useState(null);
  // Modal Calendario de Entrevistas
  const [mostrarCalendario, setMostrarCalendario] = useState(false);

  const persistirSelecionadosVaga = async (vaga, novosSels) => {
    // Sincroniza status da vaga: vaga so fica "Contratado(a)" se tiver pelo menos
    // 1 candidato com sel.contratado === true. Caso contrario, se vaga estava
    // "Contratado(a)" e ninguem mais esta marcado, volta pra "Em Selecao".
    const algumContratado = novosSels.some(s => !!s.contratado);
    let novoStatusVaga = vaga.status;
    if (algumContratado && vaga.status !== 'Contratado(a)' && vaga.status !== 'Fechada') {
      novoStatusVaga = 'Contratado(a)';
    } else if (!algumContratado && (vaga.status === 'Contratado(a)' || vaga.status === 'Fechada')) {
      novoStatusVaga = 'Em Selecao';
    }
    // Atualiza local IMEDIATAMENTE — sem isso, o re-render pelo fetchAll()
    // faz o input perder foco a cada letra digitada
    setVagas(prev => prev.map(x => x.id === vaga.id ? { ...x, selecionados: novosSels, status: novoStatusVaga } : x));
    try {
      await api.put(`/rh/vagas/${vaga.id}`, { ...vaga, status: novoStatusVaga, selecionados: novosSels });
    } catch (err) {
      toast.error('Erro ao salvar alteração no candidato');
    }
  };

  const adicionarSelecionadoNaLinha = async (vaga) => {
    const buscaId = buscaCurriculoIdLinha[vaga.id] || '';
    const idNum = parseInt(String(buscaId).replace(/\D/g, ''), 10);
    if (!idNum) { toast.error('Informe o numero do curriculo'); return; }
    const sels = Array.isArray(vaga.selecionados) ? vaga.selecionados : [];
    if (sels.some(s => Number(s.curriculo_id) === idNum)) {
      toast.error('Esse candidato ja esta na lista'); return;
    }
    try {
      setAdicionandoLinha(true);
      const resp = await api.get(`/curriculos/${idNum}`);
      const data = resp?.data?.curriculo || resp?.data;
      if (!data || !data.id) { toast.error('Curriculo nao encontrado'); return; }
      await persistirSelecionadosVaga(vaga, [...sels, novoSelecionado(data)]);
      setBuscaCurriculoIdLinha(prev => ({ ...prev, [vaga.id]: '' }));
      toast.success(`${data.nome} adicionado`);
    } catch (err) {
      const status = err?.response?.status;
      if (status === 404) toast.error('Curriculo nao encontrado');
      else toast.error('Erro ao buscar curriculo');
    } finally {
      setAdicionandoLinha(false);
    }
  };

  const atualizarSelecionadoNaLinha = async (vaga, idx, patch) => {
    const sels = Array.isArray(vaga.selecionados) ? vaga.selecionados : [];
    const novos = sels.map((s, i) => i === idx ? { ...s, ...patch } : s);
    await persistirSelecionadosVaga(vaga, novos);
  };

  const removerSelecionadoNaLinha = async (vaga, idx) => {
    if (!window.confirm('Remover este candidato da selecao?')) return;
    const sels = Array.isArray(vaga.selecionados) ? vaga.selecionados : [];
    await persistirSelecionadosVaga(vaga, sels.filter((_, i) => i !== idx));
  };

  const irParaContratacaoLinha = (vaga, sel) => {
    // Encerra o processo aqui mesmo (sem navegar pra cadastro,
    // que pode nao existir em todos os clientes). Marca como contratado,
    // mostra festa e atualiza status da vaga.
    atualizarStatusInteressado(sel.curriculo_id, 'contratado', vaga.id);
    celebrarContratacao();
    setFesta({ nome: sel.nome, vaga_titulo: vaga.titulo || '' });
  };

  const atualizarStatusInteressado = async (curriculoId, novoStatus, vagaId = null) => {
    try {
      await api.put(`/curriculos/${curriculoId}`, { status: novoStatus });
      // Sincroniza status da vaga + array de selecionados conforme acao no candidato
      if (vagaId) {
        const vaga = vagas.find(v => v.id === vagaId);
        if (vaga) {
          const selsAtual = Array.isArray(vaga.selecionados) ? vaga.selecionados : [];
          let novoStatusVaga = vaga.status;
          let novosSels = selsAtual;

          // 'selecionado' -> vaga vira 'Em Selecao' (se ainda estiver Aberta) +
          //                  adiciona o candidato no array de selecionados da vaga
          //                  (se ainda nao estiver) pra agendar entrevistas etc
          if (novoStatus === 'selecionado') {
            if (vaga.status === 'Aberta') novoStatusVaga = 'Em Selecao';
            const jaTem = selsAtual.some(s => Number(s.curriculo_id) === Number(curriculoId));
            if (!jaTem) {
              const interessado = (vaga.interessados || []).find(c => Number(c.curriculo_id) === Number(curriculoId));
              if (interessado) {
                novosSels = [...selsAtual, novoSelecionado({ id: curriculoId, nome: interessado.nome })];
              }
            }
          }

          // 'contratado' -> vaga vira 'Contratado(a)' (encerra o processo) +
          //                 marca o candidato como contratado no array de selecionados (se existir)
          if (novoStatus === 'contratado') {
            if (vaga.status !== 'Contratado(a)' && vaga.status !== 'Fechada') {
              novoStatusVaga = 'Contratado(a)';
            }
            // Garante que tem o candidato no array (caso tenha vindo direto sem passar por "Selecionar")
            const idx = selsAtual.findIndex(s => Number(s.curriculo_id) === Number(curriculoId));
            if (idx === -1) {
              const interessado = (vaga.interessados || []).find(c => Number(c.curriculo_id) === Number(curriculoId));
              if (interessado) {
                novosSels = [...selsAtual, { ...novoSelecionado({ id: curriculoId, nome: interessado.nome }), contratado: true }];
              }
            } else {
              novosSels = selsAtual.map((s, i) => i === idx ? { ...s, contratado: true } : s);
            }
          }

          // Voltou pra estado anterior (Interessado / Recusado / Vagas Futuras) ->
          // remove o candidato do array de selecionados pra ZERAR todo o processo
          // (entrevista, resultado, pos-entrevista, datas, contratado). Se quiser
          // re-selecionar depois, comeca do zero.
          if (novoStatus === 'novo' || novoStatus === 'recusado' || novoStatus === 'em_analise') {
            const tinha = selsAtual.some(s => Number(s.curriculo_id) === Number(curriculoId));
            if (tinha) {
              novosSels = selsAtual.filter(s => Number(s.curriculo_id) !== Number(curriculoId));
              // Se nao sobrou ninguem contratado, vaga volta pra "Em Selecao"
              // (a logica de sincronizacao do status da vaga ja esta em
              // persistirSelecionadosVaga, mas aqui chamamos PUT direto)
              const algumContratadoRestante = novosSels.some(s => !!s.contratado);
              if (!algumContratadoRestante && (vaga.status === 'Contratado(a)' || vaga.status === 'Fechada')) {
                novoStatusVaga = 'Em Selecao';
              }
            }
          }

          // Persiste mudancas na vaga (status + selecionados) numa tacada so
          if (novoStatusVaga !== vaga.status || novosSels !== selsAtual) {
            try {
              await api.put(`/rh/vagas/${vagaId}`, { ...vaga, status: novoStatusVaga, selecionados: novosSels });
            } catch {}
          }
        }
      }
      const msg = novoStatus === 'selecionado' ? '✓ Candidato selecionado — adicione entrevista no modal de edição da vaga'
        : novoStatus === 'recusado' ? '🚫 Candidato recusado'
        : novoStatus === 'em_analise' ? '🔎 Marcado como Vagas Futuras'
        : novoStatus === 'contratado' ? '🎉 Candidato contratado! Vaga encerrada'
        : 'Status atualizado';
      toast.success(msg);
      await fetchAll();
    } catch (err) {
      toast.error('Erro ao atualizar status do candidato');
    }
  };

  const irParaContratacao = (sel) => {
    // Salva a vaga primeiro pra persistir o estado, depois navega pro cadastro
    handleSalvar().then(() => {
      navigate(`/rh/cadastro?curriculo_id=${sel.curriculo_id}&vaga_id=${editando?.id || ''}`);
    });
  };

  const fecharModal = () => {
    setModalAberto(false);
    setEditando(null);
    setFormData(initialForm);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => {
      const novo = { ...prev, [name]: value };
      // Quando muda o cargo, puxa o salario base cadastrado em Configuracoes RH > Cargos
      // Fallback: se nao tem salario_base salvo, usa a sugestao (media dos colaboradores ativos)
      if (name === 'cargo_id') {
        const cargoSel = cargos.find(c => String(c.id) === String(value));
        const sb = cargoSel?.salario_base;
        let valorAuto = '';
        if (sb != null && sb !== '' && Number(sb) > 0) {
          valorAuto = String(sb);
        } else if (value && sugestoesSalarios[Number(value)] != null) {
          valorAuto = String(sugestoesSalarios[Number(value)]);
        }
        novo.salario_min = valorAuto;
      }
      return novo;
    });
  };

  const handleSalvar = async () => {
    if (!formData.cargo_id) {
      toast.error('Cargo e obrigatorio');
      return;
    }
    // Auto-gera titulo com base no cargo selecionado se nao informado
    const cargoSelecionado = cargos.find(c => String(c.id) === String(formData.cargo_id));
    const codLojaSelecionada = formData.cod_loja !== '' && formData.cod_loja != null ? Number(formData.cod_loja) : null;
    const basePayload = {
      ...formData,
      titulo: (formData.titulo && formData.titulo.trim()) || cargoSelecionado?.nome || 'Vaga',
      experiencia_obrigatoria: !!formData.experiencia_obrigatoria,
      experiencia_meses_minimo: formData.experiencia_obrigatoria && formData.experiencia_meses_minimo !== ''
        ? Number(formData.experiencia_meses_minimo) : null,
      turnos: Array.isArray(formData.turnos) ? formData.turnos : [],
    };

    // Fan-out: criando vaga com "Todas as lojas" e ha lojas cadastradas → clona uma por loja
    const ehFanOut = !editando && codLojaSelecionada == null && lojas.length > 0;
    if (ehFanOut) {
      const ok = window.confirm(`Isso vai criar ${lojas.length} vagas (uma pra cada loja). Continuar?`);
      if (!ok) return;
    }

    try {
      setSalvando(true);
      if (editando) {
        await api.put(`/rh/vagas/${editando.id}`, { ...basePayload, cod_loja: codLojaSelecionada });
        toast.success('Vaga atualizada com sucesso');
      } else if (ehFanOut) {
        await Promise.all(
          lojas.map(l => api.post('/rh/vagas', { ...basePayload, cod_loja: l.codLoja ?? null }))
        );
        toast.success(`${lojas.length} vagas criadas (uma pra cada loja)`);
      } else {
        await api.post('/rh/vagas', { ...basePayload, cod_loja: codLojaSelecionada });
        toast.success('Vaga criada com sucesso');
      }
      fecharModal();
      fetchAll();
    } catch (err) {
      toast.error('Erro ao salvar vaga');
      console.error(err);
    } finally {
      setSalvando(false);
    }
  };

  const handleExcluir = async (id) => {
    if (!window.confirm('Deseja realmente excluir esta vaga?')) return;
    try {
      await api.delete(`/rh/vagas/${id}`);
      toast.success('Vaga excluida com sucesso');
      fetchAll();
    } catch (err) {
      toast.error('Erro ao excluir vaga');
      console.error(err);
    }
  };

  // Vagas filtradas (afeta cards e tabela)
  // Cards: refletem APENAS o filtro de loja (pra nao zerar todos quando seleciona um status)
  const vagasFiltradasPorLoja = filtroLoja === ''
    ? vagas
    : vagas.filter(v => String(v.cod_loja ?? '') === String(filtroLoja));
  // Tabela: aplica tambem o filtro de status (clique nos cards)
  const matchStatus = (statusVaga, filtro) => {
    if (filtro === '') return true;
    if (filtro === 'Contratado(a)') return STATUS_FINALIZADO_VALUES.includes(statusVaga);
    return statusVaga === filtro;
  };
  // Filtro de card de candidato (clique nos 6 cards do topo)
  const vagaTemCandidatoStatus = (v, statusBuscado) => {
    const ints = Array.isArray(v.interessados) ? v.interessados : [];
    const sels = Array.isArray(v.selecionados) ? v.selecionados : [];
    if (statusBuscado === 'novo') {
      return ints.some(c => !c.status || c.status === 'novo');
    }
    if (statusBuscado === 'em_analise') {
      return ints.some(c => c.status === 'em_analise');
    }
    if (statusBuscado === 'selecionado') {
      return ints.some(c => c.status === 'selecionado' || c.status === 'aprovado')
        || sels.some(s => !s.contratado && !ints.some(i => Number(i.curriculo_id) === Number(s.curriculo_id)));
    }
    if (statusBuscado === 'recusado') {
      return ints.some(c => c.status === 'recusado' || c.status === 'reprovado');
    }
    if (statusBuscado === 'contratado') {
      return ints.some(c => c.status === 'contratado')
        || sels.some(s => s.contratado);
    }
    return false;
  };
  const vagasFiltradas = vagasFiltradasPorLoja
    .filter(v => matchStatus(v.status, filtroStatus))
    .filter(v => {
      if (!filtroCardCandidato) return true;
      if (filtroCardCandidato === 'em_aberto') return v.status === 'Aberta' || v.status === 'Em Selecao';
      return vagaTemCandidatoStatus(v, filtroCardCandidato);
    });

  if (loading) {
    return (
      <div className="flex h-screen bg-gray-100">
        <Sidebar user={user} onLogout={logout} isMobileMenuOpen={isMobileMenuOpen} setIsMobileMenuOpen={setIsMobileMenuOpen} />
        <div className="flex-1 flex items-center justify-center">
          <RadarLoading />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar user={user} onLogout={logout} isMobileMenuOpen={isMobileMenuOpen} setIsMobileMenuOpen={setIsMobileMenuOpen} />
      <div className="flex-1 overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-pink-600 to-rose-500 text-white px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Vagas</h1>
              <p className="text-orange-100 text-sm mt-1">Gestao de vagas abertas e processos seletivos</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => abrirModal()}
                className="bg-white text-orange-600 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-orange-50 transition"
              >
                + Nova Vaga
              </button>
              <button
                className="md:hidden text-white"
                onClick={() => setIsMobileMenuOpen(true)}
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        <div className="px-2 py-4">
          {/* Filtro de Loja */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 mb-4 flex items-center gap-3 flex-wrap">
            <label className="text-sm font-semibold text-gray-700">🏢 Loja:</label>
            <select
              value={filtroLoja}
              onChange={(e) => setFiltroLoja(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 min-w-[260px]"
            >
              <option value="">Todas as lojas</option>
              {lojas.map((l) => (
                <option key={l.id ?? l.codLoja} value={l.codLoja ?? ''}>
                  {l.codLoja != null ? `Loja ${l.codLoja} - ` : ''}{l.apelido || l.nomeFantasia || `Loja ${l.id}`}
                </option>
              ))}
            </select>
            {filtroLoja !== '' && (
              <span className="text-xs text-gray-500">
                Mostrando vagas de <strong>{(() => {
                  const l = lojas.find(x => String(x.codLoja) === String(filtroLoja));
                  return l ? (l.apelido || l.nomeFantasia || `Loja ${l.codLoja}`) : `Loja ${filtroLoja}`;
                })()}</strong>
              </span>
            )}
            <div className="flex-1" />
            <button
              type="button"
              onClick={() => setMostrarCalendario(true)}
              className="px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-semibold whitespace-nowrap"
              title="Ver todas as entrevistas agendadas"
            >📅 Calendário de Entrevistas</button>
          </div>

          {/* Stats clicaveis — funcionam como filtro de status. Cards refletem filtro de loja. */}
          {/* Cards de status de vaga removidos — info ja esta na coluna Status da tabela.
              Mantido apenas o filtro de Loja em cima. */}

          {/* Cards de candidatos (agregados de TODAS as vagas filtradas por loja) — clicaveis pra filtrar */}
          {(() => {
            let nInteressados = 0, nRecusados = 0, nVagasFuturas = 0, nSelecionados = 0, nContratados = 0;
            vagasFiltradasPorLoja.forEach(v => {
              const ints = Array.isArray(v.interessados) ? v.interessados : [];
              ints.forEach(c => {
                const st = c.status || 'novo';
                if (st === 'contratado') nContratados++;
                else if (st === 'selecionado' || st === 'aprovado') nSelecionados++;
                else if (st === 'recusado' || st === 'reprovado') nRecusados++;
                else if (st === 'em_analise') nVagasFuturas++;
                else nInteressados++;
              });
              const sels = Array.isArray(v.selecionados) ? v.selecionados : [];
              sels.forEach(s => {
                const jaContado = ints.some(i => Number(i.curriculo_id) === Number(s.curriculo_id));
                if (jaContado) return;
                if (s.contratado) nContratados++;
                else nSelecionados++;
              });
            });
            // Vagas em aberto = status Aberta ou Em Selecao (ainda nao foram contratadas/canceladas)
            const nAbertas = vagasFiltradasPorLoja.filter(v => v.status === 'Aberta' || v.status === 'Em Selecao').length;
            const cards = [
              { key: 'em_aberto', label: 'Vagas em Aberto', count: nAbertas, emoji: '🔓', cor: 'green' },
              { key: 'novo', label: 'Interessados', count: nInteressados, emoji: '❤️', cor: 'rose' },
              { key: 'recusado', label: 'Recusados', count: nRecusados, emoji: '🚫', cor: 'gray' },
              { key: 'em_analise', label: 'Vagas Futuras', count: nVagasFuturas, emoji: '🔎', cor: 'amber' },
              { key: 'selecionado', label: 'Selecionados', count: nSelecionados, emoji: '✓', cor: 'blue' },
              { key: 'contratado', label: 'Contratados', count: nContratados, emoji: '🎉', cor: 'purple' },
            ];
            const corMap = {
              green: { text: 'text-green-600', border: 'border-green-200', bg: 'bg-green-50', borderActive: 'border-green-500' },
              rose: { text: 'text-rose-600', border: 'border-rose-200', bg: 'bg-rose-50', borderActive: 'border-rose-500' },
              gray: { text: 'text-gray-600', border: 'border-gray-200', bg: 'bg-gray-50', borderActive: 'border-gray-500' },
              amber: { text: 'text-amber-600', border: 'border-amber-200', bg: 'bg-amber-50', borderActive: 'border-amber-500' },
              blue: { text: 'text-blue-600', border: 'border-blue-200', bg: 'bg-blue-50', borderActive: 'border-blue-500' },
              purple: { text: 'text-purple-600', border: 'border-purple-200', bg: 'bg-purple-50', borderActive: 'border-purple-500' },
            };
            return (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 mb-6">
                {cards.map(card => {
                  const c = corMap[card.cor];
                  const ativo = filtroCardCandidato === card.key;
                  return (
                    <button
                      key={card.key}
                      type="button"
                      onClick={() => setFiltroCardCandidato(ativo ? '' : card.key)}
                      className={`text-left rounded-lg p-2 border-2 transition-all hover:shadow ${ativo ? `${c.borderActive} ring-2 ring-offset-1 ring-orange-400` : c.border} ${c.bg}`}
                      title={ativo ? 'Clique pra remover o filtro' : `Filtrar por ${card.label}`}
                    >
                      <p className="text-[11px] text-gray-700 font-semibold flex items-center gap-1">
                        <span>{card.emoji}</span>
                        <span className="uppercase">{card.label}</span>
                      </p>
                      <p className={`text-xl font-bold ${c.text} mt-0.5`}>{card.count}</p>
                    </button>
                  );
                })}
              </div>
            );
          })()}

          {/* Titulo contextual da loja */}
          {(() => {
            const lojaSel = filtroLoja !== '' ? lojas.find(x => String(x.codLoja) === String(filtroLoja)) : null;
            const nomeLoja = lojaSel ? (lojaSel.apelido || lojaSel.nomeFantasia || `Loja ${lojaSel.codLoja}`) : null;
            return (
              <h2 className="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2">
                <span>🏢</span>
                {nomeLoja ? (
                  <>Vagas que <span className="text-orange-600">{nomeLoja}</span> está precisando</>
                ) : (
                  <>Vagas de <span className="text-orange-600">todas as lojas</span></>
                )}
              </h2>
            );
          })()}

          {/* Table */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase w-8"></th>
                    <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase">Loja</th>
                    <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-2 py-3 text-center text-xs font-medium text-rose-600 uppercase">❤️ Interessados</th>
                    <th className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase">🚫 Recusados</th>
                    <th className="px-2 py-3 text-center text-xs font-medium text-amber-600 uppercase">🔎 Vagas Futuras</th>
                    <th className="px-2 py-3 text-center text-xs font-medium text-blue-600 uppercase">🎯 Selecionados</th>
                    <th className="px-2 py-3 text-center text-xs font-medium text-purple-600 uppercase">🎉 Contratados</th>
                    <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase">Titulo</th>
                    <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cargo</th>
                    <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase">Salario</th>
                    <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase">Jornada</th>
                    <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase">Benefícios</th>
                    <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase">Experiência</th>
                    <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase">Data Abertura</th>
                    <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase">Dias Em Aberto</th>
                    <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acoes</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {vagasFiltradas.length === 0 ? (
                    <tr>
                      <td colSpan={17} className="px-4 py-8 text-center text-gray-500">
                        {vagas.length === 0 ? 'Nenhuma vaga cadastrada' : 'Nenhuma vaga pra essa loja'}
                      </td>
                    </tr>
                  ) : (
                    vagasFiltradas.flatMap((v) => {
                      const sels = Array.isArray(v.selecionados) ? v.selecionados : [];
                      const interessados = Array.isArray(v.interessados) ? v.interessados : [];
                      const isExpanded = expandedVagaId === v.id;
                      // Sempre permite expandir — mesmo sem candidatos, o usuario pode
                      // querer adicionar um manualmente do banco
                      const podeExpandir = true;
                      const rows = [];
                      rows.push(
                        <tr key={v.id} className="hover:bg-gray-50">
                          <td className="px-2 py-3 text-center">
                            <button
                              onClick={() => setExpandedVagaId(isExpanded ? null : v.id)}
                              title={isExpanded ? 'Recolher' : 'Expandir — ver candidatos / adicionar do banco'}
                              className="w-6 h-6 inline-flex items-center justify-center rounded-full bg-blue-100 text-blue-700 hover:bg-blue-200 font-bold text-base"
                            >
                              {isExpanded ? '−' : '+'}
                            </button>
                          </td>
                          <td className="px-2 py-3 text-sm text-gray-600">
                            {(() => {
                              if (v.cod_loja == null) return <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs font-medium">Todas</span>;
                              const l = lojas.find(x => String(x.codLoja) === String(v.cod_loja));
                              const nome = l?.apelido || l?.nomeFantasia || `Loja ${v.cod_loja}`;
                              return <span className="px-2 py-0.5 bg-orange-50 text-orange-700 rounded-full text-xs font-medium border border-orange-200">🏢 {nome}</span>;
                            })()}
                          </td>
                          <td className="px-2 py-3 text-sm">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[v.status] || 'bg-gray-100 text-gray-800'}`}>
                              {v.status === 'Fechada' ? 'Contratado(a)' : v.status}
                            </span>
                          </td>
                          {(() => {
                            // Separa interessados por status. 4 colunas distintas agora:
                            //   'novo' = INTERESSADOS (pendentes — aguardando primeira decisao)
                            //   'em_analise' = EM ANÁLISE (sendo avaliado)
                            //   'selecionado' / 'aprovado' / 'contratado' = SELECIONADOS
                            //   'recusado' / 'reprovado' (alias antigo) = RECUSADOS
                            const intPendentes = interessados.filter(c => !c.status || c.status === 'novo');
                            const intEmAnalise = interessados.filter(c => c.status === 'em_analise');
                            const intSelecionados = interessados.filter(c => c.status === 'selecionado' || c.status === 'aprovado');
                            const intRecusados = interessados.filter(c => c.status === 'recusado' || c.status === 'reprovado');
                            const intContratados = interessados.filter(c => c.status === 'contratado');
                            // Evita duplicar quando candidato esta em interessados E em sels
                            const selsExtras = sels.filter(s => !interessados.some(i => Number(i.curriculo_id) === Number(s.curriculo_id)));
                            const totalSelecionados = intSelecionados.length + selsExtras.filter(s => !s.contratado).length;
                            const totalContratados = intContratados.length + selsExtras.filter(s => s.contratado).length;
                            return (
                              <>
                                <td className="px-2 py-3 text-center">
                                  {intPendentes.length > 0 ? (
                                    <button
                                      onClick={() => setExpandedVagaId(isExpanded ? null : v.id)}
                                      className="inline-flex items-center gap-1 px-3 py-1 bg-rose-100 hover:bg-rose-200 text-rose-700 rounded-full text-sm font-bold transition"
                                      title="Clique pra ver os interessados"
                                    >❤️ {intPendentes.length}</button>
                                  ) : <span className="text-gray-300 text-xs">—</span>}
                                </td>
                                <td className="px-2 py-3 text-center">
                                  {intRecusados.length > 0 ? (
                                    <button
                                      onClick={() => setExpandedVagaId(isExpanded ? null : v.id)}
                                      className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-full text-sm font-bold transition"
                                      title="Clique pra ver os recusados"
                                    >🚫 {intRecusados.length}</button>
                                  ) : <span className="text-gray-300 text-xs">—</span>}
                                </td>
                                <td className="px-2 py-3 text-center">
                                  {intEmAnalise.length > 0 ? (
                                    <button
                                      onClick={() => setExpandedVagaId(isExpanded ? null : v.id)}
                                      className="inline-flex items-center gap-1 px-3 py-1 bg-amber-100 hover:bg-amber-200 text-amber-700 rounded-full text-sm font-bold transition"
                                      title="Clique pra ver os marcados como Vagas Futuras"
                                    >🔎 {intEmAnalise.length}</button>
                                  ) : <span className="text-gray-300 text-xs">—</span>}
                                </td>
                                <td className="px-2 py-3 text-center">
                                  {totalSelecionados > 0 ? (
                                    <button
                                      onClick={() => setExpandedVagaId(isExpanded ? null : v.id)}
                                      className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-full text-sm font-bold transition"
                                      title="Clique pra ver os selecionados"
                                    >🎯 {totalSelecionados}</button>
                                  ) : <span className="text-gray-300 text-xs">—</span>}
                                </td>
                                <td className="px-2 py-3 text-center">
                                  {totalContratados > 0 ? (
                                    <button
                                      onClick={() => setExpandedVagaId(isExpanded ? null : v.id)}
                                      className="inline-flex items-center gap-1 px-3 py-1 bg-purple-100 hover:bg-purple-200 text-purple-700 rounded-full text-sm font-bold transition"
                                      title="Clique pra ver os contratados"
                                    >🎉 {totalContratados}</button>
                                  ) : <span className="text-gray-300 text-xs">—</span>}
                                </td>
                              </>
                            );
                          })()}
                          <td className="px-2 py-3 text-sm font-medium text-gray-900">
                            {v.titulo}
                          </td>
                          <td className="px-2 py-3 text-sm text-gray-600">{v.cargo_nome || '-'}</td>
                          <td className="px-2 py-3 text-sm text-gray-600">
                            {v.salario_min ? formatCurrency(v.salario_min) : '-'}
                          </td>
                          <td className="px-2 py-3 text-sm text-gray-600 whitespace-nowrap">
                            {v.jornada_nome ? (
                              <span className="inline-flex items-center gap-1">
                                <span className="font-medium">{v.jornada_nome}</span>
                                {v.jornada_carga_horaria && (
                                  <span className="text-xs px-1.5 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded">
                                    {v.jornada_carga_horaria}
                                  </span>
                                )}
                              </span>
                            ) : <span className="text-gray-300">—</span>}
                          </td>
                          <td className="px-2 py-3 text-sm text-gray-600">
                            {(() => {
                              const lista = (v.beneficios || '').split(',').map(s => s.trim()).filter(Boolean);
                              if (lista.length === 0) return <span className="text-gray-300">—</span>;
                              return (
                                <div className="flex flex-wrap gap-1 max-w-xs">
                                  {lista.map((b, i) => (
                                    <span key={i} className="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded text-[11px] font-medium">
                                      {b}
                                    </span>
                                  ))}
                                </div>
                              );
                            })()}
                          </td>
                          <td className="px-2 py-3 text-sm">
                            {v.experiencia_obrigatoria ? (
                              <span className="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-xs font-medium">
                                ✓ {v.experiencia_meses_minimo ? `${v.experiencia_meses_minimo} meses` : 'Sim'}
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs font-medium">Não exige</span>
                            )}
                          </td>
                          <td className="px-2 py-3 text-sm text-gray-600">{formatDate(v.data_abertura)}</td>
                          <td className="px-2 py-3 text-sm">
                            {(() => {
                              if (!v.data_abertura) return <span className="text-gray-300">—</span>;
                              if (STATUS_FINALIZADO_VALUES.includes(v.status) || v.status === 'Cancelada') {
                                return <span className="text-gray-400 text-xs">—</span>;
                              }
                              const dias = Math.floor((Date.now() - new Date(v.data_abertura).getTime()) / (1000 * 60 * 60 * 24));
                              const cor = dias <= 7 ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : dias <= 30 ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : 'bg-red-50 text-red-700 border-red-200';
                              return (
                                <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${cor}`}>
                                  {dias === 0 ? 'Hoje' : dias === 1 ? '1 dia' : `${dias} dias`}
                                </span>
                              );
                            })()}
                          </td>
                          <td className="px-2 py-3 text-sm">
                            <div className="flex gap-3">
                              <button
                                onClick={() => abrirModal(v)}
                                className="text-orange-600 hover:text-orange-800 text-base font-semibold"
                              >
                                Editar
                              </button>
                              <button
                                onClick={() => handleExcluir(v.id)}
                                className="text-red-600 hover:text-red-800 text-base font-semibold"
                              >
                                Excluir
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                      if (isExpanded && podeExpandir) {
                        rows.push(
                          <tr key={`${v.id}-expand`} className="bg-blue-50">
                            <td colSpan={17} className="px-2 py-3 space-y-4">
                              {/* Adicionar candidato manualmente pelo numero (linha compacta) */}
                              <div className="border border-blue-300 bg-blue-50 rounded-lg px-3 py-2 flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-bold text-blue-900 whitespace-nowrap">🎯 Adicionar do Banco:</span>
                                <input
                                  type="number"
                                  min="1"
                                  placeholder="Nº do currículo (ex: 25)"
                                  value={buscaCurriculoIdLinha[v.id] || ''}
                                  onChange={(e) => setBuscaCurriculoIdLinha(prev => ({ ...prev, [v.id]: e.target.value }))}
                                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); adicionarSelecionadoNaLinha(v); } }}
                                  className="flex-1 min-w-[140px] px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                />
                                <button
                                  type="button"
                                  onClick={() => adicionarSelecionadoNaLinha(v)}
                                  disabled={adicionandoLinha}
                                  className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-xs font-medium disabled:opacity-50 whitespace-nowrap"
                                >
                                  {adicionandoLinha ? 'Buscando...' : '+ Adicionar'}
                                </button>
                              </div>

                              {/* TABELA UNIFICADA: interessados + selecionados manuais (sem duplicar) */}
                              {(() => {
                                // Combina interessados (do form publico) + selecionados manuais
                                // Pra cada selecionado, se ja existe em interessados, NAO duplica.
                                // Ele ganha o "sel" anexado pra mostrar etapas de processo.
                                const todos = [];
                                interessados.forEach(c => {
                                  const sel = sels.find(s => Number(s.curriculo_id) === Number(c.curriculo_id));
                                  todos.push({ ...c, _sel: sel || null, _origem: 'interessado' });
                                });
                                sels.forEach(s => {
                                  const ja = interessados.some(i => Number(i.curriculo_id) === Number(s.curriculo_id));
                                  if (ja) return;
                                  todos.push({
                                    curriculo_id: s.curriculo_id,
                                    nome: s.nome,
                                    whatsapp: s.whatsapp || null,
                                    email: s.email || null,
                                    cidade: s.cidade || null,
                                    created_at: s.created_at || s.adicionado_em || null,
                                    status: s.contratado ? 'contratado' : 'selecionado',
                                    _sel: s,
                                    _origem: 'manual',
                                  });
                                });
                                if (todos.length === 0) return null;
                                return (
                                  <div>
                                    <div className="text-xs font-bold text-rose-900 mb-2">
                                      ❤️ Candidatos desta vaga ({todos.length})
                                    </div>
                                    <div className="overflow-x-auto">
                                      <table className="w-full text-xs">
                                        <thead>
                                          <tr className="bg-rose-100 text-rose-900">
                                            <th className="px-2 py-1.5 text-left">Nº</th>
                                            <th className="px-2 py-1.5 text-left">Nome</th>
                                            <th className="px-2 py-1.5 text-left">WhatsApp</th>
                                            <th className="px-2 py-1.5 text-left">Cidade</th>
                                            <th className="px-2 py-1.5 text-left">Recebido em</th>
                                            <th className="px-2 py-1.5 text-center">Ações</th>
                                            <th className="px-2 py-1.5 text-center">Processo</th>
                                            <th className="px-2 py-1.5 text-left">Status</th>
                                            <th className="px-2 py-1.5 text-center">Entrevista</th>
                                            <th className="px-2 py-1.5 text-center">Data</th>
                                            <th className="px-2 py-1.5 text-center">Hora</th>
                                            <th className="px-2 py-1.5 text-left">Entrevistador</th>
                                            <th className="px-2 py-1.5 text-center">Resultado da Entrevista</th>
                                            <th className="px-2 py-1.5 text-center">Pós-Entrevista</th>
                                            <th className="px-2 py-1.5 text-center">Data Agendar Exames</th>
                                            <th className="px-2 py-1.5 text-center">Data Resultado Exames</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {todos.map((c, i) => {
                                            const st = c.status || 'novo';
                                            const isCont = st === 'contratado';
                                            const isSel = st === 'selecionado' || st === 'aprovado';
                                            const isRec = st === 'recusado' || st === 'reprovado';
                                            const stLabel = isCont ? '🎉 Contratado' : isSel ? '✓ Selecionado' : isRec ? '🚫 Recusado' : st === 'em_analise' ? '🔎 Vagas Futuras' : '🆕 Novo';
                                            const stCls = isCont ? 'bg-purple-100 text-purple-800' : isSel ? 'bg-blue-100 text-blue-800' : isRec ? 'bg-gray-200 text-gray-700' : st === 'em_analise' ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800';
                                            const sel = c._sel;
                                            const candKey = `${v.id}-${c.curriculo_id}`;
                                            const isCandExpanded = candidatoExpandido === candKey;
                                            const selIdx = sel ? sels.findIndex(s => Number(s.curriculo_id) === Number(c.curriculo_id)) : -1;
                                            return (
                                              <>
                                                <tr key={`row-${c.curriculo_id}-${i}`} className="border-t border-rose-200 bg-white">
                                                  <td className="px-2 py-1.5 font-mono font-bold">{c.curriculo_id}</td>
                                                  <td className="px-2 py-1.5">
                                                    <button onClick={() => visualizarCurriculo(c.curriculo_id)} className="text-rose-700 hover:underline font-semibold">
                                                      {c.nome}
                                                    </button>
                                                  </td>
                                                  <td className="px-2 py-1.5 text-gray-700">
                                                    {c.whatsapp ? (
                                                      <a
                                                        href={waLink(c.whatsapp, msgWhatsAppAtivo ? msgWhatsApp : '', { nome: c.nome, supermercado: supermercadoNome, recrutadora: recrutadoraNome })}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="inline-flex items-center gap-1 text-emerald-600 hover:text-emerald-700 hover:underline font-medium"
                                                        title="Abrir conversa no WhatsApp"
                                                      >
                                                        📱 {c.whatsapp}
                                                      </a>
                                                    ) : '-'}
                                                  </td>
                                                  <td className="px-2 py-1.5 text-gray-700">{c.cidade || '-'}</td>
                                                  <td className="px-2 py-1.5 text-gray-600">
                                                    {c.created_at ? new Date(c.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '-'}
                                                  </td>
                                                  <td className="px-2 py-1.5">
                                                    <div className="flex gap-1 justify-center whitespace-nowrap">
                                                      {/* Ordem = cards de cima: Interessados | Recusados | Vagas Futuras | Selecionar | Contratar */}
                                                      <button
                                                        onClick={() => atualizarStatusInteressado(c.curriculo_id, 'novo', v.id)}
                                                        disabled={st === 'novo'}
                                                        className={`px-2.5 py-1.5 text-xs font-bold rounded-md transition shadow-sm ${st === 'novo' ? 'bg-rose-200 text-rose-700 cursor-default' : 'bg-rose-500 hover:bg-rose-600 text-white'}`}
                                                        title="Marcar como Interessado"
                                                      >❤️ Interessado</button>
                                                      <button
                                                        onClick={() => atualizarStatusInteressado(c.curriculo_id, 'recusado', v.id)}
                                                        disabled={isRec}
                                                        className={`px-2.5 py-1.5 text-xs font-bold rounded-md transition shadow-sm ${isRec ? 'bg-gray-300 text-gray-600 cursor-default' : 'bg-gray-500 hover:bg-gray-600 text-white'}`}
                                                        title="Recusar"
                                                      >🚫 Recusar</button>
                                                      <button
                                                        onClick={() => atualizarStatusInteressado(c.curriculo_id, 'em_analise', v.id)}
                                                        disabled={st === 'em_analise'}
                                                        className={`px-2.5 py-1.5 text-xs font-bold rounded-md transition shadow-sm ${st === 'em_analise' ? 'bg-amber-200 text-amber-700 cursor-default' : 'bg-amber-500 hover:bg-amber-600 text-white'}`}
                                                        title="Vagas Futuras"
                                                      >🔎 Vagas Futuras</button>
                                                      <button
                                                        onClick={() => atualizarStatusInteressado(c.curriculo_id, 'selecionado', v.id)}
                                                        disabled={isSel}
                                                        className={`px-2.5 py-1.5 text-xs font-bold rounded-md transition shadow-sm ${isSel ? 'bg-blue-200 text-blue-700 cursor-default' : 'bg-blue-500 hover:bg-blue-600 text-white'}`}
                                                        title="Selecionar (vaga vira 'Em Seleção')"
                                                      >✓ Selecionar</button>
                                                      <button
                                                        onClick={() => {
                                                          if (window.confirm(`Confirmar contratação de ${c.nome}? Isso encerra a vaga (status vira "Contratado(a)").`)) {
                                                            atualizarStatusInteressado(c.curriculo_id, 'contratado', v.id);
                                                            celebrarContratacao();
                                                            setFesta({ nome: c.nome, vaga_titulo: v.titulo || '' });
                                                          }
                                                        }}
                                                        disabled={isCont}
                                                        className={`px-2.5 py-1.5 text-xs font-bold rounded-md transition shadow-sm ${isCont ? 'bg-purple-200 text-purple-700 cursor-default' : 'bg-purple-600 hover:bg-purple-700 text-white'}`}
                                                        title="Contratar (encerra a vaga)"
                                                      >🎉 Contratar</button>
                                                    </div>
                                                  </td>
                                                  <td className="px-2 py-1.5 text-center">
                                                    {sel && isSel ? (
                                                      <button
                                                        onClick={() => setCandidatoExpandido(isCandExpanded ? null : candKey)}
                                                        className="px-2 py-1 text-[11px] font-bold rounded transition bg-blue-100 hover:bg-blue-200 text-blue-700 whitespace-nowrap"
                                                        title="Agendar entrevista, exames, etc"
                                                      >{isCandExpanded ? '▲ Recolher' : '▼ Gerenciar processo'}</button>
                                                    ) : <span className="text-gray-300 text-xs">—</span>}
                                                  </td>
                                                  <td className="px-2 py-1.5">
                                                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${stCls}`}>{stLabel}</span>
                                                  </td>
                                                  {/* Colunas de info da Entrevista (read-only — edita no Gerenciar processo) */}
                                                  <td className="px-2 py-1.5 text-center text-gray-700">
                                                    {sel ? (
                                                      sel.entrevista === 'agendada' ? <span className="text-blue-700 font-medium">📅 Agendada</span>
                                                      : sel.entrevista === 'realizada' ? <span className="text-green-700 font-medium">✓ Realizada</span>
                                                      : <span className="text-gray-400">Sem agend.</span>
                                                    ) : <span className="text-gray-300">—</span>}
                                                  </td>
                                                  <td className="px-2 py-1.5 text-center text-gray-700">
                                                    {sel?.data_entrevista ? (() => {
                                                      const d = sel.data_entrevista.split('T')[0]; // YYYY-MM-DD
                                                      const [y, m, dia] = d.split('-');
                                                      return y && m && dia ? `${dia}/${m}/${y}` : '—';
                                                    })() : <span className="text-gray-300">—</span>}
                                                  </td>
                                                  <td className="px-2 py-1.5 text-center text-gray-700">
                                                    {sel?.data_entrevista ? (sel.data_entrevista.split('T')[1] || '').slice(0, 5) || <span className="text-gray-300">—</span> : <span className="text-gray-300">—</span>}
                                                  </td>
                                                  <td className="px-2 py-1.5 text-gray-700">
                                                    {sel?.entrevistador || <span className="text-gray-300">—</span>}
                                                  </td>
                                                  <td className="px-2 py-1.5 text-center">
                                                    {sel?.contratado ? (
                                                      <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-purple-100 text-purple-800">
                                                        🎉 Contratado
                                                      </span>
                                                    ) : sel?.resultado_entrevista ? (
                                                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                                                        sel.resultado_entrevista === 'passou' ? 'bg-green-100 text-green-800'
                                                        : sel.resultado_entrevista === 'aguarda_decisao' ? 'bg-amber-100 text-amber-800'
                                                        : 'bg-red-100 text-red-800'
                                                      }`}>
                                                        {({passou:'Passou', aguarda_decisao:'Aguarda decisão', nao_compareceu:'Não compareceu', reprovado:'Reprovado', desistiu:'Desistiu'})[sel.resultado_entrevista] || sel.resultado_entrevista}
                                                      </span>
                                                    ) : <span className="text-gray-300">—</span>}
                                                  </td>
                                                  {/* Pos-Entrevista */}
                                                  <td className="px-2 py-1.5 text-center">
                                                    {sel?.pos_entrevista ? (
                                                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                                                        sel.pos_entrevista === 'aprovado_exames' ? 'bg-green-100 text-green-800'
                                                        : sel.pos_entrevista === 'reprovado_exames' ? 'bg-red-100 text-red-800'
                                                        : 'bg-amber-100 text-amber-800'
                                                      }`}>
                                                        {({
                                                          aguarda_agendar_exames: '⏳ Agendar exames',
                                                          aguarda_resultado_exames: '⏳ Aguarda resultado',
                                                          aprovado_exames: '✅ Aprovado nos exames',
                                                          reprovado_exames: '❌ Reprovado nos exames',
                                                        })[sel.pos_entrevista] || sel.pos_entrevista}
                                                      </span>
                                                    ) : <span className="text-gray-300">—</span>}
                                                  </td>
                                                  {/* Data Agendar Exames — parse manual pra evitar bug de fuso */}
                                                  <td className="px-2 py-1.5 text-center text-gray-700">
                                                    {sel?.data_agendar_exames ? (() => {
                                                      const d = sel.data_agendar_exames.split('T')[0];
                                                      const [y, m, dia] = d.split('-');
                                                      return y && m && dia ? `${dia}/${m}/${y}` : '—';
                                                    })() : <span className="text-gray-300">—</span>}
                                                  </td>
                                                  {/* Data Resultado Exames — parse manual pra evitar bug de fuso */}
                                                  <td className="px-2 py-1.5 text-center text-gray-700">
                                                    {sel?.data_resultado_exames ? (() => {
                                                      const d = sel.data_resultado_exames.split('T')[0];
                                                      const [y, m, dia] = d.split('-');
                                                      return y && m && dia ? `${dia}/${m}/${y}` : '—';
                                                    })() : <span className="text-gray-300">—</span>}
                                                  </td>
                                                </tr>
                                                {isCandExpanded && sel && selIdx >= 0 && (
                                                  <tr key={`row-${c.curriculo_id}-${i}-expand`} className="bg-blue-50 border-t border-blue-200">
                                                    <td colSpan={16} className="px-3 py-3">
                                                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                                                        {/* ENTREVISTA */}
                                                        <div className="border border-gray-200 rounded p-2 bg-white">
                                                          <div className="font-bold text-gray-700 mb-1">Entrevista</div>
                                                          {[
                                                            { v: '', l: 'Sem Agendamento' },
                                                            { v: 'agendada', l: 'Agendada' },
                                                            { v: 'realizada', l: 'Realizada' },
                                                          ].map(o => (
                                                            <label key={o.v} className="flex items-center gap-1.5 cursor-pointer">
                                                              <input
                                                                type="radio"
                                                                name={`entrevista-${v.id}-${selIdx}`}
                                                                checked={(sel.entrevista || '') === o.v}
                                                                onChange={() => atualizarSelecionadoNaLinha(v, selIdx, { entrevista: o.v || null })}
                                                              />
                                                              <span>{o.l}</span>
                                                            </label>
                                                          ))}
                                                          {sel.entrevista === 'agendada' && (() => {
                                                            const dt = sel.data_entrevista || '';
                                                            const dataPart = dt.split('T')[0] || '';
                                                            const horaPart = (dt.split('T')[1] || '').slice(0, 5);
                                                            return (
                                                              <div className="mt-1.5 space-y-1">
                                                                <div className="grid grid-cols-2 gap-1">
                                                                  <input
                                                                    type="date"
                                                                    value={dataPart}
                                                                    onChange={(e) => atualizarSelecionadoNaLinha(v, selIdx, { data_entrevista: e.target.value ? `${e.target.value}T${horaPart || '09:00'}` : '' })}
                                                                    className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                                                                  />
                                                                  <input
                                                                    type="time"
                                                                    value={horaPart}
                                                                    onChange={(e) => atualizarSelecionadoNaLinha(v, selIdx, { data_entrevista: e.target.value ? `${dataPart || new Date().toISOString().substring(0,10)}T${e.target.value}` : '' })}
                                                                    className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                                                                  />
                                                                </div>
                                                                <input
                                                                  type="text"
                                                                  placeholder="Entrevistador"
                                                                  defaultValue={sel.entrevistador || ''}
                                                                  onBlur={(e) => {
                                                                    if (e.target.value !== (sel.entrevistador || '')) {
                                                                      atualizarSelecionadoNaLinha(v, selIdx, { entrevistador: e.target.value });
                                                                    }
                                                                  }}
                                                                  className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                                                                />
                                                              </div>
                                                            );
                                                          })()}
                                                        </div>
                                                        {/* RESULTADO */}
                                                        <div className="border border-gray-200 rounded p-2 bg-white">
                                                          <div className="font-bold text-gray-700 mb-1">Resultado da Entrevista</div>
                                                          {[
                                                            { v: 'passou', l: 'Passou' },
                                                            { v: 'aguarda_decisao', l: 'Aguarda decisao' },
                                                            { v: 'nao_compareceu', l: 'Nao compareceu' },
                                                            { v: 'reprovado', l: 'Reprovado' },
                                                            { v: 'desistiu', l: 'Desistiu' },
                                                          ].map(o => (
                                                            <label key={o.v} className="flex items-center gap-1.5 cursor-pointer">
                                                              <input
                                                                type="radio"
                                                                name={`resultado-${v.id}-${selIdx}`}
                                                                checked={sel.resultado_entrevista === o.v}
                                                                onChange={() => atualizarSelecionadoNaLinha(v, selIdx, {
                                                                  resultado_entrevista: o.v,
                                                                  // Se nao passou na entrevista, zera tudo de pos-entrevista
                                                                  // INCLUINDO o flag contratado (pra coluna refletir mudanca)
                                                                  ...(o.v !== 'passou' ? { pos_entrevista: null, data_agendar_exames: null, data_resultado_exames: null, contratado: false } : {})
                                                                })}
                                                              />
                                                              <span>{o.l}</span>
                                                            </label>
                                                          ))}
                                                          {(sel.resultado_entrevista === 'reprovado' || sel.resultado_entrevista === 'desistiu') && (
                                                            <input
                                                              type="text"
                                                              placeholder="Motivo"
                                                              defaultValue={sel.motivo_reprovacao || ''}
                                                              onBlur={(e) => {
                                                                if (e.target.value !== (sel.motivo_reprovacao || '')) {
                                                                  atualizarSelecionadoNaLinha(v, selIdx, { motivo_reprovacao: e.target.value });
                                                                }
                                                              }}
                                                              className="mt-1.5 w-full px-2 py-1 border border-gray-300 rounded text-xs"
                                                            />
                                                          )}
                                                        </div>
                                                        {/* POS-ENTREVISTA */}
                                                        {sel.resultado_entrevista === 'passou' && (
                                                          <div className="border border-green-300 rounded p-2 bg-green-50">
                                                            <div className="font-bold text-green-800 mb-1">Pos-Entrevista</div>
                                                            {[
                                                              { v: 'aguarda_agendar_exames', l: 'Aguardando Agendar Exames' },
                                                              { v: 'aguarda_resultado_exames', l: 'Aguardando Resultado Exames' },
                                                              { v: 'aprovado_exames', l: 'Aprovado nos Exames' },
                                                              { v: 'reprovado_exames', l: 'Reprovado nos Exames' },
                                                            ].map(o => (
                                                              <label key={o.v} className="flex items-center gap-1.5 cursor-pointer">
                                                                <input
                                                                  type="radio"
                                                                  name={`pos-${v.id}-${selIdx}`}
                                                                  checked={sel.pos_entrevista === o.v}
                                                                  onChange={() => {
                                                                    const patch = { pos_entrevista: o.v };
                                                                    if (o.v === 'aguarda_agendar_exames' && !sel.data_agendar_exames) {
                                                                      patch.data_agendar_exames = new Date().toISOString().substring(0, 10);
                                                                    }
                                                                    if (o.v === 'aguarda_resultado_exames' && !sel.data_resultado_exames) {
                                                                      patch.data_resultado_exames = new Date().toISOString().substring(0, 10);
                                                                    }
                                                                    atualizarSelecionadoNaLinha(v, selIdx, patch);
                                                                  }}
                                                                />
                                                                <span>{o.l}</span>
                                                              </label>
                                                            ))}
                                                            {sel.pos_entrevista === 'aguarda_agendar_exames' && (
                                                              <input type="date" value={sel.data_agendar_exames || ''} onChange={(e) => atualizarSelecionadoNaLinha(v, selIdx, { data_agendar_exames: e.target.value })} className="mt-1.5 w-full px-2 py-1 border border-gray-300 rounded text-xs" />
                                                            )}
                                                            {sel.pos_entrevista === 'aguarda_resultado_exames' && (
                                                              <input type="date" value={sel.data_resultado_exames || ''} onChange={(e) => atualizarSelecionadoNaLinha(v, selIdx, { data_resultado_exames: e.target.value })} className="mt-1.5 w-full px-2 py-1 border border-gray-300 rounded text-xs" />
                                                            )}
                                                            {sel.pos_entrevista === 'reprovado_exames' && (
                                                              <input type="text" placeholder="Motivo" value={sel.motivo_reprovacao_exames || ''} onChange={(e) => atualizarSelecionadoNaLinha(v, selIdx, { motivo_reprovacao_exames: e.target.value })} className="mt-1.5 w-full px-2 py-1 border border-gray-300 rounded text-xs" />
                                                            )}
                                                            {sel.pos_entrevista === 'aprovado_exames' && !sel.contratado && (
                                                              <button type="button" onClick={() => irParaContratacaoLinha(v, sel)} className="mt-2 w-full px-2 py-1.5 bg-green-600 text-white rounded text-xs font-bold hover:bg-green-700">
                                                                ✓ CONTRATAR
                                                              </button>
                                                            )}
                                                          </div>
                                                        )}
                                                      </div>
                                                    </td>
                                                  </tr>
                                                )}
                                              </>
                                            );
                                          })}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
                                );
                              })()}

                            </td>
                          </tr>
                        );
                      }
                      return rows;
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Modal */}
        {modalAberto && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className={`bg-white rounded-xl shadow-xl w-full ${formData.status === 'Em Selecao' ? 'max-w-6xl' : 'max-w-2xl'} max-h-[90vh] overflow-y-auto`}>
              <div className="px-6 py-4 bg-gradient-to-r from-pink-500 to-rose-600 text-white flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold flex items-center gap-2">
                    <span>{editando ? '✏️' : '🆕'}</span>
                    {editando ? 'Editar Vaga' : 'Nova Vaga'}
                  </h2>
                  <p className="text-xs text-white/80 mt-0.5">Preencha os dados da vaga abaixo</p>
                </div>
                <button onClick={fecharModal} className="text-white/80 hover:text-white text-3xl leading-none">×</button>
              </div>

              <div className="p-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">🏢 Loja</label>
                    <select
                      name="cod_loja"
                      value={formData.cod_loja}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border-2 border-orange-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 font-medium"
                    >
                      <option value="">Todas as lojas (cria 1 vaga pra cada)</option>
                      {lojas.map((l) => (
                        <option key={l.id ?? l.codLoja} value={l.codLoja ?? ''}>
                          {l.codLoja != null ? `Loja ${l.codLoja} - ` : ''}{l.apelido || l.nomeFantasia || `Loja ${l.id}`}
                        </option>
                      ))}
                    </select>
                    <span className="text-[11px] text-gray-500 italic">
                      {!editando && formData.cod_loja === '' && lojas.length > 0
                        ? `⚠️ Ao salvar vai gerar ${lojas.length} vagas (uma pra cada loja)`
                        : 'Vaga aparece pra candidatos desta loja no formulário público'}
                    </span>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">💼 Cargo *</label>
                    <select
                      name="cargo_id"
                      value={formData.cargo_id}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    >
                      <option value="">Selecione...</option>
                      {cargos.map((c) => (
                        <option key={c.id} value={c.id}>{c.nome}</option>
                      ))}
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">⏰ Jornada</label>
                    <select
                      name="jornada_id"
                      value={formData.jornada_id}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    >
                      <option value="">Sem jornada definida</option>
                      {jornadas.map((j) => (
                        <option key={j.id} value={j.id}>
                          {j.nome}{j.carga_horaria ? ` — ${j.carga_horaria}` : ''}
                        </option>
                      ))}
                    </select>
                    <span className="text-[11px] text-gray-500 italic">
                      Cadastre jornadas em Configurações RH → Jornadas
                    </span>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">📅 Data Abertura</label>
                    <input
                      type="date"
                      name="data_abertura"
                      value={formData.data_abertura}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">💰 Salário Base</label>
                    <input
                      type="number"
                      name="salario_min"
                      value={formData.salario_min}
                      onChange={handleChange}
                      step="0.01"
                      placeholder="0,00"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    />
                    <span className="text-[11px] text-gray-500 italic">Preenchido automaticamente pelo cargo (editavel)</span>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">📊 Status</label>
                    <select
                      name="status"
                      value={formData.status}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    >
                      {STATUS_OPTIONS.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                  <div className="md:col-span-2 bg-sky-50 border border-sky-200 rounded-lg p-3">
                    <label className="block text-sm font-semibold text-gray-800 mb-1">🕐 Disponibilidade de horário</label>
                    <p className="text-xs text-gray-500 mb-2">Marque os turnos disponíveis para esta vaga</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {TURNOS.map(t => {
                        const marcado = (formData.turnos || []).includes(t.key);
                        return (
                          <label
                            key={t.key}
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 cursor-pointer transition ${marcado ? 'bg-white border-sky-500' : 'bg-white border-gray-200 hover:border-sky-300'}`}
                          >
                            <input
                              type="checkbox"
                              checked={marcado}
                              onChange={() => {
                                setFormData(prev => {
                                  const atuais = Array.isArray(prev.turnos) ? prev.turnos : [];
                                  const novo = marcado ? atuais.filter(x => x !== t.key) : [...atuais, t.key];
                                  return { ...prev, turnos: novo };
                                });
                              }}
                              className="w-4 h-4 text-sky-500 rounded"
                            />
                            <span className="text-lg">{t.emoji}</span>
                            <span className="text-sm font-medium">{t.label}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                  <div className="md:col-span-2 bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <label className="block text-sm font-semibold text-gray-800 mb-2">⏳ Precisa experiência?</label>
                    <div className="flex items-center gap-4 mb-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="experiencia_obrigatoria"
                          checked={formData.experiencia_obrigatoria === true}
                          onChange={() => setFormData(prev => ({ ...prev, experiencia_obrigatoria: true }))}
                        />
                        <span className="text-sm">Sim</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="experiencia_obrigatoria"
                          checked={formData.experiencia_obrigatoria === false}
                          onChange={() => setFormData(prev => ({ ...prev, experiencia_obrigatoria: false, experiencia_meses_minimo: '' }))}
                        />
                        <span className="text-sm">Não</span>
                      </label>
                    </div>
                    {formData.experiencia_obrigatoria && (
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Tempo mínimo de experiência (meses)</label>
                        <input
                          type="number"
                          min="1"
                          name="experiencia_meses_minimo"
                          value={formData.experiencia_meses_minimo}
                          onChange={handleChange}
                          placeholder="Ex: 6 = 6 meses, 24 = 2 anos"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                        />
                      </div>
                    )}
                  </div>
                  <div className="md:col-span-2">
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-sm font-medium text-gray-700">📝 Descrição / Atividades</label>
                      {(() => {
                        const cargoSel = cargos.find(c => String(c.id) === String(formData.cargo_id));
                        const atividadesCargo = cargoSel?.descritivo_atividades || '';
                        if (!atividadesCargo) return null;
                        return (
                          <button
                            type="button"
                            onClick={() => {
                              if (formData.descricao && !window.confirm('Substituir o conteúdo atual pelas atividades do cargo?')) return;
                              setFormData(prev => ({ ...prev, descricao: atividadesCargo }));
                            }}
                            className="text-xs px-2 py-1 bg-orange-100 hover:bg-orange-200 text-orange-700 rounded font-medium transition flex items-center gap-1"
                            title="Copia as atividades cadastradas no cargo (Configurações RH > Cargos)"
                          >
                            📋 Trazer atividades do cargo
                          </button>
                        );
                      })()}
                    </div>
                    <textarea
                      name="descricao"
                      value={formData.descricao}
                      onChange={handleChange}
                      rows={4}
                      placeholder="Descreva as atividades da vaga ou clique em 'Trazer atividades do cargo'"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    />
                    {!formData.cargo_id && (
                      <p className="text-[11px] text-gray-500 italic mt-1">Selecione um cargo acima pra habilitar "Trazer atividades do cargo".</p>
                    )}
                  </div>
                  <div className="md:col-span-2">
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-sm font-medium text-gray-700">📋 Requisitos</label>
                      {(() => {
                        const cargoSel = cargos.find(c => String(c.id) === String(formData.cargo_id));
                        const requisitosCargo = cargoSel?.requisitos || '';
                        if (!requisitosCargo) return null;
                        return (
                          <button
                            type="button"
                            onClick={() => {
                              if (formData.requisitos && !window.confirm('Substituir o conteúdo atual pelos requisitos do cargo?')) return;
                              setFormData(prev => ({ ...prev, requisitos: requisitosCargo }));
                            }}
                            className="text-xs px-2 py-1 bg-orange-100 hover:bg-orange-200 text-orange-700 rounded font-medium transition flex items-center gap-1"
                            title="Copia os requisitos cadastrados no cargo (Configurações RH > Cargos)"
                          >
                            📋 Trazer requisitos do cargo
                          </button>
                        );
                      })()}
                    </div>
                    <textarea
                      name="requisitos"
                      value={formData.requisitos}
                      onChange={handleChange}
                      rows={3}
                      placeholder="Ex: Ensino Médio completo, disponibilidade de horário..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">🎁 Benefícios</label>
                    {beneficiosCatalogo.length === 0 ? (
                      <p className="text-xs text-gray-500 italic px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg">
                        Nenhum beneficio cadastrado em Configuracoes RH &gt; Beneficios.
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5 px-3 py-2 border border-gray-300 rounded-lg max-h-44 overflow-y-auto">
                        {beneficiosCatalogo.map(b => {
                          const nomeBeneficio = (b.nome || '').trim();
                          const selecionados = (formData.beneficios || '')
                            .split(',').map(s => s.trim()).filter(Boolean);
                          const marcado = selecionados.includes(nomeBeneficio);
                          return (
                            <label key={b.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-orange-50 px-2 py-1 rounded">
                              <input
                                type="checkbox"
                                checked={marcado}
                                onChange={() => {
                                  const next = marcado
                                    ? selecionados.filter(n => n !== nomeBeneficio)
                                    : [...new Set([...selecionados, nomeBeneficio])]; // Set evita duplicata
                                  setFormData(prev => ({ ...prev, beneficios: next.join(', ') }));
                                }}
                                className="w-4 h-4 text-orange-500 rounded focus:ring-orange-500"
                              />
                              <span>{b.nome}</span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* SELECIONADOS movido pra linha expandida da tabela.
                    Bloco abaixo desativado (false &&) e mantido pra cleanup futuro. */}
                {formData.status === 'Em Selecao' && false && (
                  <div className="border-2 border-blue-300 bg-blue-50 rounded-lg p-4 space-y-3">
                    {formData.selecionados.length === 0 ? (
                      <p className="text-xs text-gray-600 italic text-center py-4">
                        Movido pra linha expandida da tabela.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {formData.selecionados.map((sel, idx) => (
                          <div key={`${sel.curriculo_id}-${idx}`} className="bg-white border border-gray-200 rounded-lg p-3 space-y-2">
                            {/* Header: numero + nome + remover */}
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-mono text-xs font-bold text-gray-700 bg-gray-100 border border-gray-300 rounded px-2 py-0.5">
                                  N{sel.curriculo_id}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => visualizarCurriculo(sel.curriculo_id)}
                                  className="font-bold text-sm text-blue-700 hover:underline"
                                >
                                  {sel.nome}
                                </button>
                                {sel.contratado && (
                                  <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-800 border border-green-300 font-bold">
                                    ✓ Contratado
                                  </span>
                                )}
                              </div>
                              <button
                                type="button"
                                onClick={() => removerSelecionado(idx)}
                                className="text-red-600 hover:text-red-800 text-xs font-medium"
                              >
                                ✕ Remover
                              </button>
                            </div>

                            {/* Etapas em colunas */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                              {/* ENTREVISTA */}
                              <div className="border border-gray-200 rounded p-2 bg-gray-50">
                                <div className="font-bold text-gray-700 mb-1">Entrevista</div>
                                {['agendada', 'realizada'].map(v => (
                                  <label key={v} className="flex items-center gap-1.5 cursor-pointer">
                                    <input
                                      type="radio"
                                      name={`entrevista-${idx}`}
                                      checked={sel.entrevista === v}
                                      onChange={() => atualizarSelecionado(idx, { entrevista: v })}
                                    />
                                    <span className="capitalize">{v}</span>
                                  </label>
                                ))}
                                {sel.entrevista === 'agendada' && (
                                  <div className="mt-1.5 space-y-1">
                                    <input
                                      type="datetime-local"
                                      value={sel.data_entrevista || ''}
                                      onChange={(e) => atualizarSelecionado(idx, { data_entrevista: e.target.value })}
                                      className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                                    />
                                    <input
                                      type="text"
                                      placeholder="Entrevistador"
                                      value={sel.entrevistador || ''}
                                      onChange={(e) => atualizarSelecionado(idx, { entrevistador: e.target.value })}
                                      className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                                    />
                                  </div>
                                )}
                              </div>

                              {/* RESULTADO ENTREVISTA */}
                              <div className="border border-gray-200 rounded p-2 bg-gray-50">
                                <div className="font-bold text-gray-700 mb-1">Resultado da Entrevista</div>
                                {[
                                  { v: 'passou', l: 'Passou' },
                                  { v: 'aguarda_decisao', l: 'Aguarda decisao' },
                                  { v: 'nao_compareceu', l: 'Nao compareceu' },
                                  { v: 'reprovado', l: 'Reprovado' },
                                  { v: 'desistiu', l: 'Desistiu' },
                                ].map(o => (
                                  <label key={o.v} className="flex items-center gap-1.5 cursor-pointer">
                                    <input
                                      type="radio"
                                      name={`resultado-${idx}`}
                                      checked={sel.resultado_entrevista === o.v}
                                      onChange={() => atualizarSelecionado(idx, {
                                        resultado_entrevista: o.v,
                                        // se nao passou, limpa pos-entrevista
                                        ...(o.v !== 'passou' ? { pos_entrevista: null, data_agendar_exames: null, data_resultado_exames: null } : {})
                                      })}
                                    />
                                    <span>{o.l}</span>
                                  </label>
                                ))}
                                {(sel.resultado_entrevista === 'reprovado' || sel.resultado_entrevista === 'desistiu') && (
                                  <input
                                    type="text"
                                    placeholder="Motivo"
                                    value={sel.motivo_reprovacao || ''}
                                    onChange={(e) => atualizarSelecionado(idx, { motivo_reprovacao: e.target.value })}
                                    className="mt-1.5 w-full px-2 py-1 border border-gray-300 rounded text-xs"
                                  />
                                )}
                              </div>

                              {/* POS-ENTREVISTA - so aparece se passou */}
                              {sel.resultado_entrevista === 'passou' && (
                                <div className="border border-green-300 rounded p-2 bg-green-50">
                                  <div className="font-bold text-green-800 mb-1">Pos-Entrevista (Passou)</div>
                                  {[
                                    { v: 'aguarda_agendar_exames', l: 'Aguardando Agendar Exames' },
                                    { v: 'aguarda_resultado_exames', l: 'Aguardando Resultado Exames' },
                                    { v: 'aprovado_exames', l: 'Aprovado nos Exames' },
                                    { v: 'reprovado_exames', l: 'Reprovado nos Exames' },
                                  ].map(o => (
                                    <label key={o.v} className="flex items-center gap-1.5 cursor-pointer">
                                      <input
                                        type="radio"
                                        name={`pos-${idx}`}
                                        checked={sel.pos_entrevista === o.v}
                                        onChange={() => {
                                          const patch = { pos_entrevista: o.v };
                                          // Auto-grava data ao marcar agendar/resultado
                                          if (o.v === 'aguarda_agendar_exames' && !sel.data_agendar_exames) {
                                            patch.data_agendar_exames = new Date().toISOString().substring(0, 10);
                                          }
                                          if (o.v === 'aguarda_resultado_exames' && !sel.data_resultado_exames) {
                                            patch.data_resultado_exames = new Date().toISOString().substring(0, 10);
                                          }
                                          atualizarSelecionado(idx, patch);
                                        }}
                                      />
                                      <span>{o.l}</span>
                                    </label>
                                  ))}
                                  {sel.pos_entrevista === 'aguarda_agendar_exames' && (
                                    <input
                                      type="date"
                                      value={sel.data_agendar_exames || ''}
                                      onChange={(e) => atualizarSelecionado(idx, { data_agendar_exames: e.target.value })}
                                      className="mt-1.5 w-full px-2 py-1 border border-gray-300 rounded text-xs"
                                    />
                                  )}
                                  {sel.pos_entrevista === 'aguarda_resultado_exames' && (
                                    <input
                                      type="date"
                                      value={sel.data_resultado_exames || ''}
                                      onChange={(e) => atualizarSelecionado(idx, { data_resultado_exames: e.target.value })}
                                      className="mt-1.5 w-full px-2 py-1 border border-gray-300 rounded text-xs"
                                    />
                                  )}
                                  {sel.pos_entrevista === 'reprovado_exames' && (
                                    <input
                                      type="text"
                                      placeholder="Motivo"
                                      value={sel.motivo_reprovacao_exames || ''}
                                      onChange={(e) => atualizarSelecionado(idx, { motivo_reprovacao_exames: e.target.value })}
                                      className="mt-1.5 w-full px-2 py-1 border border-gray-300 rounded text-xs"
                                    />
                                  )}
                                  {sel.pos_entrevista === 'aprovado_exames' && !sel.contratado && (
                                    <button
                                      type="button"
                                      onClick={() => irParaContratacao(sel)}
                                      className="mt-2 w-full px-2 py-1.5 bg-green-600 text-white rounded text-xs font-bold hover:bg-green-700"
                                    >
                                      ✓ CONTRATAR
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
                <button
                  onClick={fecharModal}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 text-sm font-medium"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSalvar}
                  disabled={salvando}
                  className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 text-sm font-medium disabled:opacity-50"
                >
                  {salvando ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Calendario de Entrevistas */}
        {mostrarCalendario && (() => {
          // Coleta todas as entrevistas agendadas (das vagas filtradas por loja)
          const entrevistas = [];
          vagasFiltradasPorLoja.forEach(v => {
            const sels = Array.isArray(v.selecionados) ? v.selecionados : [];
            sels.forEach(s => {
              if (s.entrevista === 'agendada' && s.data_entrevista) {
                entrevistas.push({
                  curriculo_id: s.curriculo_id,
                  candidato: s.nome,
                  vaga_id: v.id,
                  vaga_titulo: v.titulo || v.cargo_nome || '—',
                  cod_loja: v.cod_loja,
                  data: s.data_entrevista, // ISO YYYY-MM-DDTHH:MM
                  entrevistador: s.entrevistador,
                  resultado: s.resultado_entrevista,
                  contratado: !!s.contratado,
                });
              }
            });
          });
          // Ordena por data crescente
          entrevistas.sort((a, b) => (a.data || '').localeCompare(b.data || ''));

          // Agrupa por dia
          const grupos = {};
          entrevistas.forEach(e => {
            const dia = (e.data || '').split('T')[0]; // YYYY-MM-DD
            if (!grupos[dia]) grupos[dia] = [];
            grupos[dia].push(e);
          });
          const dias = Object.keys(grupos).sort();
          const fmtDia = (d) => {
            const [y, m, dd] = d.split('-');
            const dt = new Date(Number(y), Number(m) - 1, Number(dd));
            const semanas = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];
            return `${semanas[dt.getDay()]}, ${dd}/${m}/${y}`;
          };
          const lojaSel = filtroLoja !== '' ? lojas.find(x => String(x.codLoja) === String(filtroLoja)) : null;
          const nomeLoja = lojaSel ? (lojaSel.apelido || lojaSel.nomeFantasia || `Loja ${lojaSel.codLoja}`) : 'Todas as lojas';
          const lojaPorCod = (cod) => {
            if (cod == null) return '—';
            const l = lojas.find(x => Number(x.codLoja) === Number(cod));
            return l ? (l.apelido || l.nomeFantasia || `Loja ${cod}`) : `Loja ${cod}`;
          };

          return (
            <div className="fixed inset-0 bg-black/60 z-[90] flex items-center justify-center p-4" onClick={() => setMostrarCalendario(false)}>
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
                <div className="px-6 py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold flex items-center gap-2">📅 Calendário de Entrevistas</h2>
                    <p className="text-xs text-white/80 mt-0.5">{nomeLoja} · {entrevistas.length} entrevista{entrevistas.length === 1 ? '' : 's'} agendada{entrevistas.length === 1 ? '' : 's'}</p>
                  </div>
                  <button onClick={() => setMostrarCalendario(false)} className="text-white/80 hover:text-white text-3xl leading-none">×</button>
                </div>
                <div className="flex-1 overflow-y-auto p-6">
                  {entrevistas.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                      <div className="text-5xl mb-3">📭</div>
                      <p className="font-semibold">Nenhuma entrevista agendada</p>
                      <p className="text-sm mt-1">Agende entrevistas pelos candidatos selecionados nas vagas.</p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {dias.map(dia => (
                        <div key={dia}>
                          <h3 className="text-sm font-bold text-purple-700 bg-purple-50 px-3 py-2 rounded-t-lg border border-purple-200 border-b-0">
                            {fmtDia(dia)} <span className="text-gray-500 font-normal">— {grupos[dia].length} entrevista{grupos[dia].length === 1 ? '' : 's'}</span>
                          </h3>
                          <table className="w-full text-sm border border-purple-200 rounded-b-lg overflow-hidden">
                            <thead>
                              <tr className="bg-purple-100 text-purple-900 text-xs uppercase">
                                <th className="px-3 py-2 text-left">Hora</th>
                                <th className="px-3 py-2 text-left">Candidato</th>
                                <th className="px-3 py-2 text-left">Vaga</th>
                                <th className="px-3 py-2 text-left">Loja</th>
                                <th className="px-3 py-2 text-left">Entrevistador</th>
                                <th className="px-3 py-2 text-left">Resultado</th>
                              </tr>
                            </thead>
                            <tbody>
                              {grupos[dia].map((e, i) => {
                                const hora = (e.data.split('T')[1] || '').slice(0, 5) || '—';
                                const resLabel = e.contratado ? '🎉 Contratado'
                                  : e.resultado === 'passou' ? '✓ Passou'
                                  : e.resultado === 'aguarda_decisao' ? '⏳ Aguarda decisão'
                                  : e.resultado === 'reprovado' ? '❌ Reprovado'
                                  : e.resultado === 'desistiu' ? '❌ Desistiu'
                                  : e.resultado === 'nao_compareceu' ? '❌ Não compareceu'
                                  : '—';
                                return (
                                  <tr key={`${e.vaga_id}-${e.curriculo_id}-${i}`} className="border-t border-purple-100 hover:bg-purple-50">
                                    <td className="px-3 py-2 font-mono font-bold">{hora}</td>
                                    <td className="px-3 py-2">
                                      <button
                                        onClick={() => { visualizarCurriculo(e.curriculo_id); setMostrarCalendario(false); }}
                                        className="text-purple-700 hover:underline font-semibold"
                                      >{e.candidato}</button>
                                    </td>
                                    <td className="px-3 py-2 text-gray-700">{e.vaga_titulo}</td>
                                    <td className="px-3 py-2 text-gray-700">{lojaPorCod(e.cod_loja)}</td>
                                    <td className="px-3 py-2 text-gray-700">{e.entrevistador || '—'}</td>
                                    <td className="px-3 py-2 text-gray-700">{resLabel}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })()}

        {/* Modal de FESTA ao contratar 🎉 */}
        {festa && (
          <div className="fixed inset-0 bg-black/70 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setFesta(null)}>
            <div
              className="relative bg-gradient-to-br from-purple-600 via-pink-500 to-orange-500 rounded-3xl shadow-2xl p-8 max-w-lg w-full text-center text-white"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-7xl mb-3 animate-bounce">🎊🎉🎊</div>
              <h2 className="text-4xl font-extrabold mb-2 drop-shadow-lg">PARABÉNS!</h2>
              <p className="text-2xl font-bold mb-1">🎈 {festa.nome} 🎈</p>
              <p className="text-base mb-3 opacity-95">passou em todo o processo seletivo!</p>
              {festa.vaga_titulo && (
                <p className="text-sm mb-4 bg-white/20 rounded-full px-4 py-1 inline-block">
                  Vaga: <strong>{festa.vaga_titulo}</strong>
                </p>
              )}
              <p className="text-lg font-bold mt-2">🥳 Bem-vindo(a) à equipe! 🎁</p>
              <div className="text-5xl mt-4">🎂🎈🎁🎊</div>
              <button
                onClick={() => setFesta(null)}
                className="mt-6 px-8 py-3 bg-white text-purple-700 font-bold rounded-full text-lg shadow-lg hover:bg-yellow-100 hover:scale-105 transition"
              >
                ✓ Fechar
              </button>
            </div>
          </div>
        )}

        {/* Modal RICO de visualizacao do curriculo — mesmo do Banco de Curriculos */}
        {curriculoVisualizar && (
          <DetalheCV
            cv={curriculoVisualizar}
            onFechar={() => setCurriculoVisualizar(null)}
            onAtualizarStatus={async (status) => {
              try {
                await api.put(`/curriculos/${curriculoVisualizar.id}`, { status });
                setCurriculoVisualizar(prev => prev ? { ...prev, status } : prev);
                fetchAll();
              } catch { toast.error('Erro ao atualizar status'); }
            }}
            onAtualizarObs={async (observacao_rh) => {
              try {
                await api.put(`/curriculos/${curriculoVisualizar.id}`, { observacao_rh });
                setCurriculoVisualizar(prev => prev ? { ...prev, observacao_rh } : prev);
              } catch { toast.error('Erro ao salvar observação'); }
            }}
            onAtualizarAvaliacao={async (avaliacao_rh) => {
              try {
                await api.put(`/curriculos/${curriculoVisualizar.id}`, { avaliacao_rh });
                setCurriculoVisualizar(prev => prev ? { ...prev, avaliacao_rh } : prev);
              } catch { toast.error('Erro ao salvar avaliação'); }
            }}
            onExcluir={async () => {
              if (!window.confirm(`Excluir o currículo de "${curriculoVisualizar.nome}"?`)) return;
              try {
                await api.delete(`/curriculos/${curriculoVisualizar.id}`);
                setCurriculoVisualizar(null);
                fetchAll();
              } catch { toast.error('Erro ao excluir'); }
            }}
          />
        )}
      </div>
    </div>
  );
}
