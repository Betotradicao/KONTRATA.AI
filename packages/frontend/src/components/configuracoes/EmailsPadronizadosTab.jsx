import { useState, useEffect, useRef } from 'react';
import api from '../../services/api';
import toast, { Toaster } from 'react-hot-toast';

/**
 * Aba "EMAILS PADRONIZADOS" (dentro de Configurações RH).
 * Duas frentes:
 *  - Destinatários: lista editável (Contabilidade, RH, Depto Pessoal, etc).
 *  - Por documento: assunto + corpo padrão de cada documento (começando pela Ficha Cadastral).
 *
 * Tudo persiste na tabela `configurations` (por cliente):
 *  - email_destinatarios       -> JSON [{ nome, email }]
 *  - email_textos_padrao       -> JSON { <docKey>: { assunto, corpo } }
 *
 * Placeholders aceitos no assunto/corpo (substituídos na hora do envio):
 *  {NOME}, {CARGO}, {EMPRESA}, {RESPONSAVEL}
 */

// Variáveis disponíveis pro texto padrão. Clicáveis -> inserem no cursor.
// {RESPONSAVEL} = nome do usuário administrativo (Liberação de Acesso) escolhido no envio.
const VARIAVEIS = [
  { token: '{NOME}', desc: 'Nome do colaborador' },
  { token: '{CARGO}', desc: 'Cargo / função' },
  { token: '{EMPRESA}', desc: 'Nome de exibição da empresa' },
  { token: '{RESPONSAVEL}', desc: 'Responsável pelo envio (usuário do sistema)' },
];

// Documentos que terão sub-aba de mensagem padrão. Comecamos pela Ficha Cadastral.
// Para adicionar outro doc no futuro, basta incluir aqui.
const BR = '\n'; // quebra de linha usada nos corpos de e-mail
const DOC_TIPOS = [
  {
    key: 'ficha_cadastral',
    label: '📋 Ficha Cadastral',
    defaultAssunto: 'Ficha Cadastral - {NOME}',
    defaultCorpo:
      'Olá,\n\nSegue em anexo a Ficha Cadastral do colaborador {NOME} ({CARGO}).\n\nQualquer dúvida estamos à disposição.\n\nAtenciosamente,\n{RESPONSAVEL}\n{EMPRESA}',
  },
  {
    key: 'guia_exame',
    label: '🏥 Medicina do Trabalho',
    defaultAssunto: 'Exame {TIPO_EXAME} - {NOME}',
    defaultCorpo:
      'Olá,' + BR + BR +
      'Segue em anexo o Guia de Exame Ocupacional ({TIPO_EXAME}) do candidato {NOME} ({CARGO}).' + BR + BR +
      'Agendamento: {AGENDADO}' + BR + BR +
      'Fico à disposição para qualquer dúvida.' + BR + BR +
      'Atenciosamente,' + BR + '{RESPONSAVEL}' + BR + '{EMPRESA}',
    // Variáveis que só fazem sentido neste documento
    variaveisExtra: [
      { token: '{TIPO_EXAME}', desc: 'Tipo do exame (Admissional, Periódico...)' },
      { token: '{AGENDADO}', desc: 'Data e hora agendadas' },
    ],
  },
];

export default function EmailsPadronizadosTab() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [subAba, setSubAba] = useState('empresa');

  const [empresa, setEmpresa] = useState({ user: '', pass: '', nome: '' }); // remetente (cliente)
  const [destinatarios, setDestinatarios] = useState([]); // [{ nome, email }]
  const [textos, setTextos] = useState({}); // { docKey: { assunto, corpo } }
  // Dados da clinica de medicina do trabalho. Vao num JSON unico em
  // `guia_exame_config` — sem migration, igual ao resto desta tela.
  const [guiaCfg, setGuiaCfg] = useState({
    email: '', clinicaEndereco: '', clinicaCidade: '',
    clinicaTelefone: '', clinicaSite: '', medicoPcmso: '', responsavel: '',
  });

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get('/configurations');
        // remetente (e-mail da empresa)
        setEmpresa({
          user: data.email_empresa_user || '',
          pass: data.email_empresa_pass || '',
          nome: data.email_empresa_nome || '',
        });
        // destinatarios
        let dest = [];
        try { dest = JSON.parse(data.email_destinatarios || '[]'); } catch { dest = []; }
        if (!Array.isArray(dest) || dest.length === 0) {
          dest = [
            { nome: 'Contabilidade', email: '' },
            { nome: 'RH', email: '' },
            { nome: 'Departamento Pessoal', email: '' },
          ];
        }
        setDestinatarios(dest);
        // textos padrao
        let txt = {};
        try { txt = JSON.parse(data.email_textos_padrao || '{}'); } catch { txt = {}; }
        // preenche defaults pros docs que ainda nao tem texto salvo
        DOC_TIPOS.forEach((d) => {
          if (!txt[d.key]) txt[d.key] = { assunto: d.defaultAssunto, corpo: d.defaultCorpo };
        });
        setTextos(txt);
        // config da clinica
        try {
          const g = JSON.parse(data.guia_exame_config || '{}');
          setGuiaCfg((prev) => ({ ...prev, ...g }));
        } catch { /* config invalida — segue com os campos vazios */ }
      } catch (e) {
        console.error('Erro ao carregar emails padronizados:', e);
        toast.error('Erro ao carregar configurações de e-mail');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const salvarEmpresa = async () => {
    const user = (empresa.user || '').trim();
    const pass = (empresa.pass || '').trim();
    if (!user || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user)) {
      toast.error('Informe um e-mail válido da empresa');
      return;
    }
    if (!pass) {
      toast.error('Informe a senha de app do e-mail');
      return;
    }
    try {
      setSaving(true);
      await api.put('/configurations/email_empresa_user', { value: user });
      await api.put('/configurations/email_empresa_pass', { value: pass });
      await api.put('/configurations/email_empresa_nome', { value: (empresa.nome || '').trim() || user });
      toast.success('E-mail da empresa salvo!');
    } catch {
      toast.error('Erro ao salvar e-mail da empresa');
    } finally {
      setSaving(false);
    }
  };

  const testarEmpresa = async () => {
    const user = (empresa.user || '').trim();
    const pass = (empresa.pass || '').trim();
    if (!user || !pass) { return { ok: false, text: 'Preencha e-mail e senha antes de testar' }; }
    try {
      await api.post('/rh/email-empresa/testar', { user, pass });
      return { ok: true, text: 'Conexão válida! Pronto para enviar.' };
    } catch (e) {
      return { ok: false, text: e?.response?.data?.error || 'Falha na conexão' };
    }
  };

  const salvarDestinatarios = async () => {
    // valida e-mails preenchidos
    const limpos = destinatarios
      .map((d) => ({ nome: (d.nome || '').trim(), email: (d.email || '').trim() }))
      .filter((d) => d.nome || d.email);
    const invalido = limpos.find((d) => d.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email));
    if (invalido) {
      toast.error(`E-mail inválido: ${invalido.email}`);
      return;
    }
    try {
      setSaving(true);
      await api.put('/configurations/email_destinatarios', { value: JSON.stringify(limpos) });
      setDestinatarios(limpos.length ? limpos : destinatarios);
      toast.success('Destinatários salvos!');
    } catch {
      toast.error('Erro ao salvar destinatários');
    } finally {
      setSaving(false);
    }
  };

  const salvarTextos = async () => {
    try {
      setSaving(true);
      await api.put('/configurations/email_textos_padrao', { value: JSON.stringify(textos) });
      await api.put('/configurations/guia_exame_config', { value: JSON.stringify(guiaCfg) });
      toast.success('Textos padrão salvos!');
    } catch {
      toast.error('Erro ao salvar textos');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-48">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
      </div>
    );
  }

  const subAbas = [
    { key: 'empresa', label: '🏢 Email Empresa' },
    { key: 'destinatarios', label: '📇 Destinatários' },
    ...DOC_TIPOS.map((d) => ({ key: d.key, label: d.label })),
  ];

  return (
    <div className="bg-white rounded-lg shadow">
      <Toaster position="top-right" />
      <div className="px-6 py-4 border-b">
        <h2 className="text-lg font-bold text-gray-800">✉️ E-mails Padronizados</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Cadastre os destinatários (Contabilidade, RH, DP...) e a mensagem padrão de cada documento.
          O botão <strong>Enviar por e-mail</strong> na Ficha usa essas configurações.
        </p>
      </div>

      {/* Sub-abas */}
      <div className="flex gap-1 px-4 pt-3 border-b bg-gray-50 flex-wrap">
        {subAbas.map((s) => (
          <button
            key={s.key}
            onClick={() => setSubAba(s.key)}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
              subAba === s.key
                ? 'bg-white text-purple-700 border border-b-white border-gray-200 -mb-px'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="p-6">
        {subAba === 'empresa' ? (
          <EmpresaEmailEditor
            empresa={empresa}
            setEmpresa={setEmpresa}
            onSalvar={salvarEmpresa}
            onTestar={testarEmpresa}
            saving={saving}
          />
        ) : subAba === 'destinatarios' ? (
          <DestinatariosEditor
            destinatarios={destinatarios}
            setDestinatarios={setDestinatarios}
            onSalvar={salvarDestinatarios}
            saving={saving}
          />
        ) : subAba === 'guia_exame' ? (
          <MedicinaTrabalhoEditor
            cfg={guiaCfg}
            setCfg={setGuiaCfg}
            doc={DOC_TIPOS.find((d) => d.key === 'guia_exame')}
            valor={textos.guia_exame || { assunto: '', corpo: '' }}
            onChange={(v) => setTextos({ ...textos, guia_exame: v })}
            onSalvar={salvarTextos}
            saving={saving}
          />
        ) : (
          <TextoDocEditor
            doc={DOC_TIPOS.find((d) => d.key === subAba)}
            valor={textos[subAba] || { assunto: '', corpo: '' }}
            onChange={(v) => setTextos({ ...textos, [subAba]: v })}
            onSalvar={salvarTextos}
            saving={saving}
          />
        )}
      </div>
    </div>
  );
}

function EmpresaEmailEditor({ empresa, setEmpresa, onSalvar, onTestar, saving }) {
  const [showPass, setShowPass] = useState(false);
  const [testando, setTestando] = useState(false);
  const [status, setStatus] = useState(null); // { ok, text }

  const handleTestar = async () => {
    setTestando(true);
    setStatus(null);
    const r = await onTestar();
    if (r) setStatus(r);
    setTestando(false);
  };

  return (
    <div className="max-w-2xl">
      <div className="mb-4 p-3 bg-purple-50 border border-purple-200 rounded-lg text-sm text-purple-800">
        📤 Este é o e-mail <strong>da empresa</strong> que vai <strong>enviar</strong> os documentos
        (Ficha Cadastral, etc). Os e-mails sairão deste endereço — não do e-mail de recuperação de senha do sistema.
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">Nome de exibição (opcional)</label>
        <input
          value={empresa.nome}
          onChange={(e) => setEmpresa({ ...empresa, nome: e.target.value })}
          placeholder="Ex: RH Supermercado Tradição"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500"
        />
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">E-mail da empresa</label>
        <input
          type="email"
          value={empresa.user}
          onChange={(e) => setEmpresa({ ...empresa, user: e.target.value })}
          placeholder="rh@suaempresa.com.br"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500"
        />
      </div>

      <div className="mb-2">
        <label className="block text-sm font-medium text-gray-700 mb-1">Senha de app</label>
        <div className="relative">
          <input
            type={showPass ? 'text' : 'password'}
            value={empresa.pass}
            onChange={(e) => setEmpresa({ ...empresa, pass: e.target.value })}
            placeholder="Senha de app de 16 caracteres"
            className="w-full px-3 py-2 pr-16 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500"
          />
          <button
            type="button"
            onClick={() => setShowPass(!showPass)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-purple-600 font-medium"
          >
            {showPass ? 'ocultar' : 'mostrar'}
          </button>
        </div>
      </div>

      <div className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-lg p-3 mb-4 space-y-1">
        <p>⚠️ Em todos os provedores, use uma <strong>Senha de App</strong> — a senha normal de login não funciona via SMTP.</p>
        <p>
          <strong>Yahoo:</strong> Conta → <em>Segurança da conta</em> → <em>Gerar senha de app</em>{' '}
          (<a href="https://login.yahoo.com/account/security" target="_blank" rel="noopener noreferrer" className="text-purple-700 underline">login.yahoo.com/account/security</a>).
          Funciona com @yahoo.com e @yahoo.com.br.
        </p>
        <p>
          <strong>Gmail:</strong> crie a senha de app (16 caracteres) em{' '}
          <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer" className="text-purple-700 underline">myaccount.google.com/apppasswords</a>{' '}
          (precisa ter verificação em 2 etapas ligada).
        </p>
      </div>

      <div className="flex gap-2 pt-4 border-t">
        <button
          onClick={handleTestar}
          disabled={testando}
          className="px-5 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:bg-gray-300 font-medium"
        >
          {testando ? 'Testando...' : '🔌 Testar Conexão'}
        </button>
        <button
          onClick={onSalvar}
          disabled={saving}
          className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-300 font-medium"
        >
          {saving ? 'Salvando...' : 'Salvar E-mail da Empresa'}
        </button>
      </div>

      {/* Resultado do teste de conexão — inline, logo abaixo dos botões */}
      {status && (
        <div
          className={`mt-3 px-4 py-3 rounded-lg text-sm border flex items-center gap-2 ${
            status.ok
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : 'bg-red-50 text-red-700 border-red-200'
          }`}
        >
          <span className={`w-2.5 h-2.5 rounded-full ${status.ok ? 'bg-emerald-500' : 'bg-red-500'}`} />
          {status.ok ? '✅ ' : '❌ '}{status.text}
        </div>
      )}
    </div>
  );
}

function DestinatariosEditor({ destinatarios, setDestinatarios, onSalvar, saving }) {
  const update = (i, campo, val) => {
    const novo = [...destinatarios];
    novo[i] = { ...novo[i], [campo]: val };
    setDestinatarios(novo);
  };
  const remover = (i) => setDestinatarios(destinatarios.filter((_, idx) => idx !== i));
  const adicionar = () => setDestinatarios([...destinatarios, { nome: '', email: '' }]);

  return (
    <div>
      <p className="text-sm text-gray-600 mb-4">
        Esses contatos aparecem no seletor ao enviar um documento por e-mail.
      </p>
      <div className="space-y-2">
        {destinatarios.map((d, i) => (
          <div key={i} className="flex gap-2 items-center">
            <input
              value={d.nome}
              onChange={(e) => update(i, 'nome', e.target.value.toUpperCase())}
              placeholder="NOME (ex: CONTABILIDADE)"
              className="w-1/3 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
            <input
              type="email"
              value={d.email}
              onChange={(e) => update(i, 'email', e.target.value)}
              placeholder="email@exemplo.com"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
            <button
              onClick={() => remover(i)}
              title="Remover"
              className="px-3 py-2 text-red-500 hover:bg-red-50 rounded-lg"
            >
              🗑️
            </button>
          </div>
        ))}
      </div>

      <button
        onClick={adicionar}
        className="mt-3 px-4 py-2 text-sm text-purple-700 hover:bg-purple-50 rounded-lg font-medium border border-purple-200"
      >
        + Adicionar contato
      </button>

      <div className="mt-6 pt-4 border-t">
        <button
          onClick={onSalvar}
          disabled={saving}
          className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-300 font-medium"
        >
          {saving ? 'Salvando...' : 'Salvar Destinatários'}
        </button>
      </div>
    </div>
  );
}

function TextoDocEditor({ doc, valor, onChange, onSalvar, saving }) {
  const assuntoRef = useRef(null);
  const corpoRef = useRef(null);
  const [campoAtivo, setCampoAtivo] = useState('corpo'); // onde a variável será inserida
  if (!doc) return null;

  // Insere o token no campo ativo, na posição do cursor (igual editor de variáveis).
  const inserirVar = (token) => {
    const campo = campoAtivo === 'assunto' ? 'assunto' : 'corpo';
    const el = (campo === 'assunto' ? assuntoRef : corpoRef).current;
    const texto = valor[campo] || '';
    if (!el) { onChange({ ...valor, [campo]: texto + token }); return; }
    const start = el.selectionStart ?? texto.length;
    const end = el.selectionEnd ?? start;
    const novo = texto.slice(0, start) + token + texto.slice(end);
    onChange({ ...valor, [campo]: novo });
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + token.length;
      el.selectionStart = el.selectionEnd = pos;
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Editor */}
      <div className="lg:col-span-2">
        <p className="text-sm text-gray-600 mb-4">
          Mensagem padrão ao enviar <strong>{doc.label.replace(/^📋\s*/, '')}</strong> por e-mail.
          Você ainda pode editar no momento do envio.
        </p>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Assunto</label>
          <input
            ref={assuntoRef}
            value={valor.assunto}
            onFocus={() => setCampoAtivo('assunto')}
            onChange={(e) => onChange({ ...valor, assunto: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Corpo do e-mail</label>
          <textarea
            ref={corpoRef}
            rows={9}
            value={valor.corpo}
            onFocus={() => setCampoAtivo('corpo')}
            onChange={(e) => onChange({ ...valor, corpo: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        </div>

        <div className="pt-2">
          <button
            onClick={onSalvar}
            disabled={saving}
            className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-300 font-medium"
          >
            {saving ? 'Salvando...' : 'Salvar Texto Padrão'}
          </button>
        </div>
      </div>

      {/* Painel de variáveis clicáveis */}
      <div className="lg:col-span-1">
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 lg:sticky lg:top-2">
          <p className="text-sm font-bold text-gray-800">🏷️ Variáveis disponíveis</p>
          <p className="text-xs text-gray-500 mt-1 mb-3">
            Clique para inserir no <strong>{campoAtivo === 'assunto' ? 'assunto' : 'corpo'}</strong> (na posição do cursor).
            São substituídas automaticamente no envio.
          </p>
          <div className="flex flex-col gap-2">
            {[...VARIAVEIS, ...(doc.variaveisExtra || [])].map((v) => (
              <button
                key={v.token}
                type="button"
                onClick={() => inserirVar(v.token)}
                className="text-left px-3 py-2 bg-white border border-gray-200 rounded-lg hover:border-purple-400 hover:bg-purple-50 transition-colors"
              >
                <code className="text-purple-700 font-semibold text-sm">{v.token}</code>
                <span className="block text-xs text-gray-500">{v.desc}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}


/**
 * Aba "Medicina do Trabalho": junta num lugar so tudo que o Guia de Exame
 * Ocupacional precisa — os dados da clinica (que saem impressos no CABECALHO
 * do .docx), pra quem enviar, e o texto padrao do e-mail.
 *
 * Fica aqui e nao em Empresas porque e tudo o mesmo assunto, e assim nao
 * precisa de coluna nova no banco: vai num JSON em `guia_exame_config`.
 */
function MedicinaTrabalhoEditor({ cfg, setCfg, doc, valor, onChange, onSalvar, saving }) {
  const Campo = ({ label, chave, dica, tipo = 'text' }) => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        type={tipo}
        value={cfg[chave] || ''}
        onChange={(e) => setCfg({ ...cfg, [chave]: e.target.value })}
        placeholder={dica}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
      />
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
        <p className="text-sm font-bold text-emerald-900">Empresa de Medicina do Trabalho</p>
        <p className="text-xs text-emerald-800 mt-1">
          Estes dados saem impressos no <strong>cabecalho do Guia de Exame</strong> e sao usados no envio.
          O logotipo continua sendo o do formulario original da clinica.
          Preencha e clique em <strong>Salvar</strong> la embaixo — o botao salva os dados e o texto do e-mail juntos.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Campo label="E-mail da clinica" chave="email" dica="contato@clinica.com.br" tipo="email" />
        <Campo label="Medico Coordenador do PCMSO" chave="medicoPcmso" dica="Nome do medico" />
        <Campo label="Endereco" chave="clinicaEndereco" dica="Rua Major Vaz, 247" />
        <Campo label="Bairro / Cidade / UF" chave="clinicaCidade" dica="Vila Adyana | Sao Jose dos Campos | SP" />
        <Campo label="Telefone" chave="clinicaTelefone" dica="(12) 3019-1664" />
        <Campo label="Site" chave="clinicaSite" dica="www.clinica.com.br" />
        <Campo label="Responsavel pelo encaminhamento" chave="responsavel" dica="Quem assina o guia" />
      </div>

      <div className="border-t pt-6">
        <TextoDocEditor doc={doc} valor={valor} onChange={onChange} onSalvar={onSalvar} saving={saving} />
      </div>
    </div>
  );
}
