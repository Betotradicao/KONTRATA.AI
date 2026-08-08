import { Router } from 'express';
import multer from 'multer';
import { CurriculosController } from '../controllers/curriculos.controller';
import { authenticateToken } from '../middleware/auth';
import { lgpdDemoMask, lgpdDemoReadOnly } from '../middleware/lgpd-demo.middleware';

const router: Router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// ============ PUBLICO (sem auth) ============
// Formulario carregado pelo candidato + envio do curriculo
router.get('/publico/formulario', CurriculosController.obterFormularioPublico);
router.get('/publico/vagas', CurriculosController.listarVagasPublicasPorLoja);
router.post('/publico/upload-foto', upload.single('foto'), CurriculosController.uploadFotoPublico);

// Arquivo do curriculo do proprio candidato — anexado na tela de sucesso, apos o envio.
// Teto de 8MB: cabe folgado um curriculo de 4 paginas em PDF/Word, um PDF escaneado ou
// uma foto de celular (12MP ~ 4MB), mas barra video/zip/arquivo aleatorio pesado.
// Multer estoura LIMIT_FILE_SIZE ANTES do controller, entao o erro e tratado aqui —
// senao o candidato receberia um 500 seco sem saber que o problema foi o tamanho.
const uploadCurriculoArquivo = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });
router.post('/publico/upload-pdf', (req, res, next) => {
  uploadCurriculoArquivo.single('arquivo')(req, res, (err: any) => {
    if (err?.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ success: false, error: 'Arquivo muito grande. O limite é 8 MB.' });
    }
    if (err) return res.status(400).json({ success: false, error: 'Não foi possível ler o arquivo enviado.' });
    return next();
  });
}, CurriculosController.uploadCurriculoPdfPublico);
router.post('/publico/enviar', CurriculosController.enviarCurriculoPublico);

// ============ AUTENTICADO ============
router.use(authenticateToken);

// Modo demonstracao LGPD (so master, so com header x-lgpd-demo: 1).
// Fica DEPOIS do authenticateToken porque precisa de req.user pra checar master,
// e ANTES das rotas pra conseguir envelopar o res.json delas.
// Nao alcanca as rotas /publico acima — o candidato preenchendo nao pode ser afetado.
router.use(lgpdDemoReadOnly);
router.use(lgpdDemoMask);

// Catalogo de cargos
router.get('/cargos', CurriculosController.listarCargos);
router.post('/cargos', CurriculosController.criarCargo);
router.put('/cargos/:id', CurriculosController.atualizarCargo);
router.delete('/cargos/:id', CurriculosController.deletarCargo);

// Catalogo de habilidades
router.get('/habilidades', CurriculosController.listarHabilidades);
router.post('/habilidades', CurriculosController.criarHabilidade);
router.put('/habilidades/:id', CurriculosController.atualizarHabilidade);
router.delete('/habilidades/:id', CurriculosController.deletarHabilidade);

// Catalogo de tipos de vaga (CLT, Aprendiz, etc — editavel)
router.get('/tipos-vaga', CurriculosController.listarTiposVaga);
router.post('/tipos-vaga', CurriculosController.criarTipoVaga);
router.put('/tipos-vaga/:id', CurriculosController.atualizarTipoVaga);
router.delete('/tipos-vaga/:id', CurriculosController.deletarTipoVaga);

// Banco de curriculos
router.get('/', CurriculosController.listarCurriculos);
router.get('/:id', CurriculosController.obterCurriculo);
router.put('/:id', CurriculosController.atualizarCurriculo);
router.delete('/:id', CurriculosController.deletarCurriculo);

export default router;
