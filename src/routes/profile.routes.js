import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import {
  deleteProfile,
  exportProfileDocx,
  exportProfilePdf,
  getProfile,
  updateProfile,
  listProfileChanges,
  getProfileChange,
  applyProfileChanges,
  rejectProfileChanges,
  resolveChangeItem,
  getChangeHistory,
} from '../controllers/profile.controller.js';

const router = Router();

router.use(requireAuth);

router.get('/', getProfile);
router.put('/', updateProfile);
router.delete('/', deleteProfile);
router.get('/export.docx', exportProfileDocx);
router.get('/export.pdf', exportProfilePdf);

router.get('/changes', listProfileChanges);
router.get('/changes/:id', getProfileChange);
router.post('/changes/:id/apply', applyProfileChanges);
router.post('/changes/:id/reject', rejectProfileChanges);
router.patch('/changes/:id/items/:itemId', resolveChangeItem);
router.get('/history', getChangeHistory);

export default router;
