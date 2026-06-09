import { AppDataSource } from '../config/database';
import { Configuration } from '../entities/Configuration';

/**
 * Script de seed para popular configurações iniciais do sistema
 * Executa automaticamente ao iniciar o backend pela primeira vez
 */
async function seedConfigurations() {
  try {
    console.log('🌱 Iniciando seed de configurações...');

    // Garantir que o banco está conectado
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
    }

    const configRepository = AppDataSource.getRepository(Configuration);

    // Verificar se já existe alguma configuração
    const existingCount = await configRepository.count();

    if (existingCount > 0) {
      console.log('🔄 Configurações já existem. Atualizando com valores do .env...');
    } else {
      console.log('📝 Banco de configurações vazio. Populando com dados do .env...');
    }

    // Pegar valores do ambiente (vindos do .env do Docker)
    const configs = [
      // MinIO - endpoint INTERNO (rede docker) usado pelo backend pra upload
      {
        key: 'minio_endpoint',
        value: process.env.MINIO_ENDPOINT || 'minio',
        description: 'Endpoint interno do MinIO (rede docker) usado pelo backend para upload'
      },
      {
        key: 'minio_port',
        value: process.env.MINIO_PORT || '9000',
        description: 'Porta interna da API do MinIO (padrao 9000)'
      },
      {
        key: 'minio_access_key',
        value: process.env.MINIO_ACCESS_KEY || process.env.MINIO_ROOT_USER || '',
        description: 'Access Key (usuário) do MinIO'
      },
      {
        key: 'minio_secret_key',
        value: process.env.MINIO_SECRET_KEY || process.env.MINIO_ROOT_PASSWORD || '',
        description: 'Secret Key (senha) do MinIO'
      },
      {
        key: 'minio_use_ssl',
        value: 'false',
        description: 'Usar SSL/HTTPS na rede interna do MinIO (sempre false)'
      },
      {
        key: 'minio_bucket_name',
        value: process.env.MINIO_BUCKET_NAME || 'market-security',
        description: 'Nome do bucket do MinIO'
      },
      {
        key: 'minio_public_endpoint',
        value: process.env.MINIO_PUBLIC_ENDPOINT || process.env.HOST_IP || 'localhost',
        description: 'Endpoint público do MinIO para acesso externo'
      },
      {
        key: 'minio_public_port',
        value: process.env.MINIO_PUBLIC_PORT || '9010',
        description: 'Porta pública do MinIO para acesso externo'
      },
      {
        key: 'minio_console_port',
        value: '9011',
        description: 'Porta do console web do MinIO'
      },

      // PostgreSQL
      {
        key: 'postgres_host',
        value: process.env.HOST_IP || 'localhost',
        description: 'Host do PostgreSQL'
      },
      {
        key: 'postgres_port',
        value: '5434', // Porta externa do Docker
        description: 'Porta externa do PostgreSQL'
      },
      {
        key: 'postgres_user',
        value: process.env.DB_USER || 'postgres',
        description: 'Usuário do PostgreSQL'
      },
      {
        key: 'postgres_password',
        value: process.env.POSTGRES_PASSWORD || process.env.DB_PASSWORD || '',
        description: 'Senha do PostgreSQL'
      },
      {
        key: 'postgres_database',
        value: process.env.DB_NAME || 'prevencao_db',
        description: 'Nome do banco de dados PostgreSQL'
      },

      // Sistema
      {
        key: 'host_ip',
        value: process.env.HOST_IP || 'localhost',
        description: 'IP da máquina host'
      },
      {
        key: 'api_token',
        value: process.env.API_TOKEN || '',
        description: 'Token de autenticação da API para scanners'
      },

      // Tailscale
      {
        key: 'tailscale_vps_ip',
        value: process.env.TAILSCALE_VPS_IP || process.env.TAILSCALE_IP || '',
        description: 'IP da VPS na rede Tailscale'
      },
      {
        key: 'tailscale_client_ip',
        value: process.env.TAILSCALE_CLIENT_IP || '',
        description: 'IP Tailscale da máquina do cliente (onde roda o ERP)'
      },

      // APIs - Configurar por cliente
      // Intersolid ERP
      {
        key: 'intersolid_api_url',
        value: '',
        description: 'URL da API Intersolid'
      },
      {
        key: 'intersolid_port',
        value: '3003',
        description: 'Porta da API Intersolid'
      },
      {
        key: 'intersolid_username',
        value: '',
        description: 'Usuário da API Intersolid'
      },
      {
        key: 'intersolid_password',
        value: '',
        description: 'Senha da API Intersolid'
      },
      {
        key: 'intersolid_products_endpoint',
        value: '/v1/produtos',
        description: 'Endpoint de produtos Intersolid'
      },
      {
        key: 'intersolid_sales_endpoint',
        value: '/v1/vendas',
        description: 'Endpoint de vendas Intersolid'
      },

      // Evolution API (WhatsApp) - pré-configurado
      {
        key: 'evolution_api_url',
        value: 'http://31.97.82.235:8090',
        description: 'URL da Evolution API (WhatsApp)'
      },
      {
        key: 'bip_price_tolerance',
        value: '0.03',
        description: 'Tolerância de preço (R$) para cruzamento de bipagens com vendas'
      },
      {
        key: 'evolution_api_token',
        value: 'F0A82E6394D6-4D5A-845A-FC0413873588',
        description: 'Token de autenticação Evolution API'
      },
      {
        key: 'evolution_instance',
        value: 'DVR FACIAL',
        description: 'Nome da instância Evolution API'
      },
      {
        key: 'evolution_whatsapp_group_id',
        value: '',
        description: 'ID do grupo WhatsApp para notificações (configurar por cliente)'
      },

      // Email - Recuperação de Senha (pré-configurado com a conta padrao kontrata.ai)
      {
        key: 'email_user',
        value: 'kontrataai@gmail.com',
        description: 'Email para envio (Gmail)'
      },
      {
        key: 'email_pass',
        value: 'rkllauajeaouhcda',
        description: 'Senha de app do Gmail'
      },

      // Monitor de Email DVR
      {
        key: 'dvr_ip',
        value: '',
        description: 'IP do DVR na rede local'
      },
      {
        key: 'dvr_usuario',
        value: 'admin',
        description: 'Usuário do DVR'
      },
      {
        key: 'dvr_senha',
        value: '',
        description: 'Senha do DVR'
      },
      {
        key: 'dvr_email_senha',
        value: '',
        description: 'Senha do email do DVR'
      },
      {
        key: 'dvr_monitor_intervalo',
        value: '360',
        description: 'Intervalo do monitor em segundos (padrão: 360s = 6min)'
      },
      {
        key: 'dvr_monitor_auto_start',
        value: 'false',
        description: 'Auto-iniciar monitor de email'
      },
      {
        key: 'dvr_porta_http',
        value: '80',
        description: 'Porta HTTP do DVR para API RPC2 (padrão: 80, usar porta tunelada na VPS)'
      },
      {
        key: 'dvr_porta_rtsp',
        value: '554',
        description: 'Porta RTSP do DVR (padrão: 554, usar porta tunelada na VPS)'
      },
      {
        key: 'dvr_canais',
        value: '[]',
        description: 'Mapeamento de canais DVR para PDV (JSON: [{channel, pdv, label}])'
      },
      {
        key: 'dvr_canal_padrao',
        value: '3',
        description: 'Canal DVR padrão selecionado ao abrir Vision PDV'
      },
      {
        key: 'dvr_antecedencia_segundos',
        value: '15',
        description: 'Segundos antes do evento POS para iniciar o vídeo (ajustar conforme relógio do DVR)'
      },
      {
        key: 'dvr_tempo_depois_segundos',
        value: '120',
        description: 'Segundos depois do evento para encerrar o vídeo (duração após o momento da bipagem/transação)'
      },
      {
        key: 'dvr_cameras_bipagens',
        value: '[]',
        description: 'Câmeras DVR que cobrem a área de bipagens/açougue (JSON: [{channel, label}])'
      },
      {
        key: 'dvr_cameras_risco',
        value: '[]',
        description: 'Câmeras DVR para Prevenção Operações de Risco PDV (JSON: [{channel, label, pdv, antes, depois}])'
      },
      {
        key: 'dvr_cameras_pdv',
        value: '[]',
        description: 'Câmeras DVR para Vision Palavra Chave 2 (JSON: [{channel, label, pdv, antes, depois}])'
      },

      // Monitor de Email (Novo sistema)
      {
        key: 'email_monitor_email',
        value: 'prevencaonoradar@gmail.com',
        description: 'Email Gmail para monitorar'
      },
      {
        key: 'email_monitor_app_password',
        value: 'hhyvmqlzzsidwrum',
        description: 'Senha de app do Gmail para IMAP (Monitor DVR)'
      },
      {
        key: 'email_monitor_subject_filter',
        value: '',
        description: 'Filtro de assunto dos emails (ex: ALERTA TRADICAO, ALERTA NUNES) - configurar por cliente'
      },
      {
        key: 'email_monitor_check_interval',
        value: '30',
        description: 'Intervalo de verificação em segundos'
      },
      {
        key: 'email_monitor_whatsapp_group',
        value: '',
        description: 'ID do grupo WhatsApp para notificações do Monitor'
      },
      {
        key: 'email_monitor_whatsapp_group_name',
        value: '',
        description: 'Nome do grupo WhatsApp para notificações do Monitor DVR'
      },
      {
        key: 'email_monitor_enabled',
        value: 'false',
        description: 'Monitor habilitado (true/false) - deixar false ate configurar filtro especifico do cliente'
      },

      // WhatsApp - Grupos por Módulo
      {
        key: 'whatsapp_group_bipagens',
        value: '',
        description: 'ID do grupo WhatsApp para relatórios de Prevenção de Bipagens'
      },
      {
        key: 'whatsapp_group_bipagens_name',
        value: '',
        description: 'Nome do grupo WhatsApp para relatórios de Prevenção de Bipagens'
      },
      {
        key: 'whatsapp_group_etiquetas',
        value: '',
        description: 'ID do grupo WhatsApp para relatórios de Prevenção de Etiquetas'
      },
      {
        key: 'whatsapp_group_etiquetas_name',
        value: '',
        description: 'Nome do grupo WhatsApp para relatórios de Prevenção de Etiquetas'
      },
      {
        key: 'whatsapp_group_rupturas',
        value: '',
        description: 'ID do grupo WhatsApp para relatórios de Prevenção de Rupturas'
      },
      {
        key: 'whatsapp_group_rupturas_name',
        value: '',
        description: 'Nome do grupo WhatsApp para relatórios de Prevenção de Rupturas'
      },
      {
        key: 'whatsapp_group_quebras',
        value: '',
        description: 'ID do grupo WhatsApp para relatórios de Prevenção de Quebras'
      },
      {
        key: 'whatsapp_group_quebras_name',
        value: '',
        description: 'Nome do grupo WhatsApp para relatórios de Prevenção de Quebras'
      },
      {
        key: 'whatsapp_group_producao',
        value: '',
        description: 'ID do grupo WhatsApp para relatórios de Prevenção de Produção'
      },
      {
        key: 'whatsapp_group_producao_name',
        value: '',
        description: 'Nome do grupo WhatsApp para relatórios de Prevenção de Produção'
      },
      {
        key: 'whatsapp_bips_schedule_time',
        value: '09:00',
        description: 'Horário de envio automático do relatório de bipagens pendentes (formato HH:MM)'
      },
      {
        key: 'whatsapp_losses_schedule_time',
        value: '07:00',
        description: 'Horário de envio automático do relatório de quebras/ajustes (formato HH:MM)'
      },
      {
        key: 'whatsapp_group_abastecimento',
        value: '',
        description: 'ID do grupo WhatsApp para relatórios de Prioridade de Abastecimento'
      },
      {
        key: 'whatsapp_group_abastecimento_name',
        value: '',
        description: 'Nome do grupo WhatsApp para relatórios de Prioridade de Abastecimento'
      },
      {
        key: 'whatsapp_abastecimento_schedule_time',
        value: '08:00',
        description: 'Horário de envio automático do relatório de prioridade de abastecimento (formato HH:MM)'
      },

      // Inteligência Artificial
      {
        key: 'openai_api_key',
        value: process.env.OPENAI_API_KEY || '',
        description: 'Chave de API do OpenAI (ChatGPT)'
      },

      // Santander - API Bancária
      {
        key: 'santander_client_id',
        value: process.env.SANTANDER_CLIENT_ID || '',
        description: 'Client ID da aplicação Santander Open API'
      },
      {
        key: 'santander_client_secret',
        value: process.env.SANTANDER_CLIENT_SECRET || '',
        description: 'Client Secret da aplicação Santander Open API'
      },
      {
        key: 'santander_pfx_password',
        value: process.env.SANTANDER_PFX_PASSWORD || '',
        description: 'Senha do certificado PFX do Santander (mTLS)'
      },
      {
        key: 'santander_branch_code',
        value: process.env.SANTANDER_BRANCH_CODE || '',
        description: 'Código da agência Santander (4 dígitos)'
      },
      {
        key: 'santander_account_number',
        value: process.env.SANTANDER_ACCOUNT_NUMBER || '',
        description: 'Número da conta Santander (12 dígitos, com dígito)'
      },
      {
        key: 'santander_environment',
        value: process.env.SANTANDER_ENVIRONMENT || 'production',
        description: 'Ambiente Santander: production ou sandbox'
      },

      // Banco 24horas - API TecBan (Portal EC)
      {
        key: 'banco24h_user_id',
        value: process.env.BANCO24H_USER_ID || '',
        description: 'UUID do usuário API no Portal EC Banco 24horas'
      },
      {
        key: 'banco24h_cnpj_raiz',
        value: process.env.BANCO24H_CNPJ_RAIZ || '',
        description: 'CNPJ Raiz (8 dígitos) cadastrado no Banco 24horas'
      },
      {
        key: 'banco24h_loja_code',
        value: process.env.BANCO24H_LOJA_CODE || '',
        description: 'Código da loja no Banco 24horas'
      },
      {
        key: 'banco24h_environment',
        value: process.env.BANCO24H_ENVIRONMENT || 'production',
        description: 'Ambiente Banco 24horas: production ou sandbox'
      }
    ];

    // Inserir APENAS configurações que não existem (não sobrescreve valores salvos)
    for (const config of configs) {
      // Buscar configuração existente
      let configuration = await configRepository.findOne({ where: { key: config.key } });

      if (configuration) {
        // JÁ EXISTE - não sobrescrever
        console.log(`   ⏭️  ${config.key}: já existe, mantido`);
      } else {
        // NÃO EXISTE - criar nova
        configuration = configRepository.create({
          key: config.key,
          value: config.value
        });
        await configRepository.save(configuration);
        console.log(`   ✅ ${config.key}: ${config.value ? '***' : '(vazio)'}`);
      }
    }

    console.log('✅ Seed de configurações concluído com sucesso!');
    console.log(`   Total: ${configs.length} configurações criadas`);

  } catch (error) {
    console.error('❌ Erro ao executar seed de configurações:', error);
    throw error;
  }
}

// Executar seed se for chamado diretamente
if (require.main === module) {
  seedConfigurations()
    .then(() => {
      console.log('✅ Seed finalizado');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Erro no seed:', error);
      process.exit(1);
    });
}

export default seedConfigurations;
