import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { DenunciasController } from '../controllers/denuncias.controller';
import { authenticateToken } from '../middleware/auth';

const router: Router = Router();

// Rate limit pra evitar spam de denuncias - max 5 por IP a cada 10 min
const publicaLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 5,
  message: { error: 'Muitas denuncias enviadas. Aguarde alguns minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rotas PUBLICAS (sem token)
router.post('/publica', publicaLimiter, DenunciasController.criarPublica);
router.get('/publica/empresa/:empresaId', DenunciasController.infoEmpresa);
router.get('/publica/consulta/:protocolo', DenunciasController.consultarProtocolo);

// Rotas ADMIN (com token)
router.get('/', authenticateToken, DenunciasController.listar);
router.get('/stats', authenticateToken, DenunciasController.stats);
router.get('/:id', authenticateToken, DenunciasController.detalhe);
router.patch('/:id', authenticateToken, DenunciasController.atualizar);

export default router;
