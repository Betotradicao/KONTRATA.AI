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
      nome: '', cpf: '', rg: '', data_nascimento: '', sexo: '', estado_civil: '',
      nacionalidade: 'BRASILEIRO(A)', naturalidade: '', nome_pai: '', nome_mae: '',
      raca_cor: '', tipo_sanguineo: '', altura: '', peso: '',
      cor_cabelos: '', cor_olhos: '', deficiente: 'NENHUMA'
    },
    escolaridade: { escolaridade_id: '' },
    endereco: { cep: '', rua: '', numero: '', complemento: '', bairro: '', cidade: '', estado: '' },
    contato: { telefone: '', celular: '', email: '' },
    documentos: {
      ctps: '', serie_ctps: '', pis_pasep: '', titulo_eleitor: '', titulo_zona: '', titulo_secao: '',
      reservista: '', reservista_uf: '', reservista_emissao: '',
      cnh: '', cnh_categoria: '', cnh_uf: '', cnh_validade: ''
    },
    banco: { banco: '', agencia: '', conta: '', tipo_conta: '', pix: '' },
    conjuge: { nome: '', cpf: '', data_nascimento: '', data_casamento: '' },
    dependentes: [],
    // DECISÕES DO CANDIDATO (antes ficavam na ficha do RH — agora é o próprio que opta):
    opcoes_candidato: { primeiro_emprego: false, contribuicao_sindical: false, vale_transporte: false },
  });

  const [escolaridades, setEscolaridades] = useState([]);
  useEffect(() => {
    (async () => {
      try {
        const r = await api.get(`/rh/fichas-admissao/public/${token}/escolaridades`).catch(() => null);
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
    dependentes: [...(d.dependentes || []), { nome: '', parentesco: '', cpf: '', data_nascimento: '', dependente_ir: false, dependente_sf: false }]
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
    if (!dados.dados_pessoais.cpf?.trim()) { toast.error('CPF é obrigatório'); return; }
    if (!dados.dados_pessoais.data_nascimento) { toast.error('Data de nascimento é obrigatória'); return; }
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
            <div><span className="text-gray-500">Vale Transporte:</span> {ficha?.vale_transporte ? 'Sim' : 'Não'}</div>
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
              <label className={labelCls}>RG</label>
              <input className={inputCls} value={dados.dados_pessoais.rg} onChange={e => setSecao('dados_pessoais', { rg: e.target.value })} />
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
                <option value="solteiro">Solteiro(a)</option>
                <option value="casado">Casado(a)</option>
                <option value="divorciado">Divorciado(a)</option>
                <option value="viuvo">Viúvo(a)</option>
                <option value="uniao_estavel">União estável</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Nacionalidade</label>
              <input className={inputCls} value={dados.dados_pessoais.nacionalidade} onChange={e => setSecao('dados_pessoais', { nacionalidade: e.target.value })} />
            </div>
            <div>
              <label className={labelCls}>Naturalidade (cidade/UF)</label>
              <input className={inputCls} value={dados.dados_pessoais.naturalidade} onChange={e => setSecao('dados_pessoais', { naturalidade: e.target.value })} />
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
            <label className={labelCls}>Grau de instrução</label>
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
              <label className={labelCls}>CEP</label>
              <input className={inputCls} value={dados.endereco.cep} onChange={e => { setSecao('endereco', { cep: e.target.value }); buscarCep(e.target.value); }} placeholder="00000-000" />
            </div>
            <div className="md:col-span-4">
              <label className={labelCls}>Rua / Logradouro</label>
              <input className={inputCls} value={dados.endereco.rua} onChange={e => setSecao('endereco', { rua: e.target.value })} />
            </div>
            <div className="md:col-span-2">
              <label className={labelCls}>Número</label>
              <input className={inputCls} value={dados.endereco.numero} onChange={e => setSecao('endereco', { numero: e.target.value })} />
            </div>
            <div className="md:col-span-4">
              <label className={labelCls}>Complemento</label>
              <input className={inputCls} value={dados.endereco.complemento} onChange={e => setSecao('endereco', { complemento: e.target.value })} />
            </div>
            <div className="md:col-span-3">
              <label className={labelCls}>Bairro</label>
              <input className={inputCls} value={dados.endereco.bairro} onChange={e => setSecao('endereco', { bairro: e.target.value })} />
            </div>
            <div className="md:col-span-2">
              <label className={labelCls}>Cidade</label>
              <input className={inputCls} value={dados.endereco.cidade} onChange={e => setSecao('endereco', { cidade: e.target.value })} />
            </div>
            <div className="md:col-span-1">
              <label className={labelCls}>UF</label>
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
              <label className={labelCls}>Série CTPS</label>
              <input className={inputCls} value={dados.documentos.serie_ctps} onChange={e => setSecao('documentos', { serie_ctps: e.target.value })} />
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
                <option value="corrente">Corrente</option>
                <option value="poupanca">Poupança</option>
                <option value="salario">Salário</option>
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
                <div key={i} className="border border-gray-200 rounded p-3 bg-gray-50">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                    <input className={inputCls + ' md:col-span-2'} placeholder="Nome" value={d.nome} onChange={e => updDependente(i, { nome: e.target.value })} />
                    <select className={inputCls} value={d.parentesco} onChange={e => updDependente(i, { parentesco: e.target.value })}>
                      <option value="">Parentesco</option>
                      <option value="filho">Filho(a)</option>
                      <option value="conjuge">Cônjuge</option>
                      <option value="enteado">Enteado(a)</option>
                      <option value="outro">Outro</option>
                    </select>
                    <input type="date" className={inputCls} value={d.data_nascimento} onChange={e => updDependente(i, { data_nascimento: e.target.value })} />
                    <input className={inputCls + ' md:col-span-2'} placeholder="CPF" value={d.cpf} onChange={e => updDependente(i, { cpf: e.target.value })} />
                    <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={!!d.dependente_ir} onChange={e => updDependente(i, { dependente_ir: e.target.checked })} /> Dependente IR</label>
                    <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={!!d.dependente_sf} onChange={e => updDependente(i, { dependente_sf: e.target.checked })} /> Salário-família</label>
                  </div>
                  <button onClick={() => rmDependente(i)} className="text-xs text-red-600 hover:underline mt-2">remover</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Opções do candidato — decisões pessoais (não do RH) */}
        <div className={sectionCls + ' bg-purple-50 border-purple-200'}>
          <h3 className="text-sm font-bold text-purple-900 uppercase mb-3 pb-2 border-b border-purple-200">Opções (suas escolhas)</h3>
          <p className="text-xs text-purple-800 mb-3">Marque conforme sua situação/decisão. Você pode mudar antes de enviar a ficha.</p>
          <div className="space-y-3">
            <label className="flex items-start gap-3 cursor-pointer p-2 hover:bg-purple-100/50 rounded">
              <input type="checkbox" checked={!!dados.opcoes_candidato.primeiro_emprego}
                onChange={e => setSecao('opcoes_candidato', { primeiro_emprego: e.target.checked })}
                className="w-5 h-5 mt-0.5 accent-purple-600" />
              <div>
                <div className="font-semibold text-sm text-gray-800">É o seu primeiro emprego (1º registro na CTPS)?</div>
                <div className="text-xs text-gray-500">Marque se você nunca teve carteira assinada antes.</div>
              </div>
            </label>
            <label className="flex items-start gap-3 cursor-pointer p-2 hover:bg-purple-100/50 rounded">
              <input type="checkbox" checked={!!dados.opcoes_candidato.contribuicao_sindical}
                onChange={e => setSecao('opcoes_candidato', { contribuicao_sindical: e.target.checked })}
                className="w-5 h-5 mt-0.5 accent-purple-600" />
              <div>
                <div className="font-semibold text-sm text-gray-800">Autorizo desconto da Contribuição Sindical Anual</div>
                <div className="text-xs text-gray-500">Decisão facultativa do trabalhador (CLT, art. 545 e seguintes).</div>
              </div>
            </label>
            <label className="flex items-start gap-3 cursor-pointer p-2 hover:bg-purple-100/50 rounded">
              <input type="checkbox" checked={!!dados.opcoes_candidato.vale_transporte}
                onChange={e => setSecao('opcoes_candidato', { vale_transporte: e.target.checked })}
                className="w-5 h-5 mt-0.5 accent-purple-600" />
              <div>
                <div className="font-semibold text-sm text-gray-800">Opto pela utilização do Vale-Transporte</div>
                <div className="text-xs text-gray-500">Autorizo o desconto de até 6% do salário base, conforme Decreto nº 95.247/87.</div>
              </div>
            </label>
          </div>
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
