import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { Configuration } from '../entities/Configuration';
import { ConfigurationService } from '../services/configuration.service';
import { emailService } from '../services/email.service';
import * as fs from 'fs';
import * as path from 'path';

const configRepository = AppDataSource.getRepository(Configuration);

export class ConfigurationsController {
  /**
   * GET /api/configurations
   * Buscar todas as configurações
   */
  async index(req: Request, res: Response) {
    try {
      const configurations = await configRepository.find();

      // Converter para objeto chave-valor para facilitar uso no frontend
      const configMap: Record<string, string | null> = {};
      configurations.forEach(config => {
        configMap[config.key] = config.value;
      });

      return res.json(configMap);
    } catch (error) {
      console.error('Error fetching configurations:', error);
      return res.status(500).json({ error: 'Failed to fetch configurations' });
    }
  }

  /**
   * GET /api/configurations/:key
   * Buscar configuração específica por chave
   */
  async show(req: Request, res: Response) {
    try {
      const { key } = req.params;

      const configuration = await configRepository.findOne({
        where: { key }
      });

      if (!configuration) {
        return res.status(404).json({ error: 'Configuration not found' });
      }

      return res.json(configuration);
    } catch (error) {
      console.error('Error fetching configuration:', error);
      return res.status(500).json({ error: 'Failed to fetch configuration' });
    }
  }

  /**
   * PUT /api/configurations/:key
   * Atualizar configuração específica
   */
  async update(req: Request, res: Response) {
    try {
      const { key } = req.params;
      const { value } = req.body;

      if (!value) {
        return res.status(400).json({ error: 'Value is required' });
      }

      let configuration = await configRepository.findOne({
        where: { key }
      });

      if (!configuration) {
        // Criar se não existir
        configuration = configRepository.create({ key, value });
      } else {
        configuration.value = value;
      }

      await configRepository.save(configuration);

      return res.json(configuration);
    } catch (error) {
      console.error('Error updating configuration:', error);
      return res.status(500).json({ error: 'Failed to update configuration' });
    }
  }

  /**
   * GET /api/configurations/email
   * Buscar configurações de email (do banco de dados)
   */
  async getEmailConfig(req: Request, res: Response) {
    try {
      const emailUser = await ConfigurationService.get('email_user', process.env.EMAIL_USER || '');
      const emailPass = await ConfigurationService.get('email_pass', process.env.EMAIL_PASS || '');

      return res.json({
        email_user: emailUser,
        email_pass: emailPass
      });
    } catch (error) {
      console.error('Error fetching email configuration:', error);
      return res.status(500).json({ error: 'Failed to fetch email configuration' });
    }
  }

  /**
   * POST /api/configurations/email/test
   * Testar conexão SMTP com as credenciais fornecidas
   */
  async testEmailConnection(req: Request, res: Response) {
    try {
      const { email_user, email_pass } = req.body;

      if (!email_user || !email_pass) {
        return res.status(400).json({ error: 'Email e senha são obrigatórios' });
      }

      // Usar nodemailer para testar conexão
      const nodemailer = require('nodemailer');

      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: email_user,
          pass: email_pass
        }
      });

      // Tentar verificar conexão
      await transporter.verify();

      console.log(`✅ Teste de conexão SMTP bem sucedido para: ${email_user}`);

      return res.json({
        success: true,
        message: 'Conexão SMTP válida! Credenciais corretas.'
      });
    } catch (error: any) {
      console.error('❌ Erro no teste de conexão SMTP:', error.message);

      return res.status(400).json({
        success: false,
        error: 'Credenciais inválidas. Verifique o email e senha de app.',
        details: error.message
      });
    }
  }

  /**
   * Atualizar arquivo .env com novas credenciais
   */
  private async updateEnvFile(email_user: string, email_pass: string): Promise<void> {
    try {
      // Caminho para o .env (no Docker, pode estar em /app/.env ou no volume montado)
      const envPath = path.resolve(process.cwd(), '../../../.env');

      // Verificar se arquivo existe
      if (!fs.existsSync(envPath)) {
        console.warn(`⚠️ Arquivo .env não encontrado em: ${envPath}`);
        return;
      }

      // Ler conteúdo atual
      let envContent = fs.readFileSync(envPath, 'utf-8');

      // Atualizar ou adicionar EMAIL_USER
      if (envContent.includes('EMAIL_USER=')) {
        envContent = envContent.replace(/EMAIL_USER=.*/g, `EMAIL_USER=${email_user}`);
      } else {
        envContent += `\nEMAIL_USER=${email_user}`;
      }

      // Atualizar ou adicionar EMAIL_PASS
      if (envContent.includes('EMAIL_PASS=')) {
        envContent = envContent.replace(/EMAIL_PASS=.*/g, `EMAIL_PASS=${email_pass}`);
      } else {
        envContent += `\nEMAIL_PASS=${email_pass}`;
      }

      // Salvar arquivo
      fs.writeFileSync(envPath, envContent, 'utf-8');
      console.log('✅ Arquivo .env atualizado com sucesso');
    } catch (error) {
      console.error('❌ Erro ao atualizar arquivo .env:', error);
      // Não falhar a requisição se não conseguir atualizar o .env
    }
  }

  /**
   * PUT /api/configurations/email
   * Atualizar configurações de email (salva no banco de dados E no .env)
   */
  async updateEmailConfig(req: Request, res: Response) {
    try {
      const { email_user, email_pass } = req.body;

      if (!email_user || !email_pass) {
        return res.status(400).json({ error: 'Email e senha são obrigatórios' });
      }

      // Salvar no banco de dados
      await ConfigurationService.set('email_user', email_user);
      await ConfigurationService.set('email_pass', email_pass);

      // Atualizar variáveis de ambiente em memória
      process.env.EMAIL_USER = email_user;
      process.env.EMAIL_PASS = email_pass;

      // Tentar atualizar arquivo .env (mas não falhar se não conseguir)
      await this.updateEnvFile(email_user, email_pass);

      console.log(`✅ Configurações de email atualizadas: ${email_user}`);

      // Reinicializa o emailService com as novas credenciais (sem precisar reiniciar backend)
      try {
        await emailService.reinitialize();
      } catch (err: any) {
        console.warn('[configurations] erro ao reinicializar emailService:', err?.message);
      }

      return res.json({
        message: 'Configurações de email atualizadas com sucesso',
        email_user,
        email_pass: '***' // Não retornar a senha real
      });
    } catch (error) {
      console.error('Error updating email configuration:', error);
      return res.status(500).json({ error: 'Failed to update email configuration' });
    }
  }
}
