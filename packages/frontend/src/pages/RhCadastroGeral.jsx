import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Sidebar from '../components/Sidebar';
import { api } from '../utils/api';
import toast from 'react-hot-toast';
import RadarLoading from '../components/RadarLoading';

export default function RhCadastroGeral() {
  const { user, logout } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Lista e paginacao
  const [colaboradores, setColaboradores] = useState([]);
  const [filtro, setFiltro] = useState('');
  const [filtroDebounced, setFiltroDebounced] = useState('');
  const [statusFiltro, setStatusFiltro] = useState('ativo');
  const [loading, setLoading] = useState(true);
  const [totalRegistros, setTotalRegistros] = useState(0);

  // Ordenacao da tabela
  const [sortField, setSortField] = useState(null);
  const [sortDir, setSortDir] = useState('asc'); // 'asc' | 'desc'
  const toggleSort = (field) => {
    if (sortField !== field) { setSortField(field); setSortDir('asc'); }
    else if (sortDir === 'asc') setSortDir('desc');
    else { setSortField(null); setSortDir('asc'); }
  };
  const sortIcon = (field) => {
    if (sortField !== field) return <span className="opacity-30 ml-1">↕</span>;
    return <span className="ml-1">{sortDir === 'asc' ? '▲' : '▼'}</span>;
  };

  // Filtros avancados (Todos por padrao)
  const [filtroCargo, setFiltroCargo] = useState('');
  const [filtroSetor, setFiltroSetor] = useState('');
  const [filtroEmpresa, setFiltroEmpresa] = useState('');
  const [filtroJornada, setFiltroJornada] = useState('');

  const colaboradoresOrdenados = (() => {
    let list = colaboradores;
    // Filtros
    if (filtroCargo) list = list.filter(c => String(c.cargo_id) === String(filtroCargo));
    if (filtroSetor) list = list.filter(c => String(c.departamento_id) === String(filtroSetor));
    if (filtroEmpresa) list = list.filter(c => String(c.company_id || c.empresa_id) === String(filtroEmpresa));
    if (filtroJornada) list = list.filter(c => String(c.jornada_id) === String(filtroJornada));
    // Ordenacao
    if (sortField) {
      list = [...list];
      const mult = sortDir === 'asc' ? 1 : -1;
      // resolve o valor de ordenacao espelhando o que a celula exibe
      // (ex: SETOR cai pra setor_departamento_nome quando setor_nome e nulo).
      const valor = (row) => {
        if (sortField === 'setor_nome') return row.setor_nome || row.setor_departamento_nome;
        return row[sortField];
      };
      list.sort((a, b) => {
        let va = valor(a);
        let vb = valor(b);
        const vazio = (x) => x == null || String(x).trim() === '';
        if (vazio(va)) return 1;   // vazios sempre por ultimo
        if (vazio(vb)) return -1;
        if (sortField === 'salario') {
          return (Number(va) - Number(vb)) * mult;
        }
        return String(va).localeCompare(String(vb), 'pt-BR', { sensitivity: 'base', numeric: true }) * mult;
      });
    }
    return list;
  })();

  // Estatisticas
  const [stats, setStats] = useState({ total: 0, ativos: 0, desligados: 0, clts: 0, aprendizes: 0 });
  const [setores, setSetores] = useState([]);

  // Modal
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState(null);
  const [abaAtiva, setAbaAtiva] = useState('pessoais');
  const [salvando, setSalvando] = useState(false);

  // Dropdowns de configuracao
  const [cargos, setCargos] = useState([]);
  const [empresas, setEmpresas] = useState([]);
  const [jornadas, setJornadas] = useState([]);
  const [escolaridades, setEscolaridades] = useState([]);
  const [escalas, setEscalas] = useState([]);
  const [escalasDomingo, setEscalasDomingo] = useState([]);
  const [regimes, setRegimes] = useState([]);
  const [tiposDesligamento, setTiposDesligamento] = useState([]);
  const [motivosDesligamento, setMotivosDesligamento] = useState([]);
  const [beneficiosDisponiveis, setBeneficiosDisponiveis] = useState([]);
  const [uploadingFoto, setUploadingFoto] = useState(false);
  // Vínculos do relógio de ponto (RHiD): PIS/CPF que o relógio conhece
  const [pontoVinculos, setPontoVinculos] = useState(null);
  // Foto expandida (lightbox) ao clicar na foto do colaborador
  const [fotoExpandida, setFotoExpandida] = useState(null);

  // Busca (não bloqueante) quais PIS/CPF o relógio identifica — pra coluna "Relógio de Ponto"
  useEffect(() => {
    api.get('/rh/ponto/rhid/vinculos')
      .then(r => setPontoVinculos({ pis: new Set(r.data?.pis || []), cpf: new Set(r.data?.cpf || []) }))
      .catch(() => setPontoVinculos({ pis: new Set(), cpf: new Set(), erro: true }));
  }, []);

  // Status do relógio de ponto pra um colaborador (verde=identificado, vermelho=não, laranja=não bate ponto)
  const statusPonto = (colab) => {
    if (colab.nao_bate_ponto) return { label: 'Não bate ponto', cls: 'bg-amber-100 text-amber-700', dot: '🟠' };
    if (!pontoVinculos || pontoVinculos.erro) return null;
    const pis = String(colab.pis_pasep || '').replace(/\D/g, '').replace(/^0+/, '');
    const cpfDigits = String(colab.cpf || '').replace(/\D/g, '');
    const cpf = cpfDigits ? cpfDigits.padStart(11, '0') : '';
    const ident = (cpf && pontoVinculos.cpf.has(cpf)) || (pis && pontoVinculos.pis.has(pis));
    return ident
      ? { label: 'OK', cls: 'bg-emerald-100 text-emerald-700', dot: '🟢' }
      : { label: 'Não identificado', cls: 'bg-rose-100 text-rose-700', dot: '🔴' };
  };

  // Calcula tempo na empresa em anos e meses
  const tempoNaEmpresa = (dataAdmissao) => {
    if (!dataAdmissao) return '-';
    const admissao = new Date(dataAdmissao);
    if (isNaN(admissao.getTime())) return '-';
    const hoje = new Date();
    let anos = hoje.getFullYear() - admissao.getFullYear();
    let meses = hoje.getMonth() - admissao.getMonth();
    if (hoje.getDate() < admissao.getDate()) meses--;
    if (meses < 0) { anos--; meses += 12; }
    if (anos < 0) return '-';
    if (anos === 0 && meses === 0) return 'Menos de 1 mes';
    const partes = [];
    if (anos > 0) partes.push(`${anos} ano${anos > 1 ? 's' : ''}`);
    if (meses > 0) partes.push(`${meses} ${meses > 1 ? 'meses' : 'mes'}`);
    return partes.join(' e ');
  };

  const formatarDataBR = (iso) => {
    if (!iso) return '-';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleDateString('pt-BR');
  };

  // Calcula idade em anos baseado em data_nascimento
  const calcularIdade = (dataNasc) => {
    if (!dataNasc) return null;
    const nasc = new Date(dataNasc);
    if (isNaN(nasc.getTime())) return null;
    const hoje = new Date();
    let idade = hoje.getFullYear() - nasc.getFullYear();
    const mesDiff = hoje.getMonth() - nasc.getMonth();
    if (mesDiff < 0 || (mesDiff === 0 && hoje.getDate() < nasc.getDate())) idade--;
    return idade < 0 ? null : idade;
  };

  const handleUploadFoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingFoto(true);
    try {
      const fd = new FormData();
      fd.append('imagem', file);
      const res = await api.post('/checklist/upload-imagem', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (res.data?.url) {
        setFormData(f => ({ ...f, foto_url: res.data.url }));
      }
    } catch (err) {
      toast.error('Erro ao enviar foto');
    } finally {
      setUploadingFoto(false);
      e.target.value = '';
    }
  };

  // Form data
  const initialFormData = {
    // Dados Pessoais
    matricula: '',
    nome: '',
    cpf: '',
    rg: '',
    data_nascimento: '',
    sexo: '',
    estado_civil: '',
    nacionalidade: 'Brasileiro(a)',
    naturalidade: '',
    escolaridade_id: '',
    nome_pai: '',
    nome_mae: '',
    telefone: '',
    celular: '',
    email: '',
    // Endereco
    cep: '',
    endereco: '',
    numero: '',
    complemento: '',
    bairro: '',
    cidade: '',
    estado: '',
    // Dados Profissionais
    cargo_id: '',
    empresa_id: '',
    company_id: '',
    jornada_id: '',
    escala_id: '',
    escala_domingo_id: '',
    regime_trabalho_id: '',
    sector_id: '',
    departamento_id: '',
    data_admissao: '',
    data_desligamento: '',
    tipo_desligamento_id: '',
    motivo_desligamento_id: '',
    salario: '',
    status: 'ativo',
    // Cartão de Ponto
    nao_bate_ponto: false,
    // Documentos
    ctps: '',
    serie_ctps: '',
    ctps_uf: '',
    ctps_emissao: '',
    pis_pasep: '',
    titulo_eleitor: '',
    titulo_zona: '',
    titulo_secao: '',
    titulo_emissao: '',
    reservista: '',
    reservista_uf: '',
    reservista_emissao: '',
    cnh: '',
    cnh_categoria: '',
    cnh_uf: '',
    cnh_validade: '',
    // RG completo
    rg_orgao_emissor: '',
    rg_uf: '',
    rg_emissao: '',
    // Características pessoais
    naturalidade_uf: '',
    raca_cor: '',
    tipo_sanguineo: '',
    altura: '',
    peso: '',
    cor_cabelos: '',
    cor_olhos: '',
    deficiente: '',
    tamanho_uniforme: '',
    tipo_uniforme: '',
    // Cônjuge
    conjuge_nome: '',
    conjuge_cpf: '',
    conjuge_data_nascimento: '',
    conjuge_data_casamento: '',
    // Estrangeiro
    pais_nacionalidade: '',
    condicao_ingresso_brasil: '',
    data_chegada_brasil: '',
    filhos_brasileiros: false,
    filhos_brasileiros_qtd: '',
    casado_brasileiro: false,
    portaria_naturalizacao: '',
    data_naturalizacao: '',
    // Dependentes (lista) — carregada do backend, atualizada no save
    dependentes: [],
    // Banco
    banco: '',
    agencia: '',
    conta: '',
    tipo_conta: '',
    pix: '',
    // Beneficios
    vale_transporte: false,
    vale_refeicao: false,
    valor_vale_refeicao: '',
    plano_saude: false,
    beneficios_ids: [],
    // Observacoes
    observacoes: '',
    // Foto do colaborador
    foto_url: ''
  };

  const [formData, setFormData] = useState(initialFormData);

  // Debounce para busca
  useEffect(() => {
    const timer = setTimeout(() => {
      setFiltroDebounced(filtro);
    }, 500);
    return () => clearTimeout(timer);
  }, [filtro]);

  // Carregar dados quando filtros mudam
  useEffect(() => {
    carregarColaboradores();
    carregarEstatisticas();
  }, [filtroDebounced, statusFiltro]);

  // Carregar configuracoes ao montar
  useEffect(() => {
    carregarConfiguracoes();
  }, []);

  // Pre-preencher cadastro vindo de Vagas (CONTRATAR)
  useEffect(() => {
    const curriculoId = searchParams.get('curriculo_id');
    const vagaId = searchParams.get('vaga_id');
    if (!curriculoId) return;
    (async () => {
      try {
        const { data: cv } = await api.get(`/curriculos/${curriculoId}`);
        if (!cv) return;
        // Tenta puxar cargo da vaga
        let cargoIdVaga = '';
        let salarioVaga = '';
        if (vagaId) {
          try {
            const { data: vagas } = await api.get('/rh/vagas');
            const vaga = (vagas || []).find(v => String(v.id) === String(vagaId));
            if (vaga) {
              cargoIdVaga = vaga.cargo_id || '';
              salarioVaga = vaga.salario_min || '';
            }
          } catch {}
        }
        setEditando(null);
        setFormData(prev => ({
          ...initialFormData,
          nome: cv.nome || '',
          cpf: cv.cpf || '',
          rg: cv.rg || '',
          data_nascimento: cv.data_nascimento?.split('T')[0] || '',
          sexo: cv.sexo || '',
          estado_civil: cv.estado_civil || '',
          escolaridade_id: cv.escolaridade_id || '',
          telefone: cv.telefone || '',
          celular: cv.whatsapp || cv.celular || '',
          email: cv.email || '',
          cep: cv.cep || '',
          endereco: cv.rua || cv.endereco || '',
          numero: cv.numero || '',
          complemento: cv.complemento || '',
          bairro: cv.bairro || '',
          cidade: cv.cidade || '',
          estado: cv.estado || '',
          foto_url: cv.foto_url || '',
          cargo_id: cargoIdVaga,
          salario: salarioVaga,
          data_admissao: new Date().toISOString().split('T')[0],
          status: 'ativo',
        }));
        setAbaAtiva('pessoais');
        setModalAberto(true);
        toast.success(`Pre-preenchido com dados de ${cv.nome} (curriculo N${cv.id})`);
        // Limpa query params pra nao reabrir ao recarregar
        setSearchParams({});
      } catch (err) {
        console.error('Erro ao pre-preencher:', err);
        toast.error('Erro ao carregar curriculo');
      }
    })();
  }, [searchParams]);

  const carregarConfiguracoes = async () => {
    try {
      const [cargosRes, empRes, jorRes, escRes, escalasRes, escDomRes, regimesRes, beneficiosRes, setoresRes, tiposDesligRes, motivosDesligRes] = await Promise.all([
        api.get('/rh/configuracoes/cargos'),
        api.get('/rh/empresas/stores/list'),
        api.get('/rh/configuracoes/jornadas'),
        api.get('/rh/configuracoes/escolaridades'),
        api.get('/rh/configuracoes/escalas'),
        api.get('/rh/configuracoes/escalas-domingo'),
        api.get('/rh/configuracoes/regimes-trabalho'),
        api.get('/rh/configuracoes/beneficios'),
        api.get('/rh/configuracoes/departamentos'),
        api.get('/rh/configuracoes/tipos-desligamento'),
        api.get('/rh/configuracoes/motivos-desligamento')
      ]);
      setCargos(cargosRes.data?.cargos || cargosRes.data || []);
      const empData = Array.isArray(empRes.data) ? empRes.data : (empRes.data?.companies || []);
      setEmpresas(empData);
      setJornadas(jorRes.data?.jornadas || jorRes.data || []);
      setEscolaridades(escRes.data?.escolaridades || escRes.data || []);
      setEscalas(escalasRes.data?.escalas || escalasRes.data || []);
      setEscalasDomingo(escDomRes.data?.escalas_domingo || escDomRes.data || []);
      setRegimes(regimesRes.data?.regimes || regimesRes.data || []);
      const benData = beneficiosRes.data?.beneficios || beneficiosRes.data || [];
      setBeneficiosDisponiveis(Array.isArray(benData) ? benData.filter(b => b.ativo !== false) : []);
      const setoresData = setoresRes.data?.departamentos || (Array.isArray(setoresRes.data) ? setoresRes.data : []);
      // Normaliza pra ter sempre {id, name} (rh_departamentos usa "nome")
      setSetores(setoresData.map(d => ({ id: d.id, name: d.name || d.nome, ativo: d.ativo })).filter(d => d.ativo !== false));
      const tdData = tiposDesligRes.data?.tipos_desligamento || tiposDesligRes.data?.tipos || tiposDesligRes.data || [];
      setTiposDesligamento(Array.isArray(tdData) ? tdData.filter(t => t.ativo !== false) : []);
      const mdData = motivosDesligRes.data?.motivos_desligamento || motivosDesligRes.data?.motivos || motivosDesligRes.data || [];
      setMotivosDesligamento(Array.isArray(mdData) ? mdData.filter(m => m.ativo !== false) : []);
    } catch (error) {
      console.error('Erro ao carregar configuracoes:', error);
    }
  };

  const carregarEstatisticas = async () => {
    try {
      const response = await api.get('/rh/colaboradores/stats');
      setStats({
        total: response.data?.totalColaboradores || response.data?.total || 0,
        ativos: response.data?.ativos || 0,
        desligados: response.data?.desligados || 0,
        clts: response.data?.clts || 0,
        aprendizes: response.data?.aprendizes || 0,
      });
    } catch (error) {
      console.error('Erro ao carregar estatisticas:', error);
    }
  };

  const carregarColaboradores = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.append('page', 1);
      params.append('limit', 99999);
      if (filtroDebounced) params.append('search', filtroDebounced);
      if (statusFiltro !== 'todos') params.append('status', statusFiltro);

      const response = await api.get(`/rh/colaboradores?${params.toString()}`);
      setColaboradores(response.data?.data || response.data?.colaboradores || []);
      setTotalRegistros(response.data?.pagination?.total || response.data?.total || 0);
    } catch (error) {
      console.error('Erro ao carregar colaboradores:', error);
      toast.error('Erro ao carregar colaboradores');
    } finally {
      setLoading(false);
    }
  };

  const abrirModal = async (colaborador = null) => {
    if (colaborador) {
      // Busca a versão completa do colaborador (com dependentes + campos novos
      // que não vêm na listagem). Se falhar, usa o objeto do listing como fallback.
      let colab = colaborador;
      try {
        const r = await api.get(`/rh/colaboradores/${colaborador.id}`);
        if (r?.data) colab = r.data;
      } catch { /* mantém o objeto do listing */ }
      colaborador = colab;
      setEditando(colaborador);
      setFormData({
        matricula: colaborador.matricula || '',
        nome: colaborador.nome || '',
        cpf: colaborador.cpf || '',
        rg: colaborador.rg || '',
        data_nascimento: colaborador.data_nascimento?.split('T')[0] || '',
        sexo: colaborador.sexo || '',
        estado_civil: (() => {
          // Normaliza valores legados ("Casado(a)", "Casado", "casado") pro padrão UPPERCASE
          const v = String(colaborador.estado_civil || '').toUpperCase().replace(/\(A\)/g, '').replace(/\s+/g, '_').trim();
          if (v.startsWith('SOLT')) return 'SOLTEIRO';
          if (v.startsWith('CAS')) return 'CASADO';
          if (v.startsWith('DIVOR')) return 'DIVORCIADO';
          if (v.startsWith('VI')) return 'VIUVO';
          if (v.includes('UNIAO')) return 'UNIAO_ESTAVEL';
          return colaborador.estado_civil || '';
        })(),
        nacionalidade: colaborador.nacionalidade || '',
        naturalidade: colaborador.naturalidade || '',
        escolaridade_id: colaborador.escolaridade_id || '',
        nome_pai: colaborador.nome_pai || '',
        nome_mae: colaborador.nome_mae || '',
        telefone: colaborador.telefone || '',
        celular: colaborador.celular || '',
        email: colaborador.email || '',
        cep: colaborador.cep || '',
        endereco: colaborador.endereco || '',
        numero: colaborador.numero || '',
        complemento: colaborador.complemento || '',
        bairro: colaborador.bairro || '',
        cidade: colaborador.cidade || '',
        estado: colaborador.estado || '',
        cargo_id: colaborador.cargo_id || '',
        empresa_id: colaborador.empresa_id || '',
        company_id: colaborador.company_id || '',
        jornada_id: colaborador.jornada_id || '',
        escala_id: colaborador.escala_id || '',
        escala_domingo_id: colaborador.escala_domingo_id || '',
        regime_trabalho_id: colaborador.regime_trabalho_id || '',
        sector_id: colaborador.sector_id || '',
        departamento_id: colaborador.departamento_id || '',
        data_admissao: colaborador.data_admissao?.split('T')[0] || '',
        data_desligamento: colaborador.data_desligamento?.split('T')[0] || '',
        tipo_desligamento_id: colaborador.tipo_desligamento_id || '',
        motivo_desligamento_id: colaborador.motivo_desligamento_id || '',
        salario: colaborador.salario || '',
        status: colaborador.status || 'ativo',
        nao_bate_ponto: colaborador.nao_bate_ponto || false,
        ctps: colaborador.ctps || '',
        serie_ctps: colaborador.serie_ctps || '',
        ctps_uf: colaborador.ctps_uf || '',
        ctps_emissao: colaborador.ctps_emissao?.split('T')[0] || '',
        pis_pasep: colaborador.pis_pasep || '',
        titulo_eleitor: colaborador.titulo_eleitor || '',
        titulo_zona: colaborador.titulo_zona || '',
        titulo_secao: colaborador.titulo_secao || '',
        titulo_emissao: colaborador.titulo_emissao?.split('T')[0] || '',
        reservista: colaborador.reservista || '',
        reservista_uf: colaborador.reservista_uf || '',
        reservista_emissao: colaborador.reservista_emissao?.split('T')[0] || '',
        cnh: colaborador.cnh || '',
        cnh_categoria: colaborador.cnh_categoria || '',
        cnh_uf: colaborador.cnh_uf || '',
        cnh_validade: colaborador.cnh_validade?.split('T')[0] || '',
        // RG completo
        rg_orgao_emissor: colaborador.rg_orgao_emissor || '',
        rg_uf: colaborador.rg_uf || '',
        rg_emissao: colaborador.rg_emissao?.split('T')[0] || '',
        // Características pessoais
        naturalidade_uf: colaborador.naturalidade_uf || '',
        raca_cor: colaborador.raca_cor || '',
        tipo_sanguineo: colaborador.tipo_sanguineo || '',
        altura: colaborador.altura || '',
        peso: colaborador.peso || '',
        cor_cabelos: colaborador.cor_cabelos || '',
        cor_olhos: colaborador.cor_olhos || '',
        deficiente: colaborador.deficiente || '',
        tamanho_uniforme: colaborador.tamanho_uniforme || '',
        tipo_uniforme: colaborador.tipo_uniforme || '',
        // Cônjuge
        conjuge_nome: colaborador.conjuge_nome || '',
        conjuge_cpf: colaborador.conjuge_cpf || '',
        conjuge_data_nascimento: colaborador.conjuge_data_nascimento?.split('T')[0] || '',
        conjuge_data_casamento: colaborador.conjuge_data_casamento?.split('T')[0] || '',
        // Estrangeiro
        pais_nacionalidade: colaborador.pais_nacionalidade || '',
        condicao_ingresso_brasil: colaborador.condicao_ingresso_brasil || '',
        data_chegada_brasil: colaborador.data_chegada_brasil?.split('T')[0] || '',
        filhos_brasileiros: colaborador.filhos_brasileiros || false,
        filhos_brasileiros_qtd: colaborador.filhos_brasileiros_qtd || '',
        casado_brasileiro: colaborador.casado_brasileiro || false,
        portaria_naturalizacao: colaborador.portaria_naturalizacao || '',
        data_naturalizacao: colaborador.data_naturalizacao?.split('T')[0] || '',
        // Dependentes (vem do backend agora — array em colaborador.dependentes)
        dependentes: Array.isArray(colaborador.dependentes) ? colaborador.dependentes.map(d => ({
          ...d,
          data_nascimento: d.data_nascimento?.split('T')[0] || '',
          certidao_data: d.certidao_data?.split('T')[0] || '',
        })) : [],
        banco: colaborador.banco || '',
        agencia: colaborador.agencia || '',
        conta: colaborador.conta || '',
        tipo_conta: colaborador.tipo_conta || '',
        pix: colaborador.pix || '',
        vale_transporte: colaborador.vale_transporte || false,
        vale_refeicao: colaborador.vale_refeicao || false,
        valor_vale_refeicao: colaborador.valor_vale_refeicao || '',
        plano_saude: colaborador.plano_saude || false,
        beneficios_ids: Array.isArray(colaborador.beneficios_ids) ? colaborador.beneficios_ids : [],
        observacoes: colaborador.observacoes || '',
        foto_url: colaborador.foto_url || ''
      });
    } else {
      setEditando(null);
      setFormData(initialFormData);
    }
    setAbaAtiva('pessoais');
    setModalAberto(true);
  };

  const fecharModal = () => {
    setModalAberto(false);
    setEditando(null);
  };

  // Campos obrigatorios CROSS-ABA — o HTML5 `required` so dispara quando
  // o campo esta visivel, e como o form tem abas (so uma renderiza por
  // vez), os required das abas inativas eram ignorados no submit. Aqui
  // validamos no JS pra garantir que NENHUM obrigatorio passa em branco,
  // independente de qual aba esta ativa quando o user clica Salvar.
  const camposObrigatorios = [
    { aba: 'pessoais',      campo: 'matricula',       label: 'Matrícula' },
    { aba: 'pessoais',      campo: 'nome',            label: 'Nome Completo' },
    { aba: 'pessoais',      campo: 'cpf',             label: 'CPF' },
    { aba: 'pessoais',      campo: 'data_nascimento', label: 'Data de Nascimento' },
    { aba: 'pessoais',      campo: 'sexo',            label: 'Sexo' },
    { aba: 'pessoais',      campo: 'escolaridade_id', label: 'Escolaridade' },
    { aba: 'endereco',      campo: 'cep',             label: 'CEP' },
    { aba: 'profissionais', campo: 'company_id',      label: 'Empresa / Loja' },
    { aba: 'profissionais', campo: 'cargo_id',        label: 'Cargo' },
    { aba: 'profissionais', campo: 'jornada_id',      label: 'Jornada' },
    { aba: 'profissionais', campo: 'escala_id',          label: 'Escala' },
    { aba: 'profissionais', campo: 'escala_domingo_id',  label: 'Escala Especial Domingo' },
    { aba: 'profissionais', campo: 'regime_trabalho_id', label: 'Regime de Trabalho' },
    { aba: 'profissionais', campo: 'departamento_id',    label: 'Setor' },
    { aba: 'profissionais', campo: 'data_admissao',   label: 'Data de Admissão' },
    { aba: 'profissionais', campo: 'salario',         label: 'Salário' },
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    // Valida obrigatorios de TODAS as abas antes de salvar
    const faltando = camposObrigatorios.find(c => {
      const v = formData[c.campo];
      return v == null || String(v).trim() === '';
    });
    if (faltando) {
      const abaLabel = (abas.find(a => a.id === faltando.aba) || {}).label || faltando.aba;
      setAbaAtiva(faltando.aba);
      toast.error(`Preencha "${faltando.label}" (aba ${abaLabel})`);
      return;
    }
    if (formData.status === 'desligado') {
      if (!formData.data_desligamento) {
        toast.error('Informe a data de desligamento');
        return;
      }
      if (!formData.tipo_desligamento_id) {
        toast.error('Selecione o tipo de desligamento');
        return;
      }
      if (!formData.motivo_desligamento_id) {
        toast.error('Selecione o motivo de desligamento');
        return;
      }
    }
    try {
      setSalvando(true);
      if (editando) {
        await api.put(`/rh/colaboradores/${editando.id}`, formData);
        toast.success('Colaborador atualizado com sucesso!');
      } else {
        await api.post('/rh/colaboradores', formData);
        toast.success('Colaborador cadastrado com sucesso!');
      }
      fecharModal();
      carregarColaboradores();
      carregarEstatisticas();
    } catch (error) {
      console.error('Erro ao salvar colaborador:', error);
      toast.error(error.response?.data?.message || 'Erro ao salvar colaborador');
    } finally {
      setSalvando(false);
    }
  };

  const excluirColaborador = async (id, nome) => {
    if (!window.confirm(`Tem certeza que deseja excluir o colaborador "${nome}"?`)) return;
    try {
      await api.delete(`/rh/colaboradores/${id}`);
      toast.success('Colaborador excluido com sucesso!');
      carregarColaboradores();
      carregarEstatisticas();
    } catch (error) {
      console.error('Erro ao excluir colaborador:', error);
      toast.error('Erro ao excluir colaborador');
    }
  };

  const formatarData = (data) => {
    if (!data) return '-';
    return new Date(data).toLocaleDateString('pt-BR');
  };

  const formatarCPF = (cpf) => {
    if (!cpf) return '-';
    const cleaned = cpf.replace(/\D/g, '');
    if (cleaned.length !== 11) return cpf;
    return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  };

  const handleChange = (field, value) => {
    setFormData(prev => {
      const novo = { ...prev, [field]: value };
      // Quando muda status pra desligado e ainda nao tem data, sugere hoje (usuario pode trocar)
      if (field === 'status' && value === 'desligado' && !prev.data_desligamento) {
        novo.data_desligamento = new Date().toISOString().split('T')[0];
      }
      // Quando volta pra ativo, limpa data/tipo/motivo de desligamento
      if (field === 'status' && value === 'ativo') {
        novo.data_desligamento = '';
        novo.tipo_desligamento_id = '';
        novo.motivo_desligamento_id = '';
      }
      return novo;
    });

    // CEP: quando completar 8 dígitos, busca no ViaCEP e preenche rua/bairro/cidade/UF.
    // Mantém o valor atual se a API não retornar aquele campo (CEPs gerais às vezes
    // não trazem logradouro).
    if (field === 'cep') {
      const cepLimpo = String(value || '').replace(/\D/g, '');
      if (cepLimpo.length === 8) {
        fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`)
          .then(r => r.ok ? r.json() : null)
          .then(data => {
            if (!data || data.erro) return;
            setFormData(prev => ({
              ...prev,
              endereco: data.logradouro || prev.endereco,
              bairro:   data.bairro     || prev.bairro,
              cidade:   data.localidade || prev.cidade,
              estado:   data.uf         || prev.estado,
            }));
          })
          .catch(() => { /* silencia erros de rede */ });
      }
    }
  };

  // Input class helper
  const inputClass = "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-sm";
  const selectClass = "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-sm";
  const labelClass = "block text-sm font-medium text-gray-700 mb-1";

  // Abas do modal
  const abas = [
    { id: 'pessoais', label: 'Dados Pessoais', icon: '👤' },
    { id: 'endereco', label: 'Endereco', icon: '🏠' },
    { id: 'profissionais', label: 'Profissionais', icon: '💼' },
    { id: 'documentos', label: 'Documentos', icon: '📄' },
    { id: 'familia', label: 'Família', icon: '👨‍👩‍👧' },
    { id: 'banco', label: 'Banco', icon: '🏦' },
    { id: 'beneficios', label: 'Beneficios', icon: '🎁' },
    { id: 'ponto', label: 'Cartão de Ponto', icon: '⏰' }
  ];

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Lightbox da foto do colaborador */}
      {fotoExpandida && (
        <div className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-4" onClick={() => setFotoExpandida(null)}>
          <div className="relative" onClick={e => e.stopPropagation()}>
            <img src={fotoExpandida.url} alt={fotoExpandida.nome}
              className="max-w-[90vw] max-h-[85vh] rounded-lg shadow-2xl object-contain bg-white" />
            <div className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-sm font-semibold px-3 py-2 rounded-b-lg">{fotoExpandida.nome}</div>
            <button onClick={() => setFotoExpandida(null)}
              className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-white text-gray-700 shadow-lg flex items-center justify-center font-bold hover:bg-gray-100">✕</button>
          </div>
        </div>
      )}
      <Sidebar
        user={user}
        onLogout={logout}
        isMobileMenuOpen={isMobileMenuOpen}
        setIsMobileMenuOpen={setIsMobileMenuOpen}
      />

      <div className="flex-1 overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-purple-500 text-white px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Cadastro de Colaboradores</h1>
              <p className="text-orange-100 text-sm">Gerencie todos os colaboradores da empresa</p>
            </div>
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-lg hover:bg-orange-700"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Stats Cards - foscos (cores suaves) com icones neutros + faixa lateral */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden flex items-stretch">
              <div className="flex-1 p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-500 font-medium">Total de Colaboradores</p>
                  <p className="text-2xl font-bold text-gray-700 mt-0.5">{stats.total}</p>
                </div>
              </div>
              <div className="w-2 bg-slate-400" />
            </div>
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden flex items-stretch">
              <div className="flex-1 p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600/70">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-500 font-medium">Ativos</p>
                  <p className="text-2xl font-bold text-emerald-700/80 mt-0.5">{stats.ativos}</p>
                </div>
              </div>
              <div className="w-2 bg-emerald-300" />
            </div>
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden flex items-stretch">
              <div className="flex-1 p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-rose-50 flex items-center justify-center text-rose-500/70">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-500 font-medium">Desligados</p>
                  <p className="text-2xl font-bold text-rose-700/80 mt-0.5">{stats.desligados}</p>
                </div>
              </div>
              <div className="w-2 bg-rose-300" />
            </div>
            {/* CARD CLT (ativos) */}
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden flex items-stretch">
              <div className="flex-1 p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-500/70">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
                  </svg>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-500 font-medium">CLTs Ativos</p>
                  <p className="text-2xl font-bold text-blue-700/80 mt-0.5">{stats.clts}</p>
                </div>
              </div>
              <div className="w-2 bg-blue-300" />
            </div>
            {/* CARD APRENDIZ (ativos) */}
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden flex items-stretch">
              <div className="flex-1 p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center text-amber-500/70">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5l4-2.222"/>
                  </svg>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-500 font-medium">Aprendizes Ativos</p>
                  <p className="text-2xl font-bold text-amber-700/80 mt-0.5">{stats.aprendizes}</p>
                </div>
              </div>
              <div className="w-2 bg-amber-300" />
            </div>
          </div>

          {/* Filtros e Acoes */}
          <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200 mb-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex flex-col md:flex-row gap-4 flex-1">
                {/* Busca */}
                <div className="flex-1">
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Buscar por nome, CPF ou matricula..."
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                      value={filtro}
                      onChange={(e) => {
                        setFiltro(e.target.value);
                      }}
                    />
                    <svg className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                </div>

                {/* Filtro por Status */}
                <select
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  value={statusFiltro}
                  onChange={(e) => {
                    setStatusFiltro(e.target.value);
                  }}
                >
                  <option value="todos">Todos os status</option>
                  <option value="ativo">Ativos</option>
                  <option value="desligado">Desligados</option>
                </select>

                {/* Filtro por Cargo */}
                <select
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  value={filtroCargo}
                  onChange={(e) => setFiltroCargo(e.target.value)}
                >
                  <option value="">Todos os cargos</option>
                  {cargos.map(c => (
                    <option key={c.id} value={c.id}>{c.nome}</option>
                  ))}
                </select>

                {/* Filtro por Setor */}
                <select
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  value={filtroSetor}
                  onChange={(e) => setFiltroSetor(e.target.value)}
                >
                  <option value="">Todos os setores</option>
                  {setores.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>

                {/* Filtro por Empresa */}
                <select
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  value={filtroEmpresa}
                  onChange={(e) => setFiltroEmpresa(e.target.value)}
                >
                  <option value="">Todas as empresas</option>
                  {empresas.map(e => (
                    <option key={e.id} value={e.id}>
                      {e.apelido
                        ? `Loja ${e.cod_loja} - ${e.apelido}`
                        : (e.label || e.nome_fantasia || `Loja ${e.cod_loja || ''}`)}
                    </option>
                  ))}
                </select>

                {/* Filtro por Jornada */}
                <select
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  value={filtroJornada}
                  onChange={(e) => setFiltroJornada(e.target.value)}
                >
                  <option value="">Todas as jornadas</option>
                  {jornadas.map(j => (
                    <option key={j.id} value={j.id}>{j.nome}</option>
                  ))}
                </select>
              </div>

              {/* Botao Novo */}
              <button
                onClick={() => abrirModal()}
                className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Novo Colaborador
              </button>
            </div>
          </div>

          {/* Tabela */}
          {loading ? (
            <div className="flex justify-center py-20">
              <RadarLoading message="Carregando colaboradores..." />
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-600">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Foto</th>
                      <th onClick={() => toggleSort('matricula')} className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider cursor-pointer select-none hover:bg-gray-700">Matricula{sortIcon('matricula')}</th>
                      <th onClick={() => toggleSort('nome')} className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider cursor-pointer select-none hover:bg-gray-700">Nome{sortIcon('nome')}</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider whitespace-nowrap">Relógio de Ponto</th>
                      <th onClick={() => toggleSort('data_nascimento')} className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider cursor-pointer select-none hover:bg-gray-700">Idade{sortIcon('data_nascimento')}</th>
                      <th onClick={() => toggleSort('cpf')} className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider cursor-pointer select-none hover:bg-gray-700">CPF{sortIcon('cpf')}</th>
                      <th onClick={() => toggleSort('cargo_nome')} className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider cursor-pointer select-none hover:bg-gray-700">Cargo{sortIcon('cargo_nome')}</th>
                      <th onClick={() => toggleSort('setor_nome')} className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider cursor-pointer select-none hover:bg-gray-700">Setor{sortIcon('setor_nome')}</th>
                      <th onClick={() => toggleSort('escolaridade_nome')} className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider cursor-pointer select-none hover:bg-gray-700">Escolaridade{sortIcon('escolaridade_nome')}</th>
                      <th onClick={() => toggleSort('empresa_nome')} className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider cursor-pointer select-none hover:bg-gray-700">Empresa{sortIcon('empresa_nome')}</th>
                      <th onClick={() => toggleSort('salario')} className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider cursor-pointer select-none hover:bg-gray-700">Salario{sortIcon('salario')}</th>
                      <th onClick={() => toggleSort('jornada_nome')} className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider cursor-pointer select-none hover:bg-gray-700">Jornada{sortIcon('jornada_nome')}</th>
                      <th onClick={() => toggleSort('escala_nome')} className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider cursor-pointer select-none hover:bg-gray-700">Escala{sortIcon('escala_nome')}</th>
                      <th onClick={() => toggleSort('regime_trabalho_nome')} className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider cursor-pointer select-none hover:bg-gray-700">Regime{sortIcon('regime_trabalho_nome')}</th>
                      <th onClick={() => toggleSort('data_admissao')} className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider cursor-pointer select-none hover:bg-gray-700">Admissao{sortIcon('data_admissao')}</th>
                      <th onClick={() => toggleSort('data_admissao')} className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider cursor-pointer select-none hover:bg-gray-700">Tempo de Casa</th>
                      <th onClick={() => toggleSort('status')} className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider cursor-pointer select-none hover:bg-gray-700">Status{sortIcon('status')}</th>
                      <th onClick={() => toggleSort('data_desligamento')} className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider cursor-pointer select-none hover:bg-gray-700">Desligado em{sortIcon('data_desligamento')}</th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-white uppercase tracking-wider">Acoes</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {colaboradores.length === 0 ? (
                      <tr>
                        <td colSpan="18" className="px-6 py-12 text-center text-gray-500">
                          <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          <p className="text-lg font-medium">Nenhum colaborador encontrado</p>
                          <p className="text-sm mt-1">Tente ajustar os filtros ou cadastre um novo colaborador.</p>
                        </td>
                      </tr>
                    ) : (
                      colaboradoresOrdenados.map((colab) => (
                        <tr key={colab.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-2">
                            {colab.foto_url ? (
                              <img src={colab.foto_url} alt={colab.nome}
                                onClick={() => setFotoExpandida({ url: colab.foto_url, nome: colab.nome })}
                                title="Clique para ampliar"
                                className="w-10 h-10 rounded-full object-cover border-2 border-orange-200 cursor-pointer hover:ring-2 hover:ring-orange-400 transition" />
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-orange-100 text-orange-700 flex items-center justify-center font-bold border-2 border-orange-200">
                                {(colab.nome || '?').charAt(0).toUpperCase()}
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {colab.matricula || '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {colab.nome}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            {(() => {
                              const st = statusPonto(colab);
                              if (!st) return <span className="text-gray-300">…</span>;
                              return <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${st.cls}`}>{st.dot} {st.label}</span>;
                            })()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 font-medium">
                            {(() => {
                              const i = calcularIdade(colab.data_nascimento);
                              return i != null ? `${i} anos` : '-';
                            })()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {formatarCPF(colab.cpf)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {colab.cargo_nome || '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {colab.setor_nome || colab.setor_departamento_nome || '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {colab.escolaridade_nome || '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {colab.empresa_nome || '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {colab.salario != null && colab.salario !== ''
                              ? Number(colab.salario).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                              : '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {colab.jornada_nome || '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {colab.escala_nome || '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {colab.regime_trabalho_nome || '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {formatarDataBR(colab.data_admissao)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 font-medium">
                            {tempoNaEmpresa(colab.data_admissao)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              colab.status === 'ativo'
                                ? 'bg-green-100 text-green-800'
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {colab.status === 'ativo' ? 'Ativo' : 'Desligado'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            {colab.status === 'desligado' && colab.data_desligamento ? (
                              <span className="inline-block px-2 py-0.5 bg-red-50 border border-red-200 text-red-700 rounded font-semibold">
                                {formatarDataBR(colab.data_desligamento)}
                              </span>
                            ) : <span className="text-gray-300">—</span>}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center">
                            <div className="flex items-center justify-center gap-3">
                              <button
                                onClick={() => abrirModal(colab)}
                                className="text-orange-600 hover:text-orange-800 transition-colors"
                                title="Editar colaborador"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                              <button
                                onClick={() => excluirColaborador(colab.id, colab.nome)}
                                className="text-red-600 hover:text-red-800 transition-colors"
                                title="Excluir colaborador"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Contador total */}
              {totalRegistros > 0 && (
                <div className="bg-gray-50 px-6 py-3 border-t border-gray-200 text-sm text-gray-700">
                  Total: <span className="font-medium">{totalRegistros}</span> colaborador(es)
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modal de Cadastro/Edicao */}
      {modalAberto && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-purple-600 to-purple-500 text-white px-6 py-4 rounded-t-xl flex items-center justify-between flex-shrink-0">
              <h3 className="text-lg font-bold">
                {editando ? 'Editar Colaborador' : 'Novo Colaborador'}
              </h3>
              <button
                type="button"
                onClick={fecharModal}
                className="text-white hover:text-orange-200 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Tabs */}
            <div className="border-b border-gray-200 flex-shrink-0">
              <div className="flex overflow-x-auto px-4">
                {abas.map((aba) => (
                  <button
                    key={aba.id}
                    type="button"
                    onClick={() => setAbaAtiva(aba.id)}
                    className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                      abaAtiva === aba.id
                        ? 'border-orange-500 text-orange-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <span className="mr-1">{aba.icon}</span>
                    {aba.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
              <div className="flex-1 overflow-y-auto px-6 py-4">
                {/* ===== ABA: Dados Pessoais ===== */}
                {abaAtiva === 'pessoais' && (
                  <div className="space-y-4">
                    {/* Foto do colaborador */}
                    <div className="flex items-center gap-4">
                      <div className="w-24 h-24 rounded-full border-4 border-orange-200 bg-orange-50 overflow-hidden flex items-center justify-center shrink-0">
                        {formData.foto_url ? (
                          <img src={formData.foto_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <svg className="w-12 h-12 text-orange-300" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                      <div className="flex flex-col gap-2">
                        <label className="text-sm font-semibold text-gray-700">Foto do Colaborador</label>
                        <input type="file" accept="image/*" id="upload-foto-colab" className="hidden" onChange={handleUploadFoto} />
                        <div className="flex gap-2">
                          <label htmlFor="upload-foto-colab"
                            className={`cursor-pointer px-4 py-2 rounded-lg text-sm font-bold text-white inline-block text-center ${uploadingFoto ? 'bg-gray-400' : 'bg-orange-500 hover:bg-orange-600'}`}>
                            {uploadingFoto ? 'Enviando…' : (formData.foto_url ? '🔄 Trocar foto' : '📷 Adicionar foto')}
                          </label>
                          {formData.foto_url && (
                            <button type="button"
                              onClick={() => setFormData(f => ({ ...f, foto_url: '' }))}
                              className="px-4 py-2 rounded-lg text-sm font-bold bg-red-100 text-red-700 hover:bg-red-200">
                              🗑️ Remover
                            </button>
                          )}
                        </div>
                        <span className="text-xs text-gray-500">JPG, PNG ou WEBP. Opcional.</span>
                      </div>
                    </div>

                    {/* Empresa + Status - escolhidos antes de qualquer outra coisa */}
                    <div className={`border rounded-lg p-3 grid grid-cols-1 md:grid-cols-4 gap-3 ${formData.status === 'desligado' ? 'bg-red-50 border-red-200' : 'bg-orange-50 border-orange-200'}`}>
                      <div className={formData.status === 'desligado' ? 'md:col-span-2' : 'md:col-span-3'}>
                        <label className={labelClass}>
                          🏪 Empresa / Loja * <span className="text-xs text-gray-500 font-normal">(cadastrada em Configuracoes)</span>
                        </label>
                        <select required className={selectClass} value={formData.company_id || ''} onChange={(e) => handleChange('company_id', e.target.value)}>
                          <option value="">Selecione a loja onde o colaborador trabalha...</option>
                          {empresas.map(emp => (
                            <option key={emp.id} value={emp.id}>
                              {emp.apelido
                                ? `Loja ${emp.cod_loja} - ${emp.apelido}${emp.nome_fantasia ? ' (' + emp.nome_fantasia + ')' : ''}`
                                : (emp.label || emp.nome_fantasia || `Loja ${emp.cod_loja || ''}`)}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className={labelClass}>Status</label>
                        <select className={selectClass} value={formData.status} onChange={(e) => handleChange('status', e.target.value)}>
                          <option value="ativo">Ativo</option>
                          <option value="desligado">Desligado</option>
                        </select>
                      </div>
                      {formData.status === 'desligado' && (
                        <div>
                          <label className={labelClass + ' text-red-700'}>Data de Desligamento *</label>
                          <input
                            type="date"
                            required
                            className={inputClass + ' border-red-300 focus:ring-red-500 focus:border-red-500'}
                            value={formData.data_desligamento}
                            max={new Date().toISOString().split('T')[0]}
                            onChange={(e) => handleChange('data_desligamento', e.target.value)}
                          />
                        </div>
                      )}
                      {formData.status === 'desligado' && (
                        <div className="md:col-span-2">
                          <label className={labelClass + ' text-red-700'}>Tipo de Desligamento *</label>
                          <select
                            required
                            className={selectClass + ' border-red-300 focus:ring-red-500 focus:border-red-500'}
                            value={formData.tipo_desligamento_id}
                            onChange={(e) => handleChange('tipo_desligamento_id', e.target.value)}
                          >
                            <option value="">Selecione...</option>
                            {tiposDesligamento.map(t => (
                              <option key={t.id} value={t.id}>{t.nome}</option>
                            ))}
                          </select>
                        </div>
                      )}
                      {formData.status === 'desligado' && (
                        <div className="md:col-span-2">
                          <label className={labelClass + ' text-red-700'}>Motivo de Desligamento *</label>
                          <select
                            required
                            className={selectClass + ' border-red-300 focus:ring-red-500 focus:border-red-500'}
                            value={formData.motivo_desligamento_id}
                            onChange={(e) => handleChange('motivo_desligamento_id', e.target.value)}
                          >
                            <option value="">Selecione...</option>
                            {motivosDesligamento.map(m => (
                              <option key={m.id} value={m.id}>{m.nome}</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className={labelClass}>Matricula *</label>
                        <input type="text" required className={inputClass} value={formData.matricula} onChange={(e) => handleChange('matricula', e.target.value)} />
                      </div>
                      <div className="md:col-span-2">
                        <label className={labelClass}>Nome Completo *</label>
                        <input type="text" required className={inputClass} value={formData.nome} onChange={(e) => handleChange('nome', e.target.value)} />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className={labelClass}>CPF *</label>
                        <input type="text" required className={inputClass} value={formData.cpf} onChange={(e) => handleChange('cpf', e.target.value)} placeholder="000.000.000-00" />
                      </div>
                      <div>
                        <label className={labelClass}>RG (nº)</label>
                        <input type="text" className={inputClass} value={formData.rg} onChange={(e) => handleChange('rg', e.target.value)} />
                      </div>
                      <div>
                        <label className={labelClass}>Data de Nascimento *</label>
                        <input type="date" required className={inputClass} value={formData.data_nascimento} onChange={(e) => handleChange('data_nascimento', e.target.value)} />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className={labelClass}>RG — Órgão Emissor</label>
                        <input type="text" className={inputClass} value={formData.rg_orgao_emissor} onChange={(e) => handleChange('rg_orgao_emissor', e.target.value)} placeholder="SSP, IFP..." />
                      </div>
                      <div>
                        <label className={labelClass}>RG — UF</label>
                        <input type="text" maxLength={2} className={inputClass} value={formData.rg_uf} onChange={(e) => handleChange('rg_uf', e.target.value.toUpperCase())} />
                      </div>
                      <div>
                        <label className={labelClass}>RG — Data Emissão</label>
                        <input type="date" className={inputClass} value={formData.rg_emissao} onChange={(e) => handleChange('rg_emissao', e.target.value)} />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className={labelClass}>Sexo *</label>
                        <select required className={selectClass} value={formData.sexo} onChange={(e) => handleChange('sexo', e.target.value)}>
                          <option value="">Selecione...</option>
                          <option value="M">Masculino</option>
                          <option value="F">Feminino</option>
                          <option value="N">Nao Informar</option>
                        </select>
                      </div>
                      <div>
                        <label className={labelClass}>Estado Civil</label>
                        <select className={selectClass} value={formData.estado_civil} onChange={(e) => handleChange('estado_civil', e.target.value)}>
                          <option value="">Selecione...</option>
                          <option value="SOLTEIRO">Solteiro(a)</option>
                          <option value="CASADO">Casado(a)</option>
                          <option value="DIVORCIADO">Divorciado(a)</option>
                          <option value="VIUVO">Viúvo(a)</option>
                          <option value="UNIAO_ESTAVEL">União Estável</option>
                        </select>
                      </div>
                      <div>
                        <label className={labelClass}>Escolaridade *</label>
                        <select className={selectClass} value={formData.escolaridade_id} onChange={(e) => handleChange('escolaridade_id', e.target.value)}>
                          <option value="">Selecione...</option>
                          {escolaridades.map(esc => (
                            <option key={esc.id} value={esc.id}>{esc.nome}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className={labelClass}>Nacionalidade</label>
                        <input type="text" className={inputClass} value={formData.nacionalidade} onChange={(e) => handleChange('nacionalidade', e.target.value)} />
                      </div>
                      <div>
                        <label className={labelClass}>Naturalidade</label>
                        <input type="text" className={inputClass} value={formData.naturalidade} onChange={(e) => handleChange('naturalidade', e.target.value)} />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className={labelClass}>Nome do Pai</label>
                        <input type="text" className={inputClass} value={formData.nome_pai} onChange={(e) => handleChange('nome_pai', e.target.value)} />
                      </div>
                      <div>
                        <label className={labelClass}>Nome da Mae</label>
                        <input type="text" className={inputClass} value={formData.nome_mae} onChange={(e) => handleChange('nome_mae', e.target.value)} />
                      </div>
                    </div>

                    <h4 className="text-md font-semibold text-gray-700 pt-3 pb-2 border-b border-gray-200">Contato</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className={labelClass}>Telefone</label>
                        <input type="text" className={inputClass} value={formData.telefone} onChange={(e) => handleChange('telefone', e.target.value)} placeholder="(00) 0000-0000" />
                      </div>
                      <div>
                        <label className={labelClass}>Celular</label>
                        <input type="text" className={inputClass} value={formData.celular} onChange={(e) => handleChange('celular', e.target.value)} placeholder="(00) 00000-0000" />
                      </div>
                      <div>
                        <label className={labelClass}>E-mail</label>
                        <input type="email" className={inputClass} value={formData.email} onChange={(e) => handleChange('email', e.target.value)} />
                      </div>
                    </div>

                    <h4 className="text-md font-semibold text-gray-700 pt-3 pb-2 border-b border-gray-200">Características pessoais</h4>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div>
                        <label className={labelClass}>Naturalidade — UF</label>
                        <input type="text" maxLength={2} className={inputClass} value={formData.naturalidade_uf} onChange={(e) => handleChange('naturalidade_uf', e.target.value.toUpperCase())} />
                      </div>
                      <div>
                        <label className={labelClass}>Raça / Cor</label>
                        <select className={selectClass} value={formData.raca_cor} onChange={(e) => handleChange('raca_cor', e.target.value)}>
                          <option value="">—</option>
                          <option value="BRANCA">Branca</option>
                          <option value="PRETA">Preta</option>
                          <option value="PARDA">Parda</option>
                          <option value="AMARELA">Amarela</option>
                          <option value="INDIGENA">Indígena</option>
                          <option value="NAO_DECLARADO">Não declarado</option>
                        </select>
                      </div>
                      <div>
                        <label className={labelClass}>Tipo Sanguíneo</label>
                        <select className={selectClass} value={formData.tipo_sanguineo} onChange={(e) => handleChange('tipo_sanguineo', e.target.value)}>
                          <option value="">—</option>
                          {['A+','A-','B+','B-','AB+','AB-','O+','O-'].map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className={labelClass}>Deficiência</label>
                        <select className={selectClass} value={formData.deficiente} onChange={(e) => handleChange('deficiente', e.target.value)}>
                          <option value="">Nenhuma</option>
                          <option value="FISICA">Física</option>
                          <option value="AUDITIVA">Auditiva</option>
                          <option value="VISUAL">Visual</option>
                          <option value="REABILITADO">Reabilitado</option>
                          <option value="MENTAL">Mental</option>
                          <option value="MULTIPLA">Múltipla</option>
                          <option value="INTELECTUAL">Intelectual</option>
                        </select>
                      </div>
                      <div>
                        <label className={labelClass}>Altura (m)</label>
                        <input type="text" className={inputClass} value={formData.altura} onChange={(e) => handleChange('altura', e.target.value)} placeholder="1,75" />
                      </div>
                      <div>
                        <label className={labelClass}>Peso (kg)</label>
                        <input type="text" className={inputClass} value={formData.peso} onChange={(e) => handleChange('peso', e.target.value)} />
                      </div>
                      <div>
                        <label className={labelClass}>Cor dos cabelos</label>
                        <input type="text" className={inputClass} value={formData.cor_cabelos} onChange={(e) => handleChange('cor_cabelos', e.target.value)} />
                      </div>
                      <div>
                        <label className={labelClass}>Cor dos olhos</label>
                        <input type="text" className={inputClass} value={formData.cor_olhos} onChange={(e) => handleChange('cor_olhos', e.target.value)} />
                      </div>
                      <div>
                        <label className={labelClass}>👕 Tamanho de Uniforme</label>
                        <select className={selectClass} value={formData.tamanho_uniforme} onChange={(e) => handleChange('tamanho_uniforme', e.target.value)}>
                          <option value="">—</option>
                          {['PP','P','M','G','GG','XG','XXG'].map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className={labelClass}>👕 Tipo Uniforme</label>
                        <select className={selectClass} value={formData.tipo_uniforme} onChange={(e) => handleChange('tipo_uniforme', e.target.value)}>
                          <option value="">—</option>
                          <option value="NORMAL">Normal</option>
                          <option value="BABY LOOK">Baby Look</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                {/* ===== ABA: Endereco ===== */}
                {abaAtiva === 'endereco' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div>
                        <label className={labelClass}>CEP *</label>
                        <input type="text" className={inputClass} value={formData.cep} onChange={(e) => handleChange('cep', e.target.value)} placeholder="00000-000" />
                      </div>
                      <div className="md:col-span-2">
                        <label className={labelClass}>Endereco</label>
                        <input type="text" className={inputClass} value={formData.endereco} onChange={(e) => handleChange('endereco', e.target.value)} />
                      </div>
                      <div>
                        <label className={labelClass}>Numero</label>
                        <input type="text" className={inputClass} value={formData.numero} onChange={(e) => handleChange('numero', e.target.value)} />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div>
                        <label className={labelClass}>Complemento</label>
                        <input type="text" className={inputClass} value={formData.complemento} onChange={(e) => handleChange('complemento', e.target.value)} />
                      </div>
                      <div>
                        <label className={labelClass}>Bairro</label>
                        <input type="text" className={inputClass} value={formData.bairro} onChange={(e) => handleChange('bairro', e.target.value)} />
                      </div>
                      <div>
                        <label className={labelClass}>Cidade</label>
                        <input type="text" className={inputClass} value={formData.cidade} onChange={(e) => handleChange('cidade', e.target.value)} />
                      </div>
                      <div>
                        <label className={labelClass}>UF</label>
                        <select className={selectClass} value={formData.estado} onChange={(e) => handleChange('estado', e.target.value)}>
                          <option value="">Selecione...</option>
                          {['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'].map(uf => (
                            <option key={uf} value={uf}>{uf}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                {/* ===== ABA: Dados Profissionais ===== */}
                {abaAtiva === 'profissionais' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className={labelClass}>Cargo *</label>
                        <select required className={selectClass} value={formData.cargo_id} onChange={(e) => {
                          const cargoId = e.target.value;
                          const cargoSelecionado = cargos.find(c => c.id === parseInt(cargoId));
                          handleChange('cargo_id', cargoId);
                          if (cargoSelecionado?.salario_base) {
                            handleChange('salario', cargoSelecionado.salario_base);
                          }
                        }}>
                          <option value="">Selecione...</option>
                          {cargos.map(cargo => (
                            <option key={cargo.id} value={cargo.id}>{cargo.nome}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className={labelClass}>Jornada *</label>
                        <select required className={selectClass} value={formData.jornada_id} onChange={(e) => handleChange('jornada_id', e.target.value)}>
                          <option value="">Selecione...</option>
                          {jornadas.map(jornada => (
                            <option key={jornada.id} value={jornada.id}>
                              {jornada.nome}{jornada.carga_horaria ? ` (${jornada.carga_horaria})` : (jornada.horas_diarias ? ` (${jornada.horas_diarias}h/dia)` : '')}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className={labelClass}>Escala *</label>
                        <select className={selectClass} value={formData.escala_id} onChange={(e) => handleChange('escala_id', e.target.value)}>
                          <option value="">Selecione...</option>
                          {escalas.map(esc => (
                            <option key={esc.id} value={esc.id}>{esc.nome}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className={labelClass}>Escala Especial Domingo *</label>
                        <select className={selectClass} value={formData.escala_domingo_id} onChange={(e) => handleChange('escala_domingo_id', e.target.value)}>
                          <option value="">Nenhum</option>
                          {escalasDomingo.map(ed => (
                            <option key={ed.id} value={ed.id}>{ed.nome}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className={labelClass}>Regime de Trabalho *</label>
                        <select className={selectClass} value={formData.regime_trabalho_id} onChange={(e) => handleChange('regime_trabalho_id', e.target.value)}>
                          <option value="">Selecione...</option>
                          {regimes.map(r => (
                            <option key={r.id} value={r.id}>{r.nome}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className={labelClass}>Setor (vem das Configurações RH &gt; Setores) *</label>
                        <select className={selectClass} value={formData.departamento_id || ''} onChange={(e) => handleChange('departamento_id', e.target.value)}>
                          <option value="">Selecione...</option>
                          {setores.map(s => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className={labelClass}>Data de Admissao *</label>
                        <input type="date" required className={inputClass} value={formData.data_admissao} onChange={(e) => handleChange('data_admissao', e.target.value)} />
                      </div>
                      <div>
                        <label className={labelClass}>Salario (R$) *</label>
                        <input type="number" step="0.01" className={inputClass} value={formData.salario} onChange={(e) => handleChange('salario', e.target.value)} placeholder="0,00" />
                      </div>
                    </div>

                    <h4 className="text-md font-semibold text-gray-700 pt-3 pb-2 border-b border-gray-200">Observacoes</h4>
                    <div>
                      <textarea
                        rows={3}
                        className={inputClass}
                        value={formData.observacoes}
                        onChange={(e) => handleChange('observacoes', e.target.value)}
                        placeholder="Observacoes gerais sobre o colaborador..."
                      />
                    </div>
                  </div>
                )}

                {/* ===== ABA: Documentos ===== */}
                {abaAtiva === 'documentos' && (
                  <div className="space-y-4">
                    <h4 className="text-md font-semibold text-gray-700 pb-2 border-b border-gray-200">CTPS</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className={labelClass}>Numero CTPS</label>
                        <input type="text" className={inputClass} value={formData.ctps} onChange={(e) => handleChange('ctps', e.target.value)} />
                      </div>
                      <div>
                        <label className={labelClass}>Serie</label>
                        <input type="text" className={inputClass} value={formData.serie_ctps} onChange={(e) => handleChange('serie_ctps', e.target.value)} />
                      </div>
                      <div>
                        <label className={labelClass}>UF</label>
                        <input type="text" maxLength={2} className={inputClass} value={formData.ctps_uf} onChange={(e) => handleChange('ctps_uf', e.target.value.toUpperCase())} />
                      </div>
                      <div>
                        <label className={labelClass}>Data Emissão</label>
                        <input type="date" className={inputClass} value={formData.ctps_emissao} onChange={(e) => handleChange('ctps_emissao', e.target.value)} />
                      </div>
                    </div>

                    <h4 className="text-md font-semibold text-gray-700 pt-3 pb-2 border-b border-gray-200">PIS/PASEP</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className={labelClass}>Numero PIS/PASEP</label>
                        <input type="text" className={inputClass} value={formData.pis_pasep} onChange={(e) => handleChange('pis_pasep', e.target.value)} />
                      </div>
                    </div>

                    <h4 className="text-md font-semibold text-gray-700 pt-3 pb-2 border-b border-gray-200">Titulo de Eleitor</h4>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div>
                        <label className={labelClass}>Número</label>
                        <input type="text" className={inputClass} value={formData.titulo_eleitor} onChange={(e) => handleChange('titulo_eleitor', e.target.value)} />
                      </div>
                      <div>
                        <label className={labelClass}>Zona</label>
                        <input type="text" className={inputClass} value={formData.titulo_zona} onChange={(e) => handleChange('titulo_zona', e.target.value)} />
                      </div>
                      <div>
                        <label className={labelClass}>Seção</label>
                        <input type="text" className={inputClass} value={formData.titulo_secao} onChange={(e) => handleChange('titulo_secao', e.target.value)} />
                      </div>
                      <div>
                        <label className={labelClass}>Data Emissão</label>
                        <input type="date" className={inputClass} value={formData.titulo_emissao} onChange={(e) => handleChange('titulo_emissao', e.target.value)} />
                      </div>
                    </div>

                    <h4 className="text-md font-semibold text-gray-700 pt-3 pb-2 border-b border-gray-200">Certificado de Reservista</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className={labelClass}>Número</label>
                        <input type="text" className={inputClass} value={formData.reservista} onChange={(e) => handleChange('reservista', e.target.value)} />
                      </div>
                      <div>
                        <label className={labelClass}>UF</label>
                        <input type="text" maxLength={2} className={inputClass} value={formData.reservista_uf} onChange={(e) => handleChange('reservista_uf', e.target.value.toUpperCase())} />
                      </div>
                      <div>
                        <label className={labelClass}>Data Emissão</label>
                        <input type="date" className={inputClass} value={formData.reservista_emissao} onChange={(e) => handleChange('reservista_emissao', e.target.value)} />
                      </div>
                    </div>

                    <h4 className="text-md font-semibold text-gray-700 pt-3 pb-2 border-b border-gray-200">Carteira de Habilitação (CNH)</h4>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div>
                        <label className={labelClass}>Número CNH</label>
                        <input type="text" className={inputClass} value={formData.cnh} onChange={(e) => handleChange('cnh', e.target.value)} />
                      </div>
                      <div>
                        <label className={labelClass}>Categoria</label>
                        <input type="text" className={inputClass} value={formData.cnh_categoria} onChange={(e) => handleChange('cnh_categoria', e.target.value.toUpperCase())} placeholder="A, B, AB..." />
                      </div>
                      <div>
                        <label className={labelClass}>UF</label>
                        <input type="text" maxLength={2} className={inputClass} value={formData.cnh_uf} onChange={(e) => handleChange('cnh_uf', e.target.value.toUpperCase())} />
                      </div>
                      <div>
                        <label className={labelClass}>Validade</label>
                        <input type="date" className={inputClass} value={formData.cnh_validade} onChange={(e) => handleChange('cnh_validade', e.target.value)} />
                      </div>
                    </div>
                  </div>
                )}

                {/* ===== ABA: Família (Cônjuge + Estrangeiro + Dependentes) ===== */}
                {abaAtiva === 'familia' && (
                  <div className="space-y-4">
                    {/* Cônjuge (se casado/união estável) */}
                    {(formData.estado_civil === 'CASADO' || formData.estado_civil === 'UNIAO_ESTAVEL' || formData.estado_civil === 'casado' || formData.estado_civil === 'uniao_estavel') && (
                      <>
                        <h4 className="text-md font-semibold text-gray-700 pt-3 pb-2 border-b border-gray-200">Cônjuge</h4>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                          <div className="md:col-span-2">
                            <label className={labelClass}>Nome do cônjuge</label>
                            <input type="text" className={inputClass} value={formData.conjuge_nome} onChange={(e) => handleChange('conjuge_nome', e.target.value)} />
                          </div>
                          <div>
                            <label className={labelClass}>CPF</label>
                            <input type="text" className={inputClass} value={formData.conjuge_cpf} onChange={(e) => handleChange('conjuge_cpf', e.target.value)} />
                          </div>
                          <div>
                            <label className={labelClass}>Data nascimento</label>
                            <input type="date" className={inputClass} value={formData.conjuge_data_nascimento} onChange={(e) => handleChange('conjuge_data_nascimento', e.target.value)} />
                          </div>
                          <div>
                            <label className={labelClass}>Data casamento/união</label>
                            <input type="date" className={inputClass} value={formData.conjuge_data_casamento} onChange={(e) => handleChange('conjuge_data_casamento', e.target.value)} />
                          </div>
                        </div>
                      </>
                    )}

                    {/* Estrangeiro (se nacionalidade não brasileira) */}
                    {formData.nacionalidade && !String(formData.nacionalidade).toUpperCase().includes('BRASIL') && (
                      <>
                        <h4 className="text-md font-semibold text-gray-700 pt-3 pb-2 border-b border-gray-200">Estrangeiro</h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <label className={labelClass}>País de nacionalidade</label>
                            <input type="text" className={inputClass} value={formData.pais_nacionalidade} onChange={(e) => handleChange('pais_nacionalidade', e.target.value)} />
                          </div>
                          <div>
                            <label className={labelClass}>Condição de ingresso</label>
                            <input type="text" className={inputClass} value={formData.condicao_ingresso_brasil} onChange={(e) => handleChange('condicao_ingresso_brasil', e.target.value)} />
                          </div>
                          <div>
                            <label className={labelClass}>Data de chegada</label>
                            <input type="date" className={inputClass} value={formData.data_chegada_brasil} onChange={(e) => handleChange('data_chegada_brasil', e.target.value)} />
                          </div>
                          <div>
                            <label className="flex items-center gap-2 mt-6 cursor-pointer">
                              <input type="checkbox" checked={!!formData.filhos_brasileiros} onChange={(e) => handleChange('filhos_brasileiros', e.target.checked)} className="w-4 h-4" />
                              <span className="text-sm">Possui filhos c/ brasileiro</span>
                            </label>
                          </div>
                          <div>
                            <label className={labelClass}>Quantos</label>
                            <input type="text" className={inputClass} value={formData.filhos_brasileiros_qtd} onChange={(e) => handleChange('filhos_brasileiros_qtd', e.target.value)} />
                          </div>
                          <div>
                            <label className="flex items-center gap-2 mt-6 cursor-pointer">
                              <input type="checkbox" checked={!!formData.casado_brasileiro} onChange={(e) => handleChange('casado_brasileiro', e.target.checked)} className="w-4 h-4" />
                              <span className="text-sm">Casado c/ brasileiro</span>
                            </label>
                          </div>
                          <div className="md:col-span-2">
                            <label className={labelClass}>Portaria naturalização</label>
                            <input type="text" className={inputClass} value={formData.portaria_naturalizacao} onChange={(e) => handleChange('portaria_naturalizacao', e.target.value)} />
                          </div>
                          <div>
                            <label className={labelClass}>Data naturalização</label>
                            <input type="date" className={inputClass} value={formData.data_naturalizacao} onChange={(e) => handleChange('data_naturalizacao', e.target.value)} />
                          </div>
                        </div>
                      </>
                    )}

                    {/* Dependentes */}
                    <div className="flex items-center justify-between pt-3 pb-2 border-b border-gray-200">
                      <h4 className="text-md font-semibold text-gray-700">Dependentes ({(formData.dependentes || []).length})</h4>
                      <button type="button" onClick={() => handleChange('dependentes', [...(formData.dependentes || []), { nome: '', parentesco: '', sexo: '', cpf: '', data_nascimento: '', certidao_numero: '', certidao_data: '', certidao_cartorio: '', certidao_folha: '', dependente_ir: false, dependente_sf: false }])}
                        className="text-xs px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded font-bold">+ Adicionar dependente</button>
                    </div>
                    {(formData.dependentes || []).length === 0 ? (
                      <p className="text-sm text-gray-400 text-center py-4">Nenhum dependente cadastrado.</p>
                    ) : (
                      <div className="space-y-3">
                        {formData.dependentes.map((d, i) => (
                          <div key={i} className="border border-gray-200 rounded p-3 bg-gray-50 space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="text-xs font-bold text-gray-500 uppercase">Dependente {i + 1}</div>
                              <button type="button" onClick={() => handleChange('dependentes', formData.dependentes.filter((_, x) => x !== i))} className="text-xs text-red-600 hover:underline">🗑 remover</button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                              <input className={inputClass + ' md:col-span-2'} placeholder="Nome completo" value={d.nome} onChange={(e) => { const arr = [...formData.dependentes]; arr[i] = { ...arr[i], nome: e.target.value }; handleChange('dependentes', arr); }} />
                              <select className={selectClass} value={d.parentesco} onChange={(e) => { const arr = [...formData.dependentes]; arr[i] = { ...arr[i], parentesco: e.target.value }; handleChange('dependentes', arr); }}>
                                <option value="">Parentesco</option>
                                <option value="FILHO">Filho(a)</option>
                                <option value="CONJUGE">Cônjuge</option>
                                <option value="ENTEADO">Enteado(a)</option>
                                <option value="PAI_MAE">Pai/Mãe</option>
                                <option value="OUTRO">Outro</option>
                              </select>
                              <select className={selectClass} value={d.sexo} onChange={(e) => { const arr = [...formData.dependentes]; arr[i] = { ...arr[i], sexo: e.target.value }; handleChange('dependentes', arr); }}>
                                <option value="">Sexo</option>
                                <option value="M">M</option>
                                <option value="F">F</option>
                              </select>
                              <input className={inputClass} placeholder="CPF" value={d.cpf} onChange={(e) => { const arr = [...formData.dependentes]; arr[i] = { ...arr[i], cpf: e.target.value }; handleChange('dependentes', arr); }} />
                              <input type="date" className={inputClass} value={d.data_nascimento} onChange={(e) => { const arr = [...formData.dependentes]; arr[i] = { ...arr[i], data_nascimento: e.target.value }; handleChange('dependentes', arr); }} />
                              <input className={inputClass + ' md:col-span-2'} placeholder="Certidão (nº)" value={d.certidao_numero} onChange={(e) => { const arr = [...formData.dependentes]; arr[i] = { ...arr[i], certidao_numero: e.target.value }; handleChange('dependentes', arr); }} />
                              <input type="date" className={inputClass} value={d.certidao_data} onChange={(e) => { const arr = [...formData.dependentes]; arr[i] = { ...arr[i], certidao_data: e.target.value }; handleChange('dependentes', arr); }} />
                              <input className={inputClass + ' md:col-span-2'} placeholder="Cartório" value={d.certidao_cartorio} onChange={(e) => { const arr = [...formData.dependentes]; arr[i] = { ...arr[i], certidao_cartorio: e.target.value }; handleChange('dependentes', arr); }} />
                              <input className={inputClass} placeholder="Folha" value={d.certidao_folha} onChange={(e) => { const arr = [...formData.dependentes]; arr[i] = { ...arr[i], certidao_folha: e.target.value }; handleChange('dependentes', arr); }} />
                            </div>
                            <div className="flex gap-4">
                              <label className="flex items-center gap-2 text-xs cursor-pointer">
                                <input type="checkbox" checked={!!d.dependente_ir} onChange={(e) => { const arr = [...formData.dependentes]; arr[i] = { ...arr[i], dependente_ir: e.target.checked }; handleChange('dependentes', arr); }} />
                                Dependente IR
                              </label>
                              <label className="flex items-center gap-2 text-xs cursor-pointer">
                                <input type="checkbox" checked={!!d.dependente_sf} onChange={(e) => { const arr = [...formData.dependentes]; arr[i] = { ...arr[i], dependente_sf: e.target.checked }; handleChange('dependentes', arr); }} />
                                Salário-família
                              </label>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* ===== ABA: Banco ===== */}
                {abaAtiva === 'banco' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className={labelClass}>Banco</label>
                        <input type="text" className={inputClass} value={formData.banco} onChange={(e) => handleChange('banco', e.target.value)} placeholder="Ex: Bradesco, Itau, Banco do Brasil..." />
                      </div>
                      <div>
                        <label className={labelClass}>Agencia</label>
                        <input type="text" className={inputClass} value={formData.agencia} onChange={(e) => handleChange('agencia', e.target.value)} />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className={labelClass}>Conta</label>
                        <input type="text" className={inputClass} value={formData.conta} onChange={(e) => handleChange('conta', e.target.value)} />
                      </div>
                      <div>
                        <label className={labelClass}>Tipo de Conta</label>
                        <select className={selectClass} value={formData.tipo_conta} onChange={(e) => handleChange('tipo_conta', e.target.value)}>
                          <option value="">Selecione...</option>
                          <option value="corrente">Conta Corrente</option>
                          <option value="poupanca">Poupanca</option>
                          <option value="salario">Conta Salario</option>
                        </select>
                      </div>
                      <div>
                        <label className={labelClass}>Chave PIX</label>
                        <input type="text" className={inputClass} value={formData.pix} onChange={(e) => handleChange('pix', e.target.value)} placeholder="CPF, email, telefone ou chave aleatoria" />
                      </div>
                    </div>
                  </div>
                )}

                {/* ===== ABA: Beneficios (dinamico - vem de Configuracoes RH > Beneficios) ===== */}
                {abaAtiva === 'beneficios' && (
                  <div className="space-y-3">
                    {beneficiosDisponiveis.length === 0 ? (
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
                        Nenhum beneficio cadastrado. Vá em <strong>Configurações RH → Benefícios</strong> para criar.
                      </div>
                    ) : beneficiosDisponiveis.map(ben => {
                      const selecionado = (formData.beneficios_ids || []).includes(ben.id);
                      return (
                        <div key={ben.id} className={`rounded-lg p-4 border cursor-pointer transition ${selecionado ? 'bg-orange-50 border-orange-300' : 'bg-gray-50 border-gray-200 hover:border-orange-200'}`}>
                          <label className="flex items-center gap-3 cursor-pointer">
                            <input
                              type="checkbox"
                              className="w-5 h-5 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
                              checked={selecionado}
                              onChange={(e) => {
                                const atuais = formData.beneficios_ids || [];
                                const novos = e.target.checked
                                  ? [...atuais, ben.id]
                                  : atuais.filter(id => id !== ben.id);
                                handleChange('beneficios_ids', novos);
                              }}
                            />
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-gray-900">{ben.nome}</span>
                                {ben.valor != null && ben.valor !== '' && (
                                  <span className="text-xs font-semibold text-orange-700 bg-orange-100 px-2 py-0.5 rounded-full">
                                    {Number(ben.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                  </span>
                                )}
                              </div>
                              {ben.descricao && <p className="text-xs text-gray-500 mt-0.5">{ben.descricao}</p>}
                            </div>
                          </label>
                        </div>
                      );
                    })}
                  </div>
                )}

                {abaAtiva === 'ponto' && (
                  <div className="space-y-4">
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
                      ⏰ Configurações de <strong>Cartão de Ponto</strong> deste colaborador.
                    </div>
                    <label className={`flex items-start gap-3 rounded-lg p-4 border cursor-pointer transition ${formData.nao_bate_ponto ? 'bg-amber-50 border-amber-300' : 'bg-gray-50 border-gray-200 hover:border-amber-200'}`}>
                      <input
                        type="checkbox"
                        className="w-5 h-5 mt-0.5 text-amber-600 border-gray-300 rounded focus:ring-amber-500"
                        checked={!!formData.nao_bate_ponto}
                        onChange={(e) => handleChange('nao_bate_ponto', e.target.checked)}
                      />
                      <div className="flex-1">
                        <span className="text-sm font-semibold text-gray-900">Colaborador não bate ponto</span>
                        <p className="text-xs text-gray-500 mt-0.5">
                          Marque para cargos de confiança / colaboradores que não registram marcações no relógio.
                          Quando marcado, este colaborador é <strong>excluído dos indicadores de ponto</strong>
                          (absenteísmo, faltas, atrasos, ranking) — senão apareceria como 100% ausente.
                        </p>
                      </div>
                    </label>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between flex-shrink-0 rounded-b-xl">
                <div className="text-sm text-gray-500">
                  {abaAtiva !== 'pessoais' && (
                    <button
                      type="button"
                      onClick={() => {
                        const idx = abas.findIndex(a => a.id === abaAtiva);
                        if (idx > 0) setAbaAtiva(abas[idx - 1].id);
                      }}
                      className="text-orange-600 hover:text-orange-800 font-medium"
                    >
                      ← Aba anterior
                    </button>
                  )}
                </div>
                <div className="flex gap-3">
                  {abaAtiva !== abas[abas.length - 1].id && (
                    <button
                      type="button"
                      onClick={() => {
                        const idx = abas.findIndex(a => a.id === abaAtiva);
                        if (idx < abas.length - 1) setAbaAtiva(abas[idx + 1].id);
                      }}
                      className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-medium transition-colors text-sm"
                    >
                      Proxima aba →
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={fecharModal}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors text-sm"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={salvando}
                    className="px-6 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  >
                    {salvando ? 'Salvando...' : (editando ? 'Atualizar' : 'Cadastrar')}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}