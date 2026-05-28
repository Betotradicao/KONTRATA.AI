import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../utils/api';
import toast, { Toaster } from 'react-hot-toast';

/**
 * Página PÚBLICA acessada pelo candidato via link com token UUID.
 * Mostra os dados já preenchidos pelo RH (read-only) e formulário pro
 * candidato completar os dados pessoais. Sem autenticação.
 */
export default function AdmissaoPublica() {
  const { token } = useParams();
  const [ficha, setFicha] = useState(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [finalizado, setFinalizado] = useState(false);

  // Dados que o candidato preenche (estrutura espelha o que o backend espera em criar-colaborador)
  const [dados, setDados] = useState({
    dados_pessoais: {
      nome: '', cpf: '', rg: '', rg_orgao_emissor: '', rg_uf: '', rg_emissao: '',
      data_nascimento: '', sexo: '', estado_civil: '',
      nacionalidade: 'BRASILEIRO(A)', naturalidade: '', naturalidade_uf: '',
      nome_pai: '', nome_mae: '',
      raca_cor: '', tipo_sanguineo: '', altura: '', peso: '',
      cor_cabelos: '', cor_olhos: '', deficiente: 'NENHUMA'
    },
    escolaridade: { escolaridade_id: '' },
    endereco: { cep: '', rua: '', numero: '', complemento: '', bairro: '', cidade: '', estado: '' },
    contato: { telefone: '', celular: '', email: '' },
    documentos: {
      ctps: '', serie_ctps: '', ctps_uf: '', ctps_emissao: '',
      pis_pasep: '',
      titulo_eleitor: '', titulo_zona: '', titulo_secao: '', titulo_emissao: '',
      reservista: '', reservista_uf: '', reservista_emissao: '',
      cnh: '', cnh_categoria: '', cnh_uf: '', cnh_validade: ''
    },
    banco: { banco: '', agencia: '', conta: '', tipo_conta: '', pix: '' },
    conjuge: { nome: '', cpf: '', data_nascimento: '', data_casamento: '' },
    estrangeiro: {
      pais_nacionalidade: '', condicao_ingresso: '', data_chegada: '',
      filhos_brasileiros: false, filhos_brasileiros_qtd: '',
      casado_brasileiro: false,
      portaria_naturalizacao: '', data_naturalizacao: ''
    },
    dependentes: [],
    // DECISÕES DO CANDIDATO (antes ficavam na ficha do RH — agora é o próprio que opta).
    // '' = não respondeu / 'SIM' / 'NAO' — todos obrigatórios antes de enviar.
    opcoes_candidato: { primeiro_emprego: '', contribuicao_sindical: '', vale_transporte: '' },
  });

  const [escolaridades, setEscolaridades] = useState([]);
  useEffect(() => {
    (async () => {
      try {
        const r = await api.get(`/rh/fichas-admissao/public/escolaridades`).catch(() => null);
        // Fallback: se a rota pública não existir, usa lista hardcoded básica
        if (r?.data && Array.isArray(r.data)) setEscolaridades(r.data);
        else setEscolaridades([
          { id: 'fundamental_incompleto', nome: 'Fundamental Incompleto' },
          { id: 'fundamental_completo', nome: 'Fundamental Completo' },
          { id: 'medio_incompleto', nome: 'Médio Incompleto' },
          { id: 'medio_completo', nome: 'Médio Completo' },
          { id: 'superior_incompleto', nome: 'Superior Incompleto' },
          { id: 'superior_completo', nome: 'Superior Completo' },
          { id: 'pos_graduacao', nome: 'Pós-Graduação' },
          { id: 'mestrado', nome: 'Mestrado' },
          { id: 'doutorado', nome: 'Doutorado' },
        ]);
      } catch { /* silencia */ }
    })();
  }, [token]);

  useEffect(() => {
    (async () => {
      try {
        const r = await api.get(`/rh/fichas-admissao/public/${token}`);
        setFicha(r.data);
        // Pré-preenche o que já temos
        const cd = r.data.candidato_dados || {};
        setDados(prev => ({
          ...prev,
          ...cd,
          dados_pessoais: {
            ...prev.dados_pessoais,
            ...(cd.dados_pessoais || {}),
            nome: cd?.dados_pessoais?.nome || r.data.candidato_nome || '',
          },
          contato: {
            ...prev.contato,
            ...(cd.contato || {}),
            email: cd?.contato?.email || r.data.candidato_email || '',
            celular: cd?.contato?.celular || r.data.candidato_celular || '',
          },
        }));
        if (r.data.status === 'preenchida') setFinalizado(true);
      } catch (e) {
        setErro(e?.response?.data?.error || 'Não foi possível carregar a ficha');
      } finally { setLoading(false); }
    })();
  }, [token]);

  // Converte automaticamente strings pra UPPERCASE (exceto email).
  // Aplicado tanto no save quanto no autofill do CEP/viacep.
  const upperize = (patch) => Object.fromEntries(
    Object.entries(patch).map(([k, v]) => [
      k,
      (typeof v === 'string' && k !== 'email') ? v.toUpperCase() : v
    ])
  );
  const setSecao = (secao, patch) => setDados(d => ({ ...d, [secao]: { ...d[secao], ...upperize(patch) } }));

  // CEP autofill (ViaCEP)
  const buscarCep = async (cep) => {
    const limpo = String(cep || '').replace(/\D/g, '');
    if (limpo.length !== 8) return;
    try {
      const r = await fetch(`https://viacep.com.br/ws/${limpo}/json/`);
      const data = await r.json();
      if (data && !data.erro) {
        setSecao('endereco', {
          rua: data.logradouro || dados.endereco.rua,
          bairro: data.bairro || dados.endereco.bairro,
          cidade: data.localidade || dados.endereco.cidade,
          estado: data.uf || dados.endereco.estado,
        });
      }
    } catch { /* silencia */ }
  };

  const addDependente = () => setDados(d => ({
    ...d,
    dependentes: [...(d.dependentes || []), {
      nome: '', parentesco: '', cpf: '', sexo: '', data_nascimento: '',
      certidao_numero: '', certidao_data: '', certidao_cartorio: '', certidao_folha: '',
      dependente_ir: false, dependente_sf: false
    }]
  }));
  const updDependente = (i, patch) => setDados(d => {
    const arr = [...(d.dependentes || [])];
    arr[i] = { ...arr[i], ...upperize(patch) };
    return { ...d, dependentes: arr };
  });
  const rmDependente = (i) => setDados(d => ({ ...d, dependentes: d.dependentes.filter((_, x) => x !== i) }));

  const salvarRascunho = async () => {
    setSalvando(true);
    try {
      await api.put(`/rh/fichas-admissao/public/${token}`, { dados, finalizar: false });
      toast.success('Rascunho salvo!');
    } catch (e) { toast.error('Erro ao salvar'); }
    finally { setSalvando(false); }
  };

  const finalizar = async () => {
    // Obrigatórios (alinhado aos asteriscos visuais)
    const obrigatorios = [
      [dados.dados_pessoais.nome,           'Nome completo é obrigatório'],
      [dados.dados_pessoais.cpf,            'CPF é obrigatório'],
      [dados.dados_pessoais.data_nascimento,'Data de nascimento é obrigatória'],
      [dados.escolaridade.escolaridade_id,  'Grau de instrução é obrigatório'],
      [dados.endereco.cep,                  'CEP é obrigatório'],
      [dados.endereco.rua,                  'Rua / Logradouro é obrigatório'],
      [dados.endereco.numero,               'Número é obrigatório'],
      [dados.endereco.bairro,               'Bairro é obrigatório'],
      [dados.endereco.cidade,               'Cidade é obrigatória'],
      [dados.endereco.estado,               'UF é obrigatória'],
      [dados.opcoes_candidato.primeiro_emprego,     'Responda Sim/Não para "É o seu primeiro emprego?"'],
      [dados.opcoes_candidato.contribuicao_sindical,'Responda Sim/Não para "Contribuição Sindical Anual"'],
      [dados.opcoes_candidato.vale_transporte,      'Responda Sim/Não para "Vale-Transporte"'],
    ];
    for (const [valor, msg] of obrigatorios) {
      if (!String(valor || '').trim()) { toast.error(msg); return; }
    }
    if (!window.confirm('Tem certeza? Após enviar, você não conseguirá mais editar esta ficha.')) return;
    setSalvando(true);
    try {
      await api.put(`/rh/fichas-admissao/public/${token}`, { dados, finalizar: true });
      toast.success('Ficha enviada! O RH vai revisar e finalizar sua admissão.');
      setFinalizado(true);
    } catch (e) { toast.error(e?.response?.data?.error || 'Erro ao enviar'); }
    finally { setSalvando(false); }
  };

  // Estados visuais ───────────────────────────────────────────────────
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-100 text-gray-500">Carregando ficha…</div>;
  }
  if (erro) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-md p-8 text-center">
          <div className="text-5xl mb-3">⚠️</div>
          <h1 className="text-xl font-bold text-gray-800 mb-2">Link inválido</h1>
          <p className="text-sm text-gray-600">{erro}</p>
        </div>
      </div>
    );
  }
  if (finalizado) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-purple-50 p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-md p-10 text-center">
          <div className="text-6xl mb-4">✅</div>
          <h1 className="text-2xl font-bold text-purple-700 mb-3">Ficha enviada!</h1>
          <p className="text-gray-600 mb-2">Obrigado, <strong>{dados.dados_pessoais.nome || ficha?.candidato_nome}</strong>.</p>
          <p className="text-sm text-gray-500">O RH da empresa <strong>{ficha?.empresa_nome}</strong> vai revisar e dar continuidade à sua admissão. Você pode fechar esta página.</p>
        </div>
      </div>
    );
  }

  // Form ─────────────────────────────────────────────────────────────
  const labelCls = 'block text-xs font-semibold uppercase text-gray-600 mb-1';
  // 'uppercase' visual: tudo digitado/colado aparece em maiúsculo (email tem classe própria abaixo)
  const inputCls = 'w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 uppercase';
  const inputClsEmail = 'w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500';
  const sectionCls = 'bg-white border border-gray-200 rounded-lg p-5 shadow-sm';

  return (
    <div className="min-h-screen bg-gray-50 py-6 px-3">
      <Toaster position="top-right" />
      <div className="max-w-3xl mx-auto space-y-4">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-purple-500 text-white rounded-lg p-5 shadow">
          <h1 className="text-2xl font-bold">📋 Ficha de Admissão</h1>
          <p className="text-sm opacity-90 mt-1">Bem-vindo(a)! Confira os dados preenchidos pelo RH e complete os seus.</p>
        </div>

        {/* Dados já preenchidos pelo RH (read-only) */}
        <div className={sectionCls}>
          <h3 className="text-sm font-bold text-gray-700 uppercase mb-3 pb-2 border-b">Dados de contratação (preenchidos pela empresa)</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-y-2 gap-x-4 text-sm">
            <div><span className="text-gray-500">Empresa:</span> <strong>{ficha?.empresa_nome || '—'}</strong></div>
            <div><span className="text-gray-500">CNPJ:</span> {ficha?.empresa_cnpj || '—'}</div>
            <div><span className="text-gray-500">Cargo:</span> <strong>{ficha?.cargo_nome || '—'}</strong></div>
            <div><span className="text-gray-500">Departamento:</span> {ficha?.departamento_nome || '—'}</div>
            <div><span className="text-gray-500">Data de admissão:</span> {ficha?.data_admissao ? new Date(ficha.data_admissao).toLocaleDateString('pt-BR') : '—'}</div>
          </div>
        </div>

        {/* Dados pessoais */}
        <div className={sectionCls}>
          <h3 className="text-sm font-bold text-gray-700 uppercase mb-3 pb-2 border-b">Dados pessoais</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-3">
              <label className={labelCls}>Nome completo *</label>
              <input className={inputCls} value={dados.dados_pessoais.nome} onChange={e => setSecao('dados_pessoais', { nome: e.target.value })} />
            </div>
            <div>
              <label className={labelCls}>CPF *</label>
              <input className={inputCls} value={dados.dados_pessoais.cpf} onChange={e => setSecao('dados_pessoais', { cpf: e.target.value })} placeholder="000.000.000-00" />
            </div>
            <div>
              <label className={labelCls}>RG (número)</label>
              <input className={inputCls} value={dados.dados_pessoais.rg} onChange={e => setSecao('dados_pessoais', { rg: e.target.value })} />
            </div>
            <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className={labelCls}>RG — Órgão Emissor</label>
                <input className={inputCls} value={dados.dados_pessoais.rg_orgao_emissor} onChange={e => setSecao('dados_pessoais', { rg_orgao_emissor: e.target.value })} placeholder="SSP, IFP..." />
              </div>
              <div>
                <label className={labelCls}>RG — UF</label>
                <input className={inputCls} maxLength={2} value={dados.dados_pessoais.rg_uf} onChange={e => setSecao('dados_pessoais', { rg_uf: e.target.value })} />
              </div>
              <div>
                <label className={labelCls}>RG — Data Emissão</label>
                <input type="date" className={inputCls} value={dados.dados_pessoais.rg_emissao} onChange={e => setSecao('dados_pessoais', { rg_emissao: e.target.value })} />
              </div>
            </div>
            <div>
              <label className={labelCls}>Data de nascimento *</label>
              <input type="date" className={inputCls} value={dados.dados_pessoais.data_nascimento} onChange={e => setSecao('dados_pessoais', { data_nascimento: e.target.value })} />
            </div>
            <div>
              <label className={labelCls}>Sexo</label>
              <select className={inputCls} value={dados.dados_pessoais.sexo} onChange={e => setSecao('dados_pessoais', { sexo: e.target.value })}>
                <option value="">—</option>
                <option value="M">Masculino</option>
                <option value="F">Feminino</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Estado civil</label>
              <select className={inputCls} value={dados.dados_pessoais.estado_civil} onChange={e => setSecao('dados_pessoais', { estado_civil: e.target.value })}>
                <option value="">—</option>
                <option value="SOLTEIRO">Solteiro(a)</option>
                <option value="CASADO">Casado(a)</option>
                <option value="DIVORCIADO">Divorciado(a)</option>
                <option value="VIUVO">Viúvo(a)</option>
                <option value="UNIAO_ESTAVEL">União estável</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Nacionalidade</label>
              <input className={inputCls} value={dados.dados_pessoais.nacionalidade} onChange={e => setSecao('dados_pessoais', { nacionalidade: e.target.value })} />
            </div>
            <div className="md:col-span-2">
              <label className={labelCls}>Naturalidade (cidade)</label>
              <input className={inputCls} value={dados.dados_pessoais.naturalidade} onChange={e => setSecao('dados_pessoais', { naturalidade: e.target.value })} />
            </div>
            <div>
              <label className={labelCls}>Naturalidade — UF</label>
              <input className={inputCls} maxLength={2} value={dados.dados_pessoais.naturalidade_uf} onChange={e => setSecao('dados_pessoais', { naturalidade_uf: e.target.value })} />
            </div>
            <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Nome do pai</label>
                <input className={inputCls} value={dados.dados_pessoais.nome_pai} onChange={e => setSecao('dados_pessoais', { nome_pai: e.target.value })} />
              </div>
              <div>
                <label className={labelCls}>Nome da mãe</label>
                <input className={inputCls} value={dados.dados_pessoais.nome_mae} onChange={e => setSecao('dados_pessoais', { nome_mae: e.target.value })} />
              </div>
            </div>
          </div>
        </div>

        {/* Características pessoais */}
        <div className={sectionCls}>
          <h3 className="text-sm font-bold text-gray-700 uppercase mb-3 pb-2 border-b">Características pessoais</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Raça / Cor</label>
              <select className={inputCls} value={dados.dados_pessoais.raca_cor} onChange={e => setSecao('dados_pessoais', { raca_cor: e.target.value })}>
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
              <label className={labelCls}>Tipo sanguíneo</label>
              <select className={inputCls} value={dados.dados_pessoais.tipo_sanguineo} onChange={e => setSecao('dados_pessoais', { tipo_sanguineo: e.target.value })}>
                <option value="">—</option>
                <option value="A+">A+</option><option value="A-">A-</option>
                <option value="B+">B+</option><option value="B-">B-</option>
                <option value="AB+">AB+</option><option value="AB-">AB-</option>
                <option value="O+">O+</option><option value="O-">O-</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Deficiência</label>
              <select className={inputCls} value={dados.dados_pessoais.deficiente} onChange={e => setSecao('dados_pessoais', { deficiente: e.target.value })}>
                <option value="NENHUMA">Nenhuma</option>
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
              <label className={labelCls}>Altura (m)</label>
              <input className={inputCls} value={dados.dados_pessoais.altura} onChange={e => setSecao('dados_pessoais', { altura: e.target.value })} placeholder="1,75" />
            </div>
            <div>
              <label className={labelCls}>Peso (kg)</label>
              <input className={inputCls} value={dados.dados_pessoais.peso} onChange={e => setSecao('dados_pessoais', { peso: e.target.value })} placeholder="70" />
            </div>
            <div>
              <label className={labelCls}>Cor dos cabelos</label>
              <input className={inputCls} value={dados.dados_pessoais.cor_cabelos} onChange={e => setSecao('dados_pessoais', { cor_cabelos: e.target.value })} />
            </div>
            <div>
              <label className={labelCls}>Cor dos olhos</label>
              <input className={inputCls} value={dados.dados_pessoais.cor_olhos} onChange={e => setSecao('dados_pessoais', { cor_olhos: e.target.value })} />
            </div>
          </div>
        </div>

        {/* Escolaridade */}
        <div className={sectionCls}>
          <h3 className="text-sm font-bold text-gray-700 uppercase mb-3 pb-2 border-b">Escolaridade</h3>
          <div>
            <label className={labelCls}>Grau de instrução *</label>
            <select className={inputCls} value={dados.escolaridade.escolaridade_id} onChange={e => setSecao('escolaridade', { escolaridade_id: e.target.value })}>
              <option value="">— Selecione —</option>
              {escolaridades.map(es => <option key={es.id} value={es.id}>{es.nome}</option>)}
            </select>
          </div>
        </div>

        {/* Contato */}
        <div className={sectionCls}>
          <h3 className="text-sm font-bold text-gray-700 uppercase mb-3 pb-2 border-b">Contato</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Telefone</label>
              <input className={inputCls} value={dados.contato.telefone} onChange={e => setSecao('contato', { telefone: e.target.value })} placeholder="(00) 0000-0000" />
            </div>
            <div>
              <label className={labelCls}>Celular</label>
              <input className={inputCls} value={dados.contato.celular} onChange={e => setSecao('contato', { celular: e.target.value })} placeholder="(00) 00000-0000" />
            </div>
            <div>
              <label className={labelCls}>E-mail</label>
              <input type="email" className={inputCls} value={dados.contato.email} onChange={e => setSecao('contato', { email: e.target.value })} />
            </div>
          </div>
        </div>

        {/* Endereço */}
        <div className={sectionCls}>
          <h3 className="text-sm font-bold text-gray-700 uppercase mb-3 pb-2 border-b">Endereço</h3>
          <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
            <div className="md:col-span-2">
              <label className={labelCls}>CEP *</label>
              <input className={inputCls} value={dados.endereco.cep} onChange={e => { setSecao('endereco', { cep: e.target.value }); buscarCep(e.target.value); }} placeholder="00000-000" />
            </div>
            <div className="md:col-span-4">
              <label className={labelCls}>Rua / Logradouro *</label>
              <input className={inputCls} value={dados.endereco.rua} onChange={e => setSecao('endereco', { rua: e.target.value })} />
            </div>
            <div className="md:col-span-2">
              <label className={labelCls}>Número *</label>
              <input className={inputCls} value={dados.endereco.numero} onChange={e => setSecao('endereco', { numero: e.target.value })} />
            </div>
            <div className="md:col-span-4">
              <label className={labelCls}>Complemento</label>
              <input className={inputCls} value={dados.endereco.complemento} onChange={e => setSecao('endereco', { complemento: e.target.value })} />
            </div>
            <div className="md:col-span-3">
              <label className={labelCls}>Bairro *</label>
              <input className={inputCls} value={dados.endereco.bairro} onChange={e => setSecao('endereco', { bairro: e.target.value })} />
            </div>
            <div className="md:col-span-2">
              <label className={labelCls}>Cidade *</label>
              <input className={inputCls} value={dados.endereco.cidade} onChange={e => setSecao('endereco', { cidade: e.target.value })} />
            </div>
            <div className="md:col-span-1">
              <label className={labelCls}>UF *</label>
              <input className={inputCls} maxLength={2} value={dados.endereco.estado} onChange={e => setSecao('endereco', { estado: e.target.value.toUpperCase() })} />
            </div>
          </div>
        </div>

        {/* Documentos */}
        <div className={sectionCls}>
          <h3 className="text-sm font-bold text-gray-700 uppercase mb-3 pb-2 border-b">Documentos</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <label className={labelCls}>CTPS (nº)</label>
              <input className={inputCls} value={dados.documentos.ctps} onChange={e => setSecao('documentos', { ctps: e.target.value })} />
            </div>
            <div>
              <label className={labelCls}>CTPS — Série</label>
              <input className={inputCls} value={dados.documentos.serie_ctps} onChange={e => setSecao('documentos', { serie_ctps: e.target.value })} />
            </div>
            <div>
              <label className={labelCls}>CTPS — UF</label>
              <input className={inputCls} maxLength={2} value={dados.documentos.ctps_uf} onChange={e => setSecao('documentos', { ctps_uf: e.target.value })} />
            </div>
            <div>
              <label className={labelCls}>CTPS — Data Emissão</label>
              <input type="date" className={inputCls} value={dados.documentos.ctps_emissao} onChange={e => setSecao('documentos', { ctps_emissao: e.target.value })} />
            </div>
            <div>
              <label className={labelCls}>PIS / PASEP</label>
              <input className={inputCls} value={dados.documentos.pis_pasep} onChange={e => setSecao('documentos', { pis_pasep: e.target.value })} />
            </div>
            <div>
              <label className={labelCls}>Título de Eleitor</label>
              <input className={inputCls} value={dados.documentos.titulo_eleitor} onChange={e => setSecao('documentos', { titulo_eleitor: e.target.value })} />
            </div>
            <div>
              <label className={labelCls}>Título: Zona</label>
              <input className={inputCls} value={dados.documentos.titulo_zona} onChange={e => setSecao('documentos', { titulo_zona: e.target.value })} />
            </div>
            <div>
              <label className={labelCls}>Título: Seção</label>
              <input className={inputCls} value={dados.documentos.titulo_secao} onChange={e => setSecao('documentos', { titulo_secao: e.target.value })} />
            </div>
            <div>
              <label className={labelCls}>Título — Data Emissão</label>
              <input type="date" className={inputCls} value={dados.documentos.titulo_emissao} onChange={e => setSecao('documentos', { titulo_emissao: e.target.value })} />
            </div>

            {/* Reservista */}
            <div>
              <label className={labelCls}>Certificado de Reservista</label>
              <input className={inputCls} value={dados.documentos.reservista} onChange={e => setSecao('documentos', { reservista: e.target.value })} />
            </div>
            <div>
              <label className={labelCls}>Reservista — UF</label>
              <input className={inputCls} maxLength={2} value={dados.documentos.reservista_uf} onChange={e => setSecao('documentos', { reservista_uf: e.target.value })} />
            </div>
            <div>
              <label className={labelCls}>Reservista — Data Emissão</label>
              <input type="date" className={inputCls} value={dados.documentos.reservista_emissao} onChange={e => setSecao('documentos', { reservista_emissao: e.target.value })} />
            </div>

            {/* CNH */}
            <div>
              <label className={labelCls}>CNH (nº)</label>
              <input className={inputCls} value={dados.documentos.cnh} onChange={e => setSecao('documentos', { cnh: e.target.value })} />
            </div>
            <div>
              <label className={labelCls}>CNH — Categoria</label>
              <input className={inputCls} value={dados.documentos.cnh_categoria} onChange={e => setSecao('documentos', { cnh_categoria: e.target.value })} placeholder="A, B, AB..." />
            </div>
            <div>
              <label className={labelCls}>CNH — UF</label>
              <input className={inputCls} maxLength={2} value={dados.documentos.cnh_uf} onChange={e => setSecao('documentos', { cnh_uf: e.target.value })} />
            </div>
            <div>
              <label className={labelCls}>CNH — Validade</label>
              <input type="date" className={inputCls} value={dados.documentos.cnh_validade} onChange={e => setSecao('documentos', { cnh_validade: e.target.value })} />
            </div>
          </div>
        </div>

        {/* Cônjuge — só aparece se estado civil = casado ou união estável */}
        {(dados.dados_pessoais.estado_civil === 'CASADO' || dados.dados_pessoais.estado_civil === 'UNIAO_ESTAVEL') && (
          <div className={sectionCls}>
            <h3 className="text-sm font-bold text-gray-700 uppercase mb-3 pb-2 border-b">Dados do cônjuge</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="md:col-span-2">
                <label className={labelCls}>Nome do cônjuge</label>
                <input className={inputCls} value={dados.conjuge.nome} onChange={e => setSecao('conjuge', { nome: e.target.value })} />
              </div>
              <div>
                <label className={labelCls}>CPF do cônjuge</label>
                <input className={inputCls} value={dados.conjuge.cpf} onChange={e => setSecao('conjuge', { cpf: e.target.value })} placeholder="000.000.000-00" />
              </div>
              <div>
                <label className={labelCls}>Data de nascimento</label>
                <input type="date" className={inputCls} value={dados.conjuge.data_nascimento} onChange={e => setSecao('conjuge', { data_nascimento: e.target.value })} />
              </div>
              <div>
                <label className={labelCls}>Data do casamento / união</label>
                <input type="date" className={inputCls} value={dados.conjuge.data_casamento} onChange={e => setSecao('conjuge', { data_casamento: e.target.value })} />
              </div>
            </div>
          </div>
        )}

        {/* Para Estrangeiro — só aparece se nacionalidade não brasileira */}
        {dados.dados_pessoais.nacionalidade &&
         !dados.dados_pessoais.nacionalidade.toUpperCase().includes('BRASIL') && (
          <div className={sectionCls}>
            <h3 className="text-sm font-bold text-gray-700 uppercase mb-3 pb-2 border-b">Para estrangeiro</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className={labelCls}>País de nacionalidade</label>
                <input className={inputCls} value={dados.estrangeiro.pais_nacionalidade} onChange={e => setSecao('estrangeiro', { pais_nacionalidade: e.target.value })} />
              </div>
              <div>
                <label className={labelCls}>Condição de ingresso no Brasil</label>
                <input className={inputCls} value={dados.estrangeiro.condicao_ingresso} onChange={e => setSecao('estrangeiro', { condicao_ingresso: e.target.value })} placeholder="Visto permanente, refúgio..." />
              </div>
              <div>
                <label className={labelCls}>Data de chegada</label>
                <input type="date" className={inputCls} value={dados.estrangeiro.data_chegada} onChange={e => setSecao('estrangeiro', { data_chegada: e.target.value })} />
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={!!dados.estrangeiro.filhos_brasileiros}
                  onChange={e => setSecao('estrangeiro', { filhos_brasileiros: e.target.checked })}
                  className="w-4 h-4 accent-purple-600" />
                <span className="text-sm">Possui filhos com brasileiro(a)?</span>
              </label>
              <div>
                <label className={labelCls}>Quantos?</label>
                <input className={inputCls} value={dados.estrangeiro.filhos_brasileiros_qtd} onChange={e => setSecao('estrangeiro', { filhos_brasileiros_qtd: e.target.value })} />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={!!dados.estrangeiro.casado_brasileiro}
                  onChange={e => setSecao('estrangeiro', { casado_brasileiro: e.target.checked })}
                  className="w-4 h-4 accent-purple-600" />
                <span className="text-sm">Casado(a) com brasileiro(a)?</span>
              </label>

              <div className="md:col-span-3 border-t pt-3 mt-2">
                <div className="text-xs font-semibold uppercase text-gray-600 mb-2">Em caso de estrangeiro naturalizado brasileiro:</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Portaria de naturalização</label>
                    <input className={inputCls} value={dados.estrangeiro.portaria_naturalizacao} onChange={e => setSecao('estrangeiro', { portaria_naturalizacao: e.target.value })} />
                  </div>
                  <div>
                    <label className={labelCls}>Data da naturalização</label>
                    <input type="date" className={inputCls} value={dados.estrangeiro.data_naturalizacao} onChange={e => setSecao('estrangeiro', { data_naturalizacao: e.target.value })} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Banco */}
        <div className={sectionCls}>
          <h3 className="text-sm font-bold text-gray-700 uppercase mb-3 pb-2 border-b">Dados bancários</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="md:col-span-2">
              <label className={labelCls}>Banco</label>
              <input className={inputCls} value={dados.banco.banco} onChange={e => setSecao('banco', { banco: e.target.value })} />
            </div>
            <div>
              <label className={labelCls}>Agência</label>
              <input className={inputCls} value={dados.banco.agencia} onChange={e => setSecao('banco', { agencia: e.target.value })} />
            </div>
            <div>
              <label className={labelCls}>Conta</label>
              <input className={inputCls} value={dados.banco.conta} onChange={e => setSecao('banco', { conta: e.target.value })} />
            </div>
            <div>
              <label className={labelCls}>Tipo</label>
              <select className={inputCls} value={dados.banco.tipo_conta} onChange={e => setSecao('banco', { tipo_conta: e.target.value })}>
                <option value="">—</option>
                <option value="CORRENTE">Corrente</option>
                <option value="POUPANCA">Poupança</option>
                <option value="SALARIO">Salário</option>
              </select>
            </div>
            <div className="md:col-span-3">
              <label className={labelCls}>PIX (chave)</label>
              <input className={inputCls} value={dados.banco.pix} onChange={e => setSecao('banco', { pix: e.target.value })} />
            </div>
          </div>
        </div>

        {/* Dependentes */}
        <div className={sectionCls}>
          <div className="flex items-center justify-between mb-3 pb-2 border-b">
            <h3 className="text-sm font-bold text-gray-700 uppercase">Dependentes (filhos, cônjuge)</h3>
            <button onClick={addDependente} className="text-xs px-3 py-1.5 bg-purple-100 hover:bg-purple-200 text-purple-700 rounded font-semibold">+ Adicionar</button>
          </div>
          {(dados.dependentes || []).length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">Nenhum dependente. Clique em + Adicionar se houver.</p>
          ) : (
            <div className="space-y-3">
              {dados.dependentes.map((d, i) => (
                <div key={i} className="border border-gray-200 rounded p-3 bg-gray-50 space-y-2">
                  <div className="text-xs font-bold text-gray-500 uppercase">Dependente {i + 1}</div>
                  {/* Linha 1: Nome + Parentesco + Sexo */}
                  <div className="grid grid-cols-1 md:grid-cols-6 gap-2">
                    <input className={inputCls + ' md:col-span-3'} placeholder="Nome completo" value={d.nome} onChange={e => updDependente(i, { nome: e.target.value })} />
                    <select className={inputCls + ' md:col-span-2'} value={d.parentesco} onChange={e => updDependente(i, { parentesco: e.target.value })}>
                      <option value="">Parentesco</option>
                      <option value="FILHO">Filho(a)</option>
                      <option value="CONJUGE">Cônjuge</option>
                      <option value="ENTEADO">Enteado(a)</option>
                      <option value="PAI_MAE">Pai/Mãe</option>
                      <option value="OUTRO">Outro</option>
                    </select>
                    <select className={inputCls} value={d.sexo} onChange={e => updDependente(i, { sexo: e.target.value })}>
                      <option value="">Sexo</option>
                      <option value="M">M</option>
                      <option value="F">F</option>
                    </select>
                  </div>
                  {/* Linha 2: CPF + Data nascimento */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    <input className={inputCls} placeholder="CPF" value={d.cpf} onChange={e => updDependente(i, { cpf: e.target.value })} />
                    <div>
                      <label className="block text-[10px] uppercase text-gray-500 mb-0.5">Data de nascimento</label>
                      <input type="date" className={inputCls} value={d.data_nascimento} onChange={e => updDependente(i, { data_nascimento: e.target.value })} />
                    </div>
                  </div>
                  {/* Linha 3: Certidão de nascimento completa */}
                  <div className="grid grid-cols-1 md:grid-cols-6 gap-2">
                    <input className={inputCls + ' md:col-span-2'} placeholder="Certidão de Nascimento (nº)" value={d.certidao_numero} onChange={e => updDependente(i, { certidao_numero: e.target.value })} />
                    <div>
                      <label className="block text-[10px] uppercase text-gray-500 mb-0.5">Data certidão</label>
                      <input type="date" className={inputCls} value={d.certidao_data} onChange={e => updDependente(i, { certidao_data: e.target.value })} />
                    </div>
                    <input className={inputCls + ' md:col-span-2'} placeholder="Cartório" value={d.certidao_cartorio} onChange={e => updDependente(i, { certidao_cartorio: e.target.value })} />
                    <input className={inputCls} placeholder="Folha" value={d.certidao_folha} onChange={e => updDependente(i, { certidao_folha: e.target.value })} />
                  </div>
                  {/* Linha 4: Flags IR e SF */}
                  <div className="flex gap-4 flex-wrap">
                    <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={!!d.dependente_ir} onChange={e => updDependente(i, { dependente_ir: e.target.checked })} className="accent-purple-600" /> Dependente Imposto de Renda</label>
                    <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={!!d.dependente_sf} onChange={e => updDependente(i, { dependente_sf: e.target.checked })} className="accent-purple-600" /> Salário-família</label>
                  </div>
                  <button onClick={() => rmDependente(i)} className="text-xs text-red-600 hover:underline">🗑 Remover este dependente</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Opções do candidato — decisões pessoais separadas, com Sim/Não obrigatórios */}
        <div className={sectionCls + ' bg-purple-50 border-purple-200'}>
          <h3 className="text-sm font-bold text-purple-900 uppercase mb-2 pb-2 border-b border-purple-200">Opções (suas escolhas) *</h3>
          <p className="text-xs text-purple-800 mb-3">Responda Sim ou Não em cada uma das opções abaixo (obrigatório).</p>

          {[
            {
              campo: 'primeiro_emprego',
              titulo: 'É o seu primeiro emprego (1º registro na CTPS)?',
              detalhe: 'Marque "Sim" se você nunca teve carteira de trabalho assinada antes.',
            },
            {
              campo: 'contribuicao_sindical',
              titulo: 'Você autoriza o desconto da Contribuição Sindical Anual?',
              detalhe: 'Decisão facultativa do trabalhador (CLT, art. 545 e seguintes).',
            },
            {
              campo: 'vale_transporte',
              titulo: 'Você opta pela utilização do Vale-Transporte?',
              detalhe: 'Autoriza o desconto de até 6% do salário base, conforme Decreto nº 95.247/87.',
            },
          ].map(opt => (
            <div key={opt.campo} className="bg-white border border-purple-200 rounded-lg p-3 mb-3">
              <div className="font-semibold text-sm text-gray-800">{opt.titulo}</div>
              <div className="text-xs text-gray-500 mb-2">{opt.detalhe}</div>
              <div className="flex gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name={`opt_${opt.campo}`} value="SIM"
                    checked={dados.opcoes_candidato[opt.campo] === 'SIM'}
                    onChange={() => setSecao('opcoes_candidato', { [opt.campo]: 'SIM' })}
                    className="w-4 h-4 accent-purple-600" />
                  <span className="text-sm font-semibold text-gray-700">Sim</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name={`opt_${opt.campo}`} value="NAO"
                    checked={dados.opcoes_candidato[opt.campo] === 'NAO'}
                    onChange={() => setSecao('opcoes_candidato', { [opt.campo]: 'NAO' })}
                    className="w-4 h-4 accent-purple-600" />
                  <span className="text-sm font-semibold text-gray-700">Não</span>
                </label>
              </div>
            </div>
          ))}
        </div>

        {/* Botões */}
        <div className="bg-white border border-gray-200 rounded-lg p-4 shadow flex flex-col md:flex-row gap-2 justify-end sticky bottom-2">
          <button onClick={salvarRascunho} disabled={salvando}
            className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 rounded font-semibold text-sm disabled:opacity-50">
            💾 Salvar rascunho
          </button>
          <button onClick={finalizar} disabled={salvando}
            className="px-5 py-2.5 bg-purple-500 hover:bg-purple-600 text-white rounded font-bold text-sm disabled:opacity-50">
            ✅ Enviar ficha
          </button>
        </div>

        <p className="text-center text-xs text-gray-400 py-4">Seus dados são protegidos. Apenas o RH da empresa terá acesso.</p>
      </div>
    </div>
  );
}
