import fs from 'node:fs/promises';
import path from 'node:path';
import User from '../models/User.js';
import ProcessingJob from '../models/ProcessingJob.js';
import ManagedTool from '../models/ManagedTool.js';
import AdminSetting from '../models/AdminSetting.js';
import ContentPage from '../models/ContentPage.js';
import AdPlacement from '../models/AdPlacement.js';
import Subscription from '../models/Subscription.js';
import AnalyticsEvent from '../models/AnalyticsEvent.js';
import SystemLog from '../models/SystemLog.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { v4 as uuid } from 'uuid';

const pageSize = (value) => Math.min(Math.max(Number.parseInt(value, 10) || 20, 1), 100);
const clean = (value, max = 500) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const internalSourcePatternFor = (req) => {
  const hosts = ['internal', 'localhost', '127.0.0.1', '::1', '[::1]'];
  try {
    const pageUrl = req.get('origin') || req.get('referer');
    if (pageUrl) hosts.push(new URL(pageUrl).hostname);
  } catch { /* Ignore malformed request origin metadata. */ }
  return new RegExp(`^(?:${hosts.map(escapeRegex).join('|')})$`, 'i');
};
const validTimeZone = (value) => {
  const candidate = clean(value, 80) || 'UTC';
  try { new Intl.DateTimeFormat('en-US', { timeZone: candidate }); return candidate; }
  catch { return 'UTC'; }
};
const isDatabaseUnavailable = (error) => /Mongo(Network|ServerSelection)|buffering timed out|ENOTFOUND|ETIMEDOUT|ECONNRESET|ECONNREFUSED/i.test(`${error?.name || ''} ${error?.message || ''}`)
  || ['ENOTFOUND', 'ETIMEDOUT', 'ECONNRESET', 'ECONNREFUSED'].includes(error?.code);
const zonedMidnight = (utcDay, timeZone) => {
  let timestamp = utcDay;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(timestamp)).map(({ type, value }) => [type, value]));
    const represented = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second));
    const adjustment = represented - utcDay;
    timestamp -= adjustment;
    if (!adjustment) break;
  }
  return new Date(timestamp);
};
const localDayRange = (now, timeZone) => {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now).map(({ type, value }) => [type, value]));
  const utcDay = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day));
  return { start: zonedMidnight(utcDay, timeZone), end: zonedMidnight(utcDay + 24 * 60 * 60 * 1000, timeZone) };
};
const localMonthRange = (value, timeZone) => {
  const current = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit' }).formatToParts(new Date()).map(({ type, value: part }) => [type, part]));
  const match = /^([0-9]{4})-(0[1-9]|1[0-2])$/.exec(value || '');
  const year = match ? Number(match[1]) : Number(current.year);
  const month = match ? Number(match[2]) : Number(current.month);
  const utcMonth = Date.UTC(year, month - 1, 1);
  return { month: `${year}-${String(month).padStart(2, '0')}`, year, monthNumber: month, days: new Date(Date.UTC(year, month, 0)).getUTCDate(), start: zonedMidnight(utcMonth, timeZone), end: zonedMidnight(Date.UTC(year, month, 1), timeZone) };
};
const log = (req, action, target = '', details = '', severity = 'info') => SystemLog.create({ actorId: req.user._id, action, target, details, severity });
const getSetting = async (key, fallback) => (await AdminSetting.findOne({ key }).lean())?.value ?? fallback;
const putSetting = async (key, value) => AdminSetting.findOneAndUpdate({ key }, { value }, { new: true, upsert: true, runValidators: true });
const builtInTools = [
  ['merge-pdf', 'Merge PDF', 'merge'], ['split-pdf', 'Split PDF', 'split'], ['extract-pages', 'Extract Pages', 'extract-pages'], ['extract-images-pdf', 'Extract Images from PDF', 'extract-images'], ['remove-pages', 'Remove Pages', 'remove-pages'], ['rotate-pdf', 'Rotate PDF', 'rotate'], ['watermark', 'Add Watermark', 'add-watermark'], ['page-numbers', 'Add Page Numbers', 'add-page-numbers'], ['scan-to-pdf', 'Scan to PDF', 'scan-to-pdf'], ['text-to-pdf', 'Text to PDF', 'text-to-pdf'], ['text-to-document', 'Text to Document', 'text-to-document'], ['pdf-to-document', 'PDF to Word', 'pdf-to-document'], ['convert-to-pdf', 'Image to PDF', 'convert-to-pdf'], ['office-to-pdf', 'Office to PDF', 'office-to-pdf'], ['pdf-to-powerpoint', 'PDF to PowerPoint', 'pdf-to-powerpoint'], ['pdf-to-pdfa', 'PDF to PDF/A', 'pdf-to-pdfa'], ['html-to-pdf', 'HTML to PDF', 'html-to-pdf'], ['edit-pdf', 'Edit PDF', 'edit-pdf'], ['flatten-pdf', 'Flatten PDF', 'flatten-pdf'], ['protect-pdf', 'Protect PDF', 'protect-pdf'], ['unlock-pdf', 'Unlock PDF', 'unlock-pdf'], ['repair-pdf', 'Repair PDF', 'repair-pdf'], ['crop-pdf', 'Crop PDF', 'crop-pdf'], ['sign-pdf', 'Sign PDF', 'sign-pdf'], ['redact-pdf', 'Redact PDF', 'redact-pdf'], ['pdf-forms', 'PDF Forms', 'form-fields'], ['fill-form', 'Fill PDF Form', 'fill-form'], ['pdf-to-jpg', 'PDF to JPG', 'to-jpg'], ['pdf-to-png', 'PDF to PNG', 'to-png'], ['pdf-to-markdown', 'PDF to Markdown', 'to-markdown'], ['pdf-to-excel', 'PDF to Excel', 'to-excel'], ['summarize-pdf', 'Summarize PDF', 'summarize'], ['compare-pdf', 'Compare PDF', 'compare'], ['compress-pdf', 'Compress PDF', 'compress'], ['ocr-pdf', 'OCR PDF', 'ocr-pdf']
];
const ensureToolCatalog = async () => {
  if (await ManagedTool.exists()) return;
  await ManagedTool.insertMany(builtInTools.map(([slug, name, endpoint], sortOrder) => ({ slug, name, endpoint, category: 'PDF tools', sortOrder })));
};

export const dashboard = asyncHandler(async (req, res) => {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const timeZone = validTimeZone(req.query.timeZone);
  const { start: today, end: tomorrow } = localDayRange(new Date(), timeZone);
  const publicPageView = { type: 'page_view', path: { $not: /^\/admin(?:\/|$)/ } };
  const [users, blockedUsers, jobs, completedJobs, activeSubscriptions, revenue, visitors, todayVisits, todayVisitors, timeSpent, recentJobs, popularTools, recentLogs] = await Promise.all([
    User.countDocuments(), User.countDocuments({ blockedAt: { $exists: true, $ne: null } }), ProcessingJob.countDocuments(),
    ProcessingJob.countDocuments({ status: 'completed' }), Subscription.countDocuments({ status: 'active' }),
    Subscription.aggregate([{ $match: { status: 'active' } }, { $group: { _id: '$currency', amount: { $sum: '$amount' } } }]),
    AnalyticsEvent.countDocuments({ ...publicPageView, createdAt: { $gte: since } }),
    AnalyticsEvent.countDocuments({ ...publicPageView, createdAt: { $gte: today, $lt: tomorrow } }),
    AnalyticsEvent.distinct('visitorId', { ...publicPageView, createdAt: { $gte: today, $lt: tomorrow }, visitorId: { $type: 'string', $ne: '' } }).then((items) => items.filter(Boolean).length),
    AnalyticsEvent.aggregate([{ $match: { type: 'session', path: { $not: /^\/admin(?:\/|$)/ }, createdAt: { $gte: today, $lt: tomorrow } } }, { $group: { _id: null, seconds: { $sum: '$durationSeconds' } } }]),
    ProcessingJob.find().sort({ createdAt: -1 }).limit(10).select('userId toolName status createdAt completedAt').populate('userId', 'name email').lean(),
    AnalyticsEvent.aggregate([{ $match: { type: 'tool_used', source: 'pdf-api', createdAt: { $gte: since } } }, { $group: { _id: '$tool', count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 5 }]),
    SystemLog.find().sort({ createdAt: -1 }).limit(6).populate('actorId', 'name').lean()
  ]);
  res.json({ success: true, data: { stats: { users, blockedUsers, jobs, completedJobs, activeSubscriptions, visitors, pageViewsLast30Days: visitors, todayVisits, pageViewsToday: todayVisits, todayVisitors, timeSpentSeconds: timeSpent[0]?.seconds || 0, revenue }, timeZone, recentJobs, popularTools, recentLogs } });
});

export const listUsers = asyncHandler(async (req, res) => {
  const page = Number.parseInt(req.query.page, 10) || 1; const limit = pageSize(req.query.limit); const query = clean(req.query.q, 120);
  const filter = query ? { $or: [{ name: new RegExp(query, 'i') }, { email: new RegExp(query, 'i') }] } : {};
  const [items, total] = await Promise.all([User.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).select('name email role emailVerified blockedAt blockedReason createdAt').lean(), User.countDocuments(filter)]);
  res.json({ success: true, data: { items, total, page, pages: Math.ceil(total / limit) } });
});

export const listVisits = asyncHandler(async (req, res) => {
  const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
  const limit = pageSize(req.query.limit);
  const query = clean(req.query.q, 120);
  const timeZone = validTimeZone(req.query.timeZone);
  const selectedMonth = localMonthRange(clean(req.query.month, 7), timeZone);
  const internalSourcePattern = internalSourcePatternFor(req);
  const monthlyMatch = { type: 'page_view', path: { $not: /^\/admin(?:\/|$)/ }, createdAt: { $gte: selectedMonth.start, $lt: selectedMonth.end } };
  const filter = { ...monthlyMatch };
  if (query) {
    const pattern = new RegExp(escapeRegex(query), 'i');
    const matchingUsers = await User.distinct('_id', { $or: [{ name: pattern }, { email: pattern }] });
    const sourcePattern = query.toLowerCase().includes('internal') ? internalSourcePattern : pattern;
    filter.$or = [{ path: pattern }, { country: pattern }, { source: sourcePattern }, { visitorId: pattern }, { userId: { $in: matchingUsers } }];
  }
  const [items, total, visitorIds, visitIds, topPages, topSources, dailyActivity] = await Promise.all([
    AnalyticsEvent.find(filter).select('visitorId userId path country source createdAt').populate('userId', 'name email').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    AnalyticsEvent.countDocuments(filter),
    AnalyticsEvent.distinct('visitorId', { ...monthlyMatch, visitorId: { $type: 'string', $ne: '' } }),
    AnalyticsEvent.distinct('visitId', { ...monthlyMatch, visitId: { $type: 'string', $ne: '' } }),
    AnalyticsEvent.aggregate([{ $match: monthlyMatch }, { $group: { _id: '$path', pageViews: { $sum: 1 } } }, { $sort: { pageViews: -1 } }, { $limit: 1 }]),
    AnalyticsEvent.aggregate([{ $match: { ...monthlyMatch, source: { $type: 'string', $ne: '', $not: internalSourcePattern } } }, { $group: { _id: '$source', pageViews: { $sum: 1 } } }, { $sort: { pageViews: -1 } }, { $limit: 1 }]),
    AnalyticsEvent.aggregate([
      { $match: { createdAt: { $gte: selectedMonth.start, $lt: selectedMonth.end }, $or: [{ type: 'page_view', path: { $not: /^\/admin(?:\/|$)/ } }, { type: 'session', path: { $not: /^\/admin(?:\/|$)/ } }, { type: 'tool_used', source: 'pdf-api' }] } },
      { $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: timeZone } },
        pageViews: { $sum: { $cond: [{ $eq: ['$type', 'page_view'] }, 1, 0] } },
        visitorIds: { $addToSet: { $cond: [{ $eq: ['$type', 'page_view'] }, '$visitorId', null] } },
        visitIds: { $addToSet: { $cond: [{ $eq: ['$type', 'page_view'] }, '$visitId', null] } },
        pdfUses: { $sum: { $cond: [{ $and: [{ $eq: ['$type', 'tool_used'] }, { $eq: ['$source', 'pdf-api'] }] }, 1, 0] } },
        activeSeconds: { $sum: { $cond: [{ $eq: ['$type', 'session'] }, '$durationSeconds', 0] } }
      } },
      { $sort: { _id: 1 } }
    ])
  ]);
  const activityByDay = new Map(dailyActivity.map((day) => {
    const visitors = (day.visitorIds || []).filter(Boolean).length;
    const visits = (day.visitIds || []).filter(Boolean).length;
    return [day._id, { visitors, visitorIds: visitors, visits, visitCount: visits, pageViews: day.pageViews, pdfUses: day.pdfUses, activeSeconds: day.activeSeconds }];
  }));
  const daily = Array.from({ length: selectedMonth.days }, (_, index) => {
    const date = new Date(Date.UTC(selectedMonth.year, selectedMonth.monthNumber - 1, index + 1)).toISOString().slice(0, 10);
    return { date, ...(activityByDay.get(date) || { visitors: 0, visitorIds: 0, visits: 0, visitCount: 0, pageViews: 0, pdfUses: 0, activeSeconds: 0 }) };
  });
  const pageViews = daily.reduce((sum, day) => sum + day.pageViews, 0);
  const uniqueVisitors = visitorIds.filter(Boolean).length;
  const uniqueVisits = visitIds.filter(Boolean).length;
  const topPage = topPages[0] ? { ...topPages[0], visits: topPages[0].pageViews } : null;
  const topSource = topSources[0] ? { ...topSources[0], visits: topSources[0].pageViews } : null;
  const summary = {
    pageViews,
    visits: pageViews, // Legacy alias: this field historically contained page views.
    visitorIds: uniqueVisitors,
    visitors: uniqueVisitors,
    visitCount: uniqueVisits,
    pdfUses: daily.reduce((sum, day) => sum + day.pdfUses, 0),
    activeSeconds: daily.reduce((sum, day) => sum + day.activeSeconds, 0),
    topPage,
    topSource
  };
  const normalizedItems = items.map((item) => ({ ...item, source: internalSourcePattern.test(item.source || '') ? 'internal' : item.source }));
  res.json({ success: true, data: { items: normalizedItems, total, page, pages: Math.ceil(total / limit), month: selectedMonth.month, timeZone, summary, daily } });
});

export const listVisitVisitors = asyncHandler(async (req, res) => {
  const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
  const limit = pageSize(req.query.limit);
  const query = clean(req.query.q, 120);
  const sortByVisitCount = clean(req.query.sort, 20) === 'visitCount';
  const timeZone = validTimeZone(req.query.timeZone);
  const selectedMonth = localMonthRange(clean(req.query.month, 7), timeZone);
  const internalSourcePattern = internalSourcePatternFor(req);
  const filter = { type: sortByVisitCount ? { $in: ['page_view', 'session'] } : 'page_view', path: { $not: /^\/admin(?:\/|$)/ }, createdAt: { $gte: selectedMonth.start, $lt: selectedMonth.end } };
  if (query) {
    const pattern = new RegExp(escapeRegex(query), 'i');
    const matchingUsers = await User.distinct('_id', { $or: [{ name: pattern }, { email: pattern }] });
    filter.$or = [{ path: pattern }, { country: pattern }, { source: pattern }, { visitorId: pattern }, { userId: { $in: matchingUsers } }];
  }
  const [result] = await AnalyticsEvent.aggregate([
    { $match: filter },
    { $sort: { createdAt: 1 } },
    { $group: {
      _id: { $ifNull: ['$userId', { $ifNull: ['$visitorId', '$_id'] }] },
      userId: { $first: '$userId' },
      visitorId: { $first: '$visitorId' },
      visitIds: { $addToSet: '$visitId' },
      visits: { $sum: { $cond: [{ $eq: ['$type', 'page_view'] }, 1, 0] } },
      firstVisitedAt: { $min: '$createdAt' },
      lastVisitedAt: { $max: '$createdAt' },
      paths: { $addToSet: { $cond: [{ $eq: ['$type', 'page_view'] }, '$path', null] } },
      country: { $last: '$country' },
      source: { $last: '$source' },
      lastPath: { $last: '$path' }
    } },
    { $addFields: { visitCount: { $size: { $setDifference: ['$visitIds', [null, '']] } } } },
    { $sort: sortByVisitCount ? { visitCount: -1, lastVisitedAt: -1 } : { lastVisitedAt: -1 } },
    { $facet: { items: [{ $skip: (page - 1) * limit }, { $limit: limit }], meta: [{ $count: 'total' }] } }
  ]);
  const items = result?.items || [];
  const userIds = items.map((item) => item.userId).filter(Boolean);
  const accounts = await User.find({ _id: { $in: userIds } }).select('name email').lean();
  const accountsById = new Map(accounts.map((account) => [String(account._id), account]));
  const total = result?.meta?.[0]?.total || 0;
  res.json({ success: true, data: { items: items.map(({ visitIds = [], ...item }) => ({ ...item, pageViews: item.visits, paths: item.paths.filter(Boolean), visitCount: visitIds.filter(Boolean).length, source: internalSourcePattern.test(item.source || '') ? 'internal' : item.source, user: item.userId ? accountsById.get(String(item.userId)) || null : null })), total, page, pages: Math.ceil(total / limit), month: selectedMonth.month, timeZone } });
});

export const updateUser = asyncHandler(async (req, res) => {
  const allowedRoles = ['user', 'admin', 'editor', 'support']; const update = {};
  if (req.body.role !== undefined) { if (!allowedRoles.includes(req.body.role)) throw new ApiError(400, 'Invalid role.'); update.role = req.body.role; }
  if (req.body.blocked !== undefined) {
    if (typeof req.body.blocked !== 'boolean') throw new ApiError(400, 'Blocked must be true or false.');
    update.blockedAt = req.body.blocked ? new Date() : null;
    update.blockedReason = req.body.blocked ? clean(req.body.reason, 240) : '';
  }
  if (!Object.keys(update).length) throw new ApiError(400, 'No supported user updates were provided.');
  if (String(req.params.id) === String(req.user._id) && update.blockedAt) throw new ApiError(400, 'You cannot block your own account.');
  const updateOperation = { $set: update };
  if (req.body.blocked !== undefined) updateOperation.$inc = { sessionVersion: 1 };
  const user = await User.findByIdAndUpdate(req.params.id, updateOperation, { new: true, runValidators: true }).select('name email role blockedAt blockedReason');
  if (!user) throw new ApiError(404, 'User not found.');
  await log(req, 'user.updated', user.email, JSON.stringify(update));
  res.json({ success: true, data: { user } });
});

export const deleteUser = asyncHandler(async (req, res) => {
  if (String(req.params.id) === String(req.user._id)) throw new ApiError(400, 'You cannot delete your own account.');
  const user = await User.findByIdAndDelete(req.params.id);
  if (!user) throw new ApiError(404, 'User not found.');
  await log(req, 'user.deleted', user.email, 'User account deleted', 'warning');
  res.json({ success: true });
});

export const userActivity = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id).select('name email role emailVerified blockedAt blockedReason createdAt updatedAt').lean();
  if (!user) throw new ApiError(404, 'User not found.');
  const tools = await AnalyticsEvent.aggregate([
    { $match: { userId: user._id, type: 'tool_used', source: 'pdf-api' } },
    { $group: { _id: '$tool', uses: { $sum: 1 } } },
    { $sort: { uses: -1 } }
  ]);
  res.json({ success: true, data: { user, tools } });
});

export const listTools = asyncHandler(async (req, res) => { await ensureToolCatalog(); res.json({ success: true, data: { items: await ManagedTool.find().sort({ sortOrder: 1, name: 1 }).lean() } }); });
export const saveTool = asyncHandler(async (req, res) => {
  const payload = { name: clean(req.body.name, 100), slug: clean(req.body.slug, 100).toLowerCase(), endpoint: clean(req.body.endpoint, 80), description: clean(req.body.description, 300), category: clean(req.body.category, 80) || 'General', enabled: req.body.enabled !== false, sortOrder: Number(req.body.sortOrder) || 0 };
  if (!payload.name || !payload.slug || !payload.endpoint || !/^[a-z0-9-]+$/.test(payload.slug)) throw new ApiError(400, 'Name, endpoint, and a valid slug are required.');
  const tool = req.params.id ? await ManagedTool.findByIdAndUpdate(req.params.id, payload, { new: true, runValidators: true }) : await ManagedTool.create(payload);
  if (!tool) throw new ApiError(404, 'Tool not found.'); await log(req, 'tool.saved', tool.slug); res.status(req.params.id ? 200 : 201).json({ success: true, data: { tool } });
});
export const deleteTool = asyncHandler(async (req, res) => { const tool = await ManagedTool.findByIdAndDelete(req.params.id); if (!tool) throw new ApiError(404, 'Tool not found.'); await log(req, 'tool.deleted', tool.slug, '', 'warning'); res.json({ success: true }); });

export const getSettings = asyncHandler(async (req, res) => {
  const [site, seo, ads] = await Promise.all([getSetting('site', { siteName: 'PDF Pro Cut', supportEmail: '', logoUrl: '', faviconUrl: '', maintenanceMode: false }), getSetting('seo', { metaTitle: '', metaDescription: '', keywords: '', canonicalUrl: '', sitemapUrl: '' }), AdPlacement.find().sort({ name: 1 }).lean()]);
  res.json({ success: true, data: { site, seo, ads } });
});
export const saveSettings = asyncHandler(async (req, res) => {
  const section = req.params.section; if (!['site', 'seo'].includes(section)) throw new ApiError(404, 'Settings section not found.');
  const value = section === 'site' ? { siteName: clean(req.body.siteName, 100), supportEmail: clean(req.body.supportEmail, 254), logoUrl: clean(req.body.logoUrl, 500), faviconUrl: clean(req.body.faviconUrl, 500), maintenanceMode: Boolean(req.body.maintenanceMode) } : { metaTitle: clean(req.body.metaTitle, 160), metaDescription: clean(req.body.metaDescription, 320), keywords: clean(req.body.keywords, 500), canonicalUrl: clean(req.body.canonicalUrl, 500), sitemapUrl: clean(req.body.sitemapUrl, 500) };
  await putSetting(section, value); await log(req, `settings.${section}.saved`); res.json({ success: true, data: { value } });
});
export const saveAd = asyncHandler(async (req, res) => { const payload = { name: clean(req.body.name, 80), placement: clean(req.body.placement, 80), adSlot: clean(req.body.adSlot, 80), format: clean(req.body.format, 40) || 'auto', enabled: Boolean(req.body.enabled) }; if (!payload.name || !payload.placement) throw new ApiError(400, 'Name and placement are required.'); const ad = req.params.id ? await AdPlacement.findByIdAndUpdate(req.params.id, payload, { new: true, runValidators: true }) : await AdPlacement.create(payload); if (!ad) throw new ApiError(404, 'Ad placement not found.'); await log(req, 'ads.saved', ad.placement); res.status(req.params.id ? 200 : 201).json({ success: true, data: { ad } }); });
export const deleteAd = asyncHandler(async (req, res) => { const ad = await AdPlacement.findByIdAndDelete(req.params.id); if (!ad) throw new ApiError(404, 'Ad placement not found.'); await log(req, 'ads.deleted', ad.placement); res.json({ success: true }); });

export const listContent = asyncHandler(async (req, res) => { const page = Number.parseInt(req.query.page, 10) || 1; const limit = pageSize(req.query.limit); const [items, total] = await Promise.all([ContentPage.find().sort({ updatedAt: -1 }).skip((page - 1) * limit).limit(limit).lean(), ContentPage.countDocuments()]); res.json({ success: true, data: { items, total, page, pages: Math.ceil(total / limit) } }); });
export const saveContent = asyncHandler(async (req, res) => { const payload = { slug: clean(req.body.slug, 100).toLowerCase(), title: clean(req.body.title, 160), body: clean(req.body.body, 100000), status: req.body.status === 'published' ? 'published' : 'draft' }; if (!payload.slug || !payload.title || !/^[a-z0-9-]+$/.test(payload.slug)) throw new ApiError(400, 'A valid slug and title are required.'); if (payload.status === 'published') payload.publishedAt = new Date(); const page = req.params.id ? await ContentPage.findByIdAndUpdate(req.params.id, payload, { new: true, runValidators: true }) : await ContentPage.create(payload); if (!page) throw new ApiError(404, 'Content page not found.'); await log(req, 'content.saved', page.slug); res.status(req.params.id ? 200 : 201).json({ success: true, data: { page } }); });
export const deleteContent = asyncHandler(async (req, res) => { const page = await ContentPage.findByIdAndDelete(req.params.id); if (!page) throw new ApiError(404, 'Content page not found.'); await log(req, 'content.deleted', page.slug); res.json({ success: true }); });

export const subscriptions = asyncHandler(async (req, res) => { const page = Number.parseInt(req.query.page, 10) || 1; const limit = pageSize(req.query.limit); const [items, total, revenue] = await Promise.all([Subscription.find().populate('userId', 'name email').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(), Subscription.countDocuments(), Subscription.aggregate([{ $match: { status: 'active' } }, { $group: { _id: '$currency', amount: { $sum: '$amount' }, subscriptions: { $sum: 1 } } }])]); res.json({ success: true, data: { items, total, page, pages: Math.ceil(total / limit), revenue } }); });
export const saveSubscription = asyncHandler(async (req, res) => { const payload = { userId: req.body.userId, plan: clean(req.body.plan, 60) || 'Free', status: ['active', 'cancelled', 'past_due', 'expired'].includes(req.body.status) ? req.body.status : 'active', amount: Number(req.body.amount) || 0, currency: clean(req.body.currency, 3).toUpperCase() || 'USD', renewalAt: req.body.renewalAt ? new Date(req.body.renewalAt) : undefined }; if (!payload.userId || payload.amount < 0 || Number.isNaN(payload.renewalAt?.getTime())) throw new ApiError(400, 'Valid subscription details are required.'); const subscription = req.params.id ? await Subscription.findByIdAndUpdate(req.params.id, payload, { new: true, runValidators: true }) : await Subscription.create(payload); if (!subscription) throw new ApiError(404, 'Subscription not found.'); await log(req, 'subscription.saved', String(subscription._id)); res.status(req.params.id ? 200 : 201).json({ success: true, data: { subscription } }); });

export const analytics = asyncHandler(async (req, res) => {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const timeZone = validTimeZone(req.query.timeZone);
  const pageViewMatch = { type: 'page_view', path: { $not: /^\/admin(?:\/|$)/ }, createdAt: { $gte: since } };
  const internalSourcePattern = internalSourcePatternFor(req);
  const visitorBreakdown = (field) => AnalyticsEvent.aggregate([
    { $match: { ...pageViewMatch, visitorId: { $type: 'string', $ne: '' }, ...(field === 'source' ? { source: { $type: 'string', $ne: '', $not: internalSourcePattern } } : {}) } },
    { $group: { _id: `$${field}`, visitors: { $addToSet: '$visitorId' } } },
    { $project: { value: { $size: '$visitors' } } },
    { $sort: { value: -1 } },
    { $limit: 8 }
  ]);
  const [countries, tools, sources, daily] = await Promise.all([
    visitorBreakdown('country'),
    AnalyticsEvent.aggregate([
      { $match: { type: 'tool_used', source: 'pdf-api', createdAt: { $gte: since }, tool: { $type: 'string', $ne: '' } } },
      { $group: { _id: '$tool', value: { $sum: 1 } } },
      { $sort: { value: -1 } },
      { $limit: 8 }
    ]),
    visitorBreakdown('source'),
    AnalyticsEvent.aggregate([
      { $match: pageViewMatch },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: timeZone } }, value: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ])
  ]);
  res.json({ success: true, data: { countries, tools, sources, daily, timeZone } });
});
export const logs = asyncHandler(async (req, res) => { const page = Number.parseInt(req.query.page, 10) || 1; const limit = pageSize(req.query.limit); const [items, total] = await Promise.all([SystemLog.find().sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).populate('actorId', 'name email').lean(), SystemLog.countDocuments()]); res.json({ success: true, data: { items, total, page, pages: Math.ceil(total / limit) } }); });

export const cleanupTemporaryFiles = asyncHandler(async (req, res) => { const directory = path.resolve(process.cwd(), 'temp'); const cutoff = Date.now() - 60 * 60 * 1000; let removed = 0; try { const entries = await fs.readdir(directory, { withFileTypes: true }); for (const entry of entries) { if (!entry.isFile()) continue; const target = path.resolve(directory, entry.name); if (!target.startsWith(`${directory}${path.sep}`)) continue; const info = await fs.stat(target); if (info.mtimeMs < cutoff) { await fs.unlink(target); removed += 1; } } } catch (error) { if (error.code !== 'ENOENT') throw error; } await log(req, 'maintenance.temp_cleanup', '', `${removed} files removed`); res.json({ success: true, data: { removed } }); });
export const backup = asyncHandler(async (req, res) => { const [users, tools, settings, content, ads, subscriptions] = await Promise.all([User.find().select('name email role emailVerified blockedAt createdAt updatedAt').lean(), ManagedTool.find().lean(), AdminSetting.find().lean(), ContentPage.find().lean(), AdPlacement.find().lean(), Subscription.find().lean()]); await log(req, 'maintenance.backup_created'); res.set({ 'Cache-Control': 'no-store', 'Content-Type': 'application/json', 'Content-Disposition': `attachment; filename="pdfprocut-backup-${new Date().toISOString().slice(0, 10)}.json"` }); res.send(JSON.stringify({ version: 1, createdAt: new Date().toISOString(), users, tools, settings, content, ads, subscriptions }, null, 2)); });

export const trackAnalytics = asyncHandler(async (req, res) => {
  const type = req.body.type === 'session' ? 'session' : 'page_view';
  const pathValue = clean(req.body.path, 240) || '/';
  const visitorId = clean(req.body.visitorId, 100) || uuid();
  const visitId = clean(req.body.visitId, 100) || uuid();
  const eventId = clean(req.body.eventId, 100) || uuid();
  const country = clean(req.get('cf-ipcountry') || req.body.country, 2).toUpperCase() || 'UN';
  const reportedSource = clean(req.body.source, 80) || 'direct';
  const source = internalSourcePatternFor(req).test(reportedSource) ? 'internal' : reportedSource;
  if (AnalyticsEvent.db.readyState !== 1) {
    console.warn('[analytics] Event was not stored because MongoDB is unavailable.');
    return res.status(202).json({ success: true, data: { tracked: false } });
  }
  try {
    await AnalyticsEvent.create({ eventId, userId: req.user?._id, visitorId, visitId, type, path: pathValue, country: /^[A-Z]{2}$/.test(country) ? country : 'UN', source, durationSeconds: type === 'session' ? Math.min(Math.max(Number(req.body.durationSeconds) || 0, 0), 86400) : 0 });
    res.status(201).json({ success: true });
  } catch (error) {
    if (error?.code === 11000 && error?.keyPattern?.eventId) return res.status(200).json({ success: true, data: { tracked: false, duplicate: true } });
    if (isDatabaseUnavailable(error)) {
      console.warn('[analytics] Event write failed because MongoDB is unavailable.', { errorName: error?.name || 'Error', errorCode: error?.code });
      return res.status(202).json({ success: true, data: { tracked: false } });
    }
    console.error('[analytics] Failed to persist event.', { errorName: error?.name || 'Error', errorCode: error?.code });
    throw error;
  }
});
