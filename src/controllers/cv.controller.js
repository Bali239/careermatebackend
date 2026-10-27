import mongoose from 'mongoose';
import CV from '../models/cv.model.js';
import { httpError } from '../utils/http-error.js';
import { extractCVProfile } from '../services/cv-extraction.service.js';
import { rebuildUserProfile } from '../services/profile-rebuild.service.js';

const allowedTypes = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

const metadata = (cv) => ({
  id: cv.id,
  name: cv.name,
  fileName: cv.fileName,
  contentType: cv.contentType,
  size: cv.size,
  extractionStatus: cv.extractionStatus,
  extractionError: cv.extractionError,
  textLength: cv.textLength,
  createdAt: cv.createdAt,
});

export const listCVs = async (req, res) => {
  const query = typeof req.query.search === 'string' ? req.query.search.trim().slice(0, 120) : '';
  const filter = { userId: req.authUser._id };
  if (query) {
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.$or = [
      { name: { $regex: escaped, $options: 'i' } },
      { fileName: { $regex: escaped, $options: 'i' } },
    ];
  }
  const cvs = await CV.find(filter)
    .sort({ createdAt: -1 })
    .select('name fileName contentType size extractionStatus extractionError textLength createdAt')
    .lean();
  res.json({
    status: 'ok',
    data: cvs.map((cv) => ({
      ...cv,
      extractionStatus: cv.extractionStatus ?? 'failed',
      extractionError: cv.extractionError ?? '',
      id: String(cv._id),
      _id: undefined,
    })),
  });
};

export const uploadCV = async (req, res) => {
  const contentType = req.get('content-type')?.split(';')[0];
  const fileName = decodeURIComponent(req.get('x-file-name') ?? '').slice(0, 255);
  const data = req.body;
  if (!Buffer.isBuffer(data) || !fileName || !allowedTypes.has(contentType))
    throw httpError(400, 'Upload a PDF or Word document');
  const name =
    typeof req.get('x-cv-name') === 'string' && req.get('x-cv-name').trim()
      ? req.get('x-cv-name').trim()
      : fileName.replace(/\.[^.]+$/, '').trim();
  if (!name || name.length > 120)
    throw httpError(400, 'CV name must be between 1 and 120 characters');
  // Check file signatures as well as the browser supplied MIME type.
  const bytes = data;
  const isPdf = bytes.subarray(0, 5).toString() === '%PDF-';
  const isZip = bytes.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
  const isDoc = bytes.subarray(0, 8).toString('hex') === 'd0cf11e0a1b11ae1';
  if (
    (contentType === 'application/pdf' && !isPdf) ||
    (contentType === 'application/msword' && !isDoc) ||
    (contentType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' &&
      !isZip)
  ) {
    throw httpError(400, 'The selected file does not match its document type');
  }
  const cv = await CV.create({
    userId: req.authUser._id,
    name,
    fileName,
    contentType,
    size: data.length,
    data,
    extractionStatus: 'pending',
  });
  res.status(201).json({ status: 'ok', data: metadata(cv) });
  void extractCVProfile(cv._id, req.authUser._id);
};

export const extractCV = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw httpError(404, 'CV not found');
  const cv = await CV.findOne({ _id: req.params.id, userId: req.authUser._id });
  if (!cv) throw httpError(404, 'CV not found');
  if (cv.extractionStatus === 'processing') throw httpError(409, 'CV is already being processed');
  const queued = await CV.updateOne(
    { _id: cv._id, userId: req.authUser._id, extractionStatus: { $ne: 'processing' } },
    { $set: { extractionStatus: 'pending', extractionError: '' } }
  );
  if (!queued.modifiedCount) throw httpError(409, 'CV is already being processed');
  void extractCVProfile(cv._id, req.authUser._id);
  res.status(202).json({ status: 'ok', message: 'CV processing started' });
};

export const downloadCV = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw httpError(404, 'CV not found');
  const cv = await CV.findOne({ _id: req.params.id, userId: req.authUser._id }).select('+data');
  if (!cv) throw httpError(404, 'CV not found');
  res.set({
    'Content-Type': cv.contentType,
    'Content-Length': String(cv.size),
    'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(cv.fileName)}`,
    'X-Content-Type-Options': 'nosniff',
  });
  res.send(cv.data);
};

export const deleteCV = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw httpError(404, 'CV not found');
  const cv = await CV.findOneAndDelete({ _id: req.params.id, userId: req.authUser._id });
  if (!cv) throw httpError(404, 'CV not found');
  await rebuildUserProfile(req.authUser._id);
  res.json({ status: 'ok', message: 'CV deleted' });
};
