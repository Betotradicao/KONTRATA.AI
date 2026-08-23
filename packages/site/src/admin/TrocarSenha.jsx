import { useState } from 'react';
import { KeyRound } from 'lucide-react';
import { api } from './api';

/**
 * Tela obrigatória no primeiro acesso. Aparece porque a conta foi criada com
 * senha temporária — enquanto não trocar, o painel não abre.
 */
export default function TrocarSenha({ aoTrocar }) {
  const [atual, setAtual] = useState('');
  const [nova, setNova] = useState('');
  const [repetir, setRepetir] = useState('');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  const enviar = async (e) => {
    e.preventDefault();
    setErro('');
    if (nova !== repetir) return setErro('As duas senhas novas não são iguais.');
    if (nova.length < 8) return setErro('A nova senha precisa ter pelo menos 8 caracteres.');
    if (nova === atual) return setErro('A nova senha precisa ser diferente da temporária.');

    setSalvando(true);
    try {
      await api.post('/trocar-senha', { senhaAtual: atual, senhaNova: nova });
      aoTrocar();
    } catch (err) {
      setErro(err.message || 'Não foi possível trocar a senha');
    } finally {
      setSalvando(false);
    }
  };

  const campo = 'w-full border-2 border-gray-200 rounded-lg px-3 py-2.5 text-sm mb-4 outline-none focus:border-purple-600';

  return (
    <div className="min-h-screen bg-hero-bg flex items-center justify-center px-5 font-body">
      <form onSubmit={enviar} className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
            <KeyRound className="w-7 h-7 text-amber-600" />
          </div>
          <h1 className="font-display font-bold text-text-dark text-xl">Crie sua senha</h1>
          <p className="text-text-gray text-sm mt-1">
            Você entrou com uma senha temporária. Defina a sua para continuar.
          </p>
        </div>

        <label className="block text-xs font-semibold text-gray-600 mb-1">Senha temporária</label>
        <input type="password" value={atual} onChange={(e) => setAtual(e.target.value)}
          autoComplete="current-password" required className={campo} />

        <label className="block text-xs font-semibold text-gray-600 mb-1">Nova senha</label>
        <input type="password" value={nova} onChange={(e) => setNova(e.target.value)}
          autoComplete="new-password" required className={campo} />

        <label className="block text-xs font-semibold text-gray-600 mb-1">Repita a nova senha</label>
        <input type="password" value={repetir} onChange={(e) => setRepetir(e.target.value)}
          autoComplete="new-password" required className={campo} />

        {erro && (
          <p className="text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs mb-4">
            {erro}
          </p>
        )}

        <button type="submit" disabled={salvando}
          className="w-full py-3 rounded-lg bg-amber-400 text-text-dark font-bold text-sm hover:bg-amber-500 transition-colors disabled:opacity-60">
          {salvando ? 'Salvando…' : 'Salvar e entrar'}
        </button>
      </form>
    </div>
  );
}
