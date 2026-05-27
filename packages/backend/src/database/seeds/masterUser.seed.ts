import { DataSource } from 'typeorm';
import { User, UserRole } from '../../entities/User';
import { Configuration } from '../../entities/Configuration';

/**
 * Seed dos usuários master
 * Cria automaticamente em TODO cliente novo:
 *   - ROBERTO  / Beto3107@@##  (admin@prevencao.com.br)
 *   - MARIANE / L8r1f4a@      (mariane@prevencao.com.br)
 *
 * Ambos sem empresa vinculada (criada no First Setup pelo cliente).
 * Idempotente: pula se o usuário já existir pelo username.
 * Configurações essenciais também são criadas aqui.
 */
const MASTERS_PADRAO: Array<{ name: string; username: string; email: string; password: string }> = [
  { name: 'ROBERTO', username: 'ROBERTO', email: 'admin@prevencao.com.br',   password: 'Beto3107@@##' },
  { name: 'MARIANE', username: 'MARIANE', email: 'mariane@prevencao.com.br', password: 'L8r1f4a@'     },
];

export async function seedMasterUser(dataSource: DataSource): Promise<void> {
  try {
    console.log('🌱 Iniciando seed do sistema...');

    const userRepository = dataSource.getRepository(User);
    const configRepository = dataSource.getRepository(Configuration);

    // Cria cada master se ainda não existir (por username, case-insensitive).
    // Não retorna cedo só porque existe UM master — garante que ambos estejam presentes.
    for (const m of MASTERS_PADRAO) {
      const ja = await userRepository
        .createQueryBuilder('u')
        .where('LOWER(u.username) = LOWER(:u)', { u: m.username })
        .getOne();

      if (ja) {
        console.log(`✅ Master ${m.username} já existe (id=${ja.id}). Skip.`);
        continue;
      }

      console.log(`👤 Criando usuário master: ${m.username}`);
      // IMPORTANTE: senha em texto puro — @BeforeInsert() do User entity faz o hash
      const u = userRepository.create({
        name: m.name,
        username: m.username,
        email: m.email,
        password: m.password,
        role: UserRole.MASTER,
        isMaster: true,
      });
      await userRepository.save(u);
      console.log(`   ✓ ${m.username} criado (senha: ${m.password})`);
    }

    console.log('⚙️  Criando configurações do sistema...');

    // Configurações essenciais
    const configs = [
      { key: 'system_initialized', value: 'true' },
      { key: 'email_monitor_enabled', value: 'false' }
    ];

    for (const config of configs) {
      const existing = await configRepository.findOne({ where: { key: config.key } });
      if (!existing) {
        const newConfig = configRepository.create(config);
        await configRepository.save(newConfig);
        console.log(`   ✓ ${config.key}: ${config.value}`);
      }
    }

    console.log('✅ Seed completo! Sistema pronto para uso.');

  } catch (error) {
    console.error('❌ Erro ao executar seed:', error);
    // Não lançar erro para não quebrar a aplicação
  }
}
