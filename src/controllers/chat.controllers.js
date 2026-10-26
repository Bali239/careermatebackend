import Chat from "../models/chat.model.js";
import CV from "../models/cv.model.js";
import mongoose from "mongoose";
import { httpError } from "../utils/http-error.js";
import { chatCreateSchema, chatEditSchema, chatMessageSchema } from "../schemas/chat.schema.js";
import { analyzeCVForJobDescription } from "../services/chat-analysis.service.js";
import { extractDocumentText } from "../utils/cv-document-text.js";

const serializeChat = (chat) => ({
  id: String(chat._id),
  title: chat.title,
  cvId: String(chat.cvId),
  jobDescription: chat.jobDescription,
  analysis: chat.analysis ?? null,
  draftHtml: chat.draftHtml ?? "",
  isEditing: Boolean(chat.isEditing),
  status: chat.status ?? "idle",
  error: chat.error ?? "",
  messages: (chat.messages ?? []).map((message) => ({ id: String(message._id ?? `${chat._id}-${message.createdAt}`), role: message.role, text: message.text, createdAt: message.createdAt })),
  createdAt: chat.createdAt,
  updatedAt: chat.updatedAt,
});

export const listChats = async (req, res) => {
  const chats = await Chat.find({ userId: req.authUser._id }).sort({ updatedAt: -1 }).limit(20).lean();
  res.json({ status: "ok", data: chats.map(serializeChat) });
};

export const getChat = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw httpError(404, "Conversation not found");
  const chat = await Chat.findOne({ _id: req.params.id, userId: req.authUser._id }).lean();
  if (!chat) throw httpError(404, "Conversation not found");
  res.json({ status: "ok", data: serializeChat(chat) });
};

export const createChat = async (req, res) => {
  const parsed = chatCreateSchema.safeParse(req.body);
  if (!parsed.success) throw httpError(400, parsed.error.issues[0]?.message ?? "Invalid chat request");

  const { cvId, jobDescription, title } = parsed.data;
  if (!mongoose.isValidObjectId(cvId)) throw httpError(404, "CV not found");

  const cv = await CV.findOne({ _id: cvId, userId: req.authUser._id });
  if (!cv) throw httpError(404, "CV not found");

  const text = await extractDocumentText(cv);
  const analysis = await analyzeCVForJobDescription(cv, jobDescription, text ?? "");

  const conversation = await Chat.create({
    userId: req.authUser._id,
    cvId: cv._id,
    title: title?.trim() || `${cv.name} · ${jobDescription.trim().slice(0, 50)}`,
    jobDescription: jobDescription.trim(),
    analysis,
    draftHtml: analysis.editableHtml,
    status: "done",
    messages: [
      { role: "user", text: jobDescription.trim() },
      { role: "assistant", text: analysis.summary },
    ],
  });

  res.status(201).json({ status: "ok", data: serializeChat(conversation.toObject()) });
};

export const sendMessage = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw httpError(404, "Conversation not found");
  const parsed = chatMessageSchema.safeParse(req.body);
  if (!parsed.success) throw httpError(400, parsed.error.issues[0]?.message ?? "Invalid chat message");

  const conversation = await Chat.findOne({ _id: req.params.id, userId: req.authUser._id });
  if (!conversation) throw httpError(404, "Conversation not found");
  if (conversation.isEditing) throw httpError(409, "Finish or exit edit mode before sending a message.");

  conversation.messages.push({ role: "user", text: parsed.data.message });
  conversation.messages.push({
    role: "assistant",
    text: `I reviewed your note. Keep the focus on the job requirements and refine the wording for ATS readability.`,
  });
  conversation.updatedAt = new Date();
  await conversation.save();

  res.json({ status: "ok", data: serializeChat(conversation.toObject()) });
};

export const editDraft = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw httpError(404, "Conversation not found");
  const parsed = chatEditSchema.safeParse(req.body);
  if (!parsed.success) throw httpError(400, parsed.error.issues[0]?.message ?? "Invalid draft data");

  const conversation = await Chat.findOne({ _id: req.params.id, userId: req.authUser._id });
  if (!conversation) throw httpError(404, "Conversation not found");

  conversation.draftHtml = parsed.data.draftHtml ?? conversation.draftHtml ?? "";
  conversation.isEditing = typeof parsed.data.isEditing === "boolean" ? parsed.data.isEditing : conversation.isEditing;
  await conversation.save();

  res.json({ status: "ok", data: serializeChat(conversation.toObject()) });
};

export const exitEditMode = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw httpError(404, "Conversation not found");

  const conversation = await Chat.findOne({ _id: req.params.id, userId: req.authUser._id });
  if (!conversation) throw httpError(404, "Conversation not found");

  conversation.isEditing = false;
  await conversation.save();

  res.json({ status: "ok", data: serializeChat(conversation.toObject()) });
};

export const deleteChat = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw httpError(404, "Conversation not found");
  const deleted = await Chat.findOneAndDelete({ _id: req.params.id, userId: req.authUser._id });
  if (!deleted) throw httpError(404, "Conversation not found");
  res.json({ status: "ok", data: { id: String(deleted._id) } });
};

export const updateChatTitle = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw httpError(404, "Conversation not found");
  const conversation = await Chat.findOne({ _id: req.params.id, userId: req.authUser._id });
  if (!conversation) throw httpError(404, "Conversation not found");
  if (typeof req.body?.title === "string" && req.body.title.trim()) {
    conversation.title = req.body.title.trim();
  }
  conversation.updatedAt = new Date();
  await conversation.save();
  res.json({ status: "ok", data: serializeChat(conversation.toObject()) });
};
