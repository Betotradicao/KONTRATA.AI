/**
 * Popula o painel com o que já existe de verdade, pra ele não nascer vazio:
 *   - os clientes que já rodam na VPS (um container por cliente)
 *   - os 4 vídeos que hoje estão fixos no código da página /treinamento
 *
 *   node scripts/semear.js
 *
 * Roda quantas vezes quiser: usa o subdomínio como chave e não duplica.
 * Os dados comerciais (plano, valor, contato) ficam em branco de propósito —
 * inventar número aqui é pior que deixar vazio pro usuário preencher.
 */
require('dotenv').config();
const { query, migrar, pool } = require('../src/db');

// Lidos dos containers kontrata-* rodando na VPS 46 em 23/08/2026.
const CLIENTES = [
  { nome: 'Tradição',      subdominio: 'tradicao' },
  { nome: 'Ponto Certo',   subdominio: 'pontocerto' },
  { nome: 'Nova Central',  subdominio: 'novacentral' },
  { nome: 'Guibox',        subdominio: 'guibox' },
  { nome: 'Da Mata',       subdominio: 'damata' },
  { nome: 'Puma',          subdominio: 'puma' },
  { nome: 'Mameva',        subdominio: 'mameva' },
  { nome: 'Cidade',        subdominio: 'cidade' },
  { nome: 'Fratelli',      subdominio: 'fratelli' },
];

const VIDEOS = [
  { titulo: 'Módulo 01 – Vídeo 01', descricao: 'Visão geral da plataforma e primeiros passos.', youtube_id: 'RqKadnMnBDQ', ordem: 1 },
  { titulo: 'Módulo 02 – Vídeo 01', descricao: 'Como criar e publicar vagas para candidatos.', youtube_id: 'iKeGO4RVVA4', ordem: 2 },
  { titulo: 'Módulo 03 – Vídeo 01', descricao: 'Filtragem, avaliação e avanço de candidatos.', youtube_id: '86UpDtVDjDI', ordem: 3 },
  { titulo: 'Módulo 04 – Vídeo 01', descricao: 'Envio e gestão de documentos dos colaboradores.', youtube_id: 'MjdoNRZ3aKc', ordem: 4 },
];

(async () => {
  try {
    await migrar();

    let novosClientes = 0;
    for (const c of CLIENTES) {
      const { rows } = await query('SELECT id FROM clientes WHERE subdominio = $1', [c.subdominio]);
      if (rows.length) continue;
      await query(
        `INSERT INTO clientes (nome, subdominio, situacao, estagio)
         VALUES ($1, $2, 'ativo', 'ganho')`,
        [c.nome, c.subdominio]
      );
      novosClientes++;
    }

    let novosVideos = 0;
    for (const v of VIDEOS) {
      const { rows } = await query('SELECT id FROM treinamentos WHERE youtube_id = $1', [v.youtube_id]);
      if (rows.length) continue;
      await query(
        `INSERT INTO treinamentos (titulo, descricao, youtube_id, ordem, ativo)
         VALUES ($1,$2,$3,$4,true)`,
        [v.titulo, v.descricao, v.youtube_id, v.ordem]
      );
      novosVideos++;
    }

    // Chaves de integração aparecem na tela mesmo vazias, pra ficar claro o
    // que dá pra configurar.
    for (const [chave, secreto] of [
      ['asaas_api_key', true],
      ['asaas_ambiente', false],
      ['whatsapp_evolution_url', false],
      ['whatsapp_evolution_key', true],
    ]) {
      await query(
        `INSERT INTO integracoes (chave, valor, secreto) VALUES ($1, NULL, $2)
         ON CONFLICT (chave) DO NOTHING`,
        [chave, secreto]
      );
    }

    console.log(`Clientes inseridos: ${novosClientes} (de ${CLIENTES.length})`);
    console.log(`Vídeos inseridos:   ${novosVideos} (de ${VIDEOS.length})`);
    console.log('Chaves de integração criadas (vazias).');
  } catch (e) {
    console.error('Erro:', e.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
