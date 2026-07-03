import axios from 'axios';
import { ConfigurationService } from './configuration.service';

/**
 * Integração com a NUVEM RHiD (Control iD) — fonte oficial da apuração e do
 * banco de horas (já reflete queima de banco / pagamento de HE).
 * Base: https://www.rhid.com.br/v2/api.svc  · auth: JWT (Authorization: Bearer)
 *
 * Config (por cliente, em configurations, criptografado):
 *   rhid_email, rhid_senha, rhid_dominio (opcional), rhid_base (opcional)
 *
 * ⚠️ A resposta do /apuracao_ponto vem JSON-dentro-de-string (double-encoded).
 */

export interface RhidPerson { id: number; pis: string; cpf: string; name: string; registration: string; status: number; }

const DEFAULT_BASE = 'https://www.rhid.com.br/v2/api.svc';
const TOKEN_TTL_MS = 45 * 60 * 1000;   // token dura ~4h; renova bem antes
const PERSON_TTL_MS = 10 * 60 * 1000;

let tokenCache: { at: number; base: string; email: string; token: string } | null = null;
let personCache: { at: number; base: string; email: string; list: RhidPerson[] } | null = null;

function pisNorm(pis: any): string { return String(pis ?? '').replace(/\D/g, '').replace(/^0+/, '') || '0'; }

async function getConfig() {
  const [email, senha, dominio, base] = await Promise.all([
    ConfigurationService.get('rhid_email'),
    ConfigurationService.get('rhid_senha'),
    ConfigurationService.get('rhid_dominio'),
    ConfigurationService.get('rhid_base', DEFAULT_BASE),
  ]);
  if (!email || !senha) throw new Error('RHiD não configurada (defina rhid_email e rhid_senha nas Configurações)');
  return { email, senha, dominio: dominio || undefined, base: base || DEFAULT_BASE };
}

async function getToken(): Promise<{ token: string; base: string }> {
  const { email, senha, dominio, base } = await getConfig();
  if (tokenCache && tokenCache.base === base && tokenCache.email === email && Date.now() - tokenCache.at < TOKEN_TTL_MS) {
    return { token: tokenCache.token, base };
  }
  const body: any = { email, password: senha };
  if (dominio) body.domain = dominio;
  const r = await axios.post(`${base}/login`, body, { timeout: 20000, headers: { 'Content-Type': 'application/json' } });
  const token = r.data?.accessToken;
  if (!token) throw new Error('RHiD: login não retornou accessToken (verifique e-mail/senha/domínio)');
  tokenCache = { at: Date.now(), base, email, token };
  return { token, base };
}

async function authGet(path: string): Promise<any> {
  const { token, base } = await getToken();
  const r = await axios.get(`${base}${path}`, { timeout: 40000, headers: { Authorization: `Bearer ${token}` }, responseType: 'text' });
  let data: any = r.data;
  if (typeof data === 'string') { try { data = JSON.parse(data); } catch { /* deixa string */ } }
  if (typeof data === 'string') { try { data = JSON.parse(data); } catch { /* double-encoded */ } }
  return data;
}

export const RhidService = {
  async testarConexao() {
    const t0 = Date.now();
    const { base } = await getToken();
    return { ok: true, base, ms: Date.now() - t0 };
  },

  /** Testa credenciais informadas (sem salvar) — pro botão "Testar Conexão". */
  async testarLoginManual(email: string, senha: string, dominio?: string, base?: string) {
    const b = base || DEFAULT_BASE;
    const body: any = { email, password: senha };
    if (dominio) body.domain = dominio;
    const t0 = Date.now();
    const r = await axios.post(`${b}/login`, body, { timeout: 20000, headers: { 'Content-Type': 'application/json' } });
    if (!r.data?.accessToken) throw new Error('Login não retornou token (verifique e-mail/senha/domínio)');
    return { ok: true, ms: Date.now() - t0, base: b };
  },

  async listarPessoas(): Promise<RhidPerson[]> {
    const { email, base } = await getConfig();
    if (personCache && personCache.base === base && personCache.email === email && Date.now() - personCache.at < PERSON_TTL_MS) {
      return personCache.list;
    }
    let all: RhidPerson[] = [], start = 0;
    for (let i = 0; i < 20; i++) {
      const j = await authGet(`/person?start=${start}&length=100`);
      const recs: any[] = j?.records || [];
      all = all.concat(recs.map(p => ({ id: p.id, pis: String(p.pis ?? ''), cpf: String(p.cpf ?? ''), name: p.name, registration: p.registration, status: p.status })));
      if (recs.length < 100) break;
      start += 100;
    }
    personCache = { at: Date.now(), base, email, list: all };
    return all;
  },

  /** Lista as empresas (companies) da conta RHiD. */
  async listarEmpresas(): Promise<{ id: number; nome: string }[]> {
    const j = await authGet(`/company?start=0&length=100`);
    const recs: any[] = j?.records || (Array.isArray(j) ? j : []);
    return recs.map(c => ({ id: c.id, nome: c.name || c.nome || c.fantasyName || c.corporateName || `Empresa ${c.id}` }));
  },

  async idPersonPorPis(pis: string): Promise<RhidPerson | null> {
    const alvo = pisNorm(pis);
    const list = await this.listarPessoas();
    return list.find(p => pisNorm(p.pis) === alvo) || null;
  },

  /** Apuração oficial (array de dias) de um idPerson no período. */
  async apuracao(idPerson: number, dataIni: string, dataFinal: string): Promise<any[]> {
    let data = await authGet(`/apuracao_ponto?dataIni=${dataIni}&dataFinal=${dataFinal}&idPerson=${idPerson}`);
    if (typeof data === 'string') { try { data = JSON.parse(data); } catch { data = []; } }
    return Array.isArray(data) ? data : [];
  },

  limparCache() { tokenCache = null; personCache = null; },
};
