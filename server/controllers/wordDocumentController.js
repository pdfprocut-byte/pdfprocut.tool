import mongoose from 'mongoose';
import multer from 'multer';
import mammoth from 'mammoth';
import WordDocument from '../models/WordDocument.js';
import { ApiError } from '../utils/ApiError.js';
import { wordJsonToDocx } from '../services/wordDocumentService.js';

const emptyContent = { type: 'doc', content: [{ type: 'paragraph' }] };
const allowedImage = /^data:image\/(png|jpeg);base64,[\da-z+/=]+$/i;
const allowedLink = /^(https?:\/\/|mailto:|tel:|#)/i;
const allowedNodes = new Set(['doc', 'paragraph', 'heading', 'blockquote', 'bulletList', 'orderedList', 'listItem', 'text', 'hardBreak', 'horizontalRule', 'codeBlock', 'image', 'table', 'tableRow', 'tableCell', 'tableHeader', 'pageBreak']);
const allowedMarks = new Set(['bold', 'italic', 'strike', 'underline', 'link', 'textStyle', 'highlight', 'code']);
const allowedFonts = new Set(['Arial', 'Calibri', 'Aptos', 'Times New Roman', 'Georgia', 'Verdana', 'Courier New']);
const maxContentBytes = 8 * 1024 * 1024;
const importUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024, files: 1 }, fileFilter: (req, file, done) => {
  const valid = file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || file.originalname.toLowerCase().endsWith('.docx');
  done(valid ? null : new ApiError(415, 'Choose a .docx Word document.'), valid);
} }).single('file');

export function validateTree(root) {
  if (!root || root.type !== 'doc' || !Array.isArray(root.content)) throw new ApiError(400, 'Document content is invalid.');
  let count = 0;
  const visit = (node, depth = 0) => {
    if (!node || typeof node !== 'object' || depth > 40 || ++count > 30000) throw new ApiError(400, 'Document has too much or invalid content.');
    if (!allowedNodes.has(node.type)) throw new ApiError(400, 'Document contains an unsupported element.');
    if (node.type === 'text' && typeof node.text !== 'string') throw new ApiError(400, 'Document text is invalid.');
    if (node.attrs !== undefined && (!node.attrs || typeof node.attrs !== 'object' || Array.isArray(node.attrs))) throw new ApiError(400, 'Document formatting is invalid.');
    if (node.marks !== undefined && !Array.isArray(node.marks)) throw new ApiError(400, 'Document text styles are invalid.');
    if (node.type === 'image' && !allowedImage.test(node.attrs?.src || '')) throw new ApiError(400, 'Images must be embedded PNG or JPEG files.');
    for (const mark of node.marks || []) {
      if (!allowedMarks.has(mark.type)) throw new ApiError(400, 'Document contains an unsupported text style.');
      if (mark.type === 'link' && !allowedLink.test(mark.attrs?.href || '')) throw new ApiError(400, 'A document link is invalid.');
      if (mark.type === 'textStyle') {
        const attrs = mark.attrs || {};
        if (attrs.color && !(/^#[\da-f]{6}$/i.test(attrs.color) || /^rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)$/i.test(attrs.color))) throw new ApiError(400, 'A document text color is invalid.');
        if (attrs.fontFamily && !allowedFonts.has(attrs.fontFamily)) throw new ApiError(400, 'A document font is invalid.');
        if (attrs.fontSize && !/^\d{1,2}(?:\.\d+)?(?:pt|px)$/i.test(attrs.fontSize)) throw new ApiError(400, 'A document font size is invalid.');
      }
      if (mark.type === 'highlight' && mark.attrs?.color && !(/^#[\da-f]{6}$/i.test(mark.attrs.color) || /^rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)$/i.test(mark.attrs.color))) throw new ApiError(400, 'A document highlight color is invalid.');
    }
    if (node.type === 'heading' && ![1, 2, 3, 4, 5, 6].includes(Number(node.attrs?.level))) throw new ApiError(400, 'A document heading level is invalid.');
    if (node.attrs?.textAlign && !['left', 'center', 'right', 'justify'].includes(node.attrs.textAlign)) throw new ApiError(400, 'A document alignment is invalid.');
    if (node.attrs?.indent !== undefined && (!Number.isFinite(Number(node.attrs.indent)) || Number(node.attrs.indent) < 0 || Number(node.attrs.indent) > 8)) throw new ApiError(400, 'A document indent is invalid.');
    if (node.attrs?.lineSpacing !== undefined && (!Number.isFinite(Number(node.attrs.lineSpacing)) || Number(node.attrs.lineSpacing) < 0.8 || Number(node.attrs.lineSpacing) > 3)) throw new ApiError(400, 'A document line spacing is invalid.');
    if (node.content !== undefined) {
      if (!Array.isArray(node.content)) throw new ApiError(400, 'Document content is invalid.');
      node.content.forEach((child) => visit(child, depth + 1));
    }
  };
  visit(root);
  if (Buffer.byteLength(JSON.stringify(root), 'utf8') > maxContentBytes) throw new ApiError(413, 'The document is too large to save.');
}

export function cleanSettings(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new ApiError(400, 'Page settings are invalid.');
  const sourceMargins = input.margins || {};
  const margins = {};
  for (const side of ['top', 'right', 'bottom', 'left']) {
    const value = Number(sourceMargins[side] ?? 20);
    if (!Number.isFinite(value) || value < 5 || value > 60) throw new ApiError(400, 'Margins must be between 5 and 60 mm.');
    margins[side] = value;
  }
  if (input.pageSize && !['a4', 'letter'].includes(input.pageSize)) throw new ApiError(400, 'Choose A4 or Letter paper size.');
  if (input.orientation && !['portrait', 'landscape'].includes(input.orientation)) throw new ApiError(400, 'Choose portrait or landscape orientation.');
  if (input.pageColor && !/^#[\da-f]{6}$/i.test(input.pageColor)) throw new ApiError(400, 'Page color must be a valid hex color.');
  return {
    pageSize: input.pageSize || 'a4', orientation: input.orientation || 'portrait', margins,
    header: String(input.header || '').slice(0, 1000), footer: String(input.footer || '').slice(0, 1000),
    pageNumbers: input.pageNumbers !== false, pageColor: input.pageColor || '#ffffff'
  };
}

const asData = (doc) => ({ id: doc.id, title: doc.title, content: doc.content, settings: doc.settings, createdAt: doc.createdAt, updatedAt: doc.updatedAt });
const validId = (id) => { if (!mongoose.isValidObjectId(id)) throw new ApiError(404, 'Document not found.'); };
const owned = async (id, userId) => {
  validId(id);
  const doc = await WordDocument.findOne({ _id: id, ownerId: userId });
  if (!doc) throw new ApiError(404, 'Document not found.');
  return doc;
};

export async function listDocuments(req, res) {
  const documents = await WordDocument.find({ ownerId: req.user._id }).sort({ updatedAt: -1 }).select('title settings createdAt updatedAt').limit(200).lean();
  res.json({ success: true, data: { documents: documents.map((doc) => ({ id: String(doc._id), title: doc.title, settings: doc.settings, createdAt: doc.createdAt, updatedAt: doc.updatedAt })) } });
}

export async function createDocument(req, res) {
  const title = String(req.body?.title || 'Untitled document').trim();
  if (!title || title.length > 180) throw new ApiError(400, 'Document name must be 1–180 characters.');
  const content = req.body?.content ?? emptyContent;
  validateTree(content);
  const doc = await WordDocument.create({ ownerId: req.user._id, title, content, settings: cleanSettings(req.body?.settings) });
  res.status(201).json({ success: true, data: { document: asData(doc) } });
}

export async function getDocument(req, res) {
  const doc = await owned(req.params.id, req.user._id);
  res.json({ success: true, data: { document: asData(doc) } });
}

export async function updateDocument(req, res) {
  const doc = await owned(req.params.id, req.user._id);
  const updates = {};
  if (Object.hasOwn(req.body || {}, 'title')) {
    const title = String(req.body.title || '').trim();
    if (!title || title.length > 180) throw new ApiError(400, 'Document name must be 1–180 characters.');
    updates.title = title;
  }
  if (Object.hasOwn(req.body || {}, 'content')) { validateTree(req.body.content); updates.content = req.body.content; }
  if (Object.hasOwn(req.body || {}, 'settings')) updates.settings = cleanSettings(req.body.settings);
  if (!Object.keys(updates).length) throw new ApiError(400, 'There are no document changes to save.');
  Object.assign(doc, updates);
  await doc.save();
  res.json({ success: true, data: { document: asData(doc) } });
}

export async function deleteDocument(req, res) {
  validId(req.params.id);
  const doc = await WordDocument.findOneAndDelete({ _id: req.params.id, ownerId: req.user._id });
  if (!doc) throw new ApiError(404, 'Document not found.');
  res.json({ success: true, data: { deleted: true } });
}

export async function exportDocx(req, res) {
  const doc = await owned(req.params.id, req.user._id);
  const buffer = await wordJsonToDocx(doc);
  const filename = `${doc.title.replace(/[\\/:*?"<>|\r\n]/g, '-').trim() || 'document'}.docx`;
  res.set({ 'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`, 'Content-Length': buffer.length, 'Cache-Control': 'no-store' });
  res.send(buffer);
}

export function importDocx(req, res, next) {
  importUpload(req, res, async (error) => {
    try {
      if (error) throw error;
      if (!req.file || req.file.buffer.length < 4 || req.file.buffer[0] !== 0x50 || req.file.buffer[1] !== 0x4b) throw new ApiError(400, 'The selected file is not a valid DOCX document.');
      const result = await mammoth.convertToHtml({ buffer: req.file.buffer }, { convertImage: mammoth.images.inline(async (image) => ({ src: `data:${image.contentType};base64,${(await image.read('base64'))}` })) });
      let unsupportedImageCount = 0;
      let html = result.value.replace(/\s+href="([^"]*)"/gi, (attribute, href) => allowedLink.test(href) ? attribute : '');
      html = html.replace(/<img\b[^>]*>/gi, (tag) => {
        if (/\ssrc="data:image\/(?:png|jpeg);base64,[\da-z+/=]+"/i.test(tag)) return tag;
        unsupportedImageCount += 1;
        const alt = tag.match(/\salt="([^"]*)"/i)?.[1]?.replace(/[<>]/g, '') || 'image';
        return `<p>[${alt} omitted: unsupported image format]</p>`;
      });
      if (Buffer.byteLength(html, 'utf8') > maxContentBytes) throw new ApiError(413, 'The imported document is too large.');
      const warnings = result.messages.filter((message) => message.type === 'warning').slice(0, 9).map((message) => message.message);
      if (unsupportedImageCount) warnings.push(`${unsupportedImageCount} unsupported image${unsupportedImageCount === 1 ? ' was' : 's were'} omitted.`);
      res.json({ success: true, data: { html, warnings } });
    } catch (caught) { next(caught); }
  });
}
