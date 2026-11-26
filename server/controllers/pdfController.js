import { v4 as uuid } from 'uuid'; import { asyncHandler } from '../utils/asyncHandler.js'; import * as pdf from '../services/pdfService.js'; import * as securityOcr from '../services/pdfSecurityOcrService.js'; import * as document from '../services/documentService.js'; import { ApiError } from '../utils/ApiError.js'; import * as pdfDocument from '../services/pdfToDocumentService.js';
import * as compression from '../services/compressionService.js';
import * as extraPdf from '../services/extraPdfService.js';
import * as officeConversion from '../services/officeConversionService.js';
import { getOcrLanguageConfig } from '../services/ocrLanguageService.js';
const file = (req) => { if (!req.files?.length) throw new ApiError(400, 'Upload a file'); return req.files[0]; };
const pdfFile = (req) => { const uploaded = file(req); if (uploaded.mimetype !== 'application/pdf') throw new ApiError(415, 'Upload a PDF file'); return uploaded; };
const sendPdf = (res, bytes) => { res.set({ 'Content-Type':'application/pdf', 'Content-Disposition':'attachment; filename="PDFPro.pdf"', 'X-Job-Id':uuid() }); res.send(Buffer.from(bytes)); };
const sendZip = (res, bytes) => { res.set({ 'Content-Type':'application/zip', 'Content-Disposition':'attachment; filename="PDFPro-images.zip"', 'X-Job-Id':uuid() }); res.send(Buffer.from(bytes)); };
const sendDocument = (res, bytes) => { res.set({ 'Content-Type':'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'Content-Disposition':'attachment; filename="PDFPro.docx"', 'X-Job-Id':uuid() }); res.send(Buffer.from(bytes)); };
export const merge = asyncHandler(async(req,res)=>sendPdf(res,await pdf.merge(req.files||[],{ files:req.body.mergeOptions,pageOrder:req.body.pageOrder })));
export const split = asyncHandler(async(req,res)=>sendPdf(res,await pdf.split(file(req),req.body.pages)));
export const removePages = asyncHandler(async(req,res)=>sendPdf(res,await pdf.remove(file(req),req.body.pages)));
export const rotate = asyncHandler(async(req,res)=>sendPdf(res,await pdf.rotate(file(req),req.body.pages,req.body.angle)));
export const watermark = asyncHandler(async(req,res)=>{ const source=req.files?.files?.[0]; if(!source) throw new ApiError(400,'Upload a PDF'); const image=req.files?.watermarkImage?.[0]||null; sendPdf(res,await pdf.watermark(source,req.body.text,req.body,image)); });
export const pageNumbers = asyncHandler(async(req,res)=>sendPdf(res,await pdf.pageNumbers(file(req),req.body)));
export const scan = asyncHandler(async(req,res)=>sendPdf(res,await pdf.imageToPdf(req.files||[],req.body.options)));
export const textToPdf = asyncHandler(async(req,res)=>{
  if (req.files?.length) throw new ApiError(400, 'Text to PDF expects text in the editor, not a file upload');
  if (typeof req.body.html !== 'string') throw new ApiError(400, 'Enter text in the editor first');
  return sendPdf(res, await pdf.richTextToPdf(req.body.html, req.body.options));
});
export const textToDocument = asyncHandler(async(req,res)=>{
  if (req.files?.length) throw new ApiError(400, 'Enter or upload text in the document editor first');
  if (typeof req.body.html !== 'string') throw new ApiError(400, 'Enter text in the editor first');
  return sendDocument(res, await document.richTextToDocument(req.body.html, req.body.options));
});
export const pdfToDocument = asyncHandler(async(req,res)=>{
  const result = await pdfDocument.pdfToDocument(pdfFile(req), { provider: req.body.provider || 'local' });
  res.set('X-PDF-Word-Mode', result.mode);
  return sendDocument(res, result.buffer);
});
export const pdfToDocumentConfig = asyncHandler(async(req,res)=>res.json({ success:true, data:pdfDocument.getPdfToDocumentConfig() }));
export const pdfToDocumentText = asyncHandler(async(req,res)=>res.json({ success:true, data:{ text:await pdfDocument.extractPdfText(pdfFile(req)) } }));
export const compress = asyncHandler(async(req,res)=>{
  const uploaded = file(req);
  const targetSizeMb = Number(req.body.targetSizeMb);
  if (!Number.isFinite(targetSizeMb) || targetSizeMb < 1 / 1024 || targetSizeMb > 25) throw new ApiError(400, 'Choose a target size between 1 KB and 25 MB');
  const quality = String(req.body.quality || 'clear');
  const result = await compression.compressFile(uploaded, targetSizeMb, quality, { imageOnlyOptimization: req.body.imageOnlyOptimization === 'true' });
  const extension = String(uploaded.originalname || '').split('.').at(-1).toLowerCase();
  const targetBytes = Math.round(targetSizeMb * 1024 * 1024);
  res.set({
    'Content-Type': result.type,
    'Content-Disposition': `attachment; filename="PDFPro.${extension}"`,
    'X-Job-Id': uuid(),
    'X-Original-Size': String(uploaded.size),
    'X-Output-Size': String(result.buffer.length),
    'X-Target-Size': String(targetBytes),
    'X-Target-Met': String(result.buffer.length <= targetBytes),
    'X-PDF-Rasterized': String(Boolean(result.rasterized))
  });
  res.send(result.buffer);
});
export const convertToPdf = asyncHandler(async(req,res)=>{
  const files = req.files || [];
  if (typeof req.body.text === 'string') {
    if (files.length) throw new ApiError(400, 'Convert either images or text at a time');
    return sendPdf(res, await pdf.textToPdf(req.body.text, req.body.options));
  }
  const f = file(req);
  if (f.mimetype.startsWith('image/')) {
    if (files.some((item) => !item.mimetype.startsWith('image/'))) throw new ApiError(400, 'Convert either images or one text file at a time');
    return sendPdf(res, await pdf.imageToPdf(files, req.body.options));
  }
  if (f.mimetype === 'text/plain') {
    if (files.length !== 1) throw new ApiError(400, 'Upload one text file at a time');
    return sendPdf(res, await pdf.textToPdf(f, req.body.options));
  }
  throw new ApiError(501, 'This conversion requires LibreOffice or a configured converter. See docs/PDF_DEPENDENCIES.md.');
});
export const officeToPdf = asyncHandler(async(req,res)=>{
  const uploaded=file(req);
  const bytes=await officeConversion.officeFileToPdf(uploaded);
  return sendPdf(res,bytes);
});
export const protect = asyncHandler(async(req,res)=>sendPdf(res,await securityOcr.protectPdf(pdfFile(req),req.body.password)));
export const ocrLanguages = (req, res) => res.json({ success: true, data: getOcrLanguageConfig() });
export const ocr = asyncHandler(async (req, res) => {
  const uploaded = file(req);
  if (!['application/pdf', 'image/png', 'image/jpeg'].includes(uploaded.mimetype)) {
    throw new ApiError(415, 'Upload a PDF, PNG, or JPG file');
  }
  const source = uploaded.mimetype === 'application/pdf'
    ? uploaded
    : { buffer: await pdf.imageToPdf([uploaded], { margin: 0 }) };
  sendPdf(res, await securityOcr.ocrPdf(source, req.body.languages));
});
export const repair = asyncHandler(async(req,res)=>sendPdf(res,await extraPdf.repairPdf(pdfFile(req))));
export const cleanMetadata = asyncHandler(async(req,res)=>sendPdf(res,await extraPdf.cleanPdfMetadata(pdfFile(req))));
export const crop = asyncHandler(async(req,res)=>sendPdf(res,await extraPdf.cropPdf(pdfFile(req),req.body)));
export const unlock = asyncHandler(async(req,res)=>sendPdf(res,await extraPdf.unlockPdf(pdfFile(req),req.body.password)));
export const sign = asyncHandler(async(req,res)=>{
  const source=req.files?.files?.[0];
  const signature=req.files?.signature?.[0];
  if(!source||source.mimetype!=='application/pdf') throw new ApiError(400,'Upload a PDF to sign');
  const bytes=await extraPdf.signPdf(source,signature,req.body);
  return sendPdf(res,bytes);
});
export const flattenPdf = asyncHandler(async(req,res)=>sendPdf(res,await extraPdf.flattenPdf(pdfFile(req))));
export const inspectExtractImages = asyncHandler(async(req,res)=>res.json({ success:true, data:{ images:await extraPdf.inspectImagesInPdf(pdfFile(req)) } }));
export const extractImages = asyncHandler(async(req,res)=>{
  let selectedIds;
  if (req.body.selectedImages !== undefined) {
    try { selectedIds = JSON.parse(req.body.selectedImages); } catch { throw new ApiError(400, 'Choose the images to extract'); }
    if (!Array.isArray(selectedIds) || selectedIds.length > 10000 || selectedIds.some((id) => typeof id !== 'string' || !/^page-\d+-image-\d+$/.test(id))) {
      throw new ApiError(400, 'The selected image list is invalid');
    }
  }
  return sendZip(res,await extraPdf.extractImagesFromPdf(pdfFile(req), selectedIds));
});
export const pdfToJpg = asyncHandler(async(req,res)=>sendZip(res,await extraPdf.pdfToImages(pdfFile(req),{ ...req.body, format:'jpg' })));
export const pdfToPng = asyncHandler(async(req,res)=>sendZip(res,await extraPdf.pdfToImages(pdfFile(req),{ ...req.body, format:'png' })));
export const pdfToMarkdown = asyncHandler(async(req,res)=>{
  const markdown=await extraPdf.pdfToMarkdown(pdfFile(req));
  res.set({ 'Content-Type':'text/markdown; charset=utf-8', 'Content-Disposition':'attachment; filename="PDFPro.md"', 'X-Job-Id':uuid() });
  res.send(markdown);
});
export const pdfToExcel = asyncHandler(async(req,res)=>{
  const bytes=await extraPdf.pdfToExcel(pdfFile(req));
  res.set({ 'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition':'attachment; filename="PDFPro.xlsx"', 'X-Job-Id':uuid() });
  res.send(Buffer.from(bytes));
});
export const pdfToPowerPoint = asyncHandler(async(req,res)=>{
  const bytes=await extraPdf.pdfToPowerPoint(pdfFile(req));
  res.set({ 'Content-Type':'application/vnd.openxmlformats-officedocument.presentationml.presentation', 'Content-Disposition':'attachment; filename="PDFPro.pptx"', 'X-Job-Id':uuid() });
  res.send(Buffer.from(bytes));
});
export const pdfToPdfA = asyncHandler(async(req,res)=>sendPdf(res,await extraPdf.pdfToPdfA(pdfFile(req))));
export const summarize = asyncHandler(async(req,res)=>res.json({ success:true, data:await extraPdf.summarizePdf(pdfFile(req)) }));
export const compare = asyncHandler(async(req,res)=>res.json({ success:true, data:await extraPdf.comparePdfs(req.files) }));
export const redact = asyncHandler(async(req,res)=>sendPdf(res,await extraPdf.redactPdf(pdfFile(req),req.body.terms)));
export const pdfFormFields = asyncHandler(async(req,res)=>res.json({ success:true, data:{ fields:await extraPdf.getPdfFormFields(pdfFile(req)) } }));
export const fillPdfForm = asyncHandler(async(req,res)=>sendPdf(res,await extraPdf.fillPdfForm(pdfFile(req),req.body.values)));
export const htmlToPdf = asyncHandler(async(req,res)=>{
  if (typeof req.body.html !== 'string' || !req.body.html.trim()) throw new ApiError(400,'Paste HTML content to convert');
  if (req.body.html.length > 500_000) throw new ApiError(413,'HTML input must be under 500 KB');
  return sendPdf(res,await pdf.richTextToPdf(req.body.html,req.body.options || {}));
});
export const editPdf = asyncHandler(async(req,res)=>{
  const source = req.files?.files?.[0];
  if (!source) throw new ApiError(400, 'Upload a PDF to edit');
  if (source.mimetype !== 'application/pdf') throw new ApiError(415, 'Upload a PDF file');
  const image = req.files?.signature?.[0] || null;
  if (!image && req.body.text?.trim() && req.body.textItems === undefined) {
    return sendPdf(res, await extraPdf.addPdfText(source, req.body));
  }
  return sendPdf(res, await extraPdf.signPdf(source, image, { ...req.body, allowTextOnly: true }));
});
