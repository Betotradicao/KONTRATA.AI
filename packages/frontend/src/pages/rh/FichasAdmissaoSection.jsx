import { useState, useEffect } from 'react';
import { api } from '../../utils/api';
import toast, { Toaster } from 'react-hot-toast';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

// Formata data-only (YYYY-MM-DD) como DD/MM/YYYY SEM passar pelo fuso do Date.
// `new Date("1996-06-10")` = meia-noite UTC → no BR (UTC-3) volta 1 dia. Extraímos
// os componentes literais da string; só caímos no Date pra formatos não-ISO.
function fmtDateBR(d) {
  if (!d) return '____';
  const m = String(d).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  try { return new Date(d).toLocaleDateString('pt-BR'); } catch { return d; }
}

// Monta o HTML (style + conteúdo) da Ficha de Admissão. Reutilizado tanto na
// impressão (window.print) quanto na geração de PDF pra anexar em e-mail.
// `fotoOverride` permite injetar a foto já como dataURL (evita CORS no html2canvas).
function buildFichaHtml(ficha, fotoOverride) {
  const cd = ficha.candidato_dados || {};
  const pess = cd.dados_pessoais || {};
  const end = cd.endereco || {};
  const cont = cd.contato || {};
  const doc = cd.documentos || {};
  const bnc = cd.banco || {};
  const opc = cd.opcoes_candidato || {};
  const conj = cd.conjuge || {};
  const estr = cd.estrangeiro || {};
  const deps = Array.isArray(cd.dependentes) ? cd.dependentes : [];

  const fmt = (v) => (v ?? '') === '' ? '____' : String(v);
  const fmtDate = fmtDateBR;
  const fmtBool = (b) => (b === true || b === 'SIM') ? '✓ Sim' : (b === false || b === 'NAO') ? '✗ Não' : '____';
  const fotoSrc = fotoOverride || cd.foto_url;
  const fotoHtml = fotoSrc
    ? `<img src="${fotoSrc}" style="width:80px;height:80px;border-radius:50%;object-fit:cover;border:2px solid #6d28d9"/>`
    : '<div style="width:80px;height:80px;border-radius:50%;background:#eee;display:flex;align-items:center;justify-content:center;font-size:24px">📷</div>';

  const linha = (lbl, val) => `<div style="font-size:7pt;line-height:1.45;padding-bottom:2px;overflow-wrap:anywhere"><span style="color:#888;font-size:6pt;text-transform:uppercase">${lbl}: </span><strong>${fmt(val)}</strong></div>`;
  // Versão de largura total (linha inteira) — pra campos de texto longo (nomes)
  // que ficariam apertados/encavalados numa célula estreita da grade.
  const linhaW = (lbl, val) => `<div style="grid-column:1 / -1;font-size:7pt;line-height:1.45;padding-bottom:2px;overflow-wrap:anywhere"><span style="color:#888;font-size:6pt;text-transform:uppercase">${lbl}: </span><strong>${fmt(val)}</strong></div>`;

  return `<style>
  @page { size: A4; margin: 8mm }
  body { font-family: Arial, sans-serif; font-size: 7.5pt; color: #222; margin: 0; line-height: 1.3 }
  h1 { font-size: 11pt; text-align: center; margin: 0 0 2px; color: #6d28d9 }
  h2 { font-size: 8pt; margin: 7px 0 3px; padding: 2px 6px; background: #f3e8ff; color: #6d28d9; border-left: 3px solid #6d28d9 }
  .header { display: flex; gap: 10px; align-items: center; border-bottom: 1.5px solid #6d28d9; padding-bottom: 5px; margin-bottom: 4px }
  .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 5px 16px; align-items: start }
  .grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 5px 16px; align-items: start }
  .grid-2 { display: grid; grid-template-columns: repeat(2, 1fr); gap: 5px 16px; align-items: start }
  .dep { border: 1px solid #ddd; padding: 3px 5px; margin-top: 3px; border-radius: 3px }
  .sig { margin-top: 14px; display: grid; grid-template-columns: 1fr 1fr; gap: 24px }
  .sig div { border-top: 1px solid #000; padding-top: 2px; text-align: center; font-size: 7pt }
  table { width: 100%; border-collapse: collapse; font-size: 7pt }
  td { padding: 1px 3px }
  .header img, .header div[style*="border-radius"] { width: 60px !important; height: 60px !important }
</style>
  <div class="header">
    ${fotoHtml}
    <div style="flex:1">
      <h1>FICHA DE ADMISSÃO</h1>
      <div style="text-align:center;font-size:7.5pt"><strong>${fmt(ficha.candidato_nome)}</strong> — ${fmt(ficha.cargo_nome)}</div>
      <div style="text-align:center;font-size:6.5pt;color:#666">${fmt(ficha.empresa_nome)} ${ficha.empresa_cnpj ? `· CNPJ ${ficha.empresa_cnpj}` : ''}</div>
    </div>
  </div>

  <h2>Dados da contratação (RH)</h2>
  <div class="grid">
    ${linha('Empresa', ficha.empresa_nome)}
    ${linha('Cargo', ficha.cargo_nome)}
    ${linha('Departamento', ficha.departamento_nome)}
    ${linha('Data de envio', fmtDate(ficha.data_admissao))}
    ${linha('Salário', ficha.salario ? `R$ ${Number(ficha.salario).toFixed(2)}` : '')}
    ${linha('Entrada', ficha.horario_entrada)}
    ${linha('Intervalo', `${ficha.horario_intervalo_inicio || ''} às ${ficha.horario_intervalo_fim || ''}`)}
    ${linha('Saída', ficha.horario_saida)}
  </div>

  <h2>Dados pessoais</h2>
  <div class="grid">
    ${linhaW('Nome completo', pess.nome)}
    ${linha('CPF', pess.cpf)}
    ${linha('RG', pess.rg)}
    ${linha('RG Órgão', pess.rg_orgao_emissor)}
    ${linha('RG UF', pess.rg_uf)}
    ${linha('RG Emissão', fmtDate(pess.rg_emissao))}
    ${linha('Data nasc.', fmtDate(pess.data_nascimento))}
    ${linha('Sexo', pess.sexo)}
    ${linha('Estado civil', pess.estado_civil)}
    ${linha('Nacionalidade', pess.nacionalidade)}
    ${linha('Naturalidade', pess.naturalidade)}
    ${linha('Naturalidade UF', pess.naturalidade_uf)}
    ${linhaW('Nome do pai', pess.nome_pai)}
    ${linhaW('Nome da mãe', pess.nome_mae)}
    ${linha('Raça/Cor', pess.raca_cor)}
    ${linha('Tipo sanguíneo', pess.tipo_sanguineo)}
    ${linha('Altura', pess.altura)}
    ${linha('Peso', pess.peso)}
    ${linha('Cor cabelos', pess.cor_cabelos)}
    ${linha('Cor olhos', pess.cor_olhos)}
    ${linha('Deficiência', pess.deficiente)}
  </div>

  ${(pess.estado_civil === 'CASADO' || pess.estado_civil === 'UNIAO_ESTAVEL') ? `
  <h2>Cônjuge</h2>
  <div class="grid">
    ${linhaW('Nome', conj.nome)}
    ${linha('CPF', conj.cpf)}
    ${linha('Data nasc.', fmtDate(conj.data_nascimento))}
    ${linha('Data casamento', fmtDate(conj.data_casamento))}
  </div>` : ''}

  ${(pess.nacionalidade && !String(pess.nacionalidade).toUpperCase().includes('BRASIL')) ? `
  <h2>Estrangeiro</h2>
  <div class="grid">
    ${linha('País', estr.pais_nacionalidade)}
    ${linha('Condição ingresso', estr.condicao_ingresso)}
    ${linha('Data chegada', fmtDate(estr.data_chegada))}
    ${linha('Filhos c/ brasileiro', fmtBool(estr.filhos_brasileiros))}
    ${linha('Quantos', estr.filhos_brasileiros_qtd)}
    ${linha('Casado c/ brasileiro', fmtBool(estr.casado_brasileiro))}
    ${linha('Portaria naturalização', estr.portaria_naturalizacao)}
    ${linha('Data naturalização', fmtDate(estr.data_naturalizacao))}
  </div>` : ''}

  <h2>Contato</h2>
  <div class="grid-3">
    ${linha('Telefone', cont.telefone)}
    ${linha('Celular', cont.celular)}
    ${linha('E-mail', cont.email)}
  </div>

  <h2>Endereço</h2>
  <div class="grid">
    ${linha('CEP', end.cep)}
    ${linha('Rua', end.rua)}
    ${linha('Nº', end.numero)}
    ${linha('Complemento', end.complemento)}
    ${linha('Bairro', end.bairro)}
    ${linha('Cidade', end.cidade)}
    ${linha('UF', end.estado)}
  </div>

  <h2>Documentos</h2>
  <div class="grid">
    ${linha('CTPS', doc.ctps)}
    ${linha('CTPS Série', doc.serie_ctps)}
    ${linha('CTPS UF', doc.ctps_uf)}
    ${linha('CTPS Emissão', fmtDate(doc.ctps_emissao))}
    ${linha('PIS/PASEP', doc.pis_pasep)}
    ${linha('Tít. Eleitor', doc.titulo_eleitor)}
    ${linha('Zona', doc.titulo_zona)}
    ${linha('Seção', doc.titulo_secao)}
    ${linha('Tít. Emissão', fmtDate(doc.titulo_emissao))}
    ${linhaW('Reservista', doc.reservista)}
    ${linha('Reserv. UF', doc.reservista_uf)}
    ${linha('Reserv. Emissão', fmtDate(doc.reservista_emissao))}
    ${linha('CNH', doc.cnh)}
    ${linha('CNH Cat.', doc.cnh_categoria)}
    ${linha('CNH UF', doc.cnh_uf)}
    ${linha('CNH Validade', fmtDate(doc.cnh_validade))}
  </div>

  <h2>Dados bancários</h2>
  <div class="grid">
    ${linha('Banco', bnc.banco)}
    ${linha('Agência', bnc.agencia)}
    ${linha('Conta', bnc.conta)}
    ${linha('Tipo', bnc.tipo_conta)}
    ${linha('PIX', bnc.pix)}
  </div>

  ${deps.length > 0 ? `
  <h2>Dependentes (${deps.length})</h2>
  ${deps.map((d, i) => `
    <div class="dep">
      <div style="font-weight:bold;color:#6d28d9">Dependente ${i + 1}: ${fmt(d.nome)} (${fmt(d.parentesco)})</div>
      <div class="grid">
        ${linha('Sexo', d.sexo)}
        ${linha('CPF', d.cpf)}
        ${linha('Data nasc.', fmtDate(d.data_nascimento))}
        ${linhaW('Certidão Nº', d.certidao_numero)}
        ${linhaW('Cartório', d.certidao_cartorio)}
        ${linha('Data certidão', fmtDate(d.certidao_data))}
        ${linha('Folha', d.certidao_folha)}
        ${linha('Dep. IR', fmtBool(d.dependente_ir))}
        ${linha('Sal. família', fmtBool(d.dependente_sf))}
      </div>
    </div>
  `).join('')}` : ''}

  <h2>Opções do candidato</h2>
  <div class="grid-3">
    ${linha('1º emprego', fmtBool(opc.primeiro_emprego))}
    ${linha('Contribuição Sindical', fmtBool(opc.contribuicao_sindical))}
    ${linha('Vale Transporte', fmtBool(opc.vale_transporte))}
  </div>

  <div class="sig">
    <div>${fmt(pess.nome || ficha.candidato_nome)}<br/><span style="font-size:8pt;color:#666">Assinatura do candidato</span></div>
    <div>____________________________<br/><span style="font-size:8pt;color:#666">Responsável de RH</span></div>
  </div>`;
}

// Busca a foto do candidato e converte pra dataURL (evita canvas "tainted" por
// CORS ao gerar o PDF). Se falhar, retorna null e o PDF usa o placeholder 📷.
async function fotoComoDataUrl(url) {
  if (!url) return null;
  try {
    const resp = await fetch(url, { mode: 'cors' });
    const blob = await resp.blob();
    return await new Promise((resolve) => {
      const r = new FileReader();
      r.onloadend = () => resolve(r.result);
      r.onerror = () => resolve(null);
      r.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

// Gera o PDF (A4, multipágina) da ficha e devolve em dataURL (data:application/pdf;base64,...)
async function gerarPdfFicha(ficha) {
  const fotoData = await fotoComoDataUrl((ficha.candidato_dados || {}).foto_url);
  const container = document.createElement('div');
  container.style.cssText = 'position:fixed;left:-99999px;top:0;width:794px;background:#fff;padding:30px;box-sizing:border-box;';
  container.innerHTML = buildFichaHtml(ficha, fotoData);
  document.body.appendChild(container);
  try {
    const canvas = await html2canvas(container, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const imgH = (canvas.height * pageW) / canvas.width;
    let heightLeft = imgH;
    let position = 0;
    const imgData = canvas.toDataURL('image/jpeg', 0.92);
    pdf.addImage(imgData, 'JPEG', 0, position, pageW, imgH);
    heightLeft -= pageH;
    while (heightLeft > 0) {
      position -= pageH;
      pdf.addPage();
      pdf.addImage(imgData, 'JPEG', 0, position, pageW, imgH);
      heightLeft -= pageH;
    }
    return pdf.output('datauristring');
  } finally {
    document.body.removeChild(container);
  }
}

/**
 * Ficha de Admissão (1ª FASE CONTRATAÇÃO).
 * - RH cria uma ficha com dados de contratação usando dropdowns dos cadastros.
 * - Gera link público pro candidato preencher dados pessoais (FASE B).
 * - Depois vira colaborador com 1 clique (FASE B).
 */
// Filtros da lista de fichas. Mantém "Todas" como escape: sem ele, ficha em
// rascunho/cancelada ficaria invisível pra sempre, já que a tela abre filtrada.
// Tipos de exame do "GUIA - EXAME OCUPACIONAL". A ordem e as chaves espelham
// TIPOS_EXAME em packages/backend/src/services/guia-exame.service.ts — se mexer
// aqui, mexa la tambem (o backend valida a chave recebida).
// Mascaras de digitacao do agendamento: o RH digita so numeros e a
// pontuacao aparece sozinha. Data e hora ficam em campos separados pra
// dar pra preencher a data mesmo sem ter o horario fechado ainda.
const mascaraData = (v) => {
  const d = String(v || '').replace(/[^0-9]/g, '').slice(0, 8);
  let out = d.slice(0, 2);
  if (d.length > 2) out += '/' + d.slice(2, 4);
  if (d.length > 4) out += '/' + d.slice(4, 8);
  return out;
};
const mascaraHora = (v) => {
  const d = String(v || '').replace(/[^0-9]/g, '').slice(0, 4);
  return d.length > 2 ? d.slice(0, 2) + ':' + d.slice(2, 4) : d;
};
// O documento recebe os dois juntos: "25/08/2026 09:30".
const juntarAgendamento = (data, hora) => [data, hora].filter(Boolean).join(' ').trim();

const TIPOS_EXAME = [
  { key: 'admissional',    label: 'Admissional' },
  { key: 'demissional',    label: 'Demissional' },
  { key: 'periodico',      label: 'Periódico' },
  { key: 'mudanca_funcao', label: 'Mudança de Função' },
  { key: 'retorno',        label: 'Retorno ao Trabalho' },
  { key: 'avaliacao',      label: 'Avaliação Médica' },
  { key: 'altura',         label: 'Trabalho em Altura' },
  { key: 'confinado',      label: 'Trabalho em Espaço Confinado' },
  { key: 'outro',          label: 'Outro' },
];

const FILTROS_STATUS = [
  { key: 'todas',                label: 'Todas' },
  { key: 'aguardando_candidato', label: 'Aguardando candidato' },
  { key: 'preenchida',           label: 'Preenchida' },
  { key: 'colaborador_criado',   label: 'Colaborador criado' },
];

export default function FichasAdmissaoSection() {
  const [fichas, setFichas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);
  const [fichaEditando, setFichaEditando] = useState(null);
  const [emailModal, setEmailModal] = useState(null); // { ficha, gerando, enviando, pdf, destinatarios, to, assunto, corpo }
  const [guiaModal, setGuiaModal] = useState(null);  // Guia de Exame Ocupacional

  // Cadastros (dropdowns)
  const [linkGerado, setLinkGerado] = useState(null); // { url, nome } ou null — modal de copiar link
  const [filtroStatus, setFiltroStatus] = useState('aguardando_candidato'); // abre já filtrado: é a fila que o RH precisa cobrar
  const [fotoExpandida, setFotoExpandida] = useState(null); // { url, nome } ou null — lightbox da foto

  // ESC fecha a foto ampliada (mesmo comportamento do Banco de Currículos).
  // Só escuta enquanto está aberta pra não roubar o ESC dos outros modais.
  useEffect(() => {
    if (!fotoExpandida) return;
    const onKey = (e) => { if (e.key === 'Escape') setFotoExpandida(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fotoExpandida]);
  const [empresas, setEmpresas] = useState([]);
  const [cargos, setCargos] = useState([]);
  const [departamentos, setDepartamentos] = useState([]);
  const [jornadas, setJornadas] = useState([]);
  const [escalas, setEscalas] = useState([]);
  const [escalasDomingo, setEscalasDomingo] = useState([]);
  const [regimes, setRegimes] = useState([]);
  const [prazos, setPrazos] = useState([]);
  const [formasPgto, setFormasPgto] = useState([]);

  const carregarFichas = async () => {
    try {
      const r = await api.get('/rh/fichas-admissao');
      setFichas(Array.isArray(r.data) ? r.data : []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const carregarCadastros = async () => {
    try {
      const [emp, ca, dep, jo, es, ed, re, pr, fp] = await Promise.all([
        api.get('/rh/empresas').catch(() => ({ data: [] })),
        api.get('/rh/configuracoes/cargos').catch(() => ({ data: [] })),
        api.get('/rh/configuracoes/departamentos').catch(() => ({ data: [] })),
        api.get('/rh/configuracoes/jornadas').catch(() => ({ data: [] })),
        api.get('/rh/configuracoes/escalas').catch(() => ({ data: [] })),
        api.get('/rh/configuracoes/escalas-domingo').catch(() => ({ data: [] })),
        api.get('/rh/configuracoes/regimes-trabalho').catch(() => ({ data: [] })),
        api.get('/rh/configuracoes/prazos-experiencia').catch(() => ({ data: [] })),
        api.get('/rh/configuracoes/formas-pagamento').catch(() => ({ data: [] })),
      ]);
      const arr = d => Array.isArray(d?.data) ? d.data : [];
      setEmpresas(arr(emp));
      setCargos(arr(ca));
      setDepartamentos(arr(dep));
      setJornadas(arr(jo));
      setEscalas(arr(es));
      setEscalasDomingo(arr(ed));
      setRegimes(arr(re));
      setPrazos(arr(pr));
      setFormasPgto(arr(fp));
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    carregarFichas();
    carregarCadastros();
  }, []);

  const novaFicha = () => {
    setFichaEditando({
      candidato_nome: '', candidato_email: '', candidato_celular: '',
      company_id: empresas.length === 1 ? empresas[0].id : '',
      data_admissao: '', cargo_id: '', departamento_id: '', jornada_id: '',
      escala_id: '', escala_domingo_id: '', regime_trabalho_id: '',
      prazo_experiencia_id: '', forma_pagamento_id: '', salario: '',
      horario_entrada: '', horario_intervalo_inicio: '', horario_intervalo_fim: '', horario_saida: '',
      primeiro_emprego: false, contribuicao_sindical: false, vale_transporte: false,
    });
    setModalAberto(true);
  };

  const abrirFicha = (f) => { setFichaEditando({ ...f }); setModalAberto(true); };

  const salvar = async () => {
    const f = fichaEditando;
    // Validação: TODOS os campos obrigatórios pra criar a ficha
    const obrigatorios = [
      [f.candidato_nome,          'Nome completo do candidato'],
      [f.candidato_celular,       'Celular'],
      [f.company_id,              'Empresa'],
      [f.data_admissao,           'Data de Envio'],
      [f.cargo_id,                'Cargo / Função'],
      [f.departamento_id,         'Departamento'],
      [f.salario,                 'Salário'],
      [f.prazo_experiencia_id,    'Prazo de Experiência'],
      [f.forma_pagamento_id,      'Forma de Pagamento'],
      [f.regime_trabalho_id,      'Regime de Trabalho'],
      [f.horario_entrada,            'Horário de Entrada'],
      [f.horario_intervalo_inicio,   'Intervalo — Início'],
      [f.horario_intervalo_fim,      'Intervalo — Fim'],
      [f.horario_saida,              'Horário de Saída'],
      [f.jornada_id,              'Jornada'],
      [f.escala_id,               'Escala'],
      [f.escala_domingo_id,       'Escala Domingo'],
    ];
    for (const [valor, label] of obrigatorios) {
      if (!String(valor ?? '').trim()) { toast.error(`Preencha o campo: ${label}`); return; }
    }
    try {
      // Limpa strings vazias pra null (FKs)
      const payload = { ...f };
      ['company_id','cargo_id','departamento_id','jornada_id','escala_id','escala_domingo_id',
       'regime_trabalho_id','prazo_experiencia_id','forma_pagamento_id','data_admissao','salario',
       'horario_intervalo_inicio','horario_intervalo_fim'
      ].forEach(k => { if (payload[k] === '') payload[k] = null; });

      if (f.id) {
        await api.put(`/rh/fichas-admissao/${f.id}`, payload);
        toast.success('Ficha atualizada');
      } else {
        await api.post('/rh/fichas-admissao', payload);
        toast.success('Ficha criada');
      }
      setModalAberto(false);
      setFichaEditando(null);
      carregarFichas();
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Erro ao salvar');
    }
  };

  const excluir = async (id) => {
    if (!window.confirm('Excluir esta ficha?')) return;
    try {
      await api.delete(`/rh/fichas-admissao/${id}`);
      toast.success('Excluída');
      carregarFichas();
    } catch { toast.error('Erro ao excluir'); }
  };

  // ── Guia de Exame Ocupacional ────────────────────────────────────────
  // O .docx e montado no BACKEND (o template mora la). O mesmo blob serve
  // pro download e pro anexo do e-mail — nao gera duas vezes.
  const abrirGuia = async (f) => {
    let cfg = {};
    let texto = { assunto: "", corpo: "" };
    try {
      const { data } = await api.get("/configurations");
      try { cfg = JSON.parse(data.guia_exame_config || "{}"); } catch { cfg = {}; }
      try { texto = (JSON.parse(data.email_textos_padrao || "{}")).guia_exame || texto; } catch { /* usa vazio */ }
    } catch { /* sem config o RH ainda consegue baixar o .docx */ }
    setGuiaModal({
      ficha: f, cfg, texto, ocupado: false,
      tipoExame: "admissional", outroDesc: "", agendadoData: "", agendadoHora: "",
      riscoFisico: "", riscoQuimico: "", riscoBiologico: "", riscoOutros: "",
    });
  };

  const rotuloTipo = (k) => (TIPOS_EXAME.find((t) => t.key === k) || {}).label || "Exame";

  const nomeDoArquivo = (g) => {
    const pessoa = String(g.ficha.candidato_nome || "Candidato")
      .replace(/[\\\\/:*?\"<>|]/g, "").trim();
    return "Guia Exame - " + rotuloTipo(g.tipoExame) + " - " + pessoa + ".docx";
  };

  const gerarGuiaBlob = async (g) => {
    const r = await api.post(`/rh/fichas-admissao/${g.ficha.id}/guia-exame`, {
      tipoExame: g.tipoExame, outroDesc: g.outroDesc,
      agendado: juntarAgendamento(g.agendadoData, g.agendadoHora),
      riscoFisico: g.riscoFisico, riscoQuimico: g.riscoQuimico,
      riscoBiologico: g.riscoBiologico, riscoOutros: g.riscoOutros,
    }, { responseType: "blob" });
    return r.data;
  };

  const baixarGuia = async () => {
    if (!guiaModal) return;
    setGuiaModal((g) => ({ ...g, ocupado: true }));
    try {
      const blob = await gerarGuiaBlob(guiaModal);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = nomeDoArquivo(guiaModal);
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
      toast.success("Guia gerado!");
    } catch {
      toast.error("Erro ao gerar o guia");
    } finally {
      setGuiaModal((g) => (g ? { ...g, ocupado: false } : g));
    }
  };

  const enviarGuiaEmail = async () => {
    if (!guiaModal) return;
    const g = guiaModal;
    const para = (g.cfg.email || "").trim();
    if (!para) {
      toast.error("Cadastre o e-mail da clínica em Configurações → E-mails Padronizados → Medicina do Trabalho");
      return;
    }
    setGuiaModal((x) => ({ ...x, ocupado: true }));
    try {
      const blob = await gerarGuiaBlob(g);
      const base64 = await new Promise((res, rej) => {
        const fr = new FileReader();
        fr.onload = () => res(String(fr.result).replace(/^data:[^,]+,/, ""));
        fr.onerror = rej;
        fr.readAsDataURL(blob);
      });
      const tipoLabel = rotuloTipo(g.tipoExame);
      const trocar = (txt) => String(txt || "")
        .split("{NOME}").join(g.ficha.candidato_nome || "")
        .split("{CARGO}").join(g.ficha.cargo_nome || "")
        .split("{EMPRESA}").join(g.ficha.empresa_nome || "")
        .split("{RESPONSAVEL}").join(g.cfg.responsavel || "")
        .split("{TIPO_EXAME}").join(tipoLabel)
        .split("{AGENDADO}").join(juntarAgendamento(g.agendadoData, g.agendadoHora) || "a combinar");
      await api.post("/rh/email-doc/enviar", {
        to: para,
        subject: trocar(g.texto.assunto) || ("Exame " + tipoLabel),
        body: trocar(g.texto.corpo),
        attachment: {
          filename: nomeDoArquivo(g),
          base64,
          contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        },
      });
      toast.success("Guia enviado para " + para);
      setGuiaModal(null);
    } catch (e) {
      toast.error(e?.response?.data?.error || "Erro ao enviar o e-mail");
      setGuiaModal((x) => (x ? { ...x, ocupado: false } : x));
    }
  };
  const gerarLink = async (ficha) => {
    try {
      const r = await api.post(`/rh/fichas-admissao/${ficha.id}/gerar-link`);
      const url = `${window.location.origin}/admissao/${r.data.public_token}`;
      // Tenta copiar automaticamente já (best-effort)
      await navigator.clipboard.writeText(url).catch(() => {});
      setLinkGerado({
        url,
        nome: ficha.candidato_nome,
        celular: ficha.candidato_celular,
        email: ficha.candidato_email,
      });
      carregarFichas();
    } catch { toast.error('Erro ao gerar link'); }
  };

  // Monta link do WhatsApp direto pro chat do candidato (se tiver celular).
  // Antes usava wa.me/ que redirecionava pra tela intermediaria
  // "Compartilhar no WhatsApp" (api.whatsapp.com/send) com botoes
  // "Abrir app"/"Continuar para Web" — irritante. Agora detecta mobile vs
  // desktop e usa o endpoint que vai DIRETO pra conversa em cada caso.
  const buildWhatsAppUrl = (celular, mensagem) => {
    const digits = String(celular || '').replace(/\D/g, '');
    const tel = digits ? (digits.startsWith('55') ? digits : `55${digits}`) : '';
    const txt = encodeURIComponent(mensagem);
    if (!tel) return `https://wa.me/?text=${txt}`;
    const isMobile = typeof navigator !== 'undefined'
      && /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent || '');
    return isMobile
      ? `https://api.whatsapp.com/send?phone=${tel}&text=${txt}`
      : `https://web.whatsapp.com/send?phone=${tel}&text=${txt}`;
  };

  // Imprime/Salva em PDF a ficha de admissão completa (RH + candidato).
  // Abre uma nova janela com layout A4 — o dialogo de impressao do browser
  // permite "Salvar como PDF" nativamente. Inclui foto, dados de contratação,
  // dados pessoais, endereço, documentos, banco, dependentes, opções.
  const imprimirFicha = (ficha) => {
    const w = window.open('', '_blank', 'width=900,height=700');
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><title>Ficha de Admissão - ${ficha.candidato_nome || ''}</title></head><body>${buildFichaHtml(ficha)}<script>window.onload=()=>{setTimeout(()=>window.print(),300)}</script></body></html>`);
    w.document.close();
  };

  // ===== Envio da Ficha Cadastral por e-mail =====
  // Abre o modal, carrega destinatários + texto padrão (configurations) e gera o PDF.
  const abrirEnviarEmail = async (ficha) => {
    setEmailModal({ ficha, gerando: true, enviando: false, pdf: null, destinatarios: [], to: '', assunto: '', corpo: '', responsaveis: [], responsavel: '' });
    try {
      const { data } = await api.get('/configurations');
      let dest = [];
      try { dest = JSON.parse(data.email_destinatarios || '[]'); } catch { dest = []; }
      dest = (Array.isArray(dest) ? dest : []).filter((d) => d.email);
      let textos = {};
      try { textos = JSON.parse(data.email_textos_padrao || '{}'); } catch { textos = {}; }
      const t = textos.ficha_cadastral || {};

      // Usuários administrativos (Liberação de Acesso) -> opções de {RESPONSAVEL}
      let responsaveis = [];
      try {
        const emp = await api.get('/employees?limit=200');
        responsaveis = (emp.data?.data || []).map((e) => e.name).filter(Boolean);
      } catch { responsaveis = []; }
      const responsavel = responsaveis[0] || '';

      // Substitui NOME/CARGO/EMPRESA (fixos). {RESPONSAVEL} fica no "base" e é
      // aplicado conforme o responsável escolhido no dropdown.
      const subst = (s) => String(s || '')
        .replace(/\{NOME\}/g, ficha.candidato_nome || '')
        .replace(/\{CARGO\}/g, ficha.cargo_nome || '')
        .replace(/\{EMPRESA\}/g, ficha.empresa_nome || '');
      const aplicaResp = (s) => String(s || '').replace(/\{RESPONSAVEL\}/g, responsavel);

      const assuntoBase = subst(t.assunto || `Ficha Cadastral - ${ficha.candidato_nome || ''}`);
      const corpoBase = subst(t.corpo || `Olá,\n\nSegue em anexo a Ficha Cadastral do colaborador ${ficha.candidato_nome || ''}.\n\nAtenciosamente,\n{RESPONSAVEL}`);

      const pdf = await gerarPdfFicha(ficha);
      setEmailModal((m) => (m && m.ficha === ficha ? {
        ...m,
        gerando: false,
        pdf,
        destinatarios: dest,
        to: dest[0]?.email || '',
        responsaveis,
        responsavel,
        assuntoBase,
        corpoBase,
        assunto: aplicaResp(assuntoBase),
        corpo: aplicaResp(corpoBase),
      } : m));
    } catch (e) {
      console.error('Erro ao preparar envio de e-mail:', e);
      toast.error('Erro ao gerar o PDF da ficha');
      setEmailModal(null);
    }
  };

  const enviarEmailFicha = async () => {
    if (!emailModal) return;
    const { to, assunto, corpo, pdf, ficha, responsavel } = emailModal;
    if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) { toast.error('Informe um e-mail de destino válido'); return; }
    if (!String(assunto).trim()) { toast.error('Informe o assunto'); return; }
    if (!pdf) { toast.error('PDF ainda não foi gerado'); return; }
    setEmailModal((m) => ({ ...m, enviando: true }));
    try {
      // Limpa qualquer {RESPONSAVEL} remanescente (ex: editado à mão) com o nome escolhido
      const aplicaResp = (s) => String(s || '').replace(/\{RESPONSAVEL\}/g, responsavel || '');
      const nomeArq = `ficha-cadastral-${(ficha.candidato_nome || 'colaborador').replace(/\s+/g, '-').toLowerCase()}.pdf`;
      await api.post('/rh/enviar-documento-email', {
        to,
        subject: aplicaResp(assunto),
        body: aplicaResp(corpo),
        attachment: { filename: nomeArq, base64: pdf, contentType: 'application/pdf' },
      });
      toast.success('E-mail enviado com sucesso!');
      setEmailModal(null);
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Erro ao enviar e-mail');
      setEmailModal((m) => (m ? { ...m, enviando: false } : m));
    }
  };

  const copiarLink = async (url) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Link copiado!');
    } catch {
      // Fallback: seleciona o texto do input
      const input = document.getElementById('input-link-publico');
      if (input) { input.select(); document.execCommand('copy'); toast.success('Link copiado!'); }
    }
  };

  const criarColaborador = async (id) => {
    if (!window.confirm('Cadastrar este candidato como colaborador ativo? Os dados da ficha serão copiados para o cadastro.')) return;
    try {
      const r = await api.post(`/rh/fichas-admissao/${id}/criar-colaborador`);
      toast.success(`Colaborador criado! (id ${r.data.colaborador_id})`);
      carregarFichas();
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Erro ao cadastrar colaborador');
    }
  };

  const statusBadge = (status) => {
    const map = {
      rascunho:              { label: 'Rascunho',          cls: 'bg-gray-200 text-gray-700' },
      aguardando_candidato:  { label: 'Aguardando candidato', cls: 'bg-amber-100 text-amber-800' },
      preenchida:            { label: 'Preenchida',       cls: 'bg-blue-100 text-blue-800' },
      colaborador_criado:    { label: 'Colaborador criado', cls: 'bg-emerald-100 text-emerald-800' },
      cancelada:             { label: 'Cancelada',          cls: 'bg-red-100 text-red-700' },
    };
    const m = map[status] || map.rascunho;
    return <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${m.cls}`}>{m.label}</span>;
  };

  const contaStatus = (key) => key === 'todas' ? fichas.length : fichas.filter(f => f.status === key).length;
  const fichasFiltradas = filtroStatus === 'todas' ? fichas : fichas.filter(f => f.status === filtroStatus);

  if (loading) return <div className="p-8 text-center text-gray-400">Carregando fichas...</div>;

  return (
    <div className="space-y-3">
      <Toaster position="top-right" />
      {/* Header com botão Nova Ficha */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
          <div>
            <h3 className="text-base font-bold text-gray-800">📋 Fichas de Admissão</h3>
            <p className="text-xs text-gray-500">RH preenche os dados de contratação; o candidato completa dados pessoais via link.</p>
          </div>
          {/* Filtro de status na mesma linha do botão — a contagem deixa claro
              que existem fichas fora do filtro ativo. */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {FILTROS_STATUS.map(op => {
              const ativo = filtroStatus === op.key;
              const n = contaStatus(op.key);
              return (
                <button key={op.key} type="button" onClick={() => setFiltroStatus(op.key)}
                  className={`inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full font-semibold border transition ${
                    ativo
                      ? 'bg-purple-600 border-purple-600 text-white shadow-sm'
                      : 'bg-white border-gray-300 text-gray-600 hover:border-purple-400 hover:text-purple-700'
                  }`}>
                  {op.label}
                  {/* Badge estilo notificação. Some no zero de propósito — bolinha
                      com "0" vira ruído visual e some o senso de "tem coisa aqui". */}
                  {n > 0 && (
                    <span className="inline-flex items-center justify-center min-w-[1.15rem] h-[1.15rem] px-1 rounded-full bg-emerald-500 text-white text-[10px] font-bold leading-none shadow-sm">
                      {n}
                    </span>
                  )}
                </button>
              );
            })}
            <button onClick={novaFicha}
              className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold px-4 py-2 rounded text-sm shadow ml-1">
              + Nova Ficha
            </button>
          </div>
        </div>

        {fichasFiltradas.length === 0 ? (
          <div className="text-center py-10 text-gray-400 text-sm">
            {fichas.length === 0 ? (
              <>Nenhuma ficha criada ainda. Clique em <strong>+ Nova Ficha</strong> pra começar.</>
            ) : (
              <>Nenhuma ficha com o status <strong>{FILTROS_STATUS.find(o => o.key === filtroStatus)?.label}</strong>.</>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {fichasFiltradas.map(f => (
              <div key={f.id} className="border border-gray-200 rounded-lg p-3 hover:border-emerald-300 transition">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {/* Avatar do candidato — usa a foto se houver, senão um placeholder */}
                    {f.candidato_dados?.foto_url ? (
                      <button type="button" title="Clique pra ampliar a foto"
                        onClick={() => setFotoExpandida({ url: f.candidato_dados.foto_url, nome: f.candidato_nome })}
                        className="flex-shrink-0 rounded-full focus:outline-none focus:ring-2 focus:ring-purple-400">
                        <img src={f.candidato_dados.foto_url} alt={f.candidato_nome}
                          className="w-12 h-12 rounded-full object-cover border-2 border-purple-200 cursor-pointer hover:border-purple-500 hover:brightness-90 transition" />
                      </button>
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 border-2 border-gray-200 flex-shrink-0 text-xl">
                        👤
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm text-gray-800 truncate">{f.candidato_nome}</span>
                        {statusBadge(f.status)}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {[f.cargo_nome, f.empresa_nome, f.data_admissao ? `Admissão: ${fmtDateBR(f.data_admissao)}` : null]
                          .filter(Boolean).join(' · ')}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <button onClick={() => abrirFicha(f)}
                      className="text-xs px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded font-semibold">✏️ Editar</button>
                    {f.status !== 'colaborador_criado' && (
                      <button onClick={() => gerarLink(f)}
                        className="text-xs px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded font-semibold">🔗 Link</button>
                    )}
                    {f.status === 'preenchida' && (
                      <button onClick={() => criarColaborador(f.id)}
                        className="text-xs px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded font-semibold">✅ Cadastrar colaborador</button>
                    )}
                    {/* Sem trava de status: o RH costuma agendar o exame junto com o
                        envio do link, antes do candidato preencher. Nesse caso os dados
                        pessoais saem em branco — o modal avisa quando for o caso. */}
                    <button onClick={() => abrirGuia(f)}
                      title="Gerar Guia de Exame Ocupacional pra medicina do trabalho"
                      className="text-xs px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded font-semibold">🩺 Guia</button>
                    <button onClick={() => excluir(f.id)}
                      className="text-xs px-2 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 rounded font-semibold">🗑️</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Lightbox da foto do candidato — clicar fora ou no Fechar sai.
          z acima dos outros modais pra funcionar mesmo aberto por cima deles. */}
      {fotoExpandida && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] p-4"
          onClick={() => setFotoExpandida(null)}>
          <div className="flex flex-col items-center gap-3" onClick={e => e.stopPropagation()}>
            <img src={fotoExpandida.url} alt={fotoExpandida.nome}
              className="max-w-[90vw] max-h-[75vh] object-contain rounded-lg shadow-2xl bg-white" />
            <div className="text-white text-sm font-semibold text-center">{fotoExpandida.nome}</div>
            <button onClick={() => setFotoExpandida(null)}
              className="px-8 py-2.5 bg-white/90 hover:bg-white text-gray-800 rounded-lg font-bold text-sm shadow-lg">
              Fechar
            </button>
            <div className="text-white/50 text-[11px]">ou aperte ESC</div>
          </div>
        </div>
      )}

      {/* Modal de Link gerado: input read-only + botão Copiar + atalhos WhatsApp/Email */}
      {linkGerado && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setLinkGerado(null)}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-purple-600 to-purple-500 text-white rounded-t-lg p-4">
              <h3 className="text-lg font-bold">🔗 Link da Ficha de Admissão</h3>
              <p className="text-xs opacity-90 mt-1">Envie este link pro candidato <strong>{linkGerado.nome}</strong> preencher os dados pessoais.</p>
            </div>
            <div className="p-4 space-y-3">
              <label className="block text-xs font-semibold uppercase text-gray-600">Link público</label>
              <div className="flex gap-2">
                <input id="input-link-publico" type="text" readOnly value={linkGerado.url}
                  onFocus={e => e.target.select()}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm bg-gray-50 font-mono" />
                <button onClick={() => copiarLink(linkGerado.url)}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded text-sm font-bold whitespace-nowrap shadow">
                  📋 Copiar
                </button>
              </div>

              <div className="pt-2 border-t border-gray-100">
                <a
                  href={buildWhatsAppUrl(
                    linkGerado.celular,
                    `Olá ${linkGerado.nome || ''}! Por favor preencha sua Ficha de Admissão neste link: ${linkGerado.url}`
                  )}
                  target="_blank" rel="noopener noreferrer"
                  className="block w-full px-3 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded text-sm font-bold text-center">
                  💬 Enviar pelo WhatsApp{linkGerado.celular ? '' : ' (sem nº cadastrado)'}
                </a>
              </div>

              <p className="text-xs text-gray-500 italic pt-2">O link foi copiado automaticamente. Cole onde quiser enviar pro candidato.</p>
            </div>
            <div className="p-4 border-t flex justify-end">
              <button onClick={() => setLinkGerado(null)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded text-sm font-semibold">Fechar</button>
            </div>
          </div>
        </div>
      )}

      {modalAberto && fichaEditando && (
        <FichaAdmissaoModal
          ficha={fichaEditando} setFicha={setFichaEditando}
          empresas={empresas} cargos={cargos} departamentos={departamentos}
          jornadas={jornadas} escalas={escalas} escalasDomingo={escalasDomingo}
          regimes={regimes} prazos={prazos} formasPgto={formasPgto}
          onSalvar={salvar} onFechar={() => { setModalAberto(false); setFichaEditando(null); }}
          onImprimir={imprimirFicha}
          onEnviarEmail={abrirEnviarEmail}
        />
      )}

      {/* Guia de Exame Ocupacional — RH preenche so o topo; a tabela de exames
          vai em branco de proposito, quem marca e a clinica. */}
      {guiaModal && (
        <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4"
          onClick={() => !guiaModal.ocupado && setGuiaModal(null)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}>
            <div className="bg-teal-600 text-white px-5 py-3 rounded-t-xl">
              <h3 className="text-lg font-bold">🩺 Guia de Exame Ocupacional</h3>
              <p className="text-xs text-teal-100">{guiaModal.ficha.candidato_nome}</p>
            </div>

            <div className="p-5 space-y-4">
              <div className="bg-teal-50 border border-teal-200 rounded-lg p-3 text-xs text-teal-900">
                Nome, nascimento, RG, CPF, função, empresa e setor vêm da ficha automaticamente.
                A tabela de exames sai <strong>em branco</strong> — quem marca é a clínica.
              </div>

              {/* Nascimento/RG/CPF vem do que o CANDIDATO preenche no link dele.
                  Se ainda nao preencheu, o guia sai com esses campos vazios. */}
              {!guiaModal.ficha?.candidato_dados?.dados_pessoais?.cpf && (
                <div className="bg-amber-50 border border-amber-300 rounded-lg p-3 text-xs text-amber-900">
                  ⚠️ Este candidato ainda não preencheu o link dele, então
                  <strong> nascimento, RG e CPF vão sair em branco</strong> no guia —
                  dá pra completar à mão no Word. Nome, função, empresa e setor saem normalmente.
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Tipo de exame *</label>
                  <select value={guiaModal.tipoExame}
                    onChange={(e) => setGuiaModal({ ...guiaModal, tipoExame: e.target.value })}
                    className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-400">
                    {TIPOS_EXAME.map((t) => (
                      <option key={t.key} value={t.key}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Data do agendamento</label>
                  <input type="text" value={guiaModal.agendadoData} inputMode="numeric"
                    onChange={(e) => setGuiaModal({ ...guiaModal, agendadoData: mascaraData(e.target.value) })}
                    placeholder="25/08/2026" maxLength={10}
                    className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-400" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Horário</label>
                  <input type="text" value={guiaModal.agendadoHora} inputMode="numeric"
                    onChange={(e) => setGuiaModal({ ...guiaModal, agendadoHora: mascaraHora(e.target.value) })}
                    placeholder="09:30" maxLength={5}
                    className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-400" />
                </div>
              </div>

              {guiaModal.tipoExame === "outro" && (
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Qual?</label>
                  <input type="text" value={guiaModal.outroDesc}
                    onChange={(e) => setGuiaModal({ ...guiaModal, outroDesc: e.target.value })}
                    className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-400" />
                </div>
              )}

              <div>
                <p className="text-xs font-semibold text-gray-600 mb-2">Riscos ocupacionais (opcional)</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {[
                    ["riscoFisico", "Físico"],
                    ["riscoQuimico", "Químico"],
                    ["riscoBiologico", "Biológico"],
                    ["riscoOutros", "Outros"],
                  ].map(([chave, rotulo]) => (
                    <div key={chave}>
                      <label className="block text-[11px] text-gray-500 mb-1">{rotulo}</label>
                      <input type="text" value={guiaModal[chave]}
                        onChange={(e) => setGuiaModal({ ...guiaModal, [chave]: e.target.value })}
                        className="w-full border-2 border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-teal-400" />
                    </div>
                  ))}
                </div>
              </div>

              {!guiaModal.cfg.email && (
                <div className="bg-amber-50 border border-amber-300 rounded-lg p-3 text-xs text-amber-900">
                  ⚠️ Nenhum e-mail de clínica cadastrado. Dá pra <strong>baixar</strong> o guia normalmente,
                  mas pra enviar, cadastre em <strong>Configurações → E-mails Padronizados → Medicina do Trabalho</strong>.
                </div>
              )}
            </div>

            <div className="border-t px-5 py-3 flex flex-col md:flex-row gap-2 md:justify-end">
              <button onClick={() => setGuiaModal(null)} disabled={guiaModal.ocupado}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-semibold disabled:opacity-50">
                Cancelar
              </button>
              <button onClick={baixarGuia} disabled={guiaModal.ocupado}
                className="px-5 py-2 bg-gray-700 hover:bg-gray-800 text-white rounded-lg text-sm font-bold disabled:opacity-50">
                ⬇️ Baixar .docx
              </button>
              <button onClick={enviarGuiaEmail} disabled={guiaModal.ocupado || !guiaModal.cfg.email}
                title={guiaModal.cfg.email ? ("Enviar para " + guiaModal.cfg.email) : "Cadastre o e-mail da clínica primeiro"}
                className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-bold disabled:opacity-50">
                {guiaModal.ocupado ? "Aguarde..." : "📧 Enviar pra clínica"}
              </button>
            </div>
          </div>
        </div>
      )}
      {emailModal && (
        <EnviarEmailModal
          estado={emailModal}
          setEstado={setEmailModal}
          onEnviar={enviarEmailFicha}
          onFechar={() => setEmailModal(null)}
        />
      )}
    </div>
  );
}

// ============================================================
// Modal: Enviar Ficha Cadastral por e-mail
// ============================================================
function EnviarEmailModal({ estado, setEstado, onEnviar, onFechar }) {
  const { ficha, gerando, enviando, pdf, destinatarios, to, assunto, corpo, responsaveis = [], responsavel = '' } = estado;
  const set = (campo, val) => setEstado((m) => (m ? { ...m, [campo]: val } : m));

  // Trocar o responsável re-aplica {RESPONSAVEL} no assunto/corpo a partir do template base.
  const setResponsavel = (nome) => setEstado((m) => (m ? {
    ...m,
    responsavel: nome,
    assunto: String(m.assuntoBase || m.assunto).replace(/\{RESPONSAVEL\}/g, nome),
    corpo: String(m.corpoBase || m.corpo).replace(/\{RESPONSAVEL\}/g, nome),
  } : m));

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-800">📧 Enviar Ficha Cadastral</h3>
          <button onClick={onFechar} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        <div className="p-5 space-y-4">
          <div className={`text-sm flex items-center gap-2 rounded-lg px-3 py-2 ${gerando ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>
            {gerando ? (
              <>
                <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-amber-600" />
                Gerando o PDF da ficha...
              </>
            ) : (
              <>📎 PDF anexado: <strong>{ficha.candidato_nome}</strong></>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Destinatário</label>
            {destinatarios.length > 0 && (
              <select
                value={destinatarios.some((d) => d.email === to) ? to : ''}
                onChange={(e) => set('to', e.target.value)}
                className="w-full mb-2 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500"
              >
                <option value="">— escolher contato cadastrado —</option>
                {destinatarios.map((d, i) => (
                  <option key={i} value={d.email}>{d.nome} ({d.email})</option>
                ))}
              </select>
            )}
            <input
              type="email"
              value={to}
              onChange={(e) => set('to', e.target.value)}
              placeholder="ou digite um e-mail"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500"
            />
            {destinatarios.length === 0 && (
              <p className="mt-1 text-xs text-amber-600">
                Nenhum contato cadastrado. Cadastre em Configurações RH → Emails Padronizados → Destinatários.
              </p>
            )}
          </div>

          {responsaveis.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Responsável (assina o e-mail)</label>
              <select
                value={responsavel}
                onChange={(e) => setResponsavel(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500"
              >
                {responsaveis.map((n, i) => (
                  <option key={i} value={n}>{n}</option>
                ))}
              </select>
              <p className="mt-1 text-xs text-gray-400">Preenche a variável {'{RESPONSAVEL}'} no texto.</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Assunto</label>
            <input
              value={assunto}
              onChange={(e) => set('assunto', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mensagem</label>
            <textarea
              rows={6}
              value={corpo}
              onChange={(e) => set('corpo', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500"
            />
          </div>
        </div>

        <div className="px-5 py-4 border-t flex justify-end gap-2">
          <button onClick={onFechar} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-semibold">
            Cancelar
          </button>
          <button
            onClick={onEnviar}
            disabled={gerando || enviando || !pdf}
            className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-bold disabled:bg-gray-300"
          >
            {enviando ? 'Enviando...' : '📤 Enviar'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Modal do formulário da ficha
// ============================================================
function FichaAdmissaoModal({ ficha, setFicha, empresas, cargos, departamentos, jornadas, escalas, escalasDomingo, regimes, prazos, formasPgto, onSalvar, onFechar, onImprimir, onEnviarEmail }) {
  const set = (k, v) => setFicha({ ...ficha, [k]: v });

  const labelCls = 'block text-xs font-semibold uppercase text-gray-600 mb-1';
  const inputCls = 'w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500';
  const selectCls = inputCls;
  const sectionCls = 'bg-white border border-gray-200 rounded-lg p-4';

  const optList = (arr, lblKey = 'nome') => (arr || []).map(o => (
    <option key={o.id} value={o.id}>{o[lblKey] || o.nome || o.label || `#${o.id}`}</option>
  ));

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[92vh] overflow-hidden flex flex-col">
        <div className="p-4 border-b flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold">{ficha.id ? 'Editar Ficha de Admissão' : 'Nova Ficha de Admissão'}</h3>
            <p className="text-xs text-gray-500">Preencha o que você sabe agora — o candidato completa os dados pessoais via link.</p>
          </div>
          <button onClick={onFechar} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>

        <div className="p-5 overflow-y-auto flex-1 bg-gray-50 space-y-4">
          {/* Candidato */}
          <div className={sectionCls}>
            <h4 className="text-sm font-bold text-gray-700 mb-3">Candidato</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-3">
                <label className={labelCls}>Nome completo *</label>
                <input className={inputCls + ' uppercase'} value={ficha.candidato_nome || ''} onChange={e => set('candidato_nome', e.target.value.toUpperCase())} />
              </div>
              <div>
                <label className={labelCls}>E-mail</label>
                <input type="email" className={inputCls} value={ficha.candidato_email || ''} onChange={e => set('candidato_email', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Celular *</label>
                <input className={inputCls} value={ficha.candidato_celular || ''} onChange={e => set('candidato_celular', e.target.value)} placeholder="(00) 00000-0000" />
              </div>
              <div>
                <label className={labelCls}>Empresa *</label>
                <select className={selectCls} value={ficha.company_id || ''} onChange={e => set('company_id', e.target.value)}>
                  <option value="">— Selecione —</option>
                  {(empresas || []).map(e => <option key={e.id} value={e.id}>{e.apelido || e.nome_fantasia || e.razao_social || `#${e.id}`}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Dados Admissão */}
          <div className={sectionCls}>
            <h4 className="text-sm font-bold text-gray-700 mb-3">Dados Admissão</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className={labelCls}>Data de Envio *</label>
                <input type="date" className={inputCls} value={ficha.data_admissao || ''} onChange={e => set('data_admissao', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Cargo / Função *</label>
                <select className={selectCls} value={ficha.cargo_id || ''} onChange={e => {
                  const cargoId = e.target.value;
                  const cargo = cargos.find(c => String(c.id) === String(cargoId));
                  // Auto-preenche salário com salario_base do cargo (RH pode ajustar depois)
                  setFicha({ ...ficha, cargo_id: cargoId, ...(cargo?.salario_base != null ? { salario: cargo.salario_base } : {}) });
                }}>
                  <option value="">— Selecione —</option>{optList(cargos)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Departamento *</label>
                <select className={selectCls} value={ficha.departamento_id || ''} onChange={e => set('departamento_id', e.target.value)}>
                  <option value="">— Selecione —</option>{optList(departamentos)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Salário *</label>
                <input type="number" step="0.01" className={inputCls} value={ficha.salario || ''} onChange={e => set('salario', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Prazo de Experiência *</label>
                <select className={selectCls} value={ficha.prazo_experiencia_id || ''} onChange={e => set('prazo_experiencia_id', e.target.value)}>
                  <option value="">— Selecione —</option>
                  {(prazos || []).map(p => {
                    const ini = p.dias_inicial, fim = p.dias_final;
                    const total = (ini != null && fim != null) ? (Number(ini) + Number(fim)) : p.dias;
                    const label = (ini != null && fim != null)
                      ? `Inicial ${ini} / Final ${fim} (total ${total} dias)`
                      : (p.nome || `${p.dias || ''} dias`);
                    return <option key={p.id} value={p.id}>{label}</option>;
                  })}
                </select>
              </div>
              <div>
                <label className={labelCls}>Forma de Pagamento *</label>
                <select className={selectCls} value={ficha.forma_pagamento_id || ''} onChange={e => set('forma_pagamento_id', e.target.value)}>
                  <option value="">— Selecione —</option>{optList(formasPgto)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Regime de Trabalho *</label>
                <select className={selectCls} value={ficha.regime_trabalho_id || ''} onChange={e => set('regime_trabalho_id', e.target.value)}>
                  <option value="">— Selecione —</option>{optList(regimes)}
                </select>
              </div>
            </div>
          </div>

          {/* Horário */}
          <div className={sectionCls}>
            <h4 className="text-sm font-bold text-gray-700 mb-3">Horário de Trabalho</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className={labelCls}>Entrada *</label>
                <input type="time" className={inputCls} value={ficha.horario_entrada || ''} onChange={e => set('horario_entrada', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Intervalo — Início *</label>
                <input type="time" className={inputCls} value={ficha.horario_intervalo_inicio || ''} onChange={e => set('horario_intervalo_inicio', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Intervalo — Fim *</label>
                <input type="time" className={inputCls} value={ficha.horario_intervalo_fim || ''} onChange={e => set('horario_intervalo_fim', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Saída *</label>
                <input type="time" className={inputCls} value={ficha.horario_saida || ''} onChange={e => set('horario_saida', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Jornada *</label>
                <select className={selectCls} value={ficha.jornada_id || ''} onChange={e => set('jornada_id', e.target.value)}>
                  <option value="">— Selecione —</option>{optList(jornadas)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Escala *</label>
                <select className={selectCls} value={ficha.escala_id || ''} onChange={e => set('escala_id', e.target.value)}>
                  <option value="">— Selecione —</option>{optList(escalas)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Escala Domingo *</label>
                <select className={selectCls} value={ficha.escala_domingo_id || ''} onChange={e => set('escala_domingo_id', e.target.value)}>
                  <option value="">— Selecione —</option>{optList(escalasDomingo)}
                </select>
              </div>
            </div>
          </div>

          {/* Painel READ-ONLY com os dados preenchidos pelo candidato via link público.
              Aparece SOMENTE quando há candidato_dados (status >= preenchida ou rascunho do candidato). */}
          {ficha.candidato_dados && Object.keys(ficha.candidato_dados).length > 0 && (
            <DadosCandidatoPainel
              dados={ficha.candidato_dados}
              onChange={(novoDados) => setFicha({ ...ficha, candidato_dados: novoDados })}
            />
          )}
        </div>

        <div className="p-4 border-t flex justify-between items-center gap-2 flex-wrap">
          <div className="flex gap-2">
            {ficha.id && (
              <button type="button" onClick={() => onImprimir(ficha)}
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded text-sm font-bold">
                🖨️ Imprimir / PDF
              </button>
            )}
            {ficha.id && onEnviarEmail && (
              <button type="button" onClick={() => onEnviarEmail(ficha)}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded text-sm font-bold">
                📧 Enviar por e-mail
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={onFechar} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded text-sm font-semibold">Cancelar</button>
            <button onClick={onSalvar} className="px-5 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded text-sm font-bold">
              💾 Salvar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Painel read-only com os dados que o candidato preencheu via link público.
// Mostrado dentro do modal de edição da ficha pra RH revisar antes de
// converter em colaborador.
// ============================================================
function DadosCandidatoPainel({ dados, onChange }) {
  const pess = dados.dados_pessoais || {};
  const end = dados.endereco || {};
  const cont = dados.contato || {};
  const doc = dados.documentos || {};
  const bnc = dados.banco || {};
  const esc = dados.escolaridade || {};
  const opc = dados.opcoes_candidato || {};
  const conj = dados.conjuge || {};
  const estr = dados.estrangeiro || {};
  const deps = Array.isArray(dados.dependentes) ? dados.dependentes : [];
  const temConjuge = pess.estado_civil === 'CASADO' || pess.estado_civil === 'UNIAO_ESTAVEL';
  const ehEstrangeiro = pess.nacionalidade && !String(pess.nacionalidade).toUpperCase().includes('BRASIL');

  // Helpers de update
  const setRoot = (key, val) => onChange({ ...dados, [key]: val });
  const setSecao = (sec, key, val) => onChange({ ...dados, [sec]: { ...(dados[sec] || {}), [key]: val } });
  const setDep = (idx, key, val) => {
    const arr = [...deps];
    arr[idx] = { ...(arr[idx] || {}), [key]: val };
    onChange({ ...dados, dependentes: arr });
  };
  const addDep = () => onChange({
    ...dados,
    dependentes: [...deps, { nome: '', parentesco: '', sexo: '', cpf: '', data_nascimento: '',
                              certidao_numero: '', certidao_data: '', certidao_cartorio: '', certidao_folha: '',
                              dependente_ir: false, dependente_sf: false }],
  });
  const rmDep = (idx) => onChange({ ...dados, dependentes: deps.filter((_, i) => i !== idx) });

  // Upload de foto (com resize) — RH troca a foto do candidato
  const handleFotoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Imagem inválida'); return; }
    if (file.size > 15 * 1024 * 1024) { toast.error('Foto muito grande'); return; }
    const reader = new FileReader();
    reader.onload = (evt) => {
      const img = new Image();
      img.onload = () => {
        const maxSize = 800;
        let { width, height } = img;
        if (width > height && width > maxSize) { height = Math.round(height * maxSize / width); width = maxSize; }
        else if (height > maxSize)              { width  = Math.round(width  * maxSize / height); height = maxSize; }
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        setRoot('foto_url', canvas.toDataURL('image/jpeg', 0.85));
      };
      img.src = evt.target.result;
    };
    reader.readAsDataURL(file);
  };

  // Styles
  const labelStyle = 'block text-[10px] uppercase font-semibold text-gray-600 mb-1';
  const inputCls = 'w-full px-2 py-1.5 border border-purple-200 rounded text-xs bg-white focus:ring-2 focus:ring-purple-400 focus:border-purple-400';
  const sectionBox = 'bg-purple-50 border border-purple-200 rounded-lg p-4';
  const subTitle = 'text-sm font-bold text-purple-900 uppercase mb-3 pb-2 border-b border-purple-200 flex items-center gap-2';

  // Components
  const Field = ({ label, value, onChg, type = 'text' }) => (
    <div>
      <label className={labelStyle}>{label}</label>
      <input type={type} value={value || ''} onChange={e => onChg(e.target.value)} className={inputCls} />
    </div>
  );
  const SelectField = ({ label, value, onChg, options }) => (
    <div>
      <label className={labelStyle}>{label}</label>
      <select value={value || ''} onChange={e => onChg(e.target.value)} className={inputCls}>
        <option value="">—</option>
        {options.map(o => <option key={o.v} value={o.v}>{o.label}</option>)}
      </select>
    </div>
  );
  const SimNao = ({ label, value, onChg }) => (
    <SelectField label={label} value={value} onChg={onChg} options={[{ v: 'SIM', label: 'Sim' }, { v: 'NAO', label: 'Não' }]} />
  );

  const opcoesSexo = [{ v: 'MASCULINO', label: 'Masculino' }, { v: 'FEMININO', label: 'Feminino' }, { v: 'M', label: 'M' }, { v: 'F', label: 'F' }];
  const opcoesEstadoCivil = [
    { v: 'SOLTEIRO', label: 'Solteiro(a)' },
    { v: 'CASADO', label: 'Casado(a)' },
    { v: 'DIVORCIADO', label: 'Divorciado(a)' },
    { v: 'VIUVO', label: 'Viúvo(a)' },
    { v: 'UNIAO_ESTAVEL', label: 'União estável' },
  ];
  const opcoesRaca = ['BRANCA', 'PRETA', 'PARDA', 'AMARELA', 'INDIGENA', 'NAO_DECLARADO'].map(v => ({ v, label: v }));
  const opcoesSangue = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(v => ({ v, label: v }));
  const opcoesDef = ['NENHUMA', 'FISICA', 'AUDITIVA', 'VISUAL', 'REABILITADO', 'MENTAL', 'MULTIPLA', 'INTELECTUAL'].map(v => ({ v, label: v }));
  const opcoesTipoConta = [{ v: 'CORRENTE', label: 'Corrente' }, { v: 'POUPANCA', label: 'Poupança' }, { v: 'SALARIO', label: 'Salário' }];
  const opcoesParentesco = [
    { v: 'FILHO', label: 'Filho(a)' }, { v: 'CONJUGE', label: 'Cônjuge' },
    { v: 'ENTEADO', label: 'Enteado(a)' }, { v: 'PAI_MAE', label: 'Pai/Mãe' }, { v: 'OUTRO', label: 'Outro' },
  ];
  const opcoesSexoDep = [{ v: 'M', label: 'M' }, { v: 'F', label: 'F' }];

  return (
    <div className="space-y-3 mt-3">
      <div className="bg-gradient-to-r from-purple-600 to-purple-500 text-white rounded-lg p-3 text-sm font-bold flex items-center gap-3">
        {dados.foto_url && (
          <img src={dados.foto_url} alt="Foto" className="w-12 h-12 rounded-full object-cover border-2 border-white shadow" />
        )}
        <span>📝 Dados preenchidos pelo candidato</span>
        <span className="ml-auto text-[10px] bg-white/20 px-2 py-0.5 rounded">✏️ editável — RH pode corrigir antes de criar colaborador</span>
      </div>

      {/* Foto editável */}
      <div className={sectionBox}>
        <h4 className={subTitle}>📸 Foto do colaborador</h4>
        <div className="flex items-center gap-3">
          {dados.foto_url ? (
            <img src={dados.foto_url} alt="Foto" className="w-20 h-20 rounded-full object-cover border-2 border-purple-300" />
          ) : (
            <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center text-2xl text-gray-400 border-2 border-dashed border-gray-300">📷</div>
          )}
          <div className="flex-1">
            <input type="file" accept="image/*" onChange={handleFotoUpload} id="painel-foto-upload" className="hidden" />
            <label htmlFor="painel-foto-upload" className="cursor-pointer inline-block px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded text-xs font-bold">
              📷 {dados.foto_url ? 'Trocar foto' : 'Escolher foto'}
            </label>
            {dados.foto_url && (
              <button type="button" onClick={() => setRoot('foto_url', '')} className="ml-2 text-xs text-red-600 hover:underline">🗑 Remover</button>
            )}
          </div>
        </div>
      </div>

      {/* Dados pessoais */}
      <div className={sectionBox}>
        <h4 className={subTitle}>Dados pessoais</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Field label="Nome completo" value={pess.nome} onChg={v => setSecao('dados_pessoais', 'nome', v)} />
          <Field label="CPF" value={pess.cpf} onChg={v => setSecao('dados_pessoais', 'cpf', v)} />
          <Field label="RG (nº)" value={pess.rg} onChg={v => setSecao('dados_pessoais', 'rg', v)} />
          <Field label="RG — Órgão" value={pess.rg_orgao_emissor} onChg={v => setSecao('dados_pessoais', 'rg_orgao_emissor', v)} />
          <Field label="RG — UF" value={pess.rg_uf} onChg={v => setSecao('dados_pessoais', 'rg_uf', v)} />
          <Field label="RG — Emissão" value={pess.rg_emissao} onChg={v => setSecao('dados_pessoais', 'rg_emissao', v)} type="date" />
          <Field label="Data nasc." value={pess.data_nascimento} onChg={v => setSecao('dados_pessoais', 'data_nascimento', v)} type="date" />
          <SelectField label="Sexo" value={pess.sexo} onChg={v => setSecao('dados_pessoais', 'sexo', v)} options={opcoesSexo} />
          <SelectField label="Estado civil" value={pess.estado_civil} onChg={v => setSecao('dados_pessoais', 'estado_civil', v)} options={opcoesEstadoCivil} />
          <Field label="Nacionalidade" value={pess.nacionalidade} onChg={v => setSecao('dados_pessoais', 'nacionalidade', v)} />
          <Field label="Naturalidade" value={pess.naturalidade} onChg={v => setSecao('dados_pessoais', 'naturalidade', v)} />
          <Field label="Naturalidade UF" value={pess.naturalidade_uf} onChg={v => setSecao('dados_pessoais', 'naturalidade_uf', v)} />
          <Field label="Nome do pai" value={pess.nome_pai} onChg={v => setSecao('dados_pessoais', 'nome_pai', v)} />
          <Field label="Nome da mãe" value={pess.nome_mae} onChg={v => setSecao('dados_pessoais', 'nome_mae', v)} />
          <SelectField label="Raça/Cor" value={pess.raca_cor} onChg={v => setSecao('dados_pessoais', 'raca_cor', v)} options={opcoesRaca} />
          <SelectField label="Tipo sanguíneo" value={pess.tipo_sanguineo} onChg={v => setSecao('dados_pessoais', 'tipo_sanguineo', v)} options={opcoesSangue} />
          <Field label="Altura" value={pess.altura} onChg={v => setSecao('dados_pessoais', 'altura', v)} />
          <Field label="Peso" value={pess.peso} onChg={v => setSecao('dados_pessoais', 'peso', v)} />
          <Field label="Cor cabelos" value={pess.cor_cabelos} onChg={v => setSecao('dados_pessoais', 'cor_cabelos', v)} />
          <Field label="Cor olhos" value={pess.cor_olhos} onChg={v => setSecao('dados_pessoais', 'cor_olhos', v)} />
          <SelectField label="Deficiência" value={pess.deficiente} onChg={v => setSecao('dados_pessoais', 'deficiente', v)} options={opcoesDef} />
        </div>
      </div>

      {/* Cônjuge — só se casado/união estável */}
      {temConjuge && (
        <div className={sectionBox}>
          <h4 className={subTitle}>Cônjuge</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Field label="Nome" value={conj.nome} onChg={v => setSecao('conjuge', 'nome', v)} />
            <Field label="CPF" value={conj.cpf} onChg={v => setSecao('conjuge', 'cpf', v)} />
            <Field label="Data nasc." value={conj.data_nascimento} onChg={v => setSecao('conjuge', 'data_nascimento', v)} type="date" />
            <Field label="Data casamento" value={conj.data_casamento} onChg={v => setSecao('conjuge', 'data_casamento', v)} type="date" />
          </div>
        </div>
      )}

      {/* Estrangeiro — só se nacionalidade não brasileira */}
      {ehEstrangeiro && (
        <div className={sectionBox}>
          <h4 className={subTitle}>Para estrangeiro</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Field label="País de nacionalidade" value={estr.pais_nacionalidade} onChg={v => setSecao('estrangeiro', 'pais_nacionalidade', v)} />
            <Field label="Condição de ingresso" value={estr.condicao_ingresso} onChg={v => setSecao('estrangeiro', 'condicao_ingresso', v)} />
            <Field label="Data de chegada" value={estr.data_chegada} onChg={v => setSecao('estrangeiro', 'data_chegada', v)} type="date" />
            <SimNao label="Filhos c/ brasileiro" value={estr.filhos_brasileiros === true ? 'SIM' : estr.filhos_brasileiros === false ? 'NAO' : estr.filhos_brasileiros} onChg={v => setSecao('estrangeiro', 'filhos_brasileiros', v === 'SIM')} />
            <Field label="Quantos" value={estr.filhos_brasileiros_qtd} onChg={v => setSecao('estrangeiro', 'filhos_brasileiros_qtd', v)} />
            <SimNao label="Casado c/ brasileiro" value={estr.casado_brasileiro === true ? 'SIM' : estr.casado_brasileiro === false ? 'NAO' : estr.casado_brasileiro} onChg={v => setSecao('estrangeiro', 'casado_brasileiro', v === 'SIM')} />
            <Field label="Portaria naturalização" value={estr.portaria_naturalizacao} onChg={v => setSecao('estrangeiro', 'portaria_naturalizacao', v)} />
            <Field label="Data naturalização" value={estr.data_naturalizacao} onChg={v => setSecao('estrangeiro', 'data_naturalizacao', v)} type="date" />
          </div>
        </div>
      )}

      {/* Contato */}
      <div className={sectionBox}>
        <h4 className={subTitle}>Contato</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Field label="Telefone" value={cont.telefone} onChg={v => setSecao('contato', 'telefone', v)} />
          <Field label="Celular" value={cont.celular} onChg={v => setSecao('contato', 'celular', v)} />
          <Field label="E-mail" value={cont.email} onChg={v => setSecao('contato', 'email', v)} type="email" />
        </div>
      </div>

      {/* Endereço */}
      <div className={sectionBox}>
        <h4 className={subTitle}>Endereço</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Field label="CEP" value={end.cep} onChg={v => setSecao('endereco', 'cep', v)} />
          <Field label="Rua" value={end.rua} onChg={v => setSecao('endereco', 'rua', v)} />
          <Field label="Nº" value={end.numero} onChg={v => setSecao('endereco', 'numero', v)} />
          <Field label="Complemento" value={end.complemento} onChg={v => setSecao('endereco', 'complemento', v)} />
          <Field label="Bairro" value={end.bairro} onChg={v => setSecao('endereco', 'bairro', v)} />
          <Field label="Cidade" value={end.cidade} onChg={v => setSecao('endereco', 'cidade', v)} />
          <Field label="UF" value={end.estado} onChg={v => setSecao('endereco', 'estado', v)} />
        </div>
      </div>

      {/* Escolaridade */}
      <div className={sectionBox}>
        <h4 className={subTitle}>Escolaridade</h4>
        <Field label="Grau" value={esc.escolaridade_id} onChg={v => setSecao('escolaridade', 'escolaridade_id', v)} />
      </div>

      {/* Documentos */}
      <div className={sectionBox}>
        <h4 className={subTitle}>Documentos</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Field label="CTPS" value={doc.ctps} onChg={v => setSecao('documentos', 'ctps', v)} />
          <Field label="CTPS Série" value={doc.serie_ctps} onChg={v => setSecao('documentos', 'serie_ctps', v)} />
          <Field label="CTPS UF" value={doc.ctps_uf} onChg={v => setSecao('documentos', 'ctps_uf', v)} />
          <Field label="CTPS Emissão" value={doc.ctps_emissao} onChg={v => setSecao('documentos', 'ctps_emissao', v)} type="date" />
          <Field label="PIS/PASEP" value={doc.pis_pasep} onChg={v => setSecao('documentos', 'pis_pasep', v)} />
          <Field label="Título Eleitor" value={doc.titulo_eleitor} onChg={v => setSecao('documentos', 'titulo_eleitor', v)} />
          <Field label="Título Zona" value={doc.titulo_zona} onChg={v => setSecao('documentos', 'titulo_zona', v)} />
          <Field label="Título Seção" value={doc.titulo_secao} onChg={v => setSecao('documentos', 'titulo_secao', v)} />
          <Field label="Título Emissão" value={doc.titulo_emissao} onChg={v => setSecao('documentos', 'titulo_emissao', v)} type="date" />
          <Field label="Reservista" value={doc.reservista} onChg={v => setSecao('documentos', 'reservista', v)} />
          <Field label="Reservista UF" value={doc.reservista_uf} onChg={v => setSecao('documentos', 'reservista_uf', v)} />
          <Field label="Reservista Emissão" value={doc.reservista_emissao} onChg={v => setSecao('documentos', 'reservista_emissao', v)} type="date" />
          <Field label="CNH" value={doc.cnh} onChg={v => setSecao('documentos', 'cnh', v)} />
          <Field label="CNH Categoria" value={doc.cnh_categoria} onChg={v => setSecao('documentos', 'cnh_categoria', v)} />
          <Field label="CNH UF" value={doc.cnh_uf} onChg={v => setSecao('documentos', 'cnh_uf', v)} />
          <Field label="CNH Validade" value={doc.cnh_validade} onChg={v => setSecao('documentos', 'cnh_validade', v)} type="date" />
        </div>
      </div>

      {/* Banco */}
      <div className={sectionBox}>
        <h4 className={subTitle}>Dados bancários</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Field label="Banco" value={bnc.banco} onChg={v => setSecao('banco', 'banco', v)} />
          <Field label="Agência" value={bnc.agencia} onChg={v => setSecao('banco', 'agencia', v)} />
          <Field label="Conta" value={bnc.conta} onChg={v => setSecao('banco', 'conta', v)} />
          <SelectField label="Tipo" value={bnc.tipo_conta} onChg={v => setSecao('banco', 'tipo_conta', v)} options={opcoesTipoConta} />
          <Field label="PIX" value={bnc.pix} onChg={v => setSecao('banco', 'pix', v)} />
        </div>
      </div>

      {/* Dependentes — editáveis */}
      <div className={sectionBox}>
        <div className="flex items-center justify-between mb-3 pb-2 border-b border-purple-200">
          <h4 className="text-sm font-bold text-purple-900 uppercase">Dependentes ({deps.length})</h4>
          <button type="button" onClick={addDep} className="text-xs px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded font-semibold">+ Adicionar</button>
        </div>
        {deps.length === 0 ? (
          <p className="text-xs text-gray-500 italic">Nenhum dependente. Clique em <strong>+ Adicionar</strong> se houver.</p>
        ) : (
          <div className="space-y-3">
            {deps.map((d, i) => (
              <div key={i} className="bg-white rounded p-3 border border-purple-100 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-gray-500 uppercase">Dependente {i + 1}</div>
                  <button type="button" onClick={() => rmDep(i)} className="text-xs text-red-600 hover:underline">🗑 remover</button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <Field label="Nome" value={d.nome} onChg={v => setDep(i, 'nome', v)} />
                  <SelectField label="Parentesco" value={d.parentesco} onChg={v => setDep(i, 'parentesco', v)} options={opcoesParentesco} />
                  <SelectField label="Sexo" value={d.sexo} onChg={v => setDep(i, 'sexo', v)} options={opcoesSexoDep} />
                  <Field label="CPF" value={d.cpf} onChg={v => setDep(i, 'cpf', v)} />
                  <Field label="Data nasc." value={d.data_nascimento} onChg={v => setDep(i, 'data_nascimento', v)} type="date" />
                  <Field label="Certidão (nº)" value={d.certidao_numero} onChg={v => setDep(i, 'certidao_numero', v)} />
                  <Field label="Data certidão" value={d.certidao_data} onChg={v => setDep(i, 'certidao_data', v)} type="date" />
                  <Field label="Cartório" value={d.certidao_cartorio} onChg={v => setDep(i, 'certidao_cartorio', v)} />
                  <Field label="Folha" value={d.certidao_folha} onChg={v => setDep(i, 'certidao_folha', v)} />
                </div>
                <div className="flex gap-4 text-xs">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={!!d.dependente_ir} onChange={e => setDep(i, 'dependente_ir', e.target.checked)} className="accent-purple-600" />
                    Dependente IR
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={!!d.dependente_sf} onChange={e => setDep(i, 'dependente_sf', e.target.checked)} className="accent-purple-600" />
                    Salário-família
                  </label>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Opções */}
      <div className={sectionBox}>
        <h4 className={subTitle}>Opções (escolhas do candidato)</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <SimNao label="1º emprego" value={opc.primeiro_emprego === true ? 'SIM' : opc.primeiro_emprego === false ? 'NAO' : opc.primeiro_emprego} onChg={v => setSecao('opcoes_candidato', 'primeiro_emprego', v)} />
          <SimNao label="Contribuição Sindical" value={opc.contribuicao_sindical === true ? 'SIM' : opc.contribuicao_sindical === false ? 'NAO' : opc.contribuicao_sindical} onChg={v => setSecao('opcoes_candidato', 'contribuicao_sindical', v)} />
          <SimNao label="Vale Transporte" value={opc.vale_transporte === true ? 'SIM' : opc.vale_transporte === false ? 'NAO' : opc.vale_transporte} onChg={v => setSecao('opcoes_candidato', 'vale_transporte', v)} />
        </div>
      </div>
    </div>
  );
}
