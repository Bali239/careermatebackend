import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import {
  listChats,
  getChat,
  createChat,
  analyzeChat,
  rewriteChatCv,
  downloadGeneratedCv,
  sendMessage,
  editDraft,
  exitEditMode,
  deleteChat,
  updateChatTitle,
} from '../controllers/chat.controllers.js';

const router = Router();
router.use(requireAuth);

router.get('/', listChats);
router.get('/:id', getChat);
router.post('/', createChat);
router.post('/:id/analyze', analyzeChat);
router.post('/:id/rewrite', rewriteChatCv);
router.get('/:id/generated/:versionId/:format', downloadGeneratedCv);
router.post('/:id/messages', sendMessage);
router.post('/:id/edit', editDraft);
router.post('/:id/exit-edit', exitEditMode);
router.delete('/:id', deleteChat);
router.patch('/:id', updateChatTitle);

export default router;
