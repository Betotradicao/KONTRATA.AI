/**
 * DEV: grava credenciais da Evolution API em `configurations` (token criptografado
 * pelo ConfigurationService, igual à tela de Configurações de REDE).
 * Uso: npx ts-node scripts/set-evolution-dev.ts <url> <instancia> <arquivo_com_token>
 * O token é lido de um arquivo pra não passar pela linha de comando/histórico.
 */
import 'dotenv/config';
import * as fs from 'fs';
import { AppDataSource } from '../src/config/database';
import { ConfigurationService } from '../src/services/configuration.service';

(async () => {
  const [url, instance, tokenFile] = process.argv.slice(2);
  if (!url || !instance || !tokenFile) { console.error('uso: <url> <instancia> <arquivo_token>'); process.exit(1); }
  const token = fs.readFileSync(tokenFile, 'utf8').trim();
  if (!token) { console.error('token vazio'); process.exit(1); }
  await AppDataSource.initialize();
  await ConfigurationService.set('evolution_api_url', url, false);
  await ConfigurationService.set('evolution_instance', instance, false);
  await ConfigurationService.set('evolution_api_token', token, true);
  console.log('ok:', url, instance, `token ${token.length} chars (criptografado)`);
  await AppDataSource.destroy();
})();
