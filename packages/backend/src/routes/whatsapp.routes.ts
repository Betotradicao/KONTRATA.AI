import { Router } from 'express';
import { WhatsappController } from '../controllers/whatsapp.controller';
import { authenticateToken } from '../middleware/auth';

const router: Router = Router();

// GET /api/whatsapp/connection-status — testa conexao com a Evolution API
router.get('/connection-status', authenticateToken, WhatsappController.connectionStatus);

export default router;
