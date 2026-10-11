import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Logo from '../../components/Logo';
import { portalApi, portalLogado, formatCpf, PORTAL_TOKEN_KEY, PORTAL_USER_KEY } from '../../utils/portalApi';

// Portal do Colaborador — login por CPF + senha (link fixo /portal, chega pelo WhatsApp)
export default function PortalLogin() {
  const navigate = useNavigate();
  const [cpf, setCpf] = useState('');
  const [senha, setSenha] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => { if (portalLogado()) navigate('/portal/holerites', { replace: true }); }, [navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErro('');
    const digits = cpf.replace(/\D/g, '');
    if (digits.length !== 11) { setErro('Digite o CPF completo (11 números)'); return; }
    if (!senha) { setErro('Digite sua senha'); return; }
    setEnviando(true);
    try {
      const { data } = await portalApi.post('/portal/login', { cpf: digits, senha });
      localStorage.setItem(PORTAL_TOKEN_KEY, data.token);
      localStorage.setItem(PORTAL_USER_KEY, JSON.stringify(data.colaborador));
      navigate('/portal/holerites', { replace: true });
    } catch (err) {
      setErro(err.response?.data?.error || 'Não foi possível entrar. Tente novamente.');
    } finally { setEnviando(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: '#F3EAFE' }}>
      <div className="max-w-md w-full rounded-2xl shadow-2xl p-6 sm:p-8" style={{ backgroundColor: '#3D1B7E' }}>
        <div className="text-center mb-6">
          <div className="flex justify-center mb-2"><Logo size="large" /></div>
          <p className="text-sm text-white/80 tracking-wide">Portal do Colaborador</p>
        </div>

        <div className="bg-white rounded-xl p-5 sm:p-6">
          <h1 className="text-lg font-bold text-gray-900 text-center">Entrar</h1>
          <p className="text-xs text-gray-500 text-center mt-1 mb-4">Use seu CPF e a senha que você criou</p>

          {erro && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">{erro}</div>}

          <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">CPF</label>
              <input type="tel" inputMode="numeric" value={formatCpf(cpf)} onChange={e => setCpf(e.target.value)}
                placeholder="000.000.000-00" autoComplete="off" name="portal-cpf"
                className="w-full px-4 py-3 text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Senha</label>
              <div className="relative">
                <input type={showPwd ? 'text' : 'password'} value={senha} onChange={e => setSenha(e.target.value)}
                  autoComplete="current-password" name="portal-senha"
                  className="w-full px-4 py-3 pr-12 text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent" />
                <button type="button" onClick={() => setShowPwd(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">
                  {showPwd ? '🙈' : '👁️'}
                </button>
              </div>
            </div>
            <button type="submit" disabled={enviando}
              className="w-full py-3 rounded-lg text-white font-bold text-base bg-purple-700 hover:bg-purple-800 disabled:opacity-60">
              {enviando ? 'Entrando…' : 'Entrar'}
            </button>
          </form>

          <p className="text-[11px] text-gray-500 text-center mt-5 leading-snug">
            Esqueceu a senha ou ainda não criou? Peça ao RH um novo <strong>link de primeiro acesso</strong>.
          </p>
        </div>
        <p className="text-[10px] text-white/50 text-center mt-4">Kontrata.ai · acesso pessoal e intransferível</p>
      </div>
    </div>
  );
}
