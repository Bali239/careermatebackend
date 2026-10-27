import Chat from '../models/chat.model.js';
import CV from '../models/cv.model.js';
import mongoose from 'mongoose';
import { httpError } from '../utils/http-error.js';
import { chatCreateSchema, chatEditSchema, chatMessageSchema } from '../schemas/chat.schema.js';
import { analyzeCVForJobDescription } from '../services/chat-analysis.service.js';
import {
  buildTailoredCvContent,
  createGeneratedDocumentBuffers,
  readGeneratedCvFile,
  writeGeneratedCvToDisk,
} from '../services/cv-rewrite.service.js';
import { extractDocumentText } from '../utils/cv-document-text.js';

const serializeChat = (chat) => ({
  id: String(chat._id),
  title: chat.title,
  cvId: String(chat.cvId),
  jobDescription: chat.jobDescription,
  analysis: chat.analysis ?? null,
  analysisStatus: chat.analysisStatus ?? (chat.analysis ? 'completed' : 'pending'),
  analysisError: chat.analysisError ?? '',
  draftHtml: chat.draftHtml ?? '',
  isEditing: Boolean(chat.isEditing),
  status: chat.status ?? 'idle',
  error: chat.error ?? '',
  sourceCvName: chat.sourceCvName ?? '',
  sourceCvFileName: chat.sourceCvFileName ?? '',
  generatedCvVersions: (chat.generatedCvVersions ?? []).map((version) => ({
    id: String(version._id ?? `${chat._id}-version-${version.createdAt ?? Date.now()}`),
    status: version.status,
    filename: version.filename,
    docxFileName: version.docxFileName ?? '',
    pdfFileName: version.pdfFileName ?? '',
    docxRef: version.docxRef ?? '',
    pdfRef: version.pdfRef ?? '',
    summary: version.summary ?? '',
    createdAt: version.createdAt,
    error: version.error ?? '',
  })),
  messages: (chat.messages ?? []).map((message) => ({
    id: String(message._id ?? `${chat._id}-${message.createdAt}`),
    role: message.role,
    text: message.text,
    createdAt: message.createdAt,
  })),
  createdAt: chat.createdAt,
  updatedAt: chat.updatedAt,
});

export const listChats = async (req, res) => {
  const chats = await Chat.find({ userId: req.authUser._id })
    .sort({ updatedAt: -1 })
    .limit(20)
    .lean();
  res.json({ status: 'ok', data: chats.map(serializeChat) });
};

export const getChat = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw httpError(404, 'Conversation not found');
  const chat = await Chat.findOne({ _id: req.params.id, userId: req.authUser._id }).lean();
  if (!chat) throw httpError(404, 'Conversation not found');
  res.json({ status: 'ok', data: serializeChat(chat) });
};

export const createChat = async (req, res) => {
  const parsed = chatCreateSchema.safeParse(req.body);
  if (!parsed.success)
    throw httpError(400, parsed.error.issues[0]?.message ?? 'Invalid chat request');

  const { cvId, jobDescription, title } = parsed.data;
  if (!mongoose.isValidObjectId(cvId)) throw httpError(404, 'CV not found');

  const cv = await CV.findOne({ _id: cvId, userId: req.authUser._id });
  if (!cv) throw httpError(404, 'CV not found');

  const trimmedJobDescription = jobDescription.trim();
  const normalizedTitle = title?.trim() || `${cv.name} · ${trimmedJobDescription.slice(0, 50)}`;

  const existingChat = await Chat.findOne({
    userId: req.authUser._id,
    cvId: cv._id,
    jobDescription: trimmedJobDescription,
  })
    .sort({ createdAt: -1 })
    .lean();

  if (existingChat) {
    return res.json({ status: 'ok', data: serializeChat(existingChat) });
  }

  try {
    const text = await extractDocumentText(cv);
    const analysis = await analyzeCVForJobDescription(cv, trimmedJobDescription, text ?? '');

    const conversation = await Chat.create({
      userId: req.authUser._id,
      cvId: cv._id,
      title: normalizedTitle,
      jobDescription: trimmedJobDescription,
      analysis,
      analysisStatus: 'completed',
      analysisError: '',
      draftHtml: analysis.editableHtml,
      status: 'done',
      sourceCvName: cv.name,
      sourceCvFileName: cv.fileName,
      messages: [
        { role: 'user', text: trimmedJobDescription },
        { role: 'assistant', text: analysis.summary },
      ],
    });

    res.status(201).json({ status: 'ok', data: serializeChat(conversation.toObject()) });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'The CV could not be analyzed.';
    throw httpError(503, message || 'The CV could not be analyzed. Please try again.');
  }
};

export const analyzeChat = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw httpError(404, 'Conversation not found');

  const conversation = await Chat.findOne({ _id: req.params.id, userId: req.authUser._id });
  if (!conversation) throw httpError(404, 'Conversation not found');

  if (conversation.analysisStatus === 'completed' && conversation.analysis) {
    return res.json({ status: 'ok', data: serializeChat(conversation.toObject()) });
  }

  if (conversation.analysisStatus === 'processing') {
    return res.status(202).json({ status: 'ok', data: serializeChat(conversation.toObject()) });
  }

  const cv = await CV.findOne({ _id: conversation.cvId, userId: req.authUser._id });
  if (!cv) throw httpError(404, 'CV not found');

  conversation.analysisStatus = 'processing';
  conversation.status = 'analyzing';
  conversation.analysisError = '';
  conversation.updatedAt = new Date();
  await conversation.save();

  try {
    const text = await extractDocumentText(cv);
    const analysis = await analyzeCVForJobDescription(cv, conversation.jobDescription, text ?? '');

    conversation.analysis = analysis;
    conversation.analysisStatus = 'completed';
    conversation.analysisError = '';
    conversation.draftHtml = analysis.editableHtml;
    conversation.status = 'done';
    conversation.sourceCvName = cv.name;
    conversation.sourceCvFileName = cv.fileName;

    if (!conversation.messages.some((message) => message.role === 'assistant' && message.text === analysis.summary)) {
      conversation.messages.push({ role: 'assistant', text: analysis.summary });
    }

    await conversation.save();
    return res.json({ status: 'ok', data: serializeChat(conversation.toObject()) });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Analysis failed';
    conversation.analysisStatus = 'failed';
    conversation.analysisError = message.slice(0, 500);
    conversation.status = 'error';
    conversation.error = message.slice(0, 500);
    conversation.updatedAt = new Date();
    await conversation.save();
    throw httpError(503, message || 'The analysis could not be completed. Please try again.');
  }
};

export const rewriteChatCv = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw httpError(404, 'Conversation not found');

  const conversation = await Chat.findOne({ _id: req.params.id, userId: req.authUser._id });
  if (!conversation) throw httpError(404, 'Conversation not found');
  if (!conversation.analysis || conversation.analysisStatus !== 'completed') {
    throw httpError(400, 'Finish the initial analysis before creating a rewritten CV.');
  }

  const activeRewrite = (conversation.generatedCvVersions ?? []).find(
    (version) => version.status === 'processing'
  );
  if (activeRewrite) {
    throw httpError(409, 'A rewritten CV is already being generated.');
  }

  const cv = await CV.findOne({ _id: conversation.cvId, userId: req.authUser._id }).select('+data');
  if (!cv) throw httpError(404, 'CV not found');

  const cvText = (await extractDocumentText(cv)) ?? '';
  const content = buildTailoredCvContent({
    fullName: req.authUser.name || 'Candidate',
    chat: conversation.toObject ? conversation.toObject() : conversation,
    cvText,
  });

  const versionId = new mongoose.Types.ObjectId();
  const baseVersion = {
    _id: versionId,
    status: 'processing',
    filename: `${(conversation.title || 'tailored-cv').replace(/\s+/g, '-').toLowerCase()}.docx`,
    createdAt: new Date(),
    error: '',
  };

  conversation.generatedCvVersions ??= [];
  conversation.generatedCvVersions.push(baseVersion);
  await conversation.save();

  try {
    const buffers = await createGeneratedDocumentBuffers(content);
    const fileInfo = await writeGeneratedCvToDisk({
      userId: req.authUser._id.toString(),
      chatId: conversation._id.toString(),
      versionId: versionId.toString(),
      docxBuffer: buffers.docx,
      pdfBuffer: buffers.pdf,
    });

    const version = conversation.generatedCvVersions.id(versionId);
    if (!version) throw httpError(500, 'The generated CV record could not be updated.');

    version.status = 'completed';
    version.docxFileName = fileInfo.docxFileName;
    version.pdfFileName = fileInfo.pdfFileName;
    version.docxRef = fileInfo.docxRef;
    version.pdfRef = fileInfo.pdfRef;
    version.summary = content.professionalSummary.slice(0, 2000);
    version.filename = fileInfo.docxFileName;
    await conversation.save();

    return res.json({ status: 'ok', data: serializeChat(conversation.toObject()) });
  } catch (error) {
    const version = conversation.generatedCvVersions.id(versionId);
    if (version) {
      version.status = 'failed';
      version.error = error instanceof Error ? error.message.slice(0, 500) : 'CV rewrite failed';
      version.filename = baseVersion.filename;
      await conversation.save();
    }
    throw httpError(500, 'The CV rewrite could not be generated. Please retry.');
  }
};

export const downloadGeneratedCv = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw httpError(404, 'Conversation not found');
  if (!mongoose.isValidObjectId(req.params.versionId)) throw httpError(404, 'Generated CV not found');

  const conversation = await Chat.findOne({ _id: req.params.id, userId: req.authUser._id });
  if (!conversation) throw httpError(404, 'Conversation not found');

  const version = conversation.generatedCvVersions.id(req.params.versionId);
  if (!version) throw httpError(404, 'Generated CV not found');

  const format = req.params.format === 'pdf' ? 'pdf' : 'docx';
  const ref = format === 'pdf' ? version.pdfRef : version.docxRef;
  if (!ref) throw httpError(404, 'Generated file not available');

  const fileData = await readGeneratedCvFile(ref);
  const mimeType =
    format === 'pdf'
      ? 'application/pdf'
      : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

  res.set({
    'Content-Type': mimeType,
    'Content-Length': String(fileData.length),
    'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(format === 'pdf' ? version.pdfFileName || 'tailored-cv.pdf' : version.docxFileName || 'tailored-cv.docx')}`,
    'X-Content-Type-Options': 'nosniff',
  });
  res.send(fileData);
};

export const sendMessage = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw httpError(404, 'Conversation not found');
  const parsed = chatMessageSchema.safeParse(req.body);
  if (!parsed.success)
    throw httpError(400, parsed.error.issues[0]?.message ?? 'Invalid chat message');

  const conversation = await Chat.findOne({ _id: req.params.id, userId: req.authUser._id });
  if (!conversation) throw httpError(404, 'Conversation not found');
  if (conversation.isEditing)
    throw httpError(409, 'Finish or exit edit mode before sending a message.');

  conversation.messages.push({ role: 'user', text: parsed.data.message });
  conversation.messages.push({
    role: 'assistant',
    text: `I reviewed your note. Keep the focus on the job requirements and refine the wording for ATS readability.`,
  });
  conversation.updatedAt = new Date();
  await conversation.save();

  res.json({ status: 'ok', data: serializeChat(conversation.toObject()) });
};

export const editDraft = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw httpError(404, 'Conversation not found');
  const parsed = chatEditSchema.safeParse(req.body);
  if (!parsed.success)
    throw httpError(400, parsed.error.issues[0]?.message ?? 'Invalid draft data');

  const conversation = await Chat.findOne({ _id: req.params.id, userId: req.authUser._id });
  if (!conversation) throw httpError(404, 'Conversation not found');

  conversation.draftHtml = parsed.data.draftHtml ?? conversation.draftHtml ?? '';
  conversation.isEditing =
    typeof parsed.data.isEditing === 'boolean' ? parsed.data.isEditing : conversation.isEditing;
  await conversation.save();

  res.json({ status: 'ok', data: serializeChat(conversation.toObject()) });
};

export const exitEditMode = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw httpError(404, 'Conversation not found');

  const conversation = await Chat.findOne({ _id: req.params.id, userId: req.authUser._id });
  if (!conversation) throw httpError(404, 'Conversation not found');

  conversation.isEditing = false;
  await conversation.save();

  res.json({ status: 'ok', data: serializeChat(conversation.toObject()) });
};

export const deleteChat = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw httpError(404, 'Conversation not found');
  const deleted = await Chat.findOneAndDelete({ _id: req.params.id, userId: req.authUser._id });
  if (!deleted) throw httpError(404, 'Conversation not found');
  res.json({ status: 'ok', data: { id: String(deleted._id) } });
};

export const updateChatTitle = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw httpError(404, 'Conversation not found');
  const conversation = await Chat.findOne({ _id: req.params.id, userId: req.authUser._id });
  if (!conversation) throw httpError(404, 'Conversation not found');
  if (typeof req.body?.title === 'string' && req.body.title.trim()) {
    conversation.title = req.body.title.trim();
  }
  conversation.updatedAt = new Date();
  await conversation.save();
  res.json({ status: 'ok', data: serializeChat(conversation.toObject()) });
};
