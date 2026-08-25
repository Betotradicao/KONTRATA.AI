import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

/**
 * Campo de senha com olhinho para revelar o que foi digitado.
 *
 * Existe porque errar a senha sem conseguir ver o que se escreveu é uma das
 * formas mais bobas de perder tempo — ainda mais em senha com símbolo, onde o
 * teclado do celular troca de layout no meio.
 *
 * O padrão é oculto: revelar é uma escolha de quem está na frente da tela.
 */
export default function CampoSenha({ value, onChange, autoComplete = 'current-password', ...resto }) {
  const [visivel, setVisivel] = useState(false);

  return (
    <div className="relative">
      <input
        type={visivel ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        autoComplete={autoComplete}
        {...resto}
        className="w-full border-2 border-gray-200 rounded-lg pl-3 pr-10 py-2.5 text-sm outline-none focus:border-purple-600"
      />
      <button
        type="button"
        onClick={() => setVisivel((v) => !v)}
        // tabIndex -1: o Tab deve pular do usuário pra senha e daí pro botão
        // de entrar, sem parar no olhinho no meio do caminho.
        tabIndex={-1}
        aria-label={visivel ? 'Ocultar senha' : 'Mostrar senha'}
        title={visivel ? 'Ocultar senha' : 'Mostrar senha'}
        className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-purple-700 transition-colors"
      >
        {visivel ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );
}
