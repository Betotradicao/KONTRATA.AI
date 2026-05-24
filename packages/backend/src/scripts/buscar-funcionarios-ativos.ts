import { AppDataSource } from '../config/database';
import { Employee } from '../entities/Employee';
import { Sector } from '../entities/Sector';

async function buscarFuncionariosAtivos() {
  try {
    await AppDataSource.initialize();
    console.log('Conectado ao banco de dados!\n');

    const employeeRepository = AppDataSource.getRepository(Employee);

    // Buscar todos os funcionários ativos com seus setores
    const funcionarios = await employeeRepository.find({
      where: { active: true },
      relations: ['sector'],
      order: { name: 'ASC' }
    });

    console.log('='.repeat(120));
    console.log(`FUNCIONÁRIOS ATIVOS - Total: ${funcionarios.length}`);
    console.log('='.repeat(120));
    console.log(`${'#'.padStart(4)} | ${'Nome'.padEnd(40)} | ${'Setor'.padEnd(25)} | ${'Barcode'.padEnd(15)} | ${'Status'.padEnd(8)}`);
    console.log('-'.repeat(120));

    funcionarios.forEach((func, idx) => {
      console.log(
        `${String(idx + 1).padStart(4)} | ` +
        `${func.name.substring(0, 40).padEnd(40)} | ` +
        `${(func.sector?.name || 'SEM SETOR').substring(0, 25).padEnd(25)} | ` +
        `${(func.barcode || '').substring(0, 15).padEnd(15)} | ` +
        `${(func.active ? 'ATIVO' : 'INATIVO').padEnd(8)}`
      );
    });

    // Agrupar por setor
    const porSetor: { [key: string]: Employee[] } = {};
    funcionarios.forEach(func => {
      const setorNome = func.sector?.name || 'SEM SETOR';
      if (!porSetor[setorNome]) {
        porSetor[setorNome] = [];
      }
      porSetor[setorNome].push(func);
    });

    console.log('\n' + '='.repeat(120));
    console.log('FUNCIONÁRIOS POR SETOR');
    console.log('='.repeat(120));

    Object.keys(porSetor).sort().forEach(setorNome => {
      console.log(`\n${setorNome}: ${porSetor[setorNome].length} funcionários`);
      porSetor[setorNome].forEach((func, idx) => {
        console.log(`  ${String(idx + 1).padStart(3)}. ${func.name.padEnd(40)} - Barcode: ${func.barcode}`);
      });
    });

    // Salvar em JSON para cruzamento
    const output = {
      total: funcionarios.length,
      funcionarios: funcionarios.map(f => ({
        id: f.id,
        name: f.name,
        sector: f.sector?.name || 'SEM SETOR',
        barcode: f.barcode,
        username: f.username,
        active: f.active,
        function: f.function_description
      })),
      porSetor: Object.keys(porSetor).sort().map(setorNome => ({
        setor: setorNome,
        total: porSetor[setorNome].length,
        funcionarios: porSetor[setorNome].map(f => ({
          name: f.name,
          barcode: f.barcode,
          username: f.username
        }))
      }))
    };

    const fs = require('fs');
    fs.writeFileSync('funcionarios-db.json', JSON.stringify(output, null, 2), 'utf8');
    console.log('\n✓ Arquivo salvo: funcionarios-db.json');

    await AppDataSource.destroy();
  } catch (error) {
    console.error('Erro:', error);
    process.exit(1);
  }
}

buscarFuncionariosAtivos();
