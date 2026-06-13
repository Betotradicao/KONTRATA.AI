import axios from 'axios';
import { AppDataSource } from '../config/database';

// Converte endereco -> coordenadas (lat/lng) e calcula distancia em linha reta
// (haversine) pra coluna "KM Residencia" em RhVagas: distancia da casa do
// candidato ate a loja da vaga (comparacao geografica ponto a ponto).
//
// Estrategia de geocoding (em ordem):
//  1) Photon (OSM) pela RUA + cidade — fonte PRIMARIA, precisa e gratis.
//     A AwesomeAPI por CEP as vezes retorna coordenada furada em CEPs isolados
//     (ex: 12248-628 caiu 12km errado), entao a rua via OSM e mais confiavel.
//  2) AwesomeAPI por CEP — fallback quando a rua nao existe no OSM.
//
// Cache: memoria por processo (memCache) evita rebater as APIs no mesmo boot.
// Persistencia: colunas latitude/longitude/geo_cep em curriculos e rh_empresas
// (geo_cep = cep que gerou as coords, pra re-geocodar se mudar).

export interface Coords { lat: number; lng: number; }
export interface Endereco { cep?: string | null; rua?: string | null; cidade?: string | null; estado?: string | null; }

const PHOTON_UA = 'kontrata-ai/1.0 (recrutamento)';
const memCache = new Map<string, Coords | null>();
const pendentes = new Set<string>();

const semAcento = (s?: string | null) =>
  String(s || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();

export class GeocodeService {
  static normalizarCep(cep?: string | null): string | null {
    if (!cep) return null;
    const d = String(cep).replace(/\D/g, '');
    return d.length === 8 ? d : null;
  }

  // PRIMARIO: geocoda pela rua via Photon/OSM. Exige bater a cidade pra nao
  // pegar rua de mesmo nome em outra cidade.
  static async coordsViaPhoton(rua?: string | null, cidade?: string | null, estado?: string | null): Promise<Coords | null> {
    if (!rua || !cidade) return null;
    const q = [rua, cidade, estado, 'Brasil'].filter(Boolean).join(', ');
    const chave = `photon:${semAcento(q)}`;
    if (memCache.has(chave)) return memCache.get(chave)!;
    try {
      const { data } = await axios.get('https://photon.komoot.io/api/', {
        params: { q, limit: 5 }, timeout: 7000, headers: { 'User-Agent': PHOTON_UA },
      });
      const alvoCidade = semAcento(cidade);
      let coords: Coords | null = null;
      for (const f of data?.features || []) {
        const p = f?.properties || {};
        if (String(p.countrycode || '').toUpperCase() !== 'BR') continue;
        const cidadeFeat = semAcento(p.city || p.county || p.district);
        if (alvoCidade && cidadeFeat !== alvoCidade && !cidadeFeat.includes(alvoCidade)) continue;
        const [lng, lat] = f?.geometry?.coordinates || [];
        if (Number.isFinite(lat) && Number.isFinite(lng)) { coords = { lat, lng }; break; }
      }
      memCache.set(chave, coords);
      return coords;
    } catch {
      memCache.set(chave, null);
      return null;
    }
  }

  // FALLBACK: AwesomeAPI por CEP (gratis, sem chave). Menos confiavel.
  static async coordsViaCep(cep?: string | null): Promise<Coords | null> {
    const norm = this.normalizarCep(cep);
    if (!norm) return null;
    const chave = `cep:${norm}`;
    if (memCache.has(chave)) return memCache.get(chave)!;
    try {
      const { data } = await axios.get(`https://cep.awesomeapi.com.br/json/${norm}`, { timeout: 6000 });
      const lat = parseFloat(data?.lat);
      const lng = parseFloat(data?.lng);
      const coords = Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
      memCache.set(chave, coords);
      return coords;
    } catch {
      memCache.set(chave, null);
      return null;
    }
  }

  // Orquestra: tenta rua (Photon) e cai pro CEP (AwesomeAPI) se nao achar.
  static async coordsParaEndereco(end: Endereco): Promise<Coords | null> {
    const viaRua = await this.coordsViaPhoton(end.rua, end.cidade, end.estado);
    if (viaRua) return viaRua;
    return this.coordsViaCep(end.cep);
  }

  static distanciaMetros(a: Coords, b: Coords): number {
    const R = 6371000;
    const toRad = (d: number) => (d * Math.PI) / 180;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }

  // 850 -> "850 m" | 14732 -> "14 km 700 m" (metros arredondados a 50).
  static formatarDistancia(metros: number | null | undefined): string | null {
    if (metros == null || !Number.isFinite(metros)) return null;
    const arred = Math.round(metros / 50) * 50;
    const km = Math.floor(arred / 1000);
    const m = arred % 1000;
    if (km <= 0) return `${m} m`;
    return m > 0 ? `${km} km ${m} m` : `${km} km`;
  }

  // Geocoda em background (nao trava a tela) os itens que faltam coords e
  // persiste. Busca o endereco completo no banco pra geocodar pela rua.
  static warmInBackground(itens: Array<{ tipo: 'curriculo' | 'empresa'; chave: number }>): void {
    const curIds = [...new Set(itens.filter(i => i.tipo === 'curriculo').map(i => i.chave))]
      .filter(id => !pendentes.has(`curriculo:${id}`));
    const lojaIds = [...new Set(itens.filter(i => i.tipo === 'empresa').map(i => i.chave))]
      .filter(id => !pendentes.has(`empresa:${id}`));
    if (!curIds.length && !lojaIds.length) return;

    (async () => {
      const lotes: Array<{ tipo: 'curriculo' | 'empresa'; tabela: string; chaveCol: string; ids: number[] }> = [
        { tipo: 'curriculo', tabela: 'curriculos', chaveCol: 'id', ids: curIds },
        { tipo: 'empresa', tabela: 'rh_empresas', chaveCol: 'cod_loja', ids: lojaIds },
      ];
      for (const lote of lotes) {
        if (!lote.ids.length) continue;
        let rows: any[] = [];
        try {
          rows = await AppDataSource.query(
            `SELECT ${lote.chaveCol} AS chave, cep, rua, cidade, estado FROM ${lote.tabela} WHERE ${lote.chaveCol} = ANY($1)`,
            [lote.ids]
          );
        } catch { continue; }
        for (const r of rows) {
          const guard = `${lote.tipo}:${r.chave}`;
          pendentes.add(guard);
          try {
            const coords = await this.coordsParaEndereco(r);
            if (!coords) continue;
            await AppDataSource.query(
              `UPDATE ${lote.tabela} SET latitude = $1, longitude = $2, geo_cep = $3, geo_updated_at = now() WHERE ${lote.chaveCol} = $4`,
              [coords.lat, coords.lng, this.normalizarCep(r.cep), r.chave]
            ).catch(() => {});
          } catch {
            /* segue */
          } finally {
            pendentes.delete(guard);
          }
        }
      }
    })();
  }
}
