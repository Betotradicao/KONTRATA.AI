import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Logo from '../components/Logo';
import PasswordRequirements from '../components/PasswordRequirements';
import { isPasswordStrong } from '../utils/passwordPolicy';
import api from '../services/api';

export default function CadastroColaborador() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [employee, setEmployee] = useState(null);
  const [erroInicial, setErroInicial] = useState('');

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [email, setEmail] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [aceiteLgpd, setAceiteLgpd] = useState(false);

  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get(`/employees/setup/${token}`);
        setEmployee(data.employee);
      } catch (err) {
        setErroInicial(err.response?.data?.error || 'Link inválido ou expirado');
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErro('');
    if (password !== confirm) {
      setErro('As senhas não conferem');
      return;
    }
    if (!isPasswordStrong(password)) {
      setErro('A senha não atende os requisitos abaixo');
      return;
    }
    if (!aceiteLgpd) {
      setErro('Você precisa aceitar os termos de uso e a política de privacidade');
      return;
    }
    setEnviando(true);
    try {
      await api.post(`/employees/setup/${token}`, {
        username, password, email_recuperacao: email,
      });
      setSucesso(true);
      setTimeout(() => navigate('/login'), 3000);
    } catch (err) {
      setErro(err.response?.data?.error || 'Erro ao concluir cadastro');
    } finally {
      setEnviando(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#F3EAFE' }}>
        <p className="text-purple-700">Carregando...</p>
      </div>
    );
  }

  if (erroInicial) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: '#F3EAFE' }}>
        <div className="max-w-md w-full rounded-2xl shadow-2xl p-8" style={{ backgroundColor: '#3D1B7E' }}>
          <div className="text-center mb-6">
            <div className="flex justify-center mb-2"><Logo size="large" /></div>
          </div>
          <div className="bg-white rounded-xl p-6 text-center">
            <h2 className="text-xl font-bold text-red-600 mb-2">Link Inválido</h2>
            <p className="text-gray-700">{erroInicial}</p>
            <p className="text-sm text-gray-500 mt-4">Entre em contato com seu administrador para gerar um novo link.</p>
          </div>
        </div>
      </div>
    );
  }

  if (sucesso) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: '#F3EAFE' }}>
        <div className="max-w-md w-full rounded-2xl shadow-2xl p-8" style={{ backgroundColor: '#3D1B7E' }}>
          <div className="text-center mb-6">
            <div className="flex justify-center mb-2"><Logo size="large" /></div>
          </div>
          <div className="bg-white rounded-xl p-6 text-center">
            <h2 className="text-xl font-bold text-green-600 mb-2">✅ Cadastro Concluído!</h2>
            <p className="text-gray-700">Você ja pode fazer login. Redirecionando...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: '#F3EAFE' }}>
      <div className="max-w-md w-full rounded-2xl shadow-2xl p-8" style={{ backgroundColor: '#3D1B7E' }}>
        <div className="text-center mb-8">
          <div className="flex justify-center mb-2"><Logo size="large" /></div>
          <p className="text-sm text-white/80 tracking-wide">Conclua seu cadastro</p>
        </div>

        <div className="bg-white rounded-xl p-6">
          <div className="mb-4 text-center">
            <h1 className="text-xl font-bold text-gray-900">Olá, {employee?.name}!</h1>
            <p className="text-sm text-gray-600 mt-1">{employee?.function_description}</p>
            <p className="text-xs text-purple-700 mt-1 font-semibold uppercase">{employee?.role_kontrata}</p>
          </div>

          {erro && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">{erro}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Usuário *</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value.toUpperCase())}
                style={{ textTransform: 'uppercase' }}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-700 focus:border-transparent"
                placeholder="Escolha um nome de usuário"
                required
                minLength={3}
                pattern="[a-zA-Z0-9._-]+"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Senha *</label>
              <div className="relative">
                <input
                  type={showPwd ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-700 focus:border-transparent"
                  placeholder="Mínimo 8 caracteres"
                  required
                  minLength={8}
                />
                <button type="button" onClick={() => setShowPwd(!showPwd)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs">
                  {showPwd ? '🙈' : '👁️'}
                </button>
              </div>
              <PasswordRequirements password={password} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Confirmar Senha *</label>
              <div className="relative">
                <input
                  type={showConfirm ? 'text' : 'password'}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-700 focus:border-transparent"
                  placeholder="Digite a senha de novo"
                  required
                  minLength={8}
                />
                <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs">
                  {showConfirm ? '🙈' : '👁️'}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Email para recuperação</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-700 focus:border-transparent"
                placeholder="email@dominio.com"
              />
              <p className="mt-1 text-xs text-gray-500">Email usado para redefinir a senha caso esqueça</p>
            </div>
            {/* Aceite LGPD */}
            <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={aceiteLgpd}
                  onChange={(e) => setAceiteLgpd(e.target.checked)}
                  className="mt-1 w-4 h-4 accent-purple-700"
                />
                <span className="text-xs text-gray-700">
                  Declaro que li e concordo com os{' '}
                  <a href="/docs/legal/01-TERMOS-DE-USO.md" target="_blank" rel="noreferrer" className="text-purple-700 underline font-semibold">Termos de Uso</a>,{' '}
                  <a href="/docs/legal/02-POLITICA-DE-PRIVACIDADE.md" target="_blank" rel="noreferrer" className="text-purple-700 underline font-semibold">Política de Privacidade</a>{' '}
                  e estou ciente das normas da <strong>LGPD (Lei Geral de Proteção de Dados)</strong> aplicáveis ao tratamento dos meus dados pela plataforma Kontrata.ai.
                </span>
              </label>
            </div>

            <button
              type="submit"
              disabled={enviando || !aceiteLgpd}
              className="w-full py-3 px-4 bg-purple-700 text-white rounded-lg hover:bg-purple-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {enviando ? 'Salvando...' : 'Concluir Cadastro'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
