import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import Logo from '../components/Logo';
import PasswordRequirements from '../components/PasswordRequirements';
import { isPasswordStrong } from '../utils/passwordPolicy';
import { TERMOS_LGPD } from '../constants/lgpdTermos';

export default function AdminSetup() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [validInfo, setValidInfo] = useState(null);
  const [erroInicial, setErroInicial] = useState('');

  // Wizard
  const [step, setStep] = useState(1); // 1=conta, 2=LGPD, 3=DPO
  const TOTAL_STEPS = 3;

  // Step 1: conta
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPwd, setShowPwd] = useState(false);

  // Step 2: aceites LGPD (Set com IDs aceitos)
  const [aceitos, setAceitos] = useState({});
  const [modalTermo, setModalTermo] = useState(null);
  const [conteudoTermo, setConteudoTermo] = useState('');

  // Step 3: DPO
  const [dpoNome, setDpoNome] = useState('');
  const [dpoEmail, setDpoEmail] = useState('');
  const [dpoTelefone, setDpoTelefone] = useState('');

  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get(`/auth/admin-setup/${token}`);
        setValidInfo(data);
        setName(data.admin?.name || '');
        setEmail(data.admin?.email || '');
        setUsername(data.admin?.username || '');
      } catch (err) {
        setErroInicial(err.response?.data?.error || 'Link inválido ou expirado');
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const abrirTermo = async (termo) => {
    setModalTermo(termo);
    setConteudoTermo('Carregando…');
    try {
      const r = await fetch(termo.arquivo);
      const txt = await r.text();
      setConteudoTermo(txt);
    } catch {
      setConteudoTermo('Não foi possível carregar o termo. Você pode aceitar mesmo assim ou pedir o arquivo pro responsável.');
    }
  };

  const validarStep1 = () => {
    if (!name.trim()) return 'Nome é obrigatório';
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Email inválido';
    if (!username || !/^[a-zA-Z0-9_-]+$/.test(username) || username.length < 3) return 'Usuário deve ter ao menos 3 caracteres (letras, números, _ ou -)';
    if (!isPasswordStrong(password)) return 'Senha não atende aos requisitos';
    if (password !== confirm) return 'As senhas não coincidem';
    return null;
  };

  const validarStep2 = () => {
    const todos = TERMOS_LGPD.every(t => aceitos[t.id]);
    if (!todos) return 'Aceite os 3 termos pra continuar';
    return null;
  };

  const validarStep3 = () => {
    if (!dpoNome.trim()) return 'Informe o nome do DPO';
    if (!dpoEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(dpoEmail)) return 'Email do DPO inválido';
    if (!dpoTelefone.trim()) return 'Informe o telefone do DPO';
    return null;
  };

  const proximo = () => {
    setErro('');
    const err = step === 1 ? validarStep1() : step === 2 ? validarStep2() : null;
    if (err) return setErro(err);
    setStep(s => Math.min(s + 1, TOTAL_STEPS));
  };
  const voltar = () => { setErro(''); setStep(s => Math.max(s - 1, 1)); };

  const finalizar = async () => {
    setErro('');
    const err = validarStep3();
    if (err) return setErro(err);
    try {
      setEnviando(true);
      const aceites = TERMOS_LGPD.map(t => ({ tipo: t.id, versao: t.versao }));
      await api.post(`/auth/admin-setup/${token}`, {
        name, email, username, password,
        aceites,
        dpo: { nome: dpoNome.trim(), email: dpoEmail.trim(), telefone: dpoTelefone.trim() },
      });
      setSucesso('Acesso configurado e LGPD registrado! Redirecionando para o login...');
      setTimeout(() => navigate('/login'), 2200);
    } catch (err) {
      setErro(err.response?.data?.error || 'Erro ao configurar acesso');
    } finally {
      setEnviando(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-gray-500">Validando link…</div>
      </div>
    );
  }

  if (erroInicial) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="text-red-500 text-5xl mb-4">⚠️</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Link inválido</h1>
          <p className="text-gray-600 mb-4">{erroInicial}</p>
          <p className="text-sm text-gray-500">Peça um novo link pra quem te enviou.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        <div className="bg-white rounded-2xl shadow-xl p-6 md:p-8">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="flex justify-center mb-4"><Logo size="medium" /></div>
            <h1 className="text-2xl font-bold text-gray-900">Configure seu acesso</h1>
            {validInfo?.empresa?.nomeFantasia && (
              <p className="text-orange-600 font-semibold mt-1">{validInfo.empresa.nomeFantasia}</p>
            )}
          </div>

          {/* Stepper */}
          <div className="flex items-center justify-center gap-2 mb-6">
            {[1, 2, 3].map(n => (
              <div key={n} className="flex items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                  step === n ? 'bg-orange-600 text-white shadow-lg scale-110' :
                  step > n ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'
                }`}>
                  {step > n ? '✓' : n}
                </div>
                {n < 3 && <div className={`w-12 h-0.5 mx-1 ${step > n ? 'bg-green-500' : 'bg-gray-200'}`} />}
              </div>
            ))}
          </div>
          <div className="text-center text-xs text-gray-500 mb-4">
            Passo {step} de {TOTAL_STEPS} — {step === 1 ? '🔐 Sua conta' : step === 2 ? '📋 Termos LGPD' : '👤 Encarregado de Dados (DPO)'}
          </div>

          {erro && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">{erro}</div>
          )}
          {sucesso && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">{sucesso}</div>
          )}

          {/* STEP 1 — CONTA */}
          {step === 1 && (
            <div className="space-y-4">
              {/* Honeypots invisiveis pra desviar o autofill agressivo do Chrome
                  que estava injetando credencial do admin logado nesses campos. */}
              <input type="text" name="fake-username" autoComplete="username" tabIndex={-1} style={{ position: 'absolute', left: '-9999px', opacity: 0 }} />
              <input type="password" name="fake-password" autoComplete="current-password" tabIndex={-1} style={{ position: 'absolute', left: '-9999px', opacity: 0 }} />

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Seu nome completo *</label>
                <input name="adm-fullname" autoComplete="off" value={name} onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="João Silva" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email * <span className="text-xs text-gray-500 font-normal">(usado pra recuperar senha)</span></label>
                <input type="email" name="adm-recovery-email" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="seu@email.com" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome de usuário * <span className="text-xs text-gray-500 font-normal">(login)</span></label>
                <input name="adm-username" autoComplete="off" value={username} onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ''))}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="joao_silva" />
                <p className="text-xs text-gray-500 mt-1">Letras, números, underscore e hífen. Min. 3 caracteres.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Senha *</label>
                <div className="relative">
                  <input type={showPwd ? 'text' : 'password'} name="adm-pwd" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    placeholder="Senha forte" />
                  <button type="button" onClick={() => setShowPwd(!showPwd)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">
                    {showPwd ? '🙈' : '👁️'}
                  </button>
                </div>
                <PasswordRequirements password={password} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Confirmar senha *</label>
                <input type={showPwd ? 'text' : 'password'} name="adm-pwd-confirm" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="Digite a senha novamente" />
                {confirm && password !== confirm && <p className="mt-1 text-xs text-red-600">As senhas não coincidem</p>}
              </div>
            </div>
          )}

          {/* STEP 2 — LGPD */}
          {step === 2 && (
            <div className="space-y-3">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-900">
                <strong>📋 Para usar o sistema em conformidade com a LGPD,</strong> aceite os 3 documentos abaixo. Você assume responsabilidade legal pela empresa.
              </div>
              {TERMOS_LGPD.map(termo => {
                const checked = !!aceitos[termo.id];
                return (
                  <div key={termo.id} className={`border rounded-lg p-4 flex items-start gap-3 transition ${checked ? 'border-green-300 bg-green-50' : 'border-gray-200 bg-white'}`}>
                    <input type="checkbox" checked={checked}
                      onChange={(e) => setAceitos(a => ({ ...a, [termo.id]: e.target.checked }))}
                      className="mt-1 w-5 h-5 accent-orange-600 cursor-pointer" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <strong className="text-gray-900">{termo.titulo}</strong>
                        <span className="text-[11px] px-1.5 py-0.5 bg-gray-100 rounded font-mono">{termo.versao}</span>
                        {checked && <span className="text-[11px] px-1.5 py-0.5 bg-green-200 text-green-900 rounded font-bold">✓ Aceito</span>}
                      </div>
                      <p className="text-xs text-gray-600 mt-1">{termo.descricao}</p>
                      <button type="button" onClick={() => abrirTermo(termo)}
                        className="mt-2 text-xs font-semibold text-orange-700 hover:text-orange-900 underline">
                        📖 Ler termo completo
                      </button>
                    </div>
                  </div>
                );
              })}
              <p className="text-xs text-gray-500 text-center">
                Ao aceitar, fica registrado quem aceitou, IP, navegador e horário (auditoria LGPD).
              </p>
            </div>
          )}

          {/* STEP 3 — DPO */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-900">
                <strong>👤 Encarregado de Dados (DPO)</strong> é o responsável pela proteção dos dados na sua empresa. Pode ser você ou outra pessoa. Será o ponto de contato para titulares (funcionários, candidatos, etc) que quiserem exercer direitos LGPD.
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome do DPO *</label>
                <input value={dpoNome} onChange={(e) => setDpoNome(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="Nome do responsável pela LGPD na sua empresa" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email do DPO *</label>
                <input type="email" value={dpoEmail} onChange={(e) => setDpoEmail(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="dpo@suaempresa.com.br" />
                <p className="text-xs text-gray-500 mt-1">Para onde candidatos/colaboradores podem escrever sobre privacidade.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Telefone do DPO *</label>
                <input value={dpoTelefone} onChange={(e) => setDpoTelefone(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="(00) 00000-0000" />
              </div>
              <p className="text-xs text-gray-500">
                Estes dados ficam visíveis no Currículo Público e podem ser editados depois em <strong>Configurações → LGPD</strong>.
              </p>
            </div>
          )}

          {/* Botoes de navegacao */}
          <div className="mt-6 flex items-center justify-between gap-3">
            <button type="button" onClick={voltar} disabled={step === 1 || enviando}
              className="px-4 py-2 text-sm font-semibold text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed">
              ← Voltar
            </button>
            {step < TOTAL_STEPS ? (
              <button type="button" onClick={proximo}
                className="px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-semibold shadow">
                Próximo →
              </button>
            ) : (
              <button type="button" onClick={finalizar} disabled={enviando}
                className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-semibold shadow">
                {enviando ? 'Configurando…' : '✅ Finalizar e ativar acesso'}
              </button>
            )}
          </div>

          <p className="text-center text-xs text-gray-500 mt-6">⚠️ Após salvar, este link deixa de funcionar (uso único).</p>
        </div>
      </div>

      {/* Modal pra ler termo */}
      {modalTermo && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setModalTermo(null)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[85vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-3 border-b flex items-center justify-between">
              <div>
                <h3 className="font-bold text-gray-900">{modalTermo.titulo}</h3>
                <p className="text-xs text-gray-500">{modalTermo.versao}</p>
              </div>
              <button onClick={() => setModalTermo(null)} className="text-gray-500 hover:text-gray-700 text-xl leading-none">×</button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 prose prose-sm max-w-none">
              <pre className="whitespace-pre-wrap text-xs font-sans text-gray-800">{conteudoTermo}</pre>
            </div>
            <div className="px-5 py-3 border-t flex justify-end gap-2">
              <button onClick={() => setModalTermo(null)} className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg font-semibold">Fechar</button>
              <button onClick={() => { setAceitos(a => ({ ...a, [modalTermo.id]: true })); setModalTermo(null); }}
                className="px-4 py-2 text-sm bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold">
                ✓ Li e Aceito
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
