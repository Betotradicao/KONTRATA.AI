import { Instagram, Facebook, Youtube } from 'lucide-react';
import { useTextos } from '../textos';

/**
 * Ícones das redes sociais.
 *
 * Só entra quem tem link preenchido no painel — ícone que não leva a lugar
 * nenhum é pior que ícone nenhum. Sem nenhuma rede, o componente não desenha
 * nada e o rodapé fica como era.
 */

/** O "G" do Google. A lucide não tem esse ícone, então vai como letra mesmo. */
function IconeGoogle({ className }) {
  return (
    <span className={`${className} font-display font-bold leading-none grid place-items-center`}>
      G
    </span>
  );
}

const REDES = [
  { k: 'instagram', nome: 'Instagram', Icon: Instagram },
  { k: 'facebook', nome: 'Facebook', Icon: Facebook },
  { k: 'youtube', nome: 'YouTube', Icon: Youtube },
  { k: 'google', nome: 'Google', Icon: IconeGoogle },
];

export default function RedesSociais({ className = '' }) {
  const { t } = useTextos('redes');
  const ativas = REDES.map((r) => ({ ...r, href: t(r.k) })).filter((r) => r.href);

  if (!ativas.length) return null;

  return (
    <div className={`flex flex-wrap items-center gap-3 ${className}`}>
      {ativas.map(({ k, nome, Icon, href }) => (
        <a
          key={k}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={nome}
          title={nome}
          className="w-9 h-9 rounded-full border border-purple-600/50 flex items-center justify-center
                     text-white/80 hover:text-white hover:border-white/60 hover:bg-white/10
                     transition-colors"
        >
          <Icon className="w-4 h-4" />
        </a>
      ))}
    </div>
  );
}
