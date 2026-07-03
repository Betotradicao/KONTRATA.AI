import { Request, Response } from 'express';
import { Client } from 'pg';
import { ConfigurationService } from '../services/configuration.service';

export class ConfigController {
  async testDatabaseConnection(req: Request, res: Response) {
    const { host, port, username, password, databaseName } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Usuário e senha são obrigatórios'
      });
    }

    // Usar credenciais internas do Docker para teste (backend está dentro da rede Docker)
    const client = new Client({
      host: process.env.DB_HOST || 'postgres',
      port: parseInt(process.env.DB_PORT || '5432'),
      user: username,
      password,
      database: databaseName || process.env.DB_NAME || 'postgres'
    });

    try {
      await client.connect();

      // Testa uma query simples
      const result = await client.query('SELECT version()');

      await client.end();

      return res.json({
        success: true,
        message: 'Conexão estabelecida com sucesso!',
        version: result.rows[0].version,
        connection: {
          host,
          port: parseInt(port) || 5432,
          database: databaseName || 'postgres'
        }
      });
    } catch (error: any) {
      try {
        await client.end();
      } catch (e) {
        // Ignore error closing connection
      }

      return res.status(500).json({
        success: false,
        message: `Erro ao conectar: ${error.message}`,
        error: error.code || 'UNKNOWN_ERROR'
      });
    }
  }

  async testMinioConnection(req: Request, res: Response) {
    const { endpoint, port, accessKey, secretKey, useSSL } = req.body;

    if (!accessKey || !secretKey) {
      return res.status(400).json({
        success: false,
        message: 'Access Key e Secret Key são obrigatórios'
      });
    }

    try {
      // Importa o MinIO dinamicamente
      const Minio = require('minio');

      // Usar credenciais internas do Docker para teste (backend está dentro da rede Docker)
      // Sempre usar as credenciais do environment (MINIO_ROOT_USER/PASSWORD) para garantir que funcione
      const minioClient = new Minio.Client({
        endPoint: process.env.MINIO_ENDPOINT || 'minio',
        port: parseInt(process.env.MINIO_PORT || '9000'),
        useSSL: (process.env.MINIO_USE_SSL || 'false') === 'true',
        accessKey: process.env.MINIO_ROOT_USER || process.env.MINIO_ACCESS_KEY || accessKey,
        secretKey: process.env.MINIO_ROOT_PASSWORD || process.env.MINIO_SECRET_KEY || secretKey
      });

      // Testa listando os buckets
      const buckets = await minioClient.listBuckets();

      return res.json({
        success: true,
        message: 'Conexão com MinIO estabelecida com sucesso!',
        buckets: buckets.map((b: any) => ({
          name: b.name,
          creationDate: b.creationDate
        })),
        connection: {
          endpoint,
          port: parseInt(port) || 9000,
          useSSL: useSSL || false
        }
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: `Erro ao conectar ao MinIO: ${error.message}`,
        error: error.code || 'UNKNOWN_ERROR'
      });
    }
  }

  /**
   * @deprecated API Intersolid foi descontinuada. O sistema agora usa Oracle diretamente.
   */
  async testIntersolidConnection(req: Request, res: Response) {
    return res.status(400).json({
      success: false,
      message: 'API Intersolid foi descontinuada. O sistema agora utiliza conexão direta com Oracle Intersolid.',
      deprecated: true
    });
  }

  async saveConfigurations(req: Request, res: Response) {
    try {
      const configurations = req.body;

      if (!configurations || typeof configurations !== 'object') {
        return res.status(400).json({
          success: false,
          message: 'Configurações inválidas'
        });
      }

      // Define quais campos devem ser criptografados
      const encryptedFields = [
        'intersolid_password',
        'evolution_api_token',
        'database_password',
        'minio_access_key',
        'minio_secret_key',
        'openai_api_key',
        'disparo_whats_token',
        'rhid_senha'
      ];

      const configsToSave: Record<string, { value: string; encrypted?: boolean }> = {};

      for (const [key, value] of Object.entries(configurations)) {
        if (value !== null && value !== undefined && value !== '') {
          configsToSave[key] = {
            value: String(value),
            encrypted: encryptedFields.includes(key)
          };
        }
      }

      await ConfigurationService.setMany(configsToSave);

      // Se salvou configurações do MinIO, reinicializar o cliente
      const minioConfigKeys = ['minio_endpoint', 'minio_port', 'minio_access_key', 'minio_secret_key', 'minio_use_ssl', 'minio_bucket_name'];
      const hasMinioConfig = Object.keys(configsToSave).some(key => minioConfigKeys.includes(key));

      if (hasMinioConfig) {
        try {
          // Importar dinamicamente para evitar dependência circular
          const { minioService } = await import('../services/minio.service');
          await minioService.reinitialize();
          console.log('✅ MinIO client reinitialized after configuration update');
        } catch (error) {
          console.error('⚠️ Failed to reinitialize MinIO client:', error);
          // Não falha o save, apenas loga o erro
        }
      }

      return res.json({
        success: true,
        message: 'Configurações salvas com sucesso!'
      });
    } catch (error: any) {
      console.error('Erro ao salvar configurações:', error);
      return res.status(500).json({
        success: false,
        message: `Erro ao salvar configurações: ${error.message}`
      });
    }
  }

  async testOpenAIConnection(req: Request, res: Response) {
    const { apiKey } = req.body;

    if (!apiKey || !apiKey.startsWith('sk-')) {
      return res.status(400).json({
        success: false,
        message: 'Chave de API inválida. Deve começar com "sk-"'
      });
    }

    try {
      // Faz uma chamada simples para listar modelos (barata e rápida)
      const response = await fetch('https://api.openai.com/v1/models', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`
        }
      });

      if (response.ok) {
        const data: any = await response.json();
        const modelCount = data.data?.length || 0;
        return res.json({
          success: true,
          message: `Conexão com OpenAI estabelecida com sucesso! ${modelCount} modelos disponíveis.`
        });
      } else {
        const errorData = await response.json().catch(() => ({}));
        const errorMsg = (errorData as any)?.error?.message || `HTTP ${response.status}`;
        return res.json({
          success: false,
          message: `Erro na API OpenAI: ${errorMsg}`
        });
      }
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: `Erro ao conectar com OpenAI: ${error.message}`
      });
    }
  }

  async getConfigurations(req: Request, res: Response) {
    try {
      const configs = await ConfigurationService.getAll();

      return res.json({
        success: true,
        data: configs
      });
    } catch (error: any) {
      console.error('Erro ao buscar configurações:', error);
      return res.status(500).json({
        success: false,
        message: `Erro ao buscar configurações: ${error.message}`
      });
    }
  }
}
