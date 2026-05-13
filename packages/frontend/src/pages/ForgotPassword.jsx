import { useState } from 'react';
import { Link } from 'react-router-dom';
import Logo from '../components/Logo';
import api from '../services/api';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess(false);
    setLoading(true);

    try {
      await api.post('/password-recovery/request', { email });
      setSuccess(true);
      setEmail('');
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao solicitar recuperação de senha');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: '#F3EAFE' }}>
      <div className="max-w-md w-full rounded-2xl shadow-2xl p-8" style={{ backgroundColor: '#3D1B7E' }}>
        {/* Logo/Header Kontrataai */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-2">
            <Logo size="large" />
          </div>
          <p className="text-sm text-white/80 tracking-wide">
            Sistema de gestão de RH para supermercados
          </p>
        </div>

        <div className="bg-white rounded-xl p-6">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-gray-900">
              Recuperar Senha
            </h1>
            <p className="mt-2 text-sm text-gray-600">
              Digite seu email de login para receber instruções
            </p>
          </div>

          {/* Success Message */}
          {success && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-green-800">Email enviado com sucesso!</h3>
                  <p className="mt-2 text-sm text-green-700">
                    Se o email informado estiver cadastrado, você receberá um link para redefinir sua senha no email de recuperação.
                  </p>
                  <p className="mt-2 text-sm text-green-700">
                    Verifique sua caixa de entrada e spam.
                  </p>
                </div>
              </div>
            </div>
          )}

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
          {!success && (
            <form className="space-y-6" onSubmit={handleSubmit}>
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                  Email de Login
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-700 focus:border-transparent transition-colors"
                  placeholder="Digite seu email de login"
                />
                <p className="mt-2 text-xs text-gray-500">
                  Você receberá um email no endereço de recuperação cadastrado
                </p>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-purple-700 text-white py-3 px-4 rounded-lg hover:bg-purple-800 focus:outline-none focus:ring-2 focus:ring-purple-700 focus:ring-offset-2 transition-colors font-medium disabled:opacity-50"
              >
                {loading ? 'Enviando...' : 'Enviar Link de Recuperação'}
              </button>
            </form>
          )}

          {/* Back to Login */}
          <div className="mt-6 text-center">
            <Link
              to="/login"
              className="text-sm text-purple-700 hover:text-purple-900 font-medium"
            >
              ← Voltar para o login
            </Link>
          </div>

        </div>
      </div>
    </div>
  );
}
