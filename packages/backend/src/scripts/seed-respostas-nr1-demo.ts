/**
 * Popula respostas SIMULADAS da pesquisa NR-1 pra demonstrar
 * o Farol Diagnostico com dados realistas.
 *
 * Gera 4 rodadas (1 por setor) com respostas distribuidas pra criar
 * um cenario rico no farol:
 *   - Acougue:    3 respostas com Burnout/Sobrecarga ALTOS (vermelho)
 *   - Caixa:      3 respostas com Assedio Moral ALTO (vermelho)
 *   - Padaria:    2 respostas medianas (amarelo geral)
 *   - Hortifruti: 2 respostas boas (verde geral)
 *
 * Idempotente: se ja existem rodadas com esses tokens, deleta e
 * recria. NAO afeta outras pesquisas.
 *
 * Uso: npx ts-node src/scripts/seed-respostas-nr1-demo.ts
 */
import { AppDataSource } from '../config/database';

const ESCALA_FREQ = ['Sempre', 'Muitas vezes', 'Às vezes', 'Raramente', 'Nunca'];
const ESCALA_SAUDE = ['Excelente', 'Muito boa', 'Boa', 'Razoável', 'Ruim'];

type Perfil = 'critico' | 'ruim' | 'medio' | 'bom' | 'excelente';

// Tendencia base por perfil: probabilidade de cada resposta na escala (0=Sempre/Excelente)
// Para perguntas com inverter_escala=true (Sempre = pior), o perfil critico responde mais "Sempre".
// Para perguntas com inverter_escala=false (Sempre = melhor), o perfil critico responde mais "Nunca".
const PERFIL_DIST: Record<Perfil, number[]> = {
  critico:   [0.55, 0.30, 0.10, 0.05, 0.00], // tende ao indice 0
  ruim:      [0.30, 0.40, 0.20, 0.07, 0.03],
  medio:     [0.10, 0.30, 0.40, 0.15, 0.05],
  bom:       [0.03, 0.10, 0.20, 0.40, 0.27],
  excelente: [0.00, 0.05, 0.15, 0.30, 0.50], // tende ao indice 4
};

function escolher(distribuicao: number[]): number {
  const r = Math.random();
  let acc = 0;
  for (let i = 0; i < distribuicao.length; i++) {
    acc += distribuicao[i];
    if (r < acc) return i;
  }
  return distribuicao.length - 1;
}

// Setor -> [perfil_geral, perfis_especificos_por_dimensao]
// perfis_especificos_por_dimensao sobrescreve o geral em dimensoes especificas
const SETORES: Array<{
  nome: string;
  qtdRespostas: number;
  perfilGeral: Perfil;
  overrides: Partial<Record<string, Perfil>>;
}> = [
  {
    nome: 'Açougue',
    qtdRespostas: 3,
    perfilGeral: 'medio',
    overrides: {
      burnout: 'critico',
      estresse: 'ruim',
      demandas_quantitativas: 'critico',
      sono: 'ruim',
    },
  },
  {
    nome: 'Frente de Caixa',
    qtdRespostas: 3,
    perfilGeral: 'medio',
    overrides: {
      assedio_moral: 'critico',
      discriminacao: 'ruim',
      apoio_gestor: 'ruim',
      qualidade_lideranca: 'ruim',
    },
  },
  {
    nome: 'Padaria',
    qtdRespostas: 2,
    perfilGeral: 'medio',
    overrides: {},
  },
  {
    nome: 'Hortifruti',
    qtdRespostas: 2,
    perfilGeral: 'bom',
    overrides: {
      apoio_colegas: 'excelente',
      comunidade_social: 'excelente',
    },
  },
];

async function main() {
  if (!AppDataSource.isInitialized) await AppDataSource.initialize();

  const [modelo] = await AppDataSource.query(
    `SELECT id FROM pesquisa_modelos WHERE nome = $1`,
    ['Avaliação de Riscos Psicossociais - NR-1']
  );
  if (!modelo) {
    console.error('❌ Modelo NR-1 não encontrado. Rode as migrations primeiro.');
    process.exit(1);
  }
  const modeloId = modelo.id;

  const perguntas = await AppDataSource.query(
    `SELECT id, tipo, configuracao FROM pesquisa_perguntas
     WHERE modelo_id = $1 ORDER BY ordem`,
    [modeloId]
  );
  console.log(`📋 ${perguntas.length} perguntas encontradas no modelo NR-1`);

  // Limpa rodadas demo anteriores (idempotencia)
  await AppDataSource.query(
    `DELETE FROM pesquisa_rodadas WHERE modelo_id = $1 AND token_publico LIKE 'demo-nr1-%'`,
    [modeloId]
  );

  let totalRespostas = 0;
  for (const setor of SETORES) {
    const slug = setor.nome
      .toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-');
    const [rodada] = await AppDataSource.query(
      `INSERT INTO pesquisa_rodadas (modelo_id, nome, token_publico, aberta)
       VALUES ($1, $2, $3, true) RETURNING id`,
      [modeloId, `NR-1 Maio/2026 — ${setor.nome}`, `demo-nr1-${slug}`]
    );
    console.log(`📊 Rodada criada pra setor ${setor.nome}: id ${rodada.id}`);

    for (let i = 0; i < setor.qtdRespostas; i++) {
      const [resp] = await AppDataSource.query(
        `INSERT INTO pesquisa_respostas (rodada_id, ip_hash, finalizada_em)
         VALUES ($1, $2, NOW() - INTERVAL '${Math.floor(Math.random() * 10)} days')
         RETURNING id`,
        [rodada.id, `demo-${setor.nome}-${i}`]
      );

      for (const p of perguntas) {
        const cfg = typeof p.configuracao === 'string'
          ? JSON.parse(p.configuracao)
          : (p.configuracao || {});
        const dimensao = cfg.dimensao_nr1;
        const inverter = !!cfg.inverter_escala;
        const escala = (cfg.opcoes && Array.isArray(cfg.opcoes)) ? cfg.opcoes : null;

        // texto_longo: pula (opcional)
        if (p.tipo === 'texto_longo' || !escala) continue;

        const perfil: Perfil = setor.overrides[dimensao] || setor.perfilGeral;

        // Idx 0 = "Sempre"/"Excelente" (extremo "alto")
        // Quando inverter=true, "Sempre" representa PIOR → critico tende a idx 0
        // Quando inverter=false, "Sempre" representa MELHOR → critico tende a idx 4
        const dist = PERFIL_DIST[perfil];
        const idx = inverter ? escolher(dist) : escolher([...dist].reverse());
        const valorTexto = escala[idx] || escala[0];

        await AppDataSource.query(
          `INSERT INTO pesquisa_resp_itens (resposta_id, pergunta_id, valor_texto)
           VALUES ($1, $2, $3)`,
          [resp.id, p.id, valorTexto]
        );
      }
      totalRespostas++;
    }
  }

  console.log(`✅ ${totalRespostas} respostas demo geradas em ${SETORES.length} setores`);
  process.exit(0);
}

main().catch(e => {
  console.error('❌ Erro:', e.message);
  process.exit(1);
});
