/**
 * Diagnóstico: lista as instâncias da Evolution API configurada em `configurations`
 * (evolution_api_url / evolution_api_token) e o estado de cada uma. Não imprime o token.
 * Uso: npx ts-node scripts/listar-instancias-evolution.ts
 */
import 'dotenv/config';
import axios from 'axios';
import { AppDataSource } from '../src/config/database';
import { ConfigurationService } from '../src/services/configuration.service';

(async () => {
  await AppDataSource.initialize();
  const url = (await ConfigurationService.get('evolution_api_url', '')) || '';
  const token = (await ConfigurationService.get('evolution_api_token', '')) || '';
  const instance = (await ConfigurationService.get('evolution_instance', '')) || '';
  console.log('URL:', url, '| instancia configurada:', instance, '| token:', token ? `${token.length} chars` : 'VAZIO');
  const base = url.replace(/\/+$/, '');
  try {
    const r = await axios.get(`${base}/instance/fetchInstances`, { headers: { apikey: token }, timeout: 20000 });
    const list = Array.isArray(r.data) ? r.data : [];
    for (const i of list) {
      const x = i.instance || i;
      console.log('-', x.instanceName || x.name, '|', x.status || x.connectionStatus, '|', String(x.owner || x.ownerJid || '').replace(/@.*/, ''));
    }
    if (!list.length) console.log('(nenhuma instância retornada)', JSON.stringify(r.data).slice(0, 300));
  } catch (e: any) {
    console.log('fetchInstances falhou:', e.response?.status, JSON.stringify(e.response?.data || e.message).slice(0, 300));
  }
  try {
    const r = await axios.get(`${base}/instance/connectionState/${encodeURIComponent(instance)}`, { headers: { apikey: token }, timeout: 20000 });
    console.log('connectionState', instance, '=>', JSON.stringify(r.data).slice(0, 200));
  } catch (e: any) {
    console.log('connectionState falhou:', e.response?.status, JSON.stringify(e.response?.data || e.message).slice(0, 200));
  }
  await AppDataSource.destroy();
})();
