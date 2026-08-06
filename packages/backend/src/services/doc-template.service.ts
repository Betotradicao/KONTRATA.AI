import { AppDataSource } from '../config/database';

/**
 * Documentacao Padronizada — replicacao do template no colaborador.
 *
 * O template mora em `rh_documento_pastas_template` / `rh_documento_subpastas_template`
 * e e configurado em "Configuracoes RH -> Documentacao Padronizada".
 *
 * ⚠️ Existem DOIS caminhos que criam colaborador (Cadastro Geral manual e
 * Ficha de Admissao -> "virar colaborador"). Os dois PRECISAM chamar isto,
 * senao o colaborador nasce sem nenhuma pasta. Por isso o codigo vive aqui,
 * e nao inline no controller.
 *
 * Idempotente: pode rodar quantas vezes quiser, nao duplica nada.
 */
export async function replicarTemplateNoColaborador(colaboradorId: number): Promise<{ pastas: number; subpastas: number }> {
  let pastas = 0;
  let subpastas = 0;
  if (!colaboradorId) return { pastas, subpastas };

  const pastasTemplate = await AppDataSource.query(
    `SELECT id, nome, ordem, protegida FROM rh_documento_pastas_template
      WHERE obrigatoria = true
      ORDER BY ordem, nome`
  );

  for (const pt of pastasTemplate) {
    try {
      // Pastas protegidas no template ficam protegidas no colaborador.
      const [pastaCriada] = await AppDataSource.query(
        `INSERT INTO rh_documento_pastas (colaborador_id, nome, ordem, protegida)
         VALUES ($1::int, $2::text, $3::int, $4::boolean)
         ON CONFLICT (colaborador_id, nome) DO UPDATE SET protegida = EXCLUDED.protegida, ordem = EXCLUDED.ordem
         RETURNING id`,
        [colaboradorId, pt.nome, pt.ordem, pt.protegida]
      );
      pastas++;

      const subs = await AppDataSource.query(
        `SELECT nome, ordem, obrigatoria FROM rh_documento_subpastas_template
          WHERE pasta_template_id = $1 AND obrigatoria = true
          ORDER BY ordem, nome`,
        [pt.id]
      );
      for (const sub of subs) {
        try {
          // ⚠️ NAO usar `ON CONFLICT (pasta_id, nome)` aqui: `rh_documento_subpastas`
          // NAO tem UNIQUE nessas colunas, e o Postgres estoura com
          // "there is no unique or exclusion constraint matching the ON CONFLICT
          // specification". Era o que acontecia ate 06/08/2026 — o erro caia no
          // catch, virava console.warn e NENHUMA subpasta obrigatoria era criada,
          // nem no Cadastro Geral. Anti-duplicata via NOT EXISTS, igual ao
          // `sincronizarTudo` do RhDocTemplateController (que por isso funcionava).
          const r = await AppDataSource.query(
            `INSERT INTO rh_documento_subpastas (pasta_id, nome, ordem, obrigatorio)
             SELECT $1::int, $2::text, $3::int, $4::boolean
              WHERE NOT EXISTS (SELECT 1 FROM rh_documento_subpastas s
                                 WHERE s.pasta_id = $1::int AND UPPER(s.nome) = UPPER($2::text))
             RETURNING id`,
            [pastaCriada.id, sub.nome, sub.ordem, sub.obrigatoria]
          );
          subpastas += r?.length || 0;
        } catch (eSub) {
          // Uma subpasta problematica nao pode derrubar as outras da mesma pasta.
          console.warn(`[colab ${colaboradorId}] falha na subpasta ${pt.nome}/${sub.nome}:`, (eSub as Error).message);
        }
      }
    } catch (e) {
      // Uma pasta problematica nao pode impedir a criacao do colaborador.
      console.warn(`[colab ${colaboradorId}] falha ao criar pasta template ${pt.nome}:`, (e as Error).message);
    }
  }

  return { pastas, subpastas };
}
