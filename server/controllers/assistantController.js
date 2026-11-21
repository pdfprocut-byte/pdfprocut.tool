import { toolCatalog } from '../../shared/toolCatalog.mjs';
import { guideFaqs, toolGuides } from '../../shared/toolGuides.mjs';
import { asyncHandler } from '../utils/asyncHandler.js';

const stopWords = new Set('a an all and are as at be can do does every for from how i in is it me my of on or our pdf please the this that to use want what when where which with you your app tool file page engane cheyy cheyyam cheyyan venam undo oru aanu'.split(' '));
const wordAliases = {
  pdfs: 'pdf', tools: 'tool', files: 'file', pages: 'page', documents: 'document',
  images: 'image', photo: 'image', photos: 'image', picture: 'image', pictures: 'image', jpg: 'image', jpeg: 'image', png: 'image',
  doc: 'word', docx: 'word', ppt: 'powerpoint', pptx: 'powerpoint', xls: 'excel', xlsx: 'excel', into: 'to',
  merging: 'merge', joining: 'join', combining: 'combine', rotating: 'rotate', cropping: 'crop',
  compression: 'compress', compressing: 'compress', reducing: 'reduce', resizing: 'resize',
  scanned: 'scan', scans: 'scan', searching: 'search', passwords: 'password',
  uploads: 'upload', uploaded: 'upload', saved: 'stored', storage: 'stored',
  converted: 'convert', converting: 'convert', conversion: 'convert', formatting: 'format',
  maximum: 'limit', max: 'limit', limits: 'limit', kurakkan: 'kurakk', kurakkam: 'kurakk'
};
const toolHints = {
  'merge-pdf': ['merge', 'join', 'combine', 'put together', 'cherkk', 'cherkka', 'orumikka'],
  'organize-pdf': ['organize', 'reorder', 'page order', 'rotate and remove', 'arrange pages', 'pages order'],
  'split-pdf': ['split', 'divide', 'separate pages', 'page range'],
  'remove-pages': ['delete page', 'remove page', 'blank page', 'page remove'],
  'extract-pages': ['keep pages', 'extract page', 'selected pages'],
  'pdf-to-jpg': ['pdf to image', 'pdf as image', 'page image'],
  'pdf-to-png': ['pdf to png', 'png pages', 'export png', 'pdf png aakkan', 'png format'],
  'extract-images-pdf': ['extract image', 'download images from pdf', 'save embedded images', 'pdf il ninn image', 'pdfil ninn image edukkan', 'image save cheyyan'],
  'flatten-pdf': ['flatten pdf', 'flatten annotations', 'flatten fields', 'flatten form', 'form fixed aakkan', 'annotation fixed aakkan'],
  'pdf-metadata-cleaner': ['clean pdf metadata', 'remove pdf metadata', 'strip metadata', 'clear author title', 'metadata remove cheyyan'],
  'pdf-to-powerpoint': ['pdf to slides'],
  'pdf-to-excel': ['pdf to spreadsheet'],
  'pdf-to-markdown': ['markdown', 'pdf to md'],
  'pdf-to-document': ['pdf to word', 'editable word', 'pdf edit in word'],
  'word-to-pdf': ['docx to pdf', 'word file to pdf'],
  'powerpoint-to-pdf': ['ppt to pdf', 'slides to pdf'],
  'excel-to-pdf': ['xlsx to pdf', 'spreadsheet to pdf'],
  'convert-to-pdf': ['jpg to pdf', 'image to pdf', 'photos to pdf'],
  'ocr-pdf': ['ocr', 'searchable', 'search scan', 'search text', 'image text', 'recognize text', 'extract text', 'text recognize'],
  'compress-files': ['compress', 'reduce', 'shrink', 'smaller', 'size kurakk', 'compress pdf', 'compress word', 'compress office'],
  'compress-image': ['compress', 'reduce', 'shrink', 'smaller', 'size kurakk', 'resize', 'compress image', 'photo size', 'image size'],
  'protect-pdf': ['password protect', 'add password', 'protect', 'encrypt', 'lock'],
  'unlock-pdf': ['remove password', 'unlock', 'decrypt', 'open protected pdf'],
  'add-watermark': ['watermark', 'stamp text'],
  'add-image-to-pdf': ['add image', 'insert image', 'place image'],
  'add-page-numbers': ['page number', 'number pages', 'pagination'],
  'sign-pdf': ['signature', 'sign document'],
  'redact-pdf': ['hide sensitive', 'black out', 'redact'],
  'pdf-forms': ['fill form', 'form fields'],
  'summarize-pdf': ['summary', 'summarize', 'short summary'],
  'compare-pdf': ['compare', 'difference between pdfs', 'compare two pdf'],
  'repair-pdf': ['repair', 'damaged pdf', 'corrupt pdf'],
  'rotate-pdf': ['rotate', 'turn page', 'sideways', 'upside down'],
  'crop-pdf': ['crop', 'trim edges'],
  'edit-pdf': ['add text', 'annotate pdf']
};

const normalize = (value) => value.toLowerCase().normalize('NFKC')
  .replace(/\bpdf\/a\b/g, 'pdfa').replace(/->|=>|→/g, ' to ').replace(/[^\p{L}\p{N}\p{M}]+/gu, ' ').trim()
  .split(/\s+/).map((word) => Object.hasOwn(wordAliases, word) ? wordAliases[word] : word).join(' ');
const tokenize = (value) => normalize(value).split(/\s+/).filter((word) => word.length > 1 && !stopWords.has(word));
const containsPhrase = (text, phrase) => ` ${text} `.includes(` ${phrase} `);
const toolsBySlug = new Map(toolCatalog.map((tool) => [tool.slug, tool]));
// Match against tool facts and usage steps, but keep examples, limits, and FAQs
// out of the index so they cannot create unrelated recommendations.
const searchableTools = toolCatalog.map((tool) => {
  const phrases = [...new Set([tool.name, ...(tool.aliases || []), ...(toolHints[tool.slug] || [])].map(normalize))];
  const guide = toolGuides[tool.slug];
  const searchableText = [
    tool.name,
    tool.description,
    ...(tool.aliases || []),
    ...(toolHints[tool.slug] || []),
    guide?.overview,
    guide?.bestFor,
    ...(guide?.steps || [])
  ].filter(Boolean).join(' ');
  return { tool, phrases, terms: new Set(tokenize(searchableText)) };
});

function rankTools(query) {
  const queryText = normalize(query).split(' ').filter((word) => !['a', 'an', 'the', 'my', 'your', 'all', 'every'].includes(word)).join(' ');
  const queryTokens = new Set(tokenize(query));
  return searchableTools.map(({ tool, phrases, terms }) => {
    const signal = Math.max(0, ...phrases.filter((phrase) => containsPhrase(queryText, phrase)).map((phrase) => 8 + phrase.split(' ').length * 4));
    const overlap = [...queryTokens].filter((word) => terms.has(word)).length;
    const semanticSignal = overlap >= 2 && overlap / Math.max(queryTokens.size, 1) >= 0.4 ? 1 : 0;
    let score = signal + Math.min(overlap, 4) * 0.5 + (signal ? 0 : semanticSignal * overlap * 0.6);
    if (signal && tool.slug === 'compress-image' && queryTokens.has('image')) score += 4;
    if (signal && tool.slug === 'compress-files' && /\b(pdf|word|excel|powerpoint|office)\b/.test(queryText)) score += 4;
    return { tool, score, signal: signal || semanticSignal };
  }).filter(({ score }) => score > 0).sort((left, right) => right.score - left.score);
}

function confidentTool(ranked) {
  const matches = ranked.filter(({ signal }) => signal > 0);
  if (!matches.length || (matches[1] && matches[0].score - matches[1].score < 3)) return null;
  return matches[0].tool;
}

function rankFaqs(query, slug = null) {
  const terms = new Set(tokenize(query));
  const faqs = slug ? toolGuides[slug]?.faqs || [] : guideFaqs;
  const queryText = normalize(query);
  return faqs.map((faq) => {
    const faqTerms = new Set(tokenize(faq.question));
    const overlap = [...terms].filter((term) => faqTerms.has(term)).length;
    const uploadLimit = !slug && faq === guideFaqs[0] && /\bupload\b/.test(queryText) && /\b(size|limit|large|big)\b/.test(queryText);
    const relevant = overlap >= 2 && overlap / Math.max(terms.size, 1) >= 0.6 && overlap / Math.max(faqTerms.size, 1) >= 0.6;
    const score = uploadLimit ? 10 : relevant ? overlap : 0;
    return { faq, score };
  }).filter(({ score }) => score > 0).sort((left, right) => right.score - left.score)[0]?.faq;
}

function isMalayalamOrTransliterated(query) {
  return /[\u0D00-\u0D7F]/.test(query) || normalize(query).split(' ').some((word) => ['engane', 'cheyyam', 'cheyyan', 'cheyyanam', 'venam', 'aakumo', 'aakkan', 'edukkan', 'ninn', 'undo', 'ellam', 'enthokke', 'njan', 'ningal', 'evide', 'oru', 'kurakk'].includes(word));
}

function listTools(malayalam) {
  const groups = [...new Set(toolCatalog.map((tool) => tool.category))].map((category) => ({
    category,
    tools: toolCatalog.filter((tool) => tool.category === category).map((tool) => tool.name)
  }));
  const heading = malayalam ? `PDF Pro Cut-il ${toolCatalog.length} tools undu:` : `PDF Pro Cut has ${toolCatalog.length} tools:`;
  const groupText = groups.map(({ category, tools }) => `${category}: ${tools.join(', ')}`).join('\n');
  const footer = malayalam ? 'Tool list: /tools · Step-by-step guides: /guides' : 'Browse tools: /tools · Read the guides: /guides';
  return `${heading}\n${groupText}\n\n${footer}`;
}

function buildToolReply(tool, malayalam) {
  const guide = toolGuides[tool.slug];
  const intro = malayalam ? `${tool.name} use cheyyam.` : `For this, use ${tool.name}.`;
  const overview = guide?.overview || tool.description;
  const steps = guide?.steps?.length ? `\n\nSteps:\n${guide.steps.map((step, index) => `${index + 1}. ${step}`).join('\n')}` : '';
  const limits = guide?.limits ? `\n\nLimits: ${guide.limits}` : '';
  return `${intro}\n${overview}${steps}${limits}\n\nOpen: /tools/${tool.slug} · Guide: /tools/${tool.slug}#guide`;
}

function isFollowUp(question) {
  const text = normalize(question);
  const refersToTool = /\b(this|that|it|same|ithu|athu|ithinte|athinte)\b/.test(text)
    && /\b(tool|work|use|step|limit|size|support|keep|format|page|file|more|engane|cheyyam)\b/.test(text);
  return refersToTool
    || /^(tell me more|more|steps|step by step|how|how to use|how does it work|limit|what next|next|engane|engane cheyyam)$/.test(text);
}

function contextualTool(question, history, currentPath, ranked) {
  const recentQuestions = history.filter((item) => item.role === 'user').slice(-2).reverse();
  // A type-only reply can narrow an ambiguous request such as "compress".
  // It must not inherit an unrelated, already resolved topic such as "merge".
  if (/^(pdf|word|image|excel|powerpoint|office)( file)?$/.test(normalize(question)) && recentQuestions[0]) {
    const previous = rankTools(recentQuestions[0].content);
    if (!confidentTool(previous) && previous.some(({ signal }) => signal > 0)) {
      const possibleSlugs = new Set(previous.filter(({ signal }) => signal > 0).map(({ tool }) => tool.slug));
      return confidentTool(rankTools(`${recentQuestions[0].content} ${question}`).filter(({ tool }) => possibleSlugs.has(tool.slug)));
    }
  }
  if (!isFollowUp(question)) return null;

  const pageTool = toolsBySlug.get(currentPath.match(/^\/tools\/([a-z0-9-]+)$/i)?.[1]?.toLowerCase());
  let context = /\b(this|current) tool\b/.test(normalize(question)) ? pageTool : null;
  if (!context) {
    for (const previousQuestion of recentQuestions) {
      const previous = rankTools(previousQuestion.content);
      context = confidentTool(previous);
      if (!context && previous.some(({ signal }) => signal > 0)) return null;
      if (context || !isFollowUp(previousQuestion.content)) break;
    }
  }
  context ||= pageTool;
  // Even an explicit follow-up cannot redirect a new action to an unrelated page.
  return context && (!ranked.some(({ signal }) => signal > 0) || ranked.some(({ tool, signal }) => signal > 0 && tool.slug === context.slug)) ? context : null;
}

function clarificationReply(ranked, malayalam) {
  const matches = ranked.filter(({ signal }) => signal > 0);
  const choices = (matches.length ? matches.filter(({ score }) => matches[0].score - score < 3) : ranked).slice(0, 3);
  if (choices.length) {
    const intro = malayalam ? 'Ithil ethaanu vendathu? Input file type-um cheyyenda kaaryavum parayamo?' : 'Which of these do you mean? Please include the starting file type and the result you need.';
    return `${intro}\n\n${choices.map(({ tool }) => `${tool.name}: /tools/${tool.slug}`).join('\n')}`;
  }
  return malayalam
    ? 'File-il enthaanu cheyyendathu? Udaharanam: PDF merge cheyyan, Word to PDF aakkan, allenkil image size kurakkan. /tools-il tools-um /guides-il instructions-um kaanam.'
    : 'What would you like to do with your file? For example, merge PDFs, convert Word to PDF, or compress an image. Browse /tools or /guides.';
}

function faqReply(faq, malayalam, slug) {
  const intro = malayalam ? 'Guide-il parayunnathu:' : 'The app guide says:';
  return `${intro} ${faq.answer}\n\nRelated: ${slug ? `/tools/${slug}` : '/guides'}`;
}

function localAnswer(question, history, currentPath) {
  const normalized = normalize(question);
  const malayalam = isMalayalamOrTransliterated(question) || /\b(nilavilulla|nilavile)\b/.test(normalized);
  const ranked = rankTools(question);
  const listRequested = /\b(all|available|supported|ella|ellam|existing|nilavilulla|nilavile)\b.*\btool\b|\btool\b.*\b(all|available|supported|ella|ellam|existing|nilavilulla|nilavile)\b|\b(tool list|list (all )?tool|show (me )?(all )?tool|what can you do)\b/.test(normalized)
    || /^(what tool|ellam|enthokke|features|options|options parayu)$/.test(normalized);
  if (listRequested && !ranked.some(({ signal }) => signal > 0)) return listTools(malayalam);

  let tool = confidentTool(ranked);
  if (!tool) {
    const faq = rankFaqs(question);
    if (faq) return faqReply(faq, malayalam);
    tool = contextualTool(question, history, currentPath, ranked);
  }
  if (tool) {
    const faq = rankFaqs(question, tool.slug);
    return faq ? faqReply(faq, malayalam, tool.slug) : buildToolReply(tool, malayalam);
  }
  return clarificationReply(ranked, malayalam);
}

export const chatWithAssistant = asyncHandler(async (req, res) => {
  const question = typeof req.body?.question === 'string' ? req.body.question.trim() : '';
  if (!question || question.length > 1200) {
    return res.status(400).json({ success: false, error: 'Enter a question of up to 1,200 characters.' });
  }

  const history = Array.isArray(req.body?.history)
    ? req.body.history.slice(-8).filter((item) => item && item.role === 'user' && typeof item.content === 'string')
      .map(({ role, content }) => ({ role, content: content.trim().slice(0, 1200) })).filter((item) => item.content)
    : [];
  const currentPath = typeof req.body?.currentPath === 'string' && /^\/[a-z0-9/-]{0,120}$/i.test(req.body.currentPath)
    ? req.body.currentPath
    : '/';
  const answer = localAnswer(question, history, currentPath);
  res.set('Cache-Control', 'no-store');
  res.json({ success: true, data: { answer } });
});
