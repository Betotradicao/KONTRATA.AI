import { Router } from 'express';
import { WhatsappController } from '../controllers/whatsapp.controller';
import { authenticateToken } from '../middleware/auth';

const router: Router = Router();

// GET /api/whatsapp/connection-status — testa conexao com a Evolution API
router.get('/connection-status', authenticateToken, WhatsappController.connectionStatus);

// GET /api/whatsapp/fetch-groups — lista os grupos da instancia
router.get('/fetch-groups', authenticateToken, WhatsappController.fetchGroups);

export default router;
