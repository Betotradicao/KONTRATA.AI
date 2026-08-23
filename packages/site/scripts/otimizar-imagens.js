/**
 * Otimiza as imagens do site. Rodar quando trocar alguma imagem:
 *   node scripts/otimizar-imagens.js
 *
 * POR QUE: as imagens vieram do CDN do Base44 em tamanho original — a foto da
 * especialista tinha 1,1 MB pra aparecer num quadrado de 288px, e o logo tinha
 * 998 KB pra ser o iconezinho da aba. Numa landing page isso custa carregamento
 * (e o Google usa velocidade como criterio de posicionamento).
 *
 * Fonte: referencia-base44/imagens/ (originais, nunca editar)
 * Saida:  src/assets/ e public/
 */
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const raiz = path.dirname(fileURLToPath(import.meta.url)) + '/..';
const origem = path.join(raiz, 'referencia-base44', 'imagens');

const TAREFAS = [
  {
    de: '6d8f8f8a6_mamevarg.png',
    para: path.join(raiz, 'src/assets/dashboard.png'),
    largura: 1200, // aparece grande no hero (metade da tela em desktop)
    nota: 'print do sistema no hero',
  },
  {
    de: '3205fe8b5_generated_34ed48bc.png',
    para: path.join(raiz, 'src/assets/especialista.png'),
    largura: 576, // exibida a 288px; 2x pra ficar nitida em tela retina
    nota: 'foto do bloco de CTA',
  },
  {
    de: '680f5509d_LogoKontrataai.png',
    para: path.join(raiz, 'public/logo-kontrataai.png'),
    largura: 256, // so icone da aba e compartilhamento
    nota: 'logo / favicon',
  },
];

const kb = (n) => (n / 1024).toFixed(0) + ' KB';

for (const t of TAREFAS) {
  const entrada = path.join(origem, t.de);
  if (!fs.existsSync(entrada)) {
    console.log(`PULANDO ${t.de} — original nao encontrado`);
    continue;
  }
  const antes = fs.statSync(entrada).size;
  await sharp(entrada)
    .resize({ width: t.largura, withoutEnlargement: true })
    .png({ quality: 82, compressionLevel: 9, palette: true })
    .toFile(t.para);
  const depois = fs.statSync(t.para).size;
  const ganho = (100 - (depois / antes) * 100).toFixed(0);
  console.log(
    `${t.nota.padEnd(26)} ${kb(antes).padStart(9)} -> ${kb(depois).padStart(8)}  (-${ganho}%)`
  );
}
