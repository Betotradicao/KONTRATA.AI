import { AppDataSource } from '../config/database';
import { User, UserRole } from '../entities/User';

/**
 * Script de fallback do installer: garante que os 2 usuários master
 * padrão existam no banco, independente do auto-seed do startup.
 *
 *   - ROBERTO  / Beto3107@@##
 *   - MARIANE / L8r1f4a@
 *
 * Idempotente por username (case-insensitive). Se algum dos dois
 * existir, só cria o que falta — não duplica.
 */
const MASTERS_PADRAO = [
  { name: 'ROBERTO', username: 'ROBERTO', email: 'admin@prevencao.com.br',   password: 'Beto3107@@##' },
  { name: 'MARIANE', username: 'MARIANE', email: 'mariane@prevencao.com.br', password: 'L8r1f4a@'     },
];

async function seedMasterUser() {
  try {
    console.log('🔧 Garantindo usuários MASTER...');

    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
    }

    const userRepository = AppDataSource.getRepository(User);

    for (const m of MASTERS_PADRAO) {
      const ja = await userRepository
        .createQueryBuilder('u')
        .where('LOWER(u.username) = LOWER(:u)', { u: m.username })
        .getOne();

      if (ja) {
        console.log(`✅ ${m.username} já existe (${ja.email}). Skip.`);
        continue;
      }

      const u = userRepository.create({
        name: m.name,
        username: m.username,
        email: m.email,
        password: m.password,
        role: UserRole.MASTER,
        isMaster: true,
      });
      await userRepository.save(u);
      console.log(`✅ ${m.username} criado (senha: ${m.password})`);
    }
  } catch (error) {
    console.error('❌ Erro ao garantir usuários MASTER:', error);
    throw error;
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  seedMasterUser()
    .then(() => {
      console.log('✅ Seed concluído');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Erro no seed:', error);
      process.exit(1);
    });
}

export { seedMasterUser };
