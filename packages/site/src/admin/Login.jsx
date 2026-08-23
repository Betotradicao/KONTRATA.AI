import { useState } from 'react';
import { Lock } from 'lucide-react';
import { api, guardarToken } from './api';

export default function Login({ aoEntrar }) {
  const [usuario, setUsuario] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [entrando, setEntrando] = useState(false);

  const enviar = async (e) => {
    e.preventDefault();
    setErro('');
    setEntrando(true);
    try {
      const r = await api.post('/login', { usuario, senha });
      guardarToken(r.token);
      aoEntrar(r);
    } catch (err) {
      setErro(err.message || 'Não foi possível entrar');
    } finally {
      setEntrando(false);
    }
  };

  return (
    <div className="min-h-screen bg-hero-bg flex items-center justify-center px-5 font-body">
      <form
        onSubmit={enviar}
        className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-sm"
      >
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-full bg-purple-100 flex items-center justify-center mx-auto mb-4">
            <Lock className="w-7 h-7 text-purple-800" />
          </div>
          <h1 className="font-display font-bold text-text-dark text-xl">Painel Interno</h1>
          <p className="text-text-gray text-sm mt-1">Acesso restrito à equipe Kontrataai.</p>
        </div>

        <label className="block text-xs font-semibold text-gray-600 mb-1">Usuário</label>
        <input
          type="text"
          value={usuario}
          onChange={(e) => setUsuario(e.target.value)}
          autoComplete="username"
          autoCapitalize="none"
          required
          className="w-full border-2 border-gray-200 rounded-lg px-3 py-2.5 text-sm mb-4 outline-none focus:border-purple-600"
        />

        <label className="block text-xs font-semibold text-gray-600 mb-1">Senha</label>
        <input
          type="password"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          autoComplete="current-password"
          required
          className="w-full border-2 border-gray-200 rounded-lg px-3 py-2.5 text-sm mb-4 outline-none focus:border-purple-600"
        />

        {erro && (
          <p className="text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs mb-4">
            {erro}
          </p>
        )}

        <button
          type="submit"
          disabled={entrando}
          className="w-full py-3 rounded-lg bg-amber-400 text-text-dark font-bold text-sm hover:bg-amber-500 transition-colors disabled:opacity-60"
        >
          {entrando ? 'Entrando…' : 'Entrar'}
        </button>

        <a
          href="/"
          className="block mt-4 text-center text-xs text-text-gray hover:text-purple-800 transition-colors"
        >
          ← Voltar ao site
        </a>
      </form>
    </div>
  );
}
