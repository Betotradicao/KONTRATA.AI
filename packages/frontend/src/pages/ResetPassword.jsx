import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import Logo from '../components/Logo';
import RadarLoading from '../components/RadarLoading';
import api from '../services/api';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(true);
  const [error, setError] = useState('');
  const [tokenValid, setTokenValid] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    validateToken();
  }, [token]);

  const validateToken = async () => {
    if (!token) {
      setError('Token inválido ou ausente');
      setValidating(false);
      return;
    }

    try {
      await api.get(`/password-recovery/validate?token=${token}`);
      setTokenValid(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Token inválido ou expirado');
      setTokenValid(false);
    } finally {
      setValidating(false);
    }
  };

  // Regras de senha forte
  const rules = [
    { id: 'len',   label: 'Pelo menos 8 caracteres',          test: (p) => p.length >= 8 },
    { id: 'upper', label: '1 letra maiúscula (A-Z)',           test: (p) => /[A-Z]/.test(p) },
    { id: 'lower', label: '1 letra minúscula (a-z)',           test: (p) => /[a-z]/.test(p) },
    { id: 'num',   label: '1 número (0-9)',                    test: (p) => /[0-9]/.test(p) },
    { id: 'spec',  label: '1 caractere especial (!@#$%&*…)',   test: (p) => /[!@#$%^&*(),.?":{}|<>_\-+=\/\\[\]~`'`]/.test(p) },
  ];
  const allRulesOk = rules.every(r => r.test(newPassword));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validações
    if (!allRulesOk) {
      setError('A senha não atende todos os requisitos abaixo');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('As senhas não coincidem');
      return;
    }

    setLoading(true);

    try {
      await api.post('/password-recovery/reset', {
        token,
        newPassword,
      });

      setSuccess(true);

      // Redirecionar para login após 3 segundos
      setTimeout(() => {
        navigate('/login');
      }, 3000);

    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao redefinir senha');
    } finally {
      setLoading(false);
    }
  };

  // Loading state
  if (validating) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
            <div className="flex justify-center mb-6">
              <Logo size="large" />
            </div>
            <RadarLoading message="Validando link de recuperação..." />
          </div>
        </div>
      </div>
    );
  }

  // Success state
  if (success) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <div className="text-center mb-8">
              <div className="flex justify-center mb-6">
                <Logo size="large" />
              </div>
              <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-4">
                <svg className="h-10 w-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                Senha Alterada com Sucesso!
              </h1>
              <p className="text-gray-600">
                Você será redirecionado para o login em instantes...
              </p>
              <div className="mt-6">
                <Link
                  to="/login"
                  className="text-purple-700 hover:text-purple-800 font-medium"
                >
                  Ir para o login agora →
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Invalid token state
  if (!tokenValid) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <div className="text-center mb-8">
              <div className="flex justify-center mb-6">
                <Logo size="large" />
              </div>
              <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 mb-4">
                <svg className="h-10 w-10 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                Link Inválido ou Expirado
              </h1>
              <p className="text-gray-600 mb-6">
                {error || 'Este link de recuperação não é mais válido'}
              </p>
              <div className="space-y-3">
                <Link
                  to="/forgot-password"
                  className="block w-full bg-purple-700 text-white py-3 px-4 rounded-lg hover:bg-purple-800 transition-colors font-medium"
                >
                  Solicitar Novo Link
                </Link>
                <Link
                  to="/login"
                  className="block w-full bg-gray-100 text-gray-700 py-3 px-4 rounded-lg hover:bg-gray-200 transition-colors font-medium"
                >
                  Voltar para o Login
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Reset password form
  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-8">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/* Logo/Header */}
          <div className="text-center mb-8">
            <div className="flex justify-center mb-6">
              <Logo size="large" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">
              Redefinir Senha
            </h1>
            <p className="mt-2 text-sm text-gray-600">
              Digite sua nova senha abaixo
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              </div>
            </div>
          )}

          {/* Form */}
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-2">
                Nova Senha
              </label>
              <div className="relative">
                <input
                  id="newPassword"
                  name="newPassword"
                  type={showPassword ? "text" : "password"}
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-colors"
                  placeholder="Digite sua nova senha"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showPassword ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
              {/* Checklist de requisitos de senha forte */}
              <ul className="mt-2 space-y-1">
                {rules.map(r => {
                  const ok = r.test(newPassword);
                  return (
                    <li key={r.id} className={`text-xs flex items-center gap-2 ${ok ? 'text-emerald-600' : 'text-gray-500'}`}>
                      <span className={`inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold ${ok ? 'bg-emerald-500 text-white' : 'bg-gray-200 text-gray-400'}`}>
                        {ok ? '✓' : '○'}
                      </span>
                      {r.label}
                    </li>
                  );
                })}
              </ul>
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
                Confirmar Nova Senha
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type={showPassword ? "text" : "password"}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-colors"
                placeholder="Digite a senha novamente"
              />
              {confirmPassword && confirmPassword !== newPassword && (
                <p className="mt-1 text-xs text-red-600">As senhas não coincidem</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading || !allRulesOk || newPassword !== confirmPassword}
              className="w-full bg-purple-700 text-white py-3 px-4 rounded-lg hover:bg-purple-800 focus:outline-none focus:ring-2 focus:ring-purple-700 focus:ring-offset-2 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Redefinindo...' : 'Redefinir Senha'}
            </button>
          </form>

          {/* Back to Login */}
          <div className="mt-6 text-center">
            <Link
              to="/login"
              className="text-sm text-purple-700 hover:text-purple-800 font-medium"
            >
              ← Voltar para o login
            </Link>
          </div>

          {/* Security Info */}
          <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-blue-800">
                  Dica de Segurança
                </h3>
                <p className="mt-1 text-sm text-blue-700">
                  Use uma senha forte com letras, números e caracteres especiais para maior segurança.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
