import { Router } from 'express';
import { WhatsappController } from '../controllers/whatsapp.controller';
import { authenticateToken } from '../middleware/auth';

const router: Router = Router();

// GET /api/whatsapp/connection-status — testa conexao com a Evolution API
router.get('/connection-status', authenticateToken, WhatsappController.connectionStatus);

// GET /api/whatsapp/fetch-groups — lista os grupos da instancia
router.get('/fetch-groups', authenticateToken, WhatsappController.fetchGroups);

// POST /api/whatsapp/test-group — envia mensagem de teste
router.post('/test-group', authenticateToken, WhatsappController.testGroup);

// Vagas em Aberto (envio semanal pro grupo)
router.post('/vagas-abertas/enviar', authenticateToken, WhatsappController.enviarVagasAbertas);
router.get('/vagas-abertas/preview', authenticateToken, WhatsappController.previewVagasAbertas);

export default router;
