import {
  AlignmentType, Document, ExternalHyperlink, Footer, Header, HeadingLevel, ImageRun, LevelFormat,
  PageNumber, PageOrientation, Packer, Paragraph, ShadingType, Table, TableCell, TableRow, TextRun, UnderlineType
} from 'docx';
import { ApiError } from '../utils/ApiError.js';

const PAGE = { a4: [11906, 16838], letter: [12240, 15840] };
const safeUrl = (href) => /^(https?:|mailto:|tel:)/i.test(href || '');
const colorHex = (value) => /^#[\da-f]{6}$/i.test(value || '') ? value.slice(1).toUpperCase() : undefined;

function makeTextRuns(node) {
  if (node?.type !== 'text') return [];
  const marks = node.marks || [];
  const get = (name) => marks.find((mark) => mark.type === name)?.attrs || {};
  const style = get('textStyle');
  const link = get('link').href;
  const common = {
    text: node.text || '', bold: marks.some((mark) => mark.type === 'bold'),
    italics: marks.some((mark) => mark.type === 'italic'), strike: marks.some((mark) => mark.type === 'strike'),
    underline: marks.some((mark) => mark.type === 'underline') ? { type: UnderlineType.SINGLE } : undefined,
    color: colorHex(style.color), font: style.fontFamily,
    size: Number(style.fontSize?.replace(/(?:pt|px)$/i, '')) ? Math.round(Number(style.fontSize.replace(/(?:pt|px)$/i, '')) * (style.fontSize.toLowerCase().endsWith('px') ? 1.5 : 2)) : undefined,
    ...(marks.some((mark) => mark.type === 'code') ? { font: 'Courier New' } : {}),
    shading: marks.some((mark) => mark.type === 'highlight') ? { type: ShadingType.CLEAR, fill: colorHex(get('highlight').color) || 'FFF2A8' } : undefined
  };
  const run = new TextRun(common);
  return safeUrl(link) ? [new ExternalHyperlink({ link, children: [run] })] : [run];
}

function paragraphFrom(node, fallbackAlign = 'left', listType = '') {
  const alignment = { left: AlignmentType.LEFT, center: AlignmentType.CENTER, right: AlignmentType.RIGHT, justify: AlignmentType.JUSTIFIED };
  const heading = /^heading([1-6])$/.exec(node.type);
  const children = [];
  for (const child of node.content || []) {
    if (child.type === 'text') children.push(...makeTextRuns(child));
    else if (child.type === 'hardBreak') children.push(new TextRun({ break: 1 }));
  }
  const level = node.type === 'heading' ? Number(node.attrs?.level) : heading ? Number(heading[1]) : 0;
  const attrs = node.attrs || {};
  return new Paragraph({
    heading: level ? [null, HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3, HeadingLevel.HEADING_4, HeadingLevel.HEADING_5, HeadingLevel.HEADING_6][level] : undefined,
    alignment: alignment[attrs.textAlign] || alignment[fallbackAlign],
    indent: attrs.indent ? { left: Math.max(0, Number(attrs.indent)) * 120 } : undefined,
    spacing: attrs.lineSpacing ? { line: Math.round(Number(attrs.lineSpacing) * 240), after: 160 } : { after: 160 },
    numbering: listType ? { reference: listType === 'orderedList' ? 'word-numbers' : 'word-bullets', level: 0 } : undefined,
    children: children.length ? children : [new TextRun(' ')]
  });
}

function blocksFrom(nodes, settings) {
  const blocks = [];
  for (const node of nodes || []) {
    if (['paragraph', 'heading', 'listItem', 'codeBlock'].includes(node.type) || /^heading[1-6]$/.test(node.type)) {
      blocks.push(paragraphFrom(node, settings.alignment));
    } else if (node.type === 'bulletList' || node.type === 'orderedList') {
      for (const item of node.content || []) for (const paragraph of item.content || []) blocks.push(paragraphFrom(paragraph, 'left', node.type));
    } else if (node.type === 'blockquote') {
      for (const paragraph of node.content || []) blocks.push(paragraphFrom(paragraph));
    } else if (node.type === 'horizontalRule' || node.type === 'pageBreak') {
      blocks.push(new Paragraph({ pageBreakBefore: node.type === 'pageBreak', border: node.type === 'horizontalRule' ? { bottom: { style: 'single', size: 6, color: 'AAB4C5' } } : undefined }));
    } else if (node.type === 'image') {
      const match = /^data:image\/(png|jpeg);base64,([\da-z+/=]+)$/i.exec(node.attrs?.src || '');
      if (match) {
        const width = Math.min(600, Math.max(40, Number(node.attrs.width) || 520));
        const height = Math.min(800, Math.max(40, Number(node.attrs.height) || width * 0.65));
        blocks.push(new Paragraph({ children: [new ImageRun({ data: Buffer.from(match[2], 'base64'), type: match[1] === 'jpeg' ? 'jpg' : 'png', transformation: { width, height } })] }));
      }
    } else if (node.type === 'table') {
      const rows = (node.content || []).map((row) => new TableRow({ children: (row.content || []).map((cell) => new TableCell({
        children: (cell.content || []).flatMap((paragraph) => paragraph.type === 'paragraph' || /^heading/.test(paragraph.type) ? [paragraphFrom(paragraph)] : []),
        width: { size: 100 / Math.max(1, row.content?.length || 1), type: 'pct' }
      })) }));
      if (rows.length) blocks.push(new Table({ rows, width: { size: 100, type: 'pct' } }));
    } else if (node.content) blocks.push(...blocksFrom(node.content, settings));
  }
  return blocks;
}

export async function wordJsonToDocx(documentRecord) {
  const settings = documentRecord.settings || {};
  let [width, height] = PAGE[settings.pageSize] || PAGE.a4;
  if (settings.orientation === 'landscape') [width, height] = [height, width];
  const margins = settings.margins || {};
  const mmToTwips = (mm) => Math.round((Number(mm) || 20) * 56.7);
  const header = settings.header ? new Header({ children: [new Paragraph(settings.header)] }) : undefined;
  const footerChildren = [];
  if (settings.footer) footerChildren.push(new TextRun(settings.footer));
  if (settings.pageNumbers) {
    if (footerChildren.length) footerChildren.push(new TextRun('   '));
    footerChildren.push(new TextRun({ text: 'Page ' }), PageNumber.CURRENT);
  }
  const footer = footerChildren.length ? new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: footerChildren })] }) : undefined;
  const content = blocksFrom(documentRecord.content?.content || [], settings);
  const doc = new Document({
    background: { color: colorHex(settings.pageColor) || 'FFFFFF' },
    numbering: { config: [
      { reference: 'word-bullets', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 360, hanging: 240 } } } }] },
      { reference: 'word-numbers', levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 360, hanging: 240 } } } }] }
    ] },
    sections: [{
      properties: { page: {
        size: { width, height, orientation: settings.orientation === 'landscape' ? PageOrientation.LANDSCAPE : PageOrientation.PORTRAIT },
        margin: { top: mmToTwips(margins.top), right: mmToTwips(margins.right), bottom: mmToTwips(margins.bottom), left: mmToTwips(margins.left) }
      } },
      ...(header ? { headers: { default: header } } : {}), ...(footer ? { footers: { default: footer } } : {}),
      children: content.length ? content : [new Paragraph(' ')]
    }]
  });
  try { return await Packer.toBuffer(doc); }
  catch { throw new ApiError(422, 'Could not export this document as DOCX.'); }
}
