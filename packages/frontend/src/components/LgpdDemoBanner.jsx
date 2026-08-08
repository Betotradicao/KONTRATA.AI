import { useAuth } from '../contexts/AuthContext';
import { useLgpdDemo, podeUsarLgpdDemo, toggleLgpdDemoComReload } from '../utils/lgpdDemo';

/**
 * Tarja fixa enquanto o modo demonstracao LGPD esta ligado.
 *
 * Fica no App (nao no Layout) porque varias telas — RhVagas entre elas —
 * montam o proprio layout e nunca passam pelo Layout.jsx. No App ela aparece
 * em QUALQUER tela.
 *
 * Existe pra ninguem esquecer ativado: sem ela o RH real passaria a trabalhar
 * sem ver telefone e endereco de candidato sem entender o motivo.
 */
export default function LgpdDemoBanner() {
  const { user } = useAuth();
  const [ligado] = useLgpdDemo();

  if (!ligado || !podeUsarLgpdDemo(user)) return null;

  return (
    <div
      role="status"
      className="fixed top-0 left-0 right-0 z-[9999] flex items-center justify-center gap-3 px-4 py-1 text-[11px] font-bold uppercase tracking-wider bg-yellow-400 text-purple-950 shadow-md"
    >
      <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
      </svg>
      <span className="text-center">Modo demonstração LGPD — dados mascarados e edição bloqueada</span>
      <button
        onClick={() => toggleLgpdDemoComReload(false)}
        className="underline underline-offset-2 hover:no-underline"
      >
        desligar
      </button>
    </div>
  );
}
