import { matchedData, validationResult } from 'express-validator';
import ContactMessage from '../models/ContactMessage.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

function requireMessageStore() {
  if (ContactMessage.db.readyState !== 1) {
    throw new ApiError(503, 'Messages are temporarily unavailable. Please try again shortly.');
  }
}

export const submitContactMessage = asyncHandler(async (req, res) => {
  const [error] = validationResult(req).array({ onlyFirstError: true });
  if (error) throw new ApiError(400, error.msg);

  requireMessageStore();
  await ContactMessage.create(matchedData(req, { locations: ['body'] }));
  res.status(201).json({ success: true });
});

export const listContactMessages = asyncHandler(async (req, res) => {
  requireMessageStore();
  const requestedPage = typeof req.query.page === 'string' ? Number(req.query.page) : 1;
  const pageSize = 20;
  const total = await ContactMessage.countDocuments();
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const page = Number.isSafeInteger(requestedPage) ? Math.min(pages, Math.max(1, requestedPage)) : 1;
  const items = await ContactMessage.find()
    .select('name email topic message createdAt')
    .sort({ createdAt: -1, _id: -1 })
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .lean();

  res.set('Cache-Control', 'no-store');
  res.json({ success: true, data: { items, page, pages, total } });
});
