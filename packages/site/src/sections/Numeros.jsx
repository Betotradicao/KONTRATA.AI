import { useState, useEffect, useRef } from 'react';
import { useTextos } from '../textos';

/**
 * Prova social: currículos captados e pessoas contratadas em toda a base.
 *
 * Os números vêm do painel interno, que copia de tempos em tempos o que cada
 * cliente tem no Banco de Currículos. Não é ao vivo ao segundo — e não precisa
 * ser: o que convence é a ordem de grandeza, não o dígito da unidade.
 *
 * A seção some por completo se não houver número. Prova social com zero é
 * pior que prova social nenhuma.
 */

const formatar = (n) => (Number(n) || 0).toLocaleString('pt-BR');

/**
 * Número que "roda" de zero até o valor final quando entra na tela.
 *
 * Dispara pelo IntersectionObserver, e não ao carregar a página: animar um
 * número que ninguém está vendo desperdiça o efeito — quando o visitante
 * chega ali, já teria parado.
 *
 * Roda UMA vez (`observer.disconnect()`). Repetir a cada rolagem viraria
 * enfeite piscando e tiraria a credibilidade do dado.
 */
function NumeroQueRoda({ valor, duracaoMs = 1600 }) {
  const [atual, setAtual] = useState(0);
  const ref = useRef(null);
  const jaRodou = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Sem IntersectionObserver (navegador antigo): mostra o número final.
    if (typeof IntersectionObserver === 'undefined') {
      setAtual(valor);
      return;
    }

    const observer = new IntersectionObserver(
      (entradas) => {
        if (!entradas[0].isIntersecting || jaRodou.current) return;
        jaRodou.current = true;
        observer.disconnect();

        const inicio = performance.now();
        const passo = (agora) => {
          const p = Math.min((agora - inicio) / duracaoMs, 1);
          // Desacelera no fim: dá a sensação de "travar" no número certo,
          // em vez de parar seco no meio da contagem.
          const suave = 1 - Math.pow(1 - p, 3);
          setAtual(Math.round(valor * suave));
          if (p < 1) requestAnimationFrame(passo);
        };
        requestAnimationFrame(passo);
      },
      // 40% visível: garante que a seção está de fato na frente do visitante.
      { threshold: 0.4 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [valor, duracaoMs]);

  return (
    <span ref={ref} className="tabular-nums">
      {formatar(atual)}
    </span>
  );
}

export default function Numeros() {
  const { t } = useTextos('numeros');
  const [dados, setDados] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/admin/api/publico/numeros');
        const d = await r.json();
        if (d && (d.curriculos > 0 || d.contratados > 0)) setDados(d);
      } catch {
        /* sem números, a seção simplesmente não aparece */
      }
    })();
  }, []);

  if (!dados) return null;

  return (
    <section id="numeros" className="py-14 lg:py-20 bg-hero-bg">
      <div className="max-w-5xl mx-auto px-5 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 lg:gap-12 text-center">
          <div>
            <p className="font-display font-bold text-amber-400 text-4xl sm:text-5xl lg:text-6xl">
              <NumeroQueRoda valor={dados.curriculos} />
            </p>
            <p className="text-white/90 text-sm sm:text-base mt-2">
              {t('rotulo1')}
            </p>
          </div>
          <div>
            <p className="font-display font-bold text-amber-400 text-4xl sm:text-5xl lg:text-6xl">
              <NumeroQueRoda valor={dados.contratados} />
            </p>
            <p className="text-white/90 text-sm sm:text-base mt-2">
              {t('rotulo2')}
            </p>
          </div>
        </div>
        <p className="text-center text-purple-300 text-xs mt-8">
          {t('rodape')}
        </p>
      </div>
    </section>
  );
}
