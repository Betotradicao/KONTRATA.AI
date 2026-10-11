import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Logo from '../../components/Logo';
import PasswordRequirements from '../../components/PasswordRequirements';
import { isPasswordStrong } from '../../utils/passwordPolicy';
import { portalApi, formatCpf } from '../../utils/portalApi';

// Link de primeiro acesso (/portal/primeiro-acesso/:token): colaborador confirma o CPF e cria a senha.
export default function PortalPrimeiroAcesso() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [nome, setNome] = useState('');
  const [erroInicial, setErroInicial] = useState('');
  const [cpf, setCpf] = useState('');
  const [senha, setSenha] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [sucesso, setSucesso] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await portalApi.get(`/portal/setup/${token}`);
        setNome(data.nome || '');
      } catch (err) {
        setErroInicial(err.response?.data?.error || 'Link inválido');
      } finally { setLoading(false); }
    })();
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErro('');
    if (cpf.replace(/\D/g, '').length !== 11) { setErro('Digite seu CPF completo'); return; }
    if (!isPasswordStrong(senha)) { setErro('A senha não atende aos requisitos abaixo'); return; }
    if (senha !== confirm) { setErro('As senhas não coincidem'); return; }
    setEnviando(true);
    try {
      await portalApi.post(`/portal/setup/${token}`, { cpf: cpf.replace(/\D/g, ''), senha });
      setSucesso(true);
      setTimeout(() => navigate('/portal', { replace: true }), 2500);
    } catch (err) {
      setErro(err.response?.data?.error || 'Erro ao criar senha');
    } finally { setEnviando(false); }
  };

  const Shell = ({ children }) => (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: '#F3EAFE' }}>
      <div className="max-w-md w-full rounded-2xl shadow-2xl p-6 sm:p-8" style={{ backgroundColor: '#3D1B7E' }}>
        <div className="text-center mb-6">
          <div className="flex justify-center mb-2"><Logo size="large" /></div>
          <p className="text-sm text-white/80 tracking-wide">Portal do Colaborador</p>
        </div>
        <div className="bg-white rounded-xl p-5 sm:p-6">{children}</div>
      </div>
    </div>
  );

  if (loading) return <Shell><p className="text-center text-gray-500 py-6">Carregando…</p></Shell>;
  if (erroInicial) return (
    <Shell>
      <div className="text-center py-4">
        <div className="text-4xl mb-2">⛔</div>
        <p className="font-semibold text-gray-800">{erroInicial}</p>
        <button onClick={() => navigate('/portal')} className="mt-5 px-5 py-2 rounded-lg bg-purple-700 text-white font-semibold text-sm">Ir para o login</button>
      </div>
    </Shell>
  );
  if (sucesso) return (
    <Shell>
      <div className="text-center py-4">
        <div className="text-4xl mb-2">✅</div>
        <p className="font-semibold text-gray-800">Senha criada!</p>
        <p className="text-sm text-gray-500 mt-1">Levando você para o login…</p>
      </div>
    </Shell>
  );

  return (
    <Shell>
      <h1 className="text-lg font-bold text-gray-900 text-center">Olá, {nome.split(' ')[0]}!</h1>
      <p className="text-xs text-gray-500 text-center mt-1 mb-4">Confirme seu CPF e crie a senha do seu acesso</p>
      {erro && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">{erro}</div>}
      <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
        <div>
          <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">CPF</label>
          <input type="tel" inputMode="numeric" value={formatCpf(cpf)} onChange={e => setCpf(e.target.value)} placeholder="000.000.000-00"
            autoComplete="off" name="setup-cpf"
            className="w-full px-4 py-3 text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Nova senha</label>
          <div className="relative">
            <input type={showPwd ? 'text' : 'password'} value={senha} onChange={e => setSenha(e.target.value)} autoComplete="new-password" name="setup-senha"
              className="w-full px-4 py-3 pr-12 text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent" />
            <button type="button" onClick={() => setShowPwd(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">{showPwd ? '🙈' : '👁️'}</button>
          </div>
          <PasswordRequirements password={senha} className="mt-2" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Repita a senha</label>
          <input type={showPwd ? 'text' : 'password'} value={confirm} onChange={e => setConfirm(e.target.value)} autoComplete="new-password" name="setup-confirm"
            className="w-full px-4 py-3 text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent" />
        </div>
        <button type="submit" disabled={enviando} className="w-full py-3 rounded-lg text-white font-bold bg-purple-700 hover:bg-purple-800 disabled:opacity-60">
          {enviando ? 'Salvando…' : 'Criar senha e entrar'}
        </button>
      </form>
    </Shell>
  );
}
