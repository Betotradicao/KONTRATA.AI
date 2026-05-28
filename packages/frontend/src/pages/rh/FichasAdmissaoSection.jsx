import { useState, useEffect } from 'react';
import { api } from '../../utils/api';
import toast from 'react-hot-toast';

/**
 * Ficha de Admissão (1ª FASE CONTRATAÇÃO).
 * - RH cria uma ficha com dados de contratação usando dropdowns dos cadastros.
 * - Gera link público pro candidato preencher dados pessoais (FASE B).
 * - Depois vira colaborador com 1 clique (FASE B).
 */
export default function FichasAdmissaoSection() {
  const [fichas, setFichas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);
  const [fichaEditando, setFichaEditando] = useState(null);

  // Cadastros (dropdowns)
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
      horario_entrada: '', horario_intervalo: '', horario_saida: '',
      primeiro_emprego: false, contribuicao_sindical: false, vale_transporte: false,
    });
    setModalAberto(true);
  };

  const abrirFicha = (f) => { setFichaEditando({ ...f }); setModalAberto(true); };

  const salvar = async () => {
    const f = fichaEditando;
    if (!f.candidato_nome?.trim()) { toast.error('Nome do candidato é obrigatório'); return; }
    try {
      // Limpa strings vazias pra null (FKs)
      const payload = { ...f };
      ['company_id','cargo_id','departamento_id','jornada_id','escala_id','escala_domingo_id',
       'regime_trabalho_id','prazo_experiencia_id','forma_pagamento_id','data_admissao','salario'
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
    } catch (e) { toast.error('Erro ao excluir'); }
  };

  const gerarLink = async (id) => {
    try {
      const r = await api.post(`/rh/fichas-admissao/${id}/gerar-link`);
      const url = `${window.location.origin}/admissao/${r.data.public_token}`;
      await navigator.clipboard.writeText(url).catch(() => {});
      toast.success('Link gerado e copiado!');
      window.prompt('Link do candidato (Ctrl+C pra copiar):', url);
      carregarFichas();
    } catch (e) { toast.error('Erro ao gerar link'); }
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

  if (loading) return <div className="p-8 text-center text-gray-400">Carregando fichas...</div>;

  return (
    <div className="space-y-3">
      {/* Header com botão Nova Ficha */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-base font-bold text-gray-800">📋 Fichas de Admissão</h3>
            <p className="text-xs text-gray-500">RH preenche os dados de contratação; o candidato completa dados pessoais via link.</p>
          </div>
          <button onClick={novaFicha}
            className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold px-4 py-2 rounded text-sm shadow">
            + Nova Ficha
          </button>
        </div>

        {fichas.length === 0 ? (
          <div className="text-center py-10 text-gray-400 text-sm">
            Nenhuma ficha criada ainda. Clique em <strong>+ Nova Ficha</strong> pra começar.
          </div>
        ) : (
          <div className="space-y-2">
            {fichas.map(f => (
              <div key={f.id} className="border border-gray-200 rounded-lg p-3 hover:border-emerald-300 transition">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm text-gray-800 truncate">{f.candidato_nome}</span>
                      {statusBadge(f.status)}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {[f.cargo_nome, f.empresa_nome, f.data_admissao ? `Admissão: ${new Date(f.data_admissao).toLocaleDateString('pt-BR')}` : null]
                        .filter(Boolean).join(' · ')}
                    </div>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <button onClick={() => abrirFicha(f)}
                      className="text-xs px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded font-semibold">✏️ Editar</button>
                    {f.status !== 'colaborador_criado' && (
                      <button onClick={() => gerarLink(f.id)}
                        className="text-xs px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded font-semibold">🔗 Link</button>
                    )}
                    {f.status === 'preenchida' && (
                      <button onClick={() => criarColaborador(f.id)}
                        className="text-xs px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded font-semibold">✅ Cadastrar colaborador</button>
                    )}
                    <button onClick={() => excluir(f.id)}
                      className="text-xs px-2 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 rounded font-semibold">🗑️</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {modalAberto && fichaEditando && (
        <FichaAdmissaoModal
          ficha={fichaEditando} setFicha={setFichaEditando}
          empresas={empresas} cargos={cargos} departamentos={departamentos}
          jornadas={jornadas} escalas={escalas} escalasDomingo={escalasDomingo}
          regimes={regimes} prazos={prazos} formasPgto={formasPgto}
          onSalvar={salvar} onFechar={() => { setModalAberto(false); setFichaEditando(null); }}
        />
      )}
    </div>
  );
}

// ============================================================
// Modal do formulário da ficha
// ============================================================
function FichaAdmissaoModal({ ficha, setFicha, empresas, cargos, departamentos, jornadas, escalas, escalasDomingo, regimes, prazos, formasPgto, onSalvar, onFechar }) {
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
                <input className={inputCls} value={ficha.candidato_nome || ''} onChange={e => set('candidato_nome', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>E-mail</label>
                <input type="email" className={inputCls} value={ficha.candidato_email || ''} onChange={e => set('candidato_email', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Celular</label>
                <input className={inputCls} value={ficha.candidato_celular || ''} onChange={e => set('candidato_celular', e.target.value)} placeholder="(00) 00000-0000" />
              </div>
              <div>
                <label className={labelCls}>Empresa</label>
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
                <label className={labelCls}>Data de Admissão</label>
                <input type="date" className={inputCls} value={ficha.data_admissao || ''} onChange={e => set('data_admissao', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Cargo / Função</label>
                <select className={selectCls} value={ficha.cargo_id || ''} onChange={e => set('cargo_id', e.target.value)}>
                  <option value="">— Selecione —</option>{optList(cargos)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Departamento</label>
                <select className={selectCls} value={ficha.departamento_id || ''} onChange={e => set('departamento_id', e.target.value)}>
                  <option value="">— Selecione —</option>{optList(departamentos)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Salário</label>
                <input type="number" step="0.01" className={inputCls} value={ficha.salario || ''} onChange={e => set('salario', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Prazo de Experiência</label>
                <select className={selectCls} value={ficha.prazo_experiencia_id || ''} onChange={e => set('prazo_experiencia_id', e.target.value)}>
                  <option value="">— Selecione —</option>{optList(prazos)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Forma de Pagamento</label>
                <select className={selectCls} value={ficha.forma_pagamento_id || ''} onChange={e => set('forma_pagamento_id', e.target.value)}>
                  <option value="">— Selecione —</option>{optList(formasPgto)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Regime de Trabalho</label>
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
                <label className={labelCls}>Entrada</label>
                <input type="time" className={inputCls} value={ficha.horario_entrada || ''} onChange={e => set('horario_entrada', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Intervalo</label>
                <input className={inputCls} value={ficha.horario_intervalo || ''} onChange={e => set('horario_intervalo', e.target.value)} placeholder="ex: 12:00 às 13:00" />
              </div>
              <div>
                <label className={labelCls}>Saída</label>
                <input type="time" className={inputCls} value={ficha.horario_saida || ''} onChange={e => set('horario_saida', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Jornada</label>
                <select className={selectCls} value={ficha.jornada_id || ''} onChange={e => set('jornada_id', e.target.value)}>
                  <option value="">— Selecione —</option>{optList(jornadas)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Escala</label>
                <select className={selectCls} value={ficha.escala_id || ''} onChange={e => set('escala_id', e.target.value)}>
                  <option value="">— Selecione —</option>{optList(escalas)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Escala Domingo</label>
                <select className={selectCls} value={ficha.escala_domingo_id || ''} onChange={e => set('escala_domingo_id', e.target.value)}>
                  <option value="">— Selecione —</option>{optList(escalasDomingo)}
                </select>
              </div>
            </div>
          </div>

          {/* Painel READ-ONLY com os dados preenchidos pelo candidato via link público.
              Aparece SOMENTE quando há candidato_dados (status >= preenchida ou rascunho do candidato). */}
          {ficha.candidato_dados && Object.keys(ficha.candidato_dados).length > 0 && (
            <DadosCandidatoPainel dados={ficha.candidato_dados} />
          )}
        </div>

        <div className="p-4 border-t flex justify-end gap-2">
          <button onClick={onFechar} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded text-sm font-semibold">Cancelar</button>
          <button onClick={onSalvar} className="px-5 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded text-sm font-bold">
            💾 Salvar
          </button>
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
function DadosCandidatoPainel({ dados }) {
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
  const temConjuge = pess.estado_civil === 'casado' || pess.estado_civil === 'uniao_estavel';
  const ehEstrangeiro = pess.nacionalidade && !String(pess.nacionalidade).toUpperCase().includes('BRASIL');

  const fmtDate = (d) => { if (!d) return '—'; try { return new Date(d).toLocaleDateString('pt-BR'); } catch { return d; } };
  const fmtBool = (b) => b ? '✅ Sim' : '❌ Não';
  const fmt = (v) => v || '—';

  const labelStyle = 'text-[10px] uppercase font-semibold text-gray-500';
  const valueStyle = 'text-sm text-gray-800 font-medium';
  const sectionBox = 'bg-purple-50 border border-purple-200 rounded-lg p-4';
  const subTitle = 'text-sm font-bold text-purple-900 uppercase mb-3 pb-2 border-b border-purple-200 flex items-center gap-2';

  const Item = ({ label, value }) => (
    <div>
      <div className={labelStyle}>{label}</div>
      <div className={valueStyle}>{value || '—'}</div>
    </div>
  );

  return (
    <div className="space-y-3 mt-3">
      <div className="bg-gradient-to-r from-purple-600 to-purple-500 text-white rounded-lg p-3 text-sm font-bold">
        📝 Dados preenchidos pelo candidato
      </div>

      {/* Dados pessoais */}
      <div className={sectionBox}>
        <h4 className={subTitle}>Dados pessoais</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Item label="Nome" value={pess.nome} />
          <Item label="CPF" value={pess.cpf} />
          <Item label="RG" value={pess.rg} />
          <Item label="RG — Órgão" value={pess.rg_orgao_emissor} />
          <Item label="RG — UF" value={pess.rg_uf} />
          <Item label="RG — Emissão" value={fmtDate(pess.rg_emissao)} />
          <Item label="Data nasc." value={fmtDate(pess.data_nascimento)} />
          <Item label="Sexo" value={pess.sexo} />
          <Item label="Estado civil" value={pess.estado_civil} />
          <Item label="Nacionalidade" value={pess.nacionalidade} />
          <Item label="Naturalidade" value={pess.naturalidade} />
          <Item label="Naturalidade UF" value={pess.naturalidade_uf} />
          <Item label="Pai" value={pess.nome_pai} />
          <Item label="Mãe" value={pess.nome_mae} />
          <Item label="Raça/Cor" value={pess.raca_cor} />
          <Item label="Sanguíneo" value={pess.tipo_sanguineo} />
          <Item label="Altura" value={pess.altura} />
          <Item label="Peso" value={pess.peso} />
          <Item label="Cabelos" value={pess.cor_cabelos} />
          <Item label="Olhos" value={pess.cor_olhos} />
          <Item label="Deficiência" value={pess.deficiente} />
        </div>
      </div>

      {/* Cônjuge — só se casado/união estável */}
      {temConjuge && (
        <div className={sectionBox}>
          <h4 className={subTitle}>Cônjuge</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Item label="Nome" value={conj.nome} />
            <Item label="CPF" value={conj.cpf} />
            <Item label="Data nasc." value={fmtDate(conj.data_nascimento)} />
            <Item label="Data casamento" value={fmtDate(conj.data_casamento)} />
          </div>
        </div>
      )}

      {/* Estrangeiro — só se nacionalidade não brasileira */}
      {ehEstrangeiro && (
        <div className={sectionBox}>
          <h4 className={subTitle}>Para estrangeiro</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Item label="País de nacionalidade" value={estr.pais_nacionalidade} />
            <Item label="Condição de ingresso" value={estr.condicao_ingresso} />
            <Item label="Data de chegada" value={fmtDate(estr.data_chegada)} />
            <Item label="Filhos c/ brasileiro" value={fmtBool(estr.filhos_brasileiros)} />
            <Item label="Quantos" value={estr.filhos_brasileiros_qtd} />
            <Item label="Casado c/ brasileiro" value={fmtBool(estr.casado_brasileiro)} />
            <Item label="Portaria naturalização" value={estr.portaria_naturalizacao} />
            <Item label="Data naturalização" value={fmtDate(estr.data_naturalizacao)} />
          </div>
        </div>
      )}

      {/* Contato */}
      <div className={sectionBox}>
        <h4 className={subTitle}>Contato</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Item label="Telefone" value={cont.telefone} />
          <Item label="Celular" value={cont.celular} />
          <Item label="E-mail" value={cont.email} />
        </div>
      </div>

      {/* Endereço */}
      <div className={sectionBox}>
        <h4 className={subTitle}>Endereço</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Item label="CEP" value={end.cep} />
          <Item label="Rua" value={end.rua} />
          <Item label="Nº" value={end.numero} />
          <Item label="Complemento" value={end.complemento} />
          <Item label="Bairro" value={end.bairro} />
          <Item label="Cidade" value={end.cidade} />
          <Item label="UF" value={end.estado} />
        </div>
      </div>

      {/* Escolaridade */}
      {esc.escolaridade_id && (
        <div className={sectionBox}>
          <h4 className={subTitle}>Escolaridade</h4>
          <Item label="Grau" value={esc.escolaridade_id} />
        </div>
      )}

      {/* Documentos */}
      <div className={sectionBox}>
        <h4 className={subTitle}>Documentos</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Item label="CTPS" value={doc.ctps} />
          <Item label="CTPS Série" value={doc.serie_ctps} />
          <Item label="CTPS UF" value={doc.ctps_uf} />
          <Item label="CTPS Emissão" value={fmtDate(doc.ctps_emissao)} />
          <Item label="PIS/PASEP" value={doc.pis_pasep} />
          <Item label="Tít. Eleitor" value={doc.titulo_eleitor} />
          <Item label="Tít. Zona" value={doc.titulo_zona} />
          <Item label="Tít. Seção" value={doc.titulo_secao} />
          <Item label="Tít. Emissão" value={fmtDate(doc.titulo_emissao)} />
          <Item label="Reservista" value={doc.reservista} />
          <Item label="Reserv. UF" value={doc.reservista_uf} />
          <Item label="Reserv. Emissão" value={fmtDate(doc.reservista_emissao)} />
          <Item label="CNH" value={doc.cnh} />
          <Item label="CNH Cat." value={doc.cnh_categoria} />
          <Item label="CNH UF" value={doc.cnh_uf} />
          <Item label="CNH Valid." value={fmtDate(doc.cnh_validade)} />
        </div>
      </div>

      {/* Banco */}
      <div className={sectionBox}>
        <h4 className={subTitle}>Dados bancários</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Item label="Banco" value={bnc.banco} />
          <Item label="Agência" value={bnc.agencia} />
          <Item label="Conta" value={bnc.conta} />
          <Item label="Tipo" value={bnc.tipo_conta} />
          <Item label="PIX" value={bnc.pix} />
        </div>
      </div>

      {/* Dependentes */}
      {deps.length > 0 && (
        <div className={sectionBox}>
          <h4 className={subTitle}>Dependentes ({deps.length})</h4>
          <div className="space-y-3">
            {deps.map((d, i) => (
              <div key={i} className="bg-white rounded p-3 border border-purple-100">
                <div className="font-bold text-sm text-gray-800 mb-2">{fmt(d.nome)} — {fmt(d.parentesco)} {d.sexo ? `(${d.sexo})` : ''}</div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                  <Item label="CPF" value={d.cpf} />
                  <Item label="Data nasc." value={fmtDate(d.data_nascimento)} />
                  <Item label="IR" value={fmtBool(d.dependente_ir)} />
                  <Item label="Salário-família" value={fmtBool(d.dependente_sf)} />
                  <Item label="Certidão (nº)" value={d.certidao_numero} />
                  <Item label="Data certidão" value={fmtDate(d.certidao_data)} />
                  <Item label="Cartório" value={d.certidao_cartorio} />
                  <Item label="Folha" value={d.certidao_folha} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Opções */}
      <div className={sectionBox}>
        <h4 className={subTitle}>Opções (escolhas do candidato)</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Item label="1º emprego" value={fmtBool(opc.primeiro_emprego)} />
          <Item label="Contribuição Sindical" value={fmtBool(opc.contribuicao_sindical)} />
          <Item label="Vale Transporte" value={fmtBool(opc.vale_transporte)} />
        </div>
      </div>
    </div>
  );
}
