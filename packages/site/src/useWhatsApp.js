import { useTextos } from './textos';

/**
 * Link do WhatsApp dos botões de demonstração.
 *
 * O número é cadastrado no painel (Configurar Site → Textos → Contato). Sem
 * número, devolve `null` e cada botão volta pro comportamento antigo — rolar
 * até a chamada final. Assim um campo em branco nunca vira botão que não faz
 * nada.
 */
export function useWhatsApp() {
  const { t } = useTextos('contato');

  const digitos = String(t('whatsapp') || '').replace(/[^0-9]/g, '');
  if (digitos.length < 10) return null;

  // O wa.me exige o código do país. Se veio só com DDD, completa com 55 —
  // ninguém digita "55" ao anotar o próprio telefone.
  const numero = digitos.startsWith('55') ? digitos : `55${digitos}`;

  const texto = t('mensagem');
  return `https://wa.me/${numero}${texto ? `?text=${encodeURIComponent(texto)}` : ''}`;
}
