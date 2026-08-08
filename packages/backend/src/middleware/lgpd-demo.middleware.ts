import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import { UserRole } from '../entities/User';

/**
 * MODO DEMONSTRACAO LGPD
 * ----------------------
 * Mascara dado pessoal na RESPOSTA, antes de sair do servidor, pra permitir
 * gravar video de divulgacao do sistema sem expor candidato real.
 *
 * Por que mascarar no backend e nao com CSS no frontend:
 * borrao de CSS esconde do gravador de tela, mas o dado real continua no
 * payload — aparece no DevTools, na aba Network e num frame perdido do video.
 * Aqui o dado real simplesmente nao sai da VPS.
 *
 * Ativacao: header `x-lgpd-demo: 1` E o usuario ser MASTER.
 * O escopo e a SESSAO de quem ligou — nao afeta o RH do cliente, que continua
 * enxergando os dados reais pra conseguir trabalhar (ligar pro candidato, etc).
 */

// Campos cujo VALOR e mascarado, por nome de campo (case-insensitive).
type Masker = (v: any) => any;

// ⚠️ CUIDADO ao mexer aqui: `nome` puro tambem e usado por CATALOGO
// (pasta de documento, cargo, setor, loja, modelo de pesquisa). Por isso o
// middleware NAO e montado nas rotas de catalogo — ver rh.routes.ts.
// Os controllers do RH batizam catalogo com SUFIXO (`cargo_nome`, `setor_nome`,
// `motivo_desligamento_nome`), entao `nome` puro = pessoa nas rotas montadas.
const NOME_FIELDS = new Set([
  'nome', 'nome_completo', 'candidato_nome', 'nome_candidato',
  // O ASO e a apuracao de ponto usam apelido com sufixo pro nome da PESSOA:
  'colaborador_nome', 'nome_colaborador', 'funcionario_nome', 'nome_funcionario',
]);
// Nome de ARQUIVO enviado pelo colaborador — costuma ser "RG JOAO SILVA.pdf".
const ARQUIVO_NOME_FIELDS = new Set(['doc_nome', 'nome_arquivo', 'arquivo_nome']);
const FONE_FIELDS = new Set(['whatsapp', 'telefone', 'celular', 'fone', 'telefone_contato']);
const EMAIL_FIELDS = new Set(['email']);
const HANDLE_FIELDS = new Set(['instagram', 'linkedin']);
const CEP_FIELDS = new Set(['cep', 'geo_cep']);
const RUA_FIELDS = new Set(['rua', 'endereco', 'logradouro', 'complemento']);
const NUM_FIELDS = new Set(['numero']);
const DOC_FIELDS = new Set(['cpf', 'rg', 'pis_pasep', 'pis', 'ctps', 'titulo_eleitor']);
// Anulados por completo: o arquivo/coordenada revela tudo por fora da tela.
// Um link de documento aberto no video vaza MAIS que a propria tela — o PDF
// do RG/ASO tem nome, CPF, endereco e, no caso do ASO, dado de SAUDE.
const NULL_FIELDS = new Set([
  'foto_url', 'foto', 'colaborador_foto', 'foto_colaborador', 'avatar',
  'curriculo_pdf_url', 'curriculo_pdf_nome',
  'arquivo_url', 'doc_url', 'documento_url', 'url_arquivo',
  'latitude', 'longitude',
]);

/** MARIA DAS DORES SILVA SANTOS -> MARIA S***** */
export function maskNome(v: any): any {
  if (typeof v !== 'string') return v;
  const partes = v.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return v;
  if (partes.length === 1) return partes[0]; // so um nome: nada a esconder
  const primeiro = partes[0];
  const ultimo = partes[partes.length - 1];
  return `${primeiro} ${ultimo.charAt(0)}${'*'.repeat(Math.max(ultimo.length - 1, 3))}`;
}

/** (11) 98765-4321 -> (11) 9****-**21 */
export function maskFone(v: any): any {
  if (typeof v !== 'string' || !v.trim()) return v;
  const d = v.replace(/\D/g, '');
  if (d.length < 6) return '*'.repeat(v.length);
  const ddd = d.slice(0, 2);
  const fim = d.slice(-2);
  if (d.length >= 11) return `(${ddd}) ${d.charAt(2)}****-**${fim}`;
  return `(${ddd}) ****-**${fim}`;
}

/** maria.santos@gmail.com -> ma****@gmail.com (dominio preservado) */
export function maskEmail(v: any): any {
  if (typeof v !== 'string' || !v.includes('@')) return typeof v === 'string' && v ? '****' : v;
  const [user, dominio] = v.split('@');
  const visivel = user.slice(0, 2);
  return `${visivel}${'*'.repeat(Math.max(user.length - 2, 4))}@${dominio}`;
}

/** @maria.santos -> @ma**** */
export function maskHandle(v: any): any {
  if (typeof v !== 'string' || !v.trim()) return v;
  const limpo = v.replace(/^@/, '');
  return `@${limpo.slice(0, 2)}${'*'.repeat(Math.max(limpo.length - 2, 4))}`;
}

/** 01310-100 -> 013**-*** (os 3 primeiros digitos ja dao a regiao, o resto da a rua) */
export function maskCep(v: any): any {
  if (typeof v !== 'string' || !v.trim()) return v;
  const d = v.replace(/\D/g, '');
  if (d.length < 5) return '*'.repeat(v.length);
  return `${d.slice(0, 3)}**-***`;
}

/** AVENIDA PAULISTA -> A****** P******* (le como censurado no video) */
export function maskRua(v: any): any {
  if (typeof v !== 'string' || !v.trim()) return v;
  return v
    .trim()
    .split(/\s+/)
    .map((p) => (p.length <= 1 ? p : `${p.charAt(0)}${'*'.repeat(p.length - 1)}`))
    .join(' ');
}

/** Documento: mantem os 3 ultimos digitos, o resto vira asterisco. */
export function maskDoc(v: any): any {
  if (typeof v !== 'string' || !v.trim()) return v;
  const d = v.replace(/\D/g, '');
  if (d.length <= 3) return '*'.repeat(v.length);
  return `${'*'.repeat(d.length - 3)}${d.slice(-3)}`;
}

/**
 * Objetos que sao CATALOGO, nao pessoa. Dentro deles `nome` e o nome da
 * empresa/loja/cargo/pasta — mascarar deixaria a tela com cara de quebrada
 * (ex: cabecalho do cartao de ponto viraria "TRADICAO S*****").
 */
const CATALOGO_KEYS = new Set([
  'empresa', 'empresas', 'company', 'companies', 'loja', 'lojas', 'store', 'stores',
  'cargo', 'cargos', 'setor', 'setores', 'departamento', 'departamentos',
  'pasta', 'pastas', 'subpasta', 'subpastas', 'modelo', 'modelos',
  'jornada', 'jornadas', 'escala', 'escalas', 'beneficio', 'beneficios',
  'regime', 'regimes', 'holiday', 'feriado', 'feriados',
]);

function maskerFor(key: string): Masker | null {
  const k = key.toLowerCase();
  if (NULL_FIELDS.has(k)) return () => null;
  if (NOME_FIELDS.has(k)) return maskNome;
  if (ARQUIVO_NOME_FIELDS.has(k)) return maskRua; // censura palavra a palavra
  if (FONE_FIELDS.has(k)) return maskFone;
  if (EMAIL_FIELDS.has(k)) return maskEmail;
  if (HANDLE_FIELDS.has(k)) return maskHandle;
  if (CEP_FIELDS.has(k)) return maskCep;
  if (RUA_FIELDS.has(k)) return maskRua;
  if (NUM_FIELDS.has(k)) return () => '***';
  if (DOC_FIELDS.has(k)) return maskDoc;
  return null;
}

/**
 * Percorre o payload inteiro (objeto, array, aninhado) devolvendo uma COPIA
 * mascarada. Nao muta o original — o objeto pode ser uma entity do TypeORM.
 */
export function mascarar(node: any, profundidade = 0, emCatalogo = false): any {
  if (node === null || node === undefined) return node;
  if (profundidade > 12) return node; // trava contra payload circular/gigante
  if (Array.isArray(node)) return node.map((i) => mascarar(i, profundidade + 1, emCatalogo));
  if (node instanceof Date) return node;
  if (typeof node !== 'object') return node;

  const saida: Record<string, any> = {};
  for (const [chave, valor] of Object.entries(node)) {
    // Dentro de objeto de catalogo, `nome` e da empresa/loja/cargo — nao e pessoa.
    const ehNomeDeCatalogo = emCatalogo && NOME_FIELDS.has(chave.toLowerCase());
    const masker = ehNomeDeCatalogo ? null : maskerFor(chave);
    if (masker) {
      saida[chave] = valor === null || valor === undefined ? valor : masker(valor);
      // Sinaliza pro frontend que havia arquivo/foto ali (pra desenhar o placeholder)
      const k = chave.toLowerCase();
      if ((k === 'foto_url' || k === 'foto') && valor) saida['_lgpd_foto'] = true;
      if (k === 'curriculo_pdf_url' && valor) saida['_lgpd_pdf'] = true;
    } else {
      // Entrando num objeto de catalogo, marca o contexto pros filhos.
      const filhoEmCatalogo = emCatalogo || CATALOGO_KEYS.has(chave.toLowerCase());
      saida[chave] = mascarar(valor, profundidade + 1, filhoEmCatalogo);
    }
  }
  return saida;
}

/** O modo so vale pra master COM o header ligado. */
export function demoAtivo(req: AuthRequest): boolean {
  const header = req.header('x-lgpd-demo');
  if (header !== '1') return false;
  const u = req.user as any;
  if (!u) return false;
  return u.role === UserRole.MASTER || u.isMaster === true;
}

/**
 * Middleware: intercepta res.json e mascara a resposta quando o modo esta ligado.
 * Montar DEPOIS do authenticateToken (precisa de req.user pra checar master).
 */
export const lgpdDemoMask = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!demoAtivo(req)) return next();

  const jsonOriginal = res.json.bind(res);
  res.json = ((body: any) => {
    try {
      const mascarado = mascarar(body);
      if (mascarado && typeof mascarado === 'object' && !Array.isArray(mascarado)) {
        mascarado._lgpd_demo = true;
      }
      return jsonOriginal(mascarado);
    } catch {
      // Se a mascara falhar, NAO devolve dado cru — falha fechada.
      // Usa jsonOriginal: res.json aqui ja e este proprio wrapper (recursao).
      res.status(500);
      return jsonOriginal({ error: 'Falha ao aplicar mascara LGPD' });
    }
  }) as Response['json'];

  next();
};

/**
 * Trava de escrita enquanto o modo demonstracao esta ligado.
 *
 * Por que existe: com a tela mascarada, o frontend segura valores JA mascarados
 * em estado local. Um "Salvar" gravaria `MARIA S*****` por cima do nome real do
 * candidato no banco do cliente — perda de dado silenciosa e irreversivel.
 * Enquanto grava video ninguem precisa escrever, entao bloquear e o certo.
 * Montar JUNTO com o lgpdDemoMask.
 */
export const lgpdDemoReadOnly = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!demoAtivo(req)) return next();
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next();

  return res.status(423).json({
    error: 'Modo demonstração LGPD ativo — alterações estão bloqueadas.',
    detail: 'Desligue o modo no menu lateral para voltar a editar.',
    _lgpd_demo: true,
  });
};
