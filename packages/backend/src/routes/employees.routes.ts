import { Router } from 'express';
import multer from 'multer';
import { EmployeesController } from '../controllers/employees.controller';
import { authenticateToken, isAdmin } from '../middleware/auth';

const router: Router = Router();

// Configure multer for memory storage (files stored in buffer)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (_req, file, cb) => {
    const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, and WebP are allowed'));
    }
  },
});

// Profile routes (for logged-in employee) - must come BEFORE /:id routes
router.get('/me/profile', authenticateToken, EmployeesController.getProfile);
router.patch('/me/profile', authenticateToken, EmployeesController.updateProfile);
router.patch('/me/avatar', authenticateToken, upload.single('avatar'), EmployeesController.updateProfileAvatar);
router.patch('/me/password', authenticateToken, EmployeesController.changePassword);

// Setup via link (publico - sem auth)
router.get('/setup/:token', EmployeesController.getBySetupToken);
router.post('/setup/:token', EmployeesController.completeSetup);

// Gerar link de cadastro (admin)
router.post('/generate-link', authenticateToken, isAdmin, EmployeesController.generateLink);

// List employees - available for all authenticated users (for filters)
router.get('/', authenticateToken, EmployeesController.getAll);

// Admin-only routes require authentication and admin access
router.get('/:id', authenticateToken, isAdmin, EmployeesController.getById);
router.post('/', authenticateToken, isAdmin, EmployeesController.create);
router.put('/:id', authenticateToken, isAdmin, EmployeesController.update);
router.patch('/:id/avatar', authenticateToken, isAdmin, upload.single('avatar'), EmployeesController.uploadAvatar);
router.patch('/:id/toggle', authenticateToken, isAdmin, EmployeesController.toggleStatus);
router.post('/:id/reset-password', authenticateToken, isAdmin, EmployeesController.resetPassword);
router.delete('/:id', authenticateToken, isAdmin, EmployeesController.delete);

// Permissions routes - Admin only
router.get('/:id/permissions', authenticateToken, isAdmin, EmployeesController.getPermissions);
router.put('/:id/permissions', authenticateToken, isAdmin, EmployeesController.updatePermissions);

export default router;
