import { useState, useEffect } from 'react';
import { api } from '../../utils/api';
import toast from 'react-hot-toast';

/**
 * Conta Salário (1ª FASE).
 * Lista fichas de admissão em processo (pré-aprovadas) e permite gerar
 * o documento "Solicitação de Conta Salário" pra enviar ao banco, usando
 * os dados da ficha + dados pessoais preenchidos pelo candidato.
 */
export default function ContaSalarioSection() {
  const [fichas, setFichas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState(null); // ficha completa pro preview
  const [responsavelRh, setResponsavelRh] = useState('');
  const [telefoneRh, setTelefoneRh] = useState('');
  const [logoEmpresa, setLogoEmpresa] = useState(null);

  const carregar = async () => {
    try {
      const r = await api.get('/rh/fichas-admissao');
      const list = Array.isArray(r.data) ? r.data : [];
      // só candidatos EM PROCESSO (não cancelados nem já virou colaborador)
      setFichas(list.filter(f => f.status !== 'cancelada' && f.status !== 'colaborador_criado'));
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    carregar();
    // Carrega logo da personalização do sistema (mesma lógica dos docs padronizados)
    (async () => {
      try {
        const r = await api.get('/configurations/client_logo_url').catch(() => null);
        if (r?.data?.value) setLogoEmpresa(r.data.value);
      } catch { /* silencia */ }
    })();
  }, []);

  const abrirPreview = (f) => setPreview(f);

  const statusBadge = (status) => {
    const map = {
      rascunho:              { label: 'Rascunho',                cls: 'bg-gray-200 text-gray-700' },
      aguardando_candidato:  { label: 'Aguardando candidato',    cls: 'bg-amber-100 text-amber-800' },
      preenchida:            { label: 'Preenchida',              cls: 'bg-blue-100 text-blue-800' },
    };
    const m = map[status] || map.rascunho;
    return <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${m.cls}`}>{m.label}</span>;
  };

  if (loading) return <div className="p-8 text-center text-gray-400">Carregando candidatos...</div>;

  return (
    <div className="space-y-3">
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="mb-3">
          <h3 className="text-base font-bold text-gray-800">💳 Conta Salário</h3>
          <p className="text-xs text-gray-500">Gere a Solicitação de Conta Salário para enviar ao banco. Lista todos os candidatos em processo (que ainda não viraram colaboradores).</p>
        </div>

        {/* Campos do responsável de RH (preenchimento do RH, salvos no localStorage) */}
        <div className="bg-amber-50 border border-amber-200 rounded p-3 mb-3 grid grid-cols-1 md:grid-cols-2 gap-2">
          <div>
            <label className="block text-xs font-semibold text-amber-900 mb-1">Responsável de RH (vai assinar)</label>
            <input
              className="w-full px-3 py-2 border border-amber-300 rounded text-sm bg-white"
              value={responsavelRh}
              onChange={e => setResponsavelRh(e.target.value)}
              placeholder="Nome do responsável de RH"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-amber-900 mb-1">Telefone</label>
            <input
              className="w-full px-3 py-2 border border-amber-300 rounded text-sm bg-white"
              value={telefoneRh}
              onChange={e => setTelefoneRh(e.target.value)}
              placeholder="(00) 00000-0000"
            />
          </div>
        </div>

        {fichas.length === 0 ? (
          <div className="text-center py-10 text-gray-400 text-sm">
            Nenhum candidato em processo. Vá em <strong>Fichas de Admissão</strong> para criar uma ficha primeiro.
          </div>
        ) : (
          <div className="space-y-2">
            {fichas.map(f => (
              <div key={f.id} className="border border-gray-200 rounded-lg p-3 hover:border-emerald-300 transition flex items-center justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm text-gray-800">{f.candidato_nome}</span>
                    {statusBadge(f.status)}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {[f.cargo_nome, f.empresa_nome, f.salario ? `R$ ${Number(f.salario).toFixed(2)}` : null].filter(Boolean).join(' · ') || '—'}
                  </div>
                </div>
                <button onClick={() => abrirPreview(f)}
                  className="text-xs px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded font-semibold shadow flex-shrink-0">
                  📄 Gerar Conta Salário
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {preview && (
        <ContaSalarioPreview
          ficha={preview}
          responsavelRh={responsavelRh}
          telefoneRh={telefoneRh}
          logoEmpresa={logoEmpresa || preview.empresa_logo}
          onFechar={() => setPreview(null)}
        />
      )}
    </div>
  );
}

// ============================================================
// Preview + impressão do documento Santander
// ============================================================
function ContaSalarioPreview({ ficha, responsavelRh, telefoneRh, logoEmpresa, onFechar }) {
  // Dados pessoais que o candidato preencheu via link público
  const dados = ficha.candidato_dados || {};
  const pess = dados.dados_pessoais || {};
  const end = dados.endereco || {};
  const cont = dados.contato || {};

  const cpfFmt = (cpf) => {
    if (!cpf) return '___.___.___-__';
    const d = String(cpf).replace(/\D/g, '');
    if (d.length !== 11) return cpf;
    return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}`;
  };

  const dataFmt = (d) => {
    if (!d) return '__/__/____';
    try { return new Date(d).toLocaleDateString('pt-BR'); }
    catch { return d; }
  };

  const salarioFmt = (s) => {
    if (!s) return '_____,__';
    return Number(s).toFixed(2).replace('.', ',');
  };

  const nome = pess.nome || ficha.candidato_nome || '_______________________';
  const cpf = cpfFmt(pess.cpf);
  const enderecoTxt = end.rua || '_______________________';
  const numero = end.numero || '____';
  const bairro = end.bairro || '_______________________';
  const cep = end.cep || '_________';
  const cidade = end.cidade || '_______________________';
  const estado = end.estado || '__';
  const dataAdmissao = dataFmt(ficha.data_admissao);
  const cargo = ficha.cargo_nome || '_______________________';
  const salario = salarioFmt(ficha.salario);
  const telefone = cont.telefone || cont.celular || ficha.candidato_celular || '_______________________';
  const email = cont.email || ficha.candidato_email || '_______________________';
  const empresaNome = ficha.empresa_razao_social || ficha.empresa_nome || '_______________________';
  const empresaCnpj = ficha.empresa_cnpj || '__.___.___/____-__';

  const imprimir = () => {
    const w = window.open('', '_blank');
    if (!w) return;
    const logoHtml = logoEmpresa
      ? `<div style="text-align:center;margin:0 0 18px"><img src="${logoEmpresa}" alt="Logo" style="max-height:80px;max-width:200px;object-fit:contain"/></div>`
      : '';
    w.document.write(`<!DOCTYPE html><html><head><title>Solicitação de Conta Salário - ${nome}</title>
      <style>
        @page { size: A4; margin: 18mm }
        body { font-family: 'Times New Roman', serif; font-size: 11pt; line-height: 1.4; color: #000 }
        h1 { font-size: 13pt; text-align: center; margin: 0 0 4px; text-transform: uppercase }
        .sub { text-align: center; font-style: italic; font-size: 9pt; margin-bottom: 16px }
        p { margin: 0 0 10px; text-align: justify }
        .box { border: 1px solid #000; padding: 8px; margin: 10px 0; font-size: 10pt; line-height: 1.6 }
        .field { border-bottom: 1px dotted #000; padding: 0 4px }
        .sig { margin-top: 30px }
        .santander-box { border: 1px solid #000; padding: 8px; margin-top: 25px; font-size: 10pt }
        .santander-title { text-align: center; font-weight: bold; border-bottom: 1px solid #000; padding-bottom: 4px; margin-bottom: 6px }
      </style></head><body>
      ${logoHtml}
      <h1>Solicitação da Empresa para Abertura de Conta para Funcionário</h1>
      <div class="sub">[Logo da empresa emitente da carta — papel timbrado]</div>

      <p><strong>Prezado,</strong></p>
      <p>Escolhemos o Santander como nosso parceiro para o processamento do pagamento do seu salário.</p>
      <p>Conforme determinam as Resoluções nº 3.402 e 3.424/06, do Conselho Monetário Nacional, seu salário será creditado em uma conta de registro, denominada 'conta-salário', que não é movimentável por cheque, não admite créditos de outras naturezas qualquer salariais e possui serviços limitados.</p>
      <p>Você também poderá aproveitar as vantagens de ter uma <strong>CONTA CORRENTE</strong> e transferir automaticamente o seu salário da conta-salário para a conta corrente, podendo assim fazer uso de diversos outros serviços e condições diferenciadas oferecidas pelo Santander, que acreditamos que tenham um valor agregado para você (Pacote de serviços a partir de R$12,20 mensais). Para conhecer as vantagens de possuir uma conta corrente, compareça a uma agência até a data da sua admissão e apresente o original e uma cópia simples (frente e verso) dos documentos abaixo indicados:</p>
      <ul style="margin: 0 0 10px 24px; padding: 0">
        <li>Esta carta;</li>
        <li>Documento de identidade com foto;</li>
        <li>CPF — Cadastro de Pessoa Física;</li>
        <li>Comprovante de endereço de residência atual (onde prefere receber correspondência) com prazo inferior a 60 dias da data de vencimento. Ex.: conta de luz, de água, de gás, de telefone fixo, IPTU, contrato de locação (cópia autenticada com firma reconhecida);</li>
        <li>Se casado(a), apresentar nome completo do cônjuge, número do CPF, data de nascimento e data do casamento.</li>
      </ul>
      <p>Se a sua opção for apenas pela utilização da conta-salário, basta apresentar o número do documento de identidade e CPF. Neste caso, você poderá realizar a portabilidade de salário para outra instituição ao utilizar o cartão de débito, fornecido para a conta-salário. Procure a agência Santander de sua conveniência e fale com o gerente que está apto a orientá-lo e prestar todas as informações necessárias para a movimentação da sua conta.</p>

      <div class="box">
        <strong>Dados do Funcionário:</strong><br><br>
        Declaramos que o(a) Sr(a) <span class="field">${nome}</span>, portador do CPF: <span class="field">${cpf}</span>, residente e domiciliado na rua <span class="field">${enderecoTxt}</span> número: <span class="field">${numero}</span>, bairro <span class="field">${bairro}</span>, CEP <span class="field">${cep}</span>, cidade <span class="field">${cidade}</span>, UF <span class="field">${estado}</span>, é nosso funcionário desde <span class="field">${dataAdmissao}</span> (data de admissão) e exercerá o cargo de <span class="field">${cargo}</span>, com salário nominal mensal de R$ <span class="field">${salario}</span>. Telefones: <span class="field">${telefone}</span> e-mail: <span class="field">${email}</span>.
      </div>

      <p style="margin-top:16px">Responsável de RH: <span class="field">${responsavelRh || '_______________________'}</span> &nbsp;&nbsp; Telefone: <span class="field">${telefoneRh || '_______________________'}</span></p>
      <p>EMPRESA: <span class="field">${empresaNome}</span></p>
      <p>CNPJ principal/matriz: <span class="field">${empresaCnpj}</span></p>

      <div class="sig">
        <div style="border-top: 1px solid #000; width: 360px; margin-top: 50px; padding-top: 4px">Recursos Humanos (Assinatura do responsável pelo RH)</div>
      </div>

      <div class="santander-box">
        <div class="santander-title">PARA USO EXCLUSIVO DO BANCO SANTANDER</div>
        <p>Nome e Número da Agência: __________________________________________________</p>
        <p>Número da Conta: __________________________________________________________</p>
        <p>Responsável pelo atendimento: ______________________________________________</p>
      </div>

      <script>window.onload=()=>{window.print()}</script>
    </body></html>`);
    w.document.close();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[92vh] overflow-hidden flex flex-col">
        <div className="p-4 border-b flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold">Preview — Solicitação de Conta Salário</h3>
            <p className="text-xs text-gray-500">{nome}</p>
          </div>
          <button onClick={imprimir}
            className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold px-4 py-2 rounded text-sm">
            🖨️ Imprimir
          </button>
        </div>

        <div className="p-8 overflow-y-auto flex-1 bg-gray-50">
          <div className="bg-white shadow-md mx-auto max-w-2xl p-10" style={{ fontFamily: 'Times New Roman, serif', fontSize: '11pt', lineHeight: 1.4 }}>
            {logoEmpresa && (
              <div className="text-center mb-4">
                <img src={logoEmpresa} alt="Logo" className="inline-block max-h-20 max-w-[200px] object-contain" />
              </div>
            )}
            <h1 className="text-base font-bold text-center uppercase mb-1">Solicitação da Empresa para Abertura de Conta para Funcionário</h1>
            <p className="text-center italic text-xs mb-4">[Logo da empresa emitente da carta — papel timbrado]</p>

            <p className="mb-3"><strong>Prezado,</strong></p>
            <p className="mb-3 text-justify">Escolhemos o Santander como nosso parceiro para o processamento do pagamento do seu salário.</p>
            <p className="mb-3 text-justify">Conforme determinam as Resoluções nº 3.402 e 3.424/06, do Conselho Monetário Nacional, seu salário será creditado em uma conta de registro, denominada 'conta-salário', que não é movimentável por cheque, não admite créditos de outras naturezas qualquer salariais e possui serviços limitados.</p>
            <p className="mb-3 text-justify">Você também poderá aproveitar as vantagens de ter uma <strong>CONTA CORRENTE</strong> e transferir automaticamente o seu salário da conta-salário para a conta corrente...</p>

            <div className="border border-black p-3 my-4 text-sm leading-relaxed">
              <strong>Dados do Funcionário:</strong><br /><br />
              Declaramos que o(a) Sr(a) <u>{nome}</u>, portador do CPF: <u>{cpf}</u>, residente e domiciliado na rua <u>{enderecoTxt}</u> número: <u>{numero}</u>, bairro <u>{bairro}</u>, CEP <u>{cep}</u>, cidade <u>{cidade}</u>, UF <u>{estado}</u>, é nosso funcionário desde <u>{dataAdmissao}</u> (data de admissão) e exercerá o cargo de <u>{cargo}</u>, com salário nominal mensal de R$ <u>{salario}</u>. Telefones: <u>{telefone}</u> e-mail: <u>{email}</u>.
            </div>

            <p className="mb-2">Responsável de RH: <u>{responsavelRh || '_______________________'}</u> &nbsp;&nbsp; Telefone: <u>{telefoneRh || '_______________________'}</u></p>
            <p className="mb-2">EMPRESA: <u>{empresaNome}</u></p>
            <p className="mb-2">CNPJ principal/matriz: <u>{empresaCnpj}</u></p>

            <div className="mt-10 pt-4 border-t border-black w-72 text-xs">
              Recursos Humanos (Assinatura do responsável pelo RH)
            </div>

            <div className="border border-black p-3 mt-8 text-sm">
              <div className="text-center font-bold border-b border-black pb-1 mb-2">PARA USO EXCLUSIVO DO BANCO SANTANDER</div>
              <p>Nome e Número da Agência: ____________________________</p>
              <p>Número da Conta: ___________________________________</p>
              <p>Responsável pelo atendimento: _________________________</p>
            </div>
          </div>
        </div>

        <div className="p-4 border-t flex justify-end">
          <button onClick={onFechar} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded text-sm font-semibold">Fechar</button>
        </div>
      </div>
    </div>
  );
}
