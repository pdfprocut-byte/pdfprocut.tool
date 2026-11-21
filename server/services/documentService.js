import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  LineRuleType,
  PageNumber,
  PageOrientation,
  Packer,
  Paragraph,
  ShadingType,
  TextRun,
  UnderlineType
} from 'docx';
import { rgb } from 'pdf-lib';
import { textDirection } from '../../shared/documentText.mjs';
import { ApiError } from '../utils/ApiError.js';
import { parseRichText } from './pdfService.js';

const sizes = {
  a4: [11906, 16838],
  letter: [12240, 15840],
  legal: [12240, 20160]
};

function parseOptions(value) {
  if (typeof value === 'string') {
    try { value = JSON.parse(value); }
    catch { throw new ApiError(400, 'Text layout settings are invalid'); }
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ApiError(400, 'Text layout settings are invalid');

  const options = {
    pageSize: String(value.pageSize || 'a4'),
    orientation: String(value.orientation || 'portrait'),
    margin: Number(value.margin ?? 48),
    font: String(value.font || 'Helvetica'),
    fontSize: Number(value.fontSize ?? 12),
    color: String(value.color || '#202124').replace(/^#/, ''),
    highlight: String(value.highlight || '#fff2a8').replace(/^#/, ''),
    align: String(value.align || 'left'),
    lineSpacing: Number(value.lineSpacing ?? 1.35),
    paragraphSpacing: Number(value.paragraphSpacing ?? 8),
    backgroundColor: String(value.backgroundColor || '#ffffff').replace(/^#/, ''),
    pageNumbers: value.pageNumbers === true || value.pageNumbers === 'true'
  };

  if (!sizes[options.pageSize]) throw new ApiError(400, 'Choose A4, Letter, or Legal paper size');
  if (!['portrait', 'landscape'].includes(options.orientation)) throw new ApiError(400, 'Choose portrait or landscape orientation');
  if (!['left', 'center', 'right', 'justify'].includes(options.align)) throw new ApiError(400, 'Choose a supported paragraph alignment');
  if (!Number.isFinite(options.fontSize) || options.fontSize < 8 || options.fontSize > 36) throw new ApiError(400, 'Font size must be between 8 and 36 points');
  if (!Number.isFinite(options.margin) || options.margin < 12 || options.margin > 120) throw new ApiError(400, 'Margin must be between 12 and 120 points');
  if (!Number.isFinite(options.lineSpacing) || options.lineSpacing < 1 || options.lineSpacing > 2.5) throw new ApiError(400, 'Line spacing must be between 1 and 2.5');
  if (!Number.isFinite(options.paragraphSpacing) || options.paragraphSpacing < 0 || options.paragraphSpacing > 36) throw new ApiError(400, 'Paragraph spacing must be between 0 and 36 points');
  for (const [name, color] of [['text color', options.color], ['highlight color', options.highlight], ['page background', options.backgroundColor]]) {
    if (!/^[\da-fA-F]{6}$/.test(color)) throw new ApiError(400, `Choose a valid ${name}`);
  }
  return options;
}

function toHex(color, fallback) {
  if (!color || typeof color !== 'object') return fallback;
  return [color.red, color.green, color.blue]
    .map((channel) => Math.round(Math.max(0, Math.min(1, channel)) * 255).toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
}

function fontFamily(value) {
  if (/times/i.test(value || '')) return 'Times New Roman';
  if (/courier/i.test(value || '')) return 'Courier New';
  return 'Arial';
}

function makeRun(run, fallbackColor) {
  const style = run.style;
  const color = toHex(style.color, fallbackColor);
  const shading = style.highlight ? { type: ShadingType.CLEAR, fill: toHex(style.highlight, fallbackColor) } : undefined;
  const common = {
    font: fontFamily(style.font),
    size: Math.round(style.size * 2),
    color,
    bold: Boolean(style.bold),
    italics: Boolean(style.italic),
    superScript: Boolean(style.superscript),
    subScript: Boolean(style.subscript),
    underline: style.underline ? { type: UnderlineType.SINGLE, color } : undefined,
    strike: Boolean(style.strike),
    shading
  };
  return run.text.split('\n').map((text, index) => new TextRun({ ...common, text, break: index ? 1 : undefined }));
}

export async function richTextToDocument(html, rawOptions = {}) {
  const options = parseOptions(rawOptions);
  const color = options.color.toUpperCase();
  const background = options.backgroundColor.toUpperCase();
  const blocks = parseRichText(
    html,
    { font: options.font, fontSize: options.fontSize, align: options.align },
    rgb(parseInt(color.slice(0, 2), 16) / 255, parseInt(color.slice(2, 4), 16) / 255, parseInt(color.slice(4, 6), 16) / 255)
  );
  if (!blocks.some((block) => block.runs.some((run) => run.text.trim()))) throw new ApiError(400, 'Enter some text to create a document');

  let [width, height] = sizes[options.pageSize];
  if (options.orientation === 'landscape') [width, height] = [height, width];
  const alignment = { left: AlignmentType.LEFT, center: AlignmentType.CENTER, right: AlignmentType.RIGHT, justify: AlignmentType.JUSTIFIED };
  const paragraphSpacing = Math.round(options.paragraphSpacing * 20);
  const lineSpacing = Math.round(options.lineSpacing * 240);
  const children = blocks.map((block) => new Paragraph({
    alignment: alignment[block.align] || alignment[options.align],
    bidirectional: textDirection(block.runs.map((run) => run.text).join('')) === 'rtl' || undefined,
    indent: block.indent ? { left: Math.round(block.indent * 20) } : undefined,
    pageBreakBefore: Boolean(block.pageBreakBefore),
    border: block.horizontalRule ? { bottom: { style: BorderStyle.SINGLE, size: 6, color } } : undefined,
    includeIfEmpty: Boolean(block.pageBreakBefore || block.horizontalRule),
    spacing: { after: paragraphSpacing, line: lineSpacing, lineRule: LineRuleType.AUTO },
    children: block.horizontalRule ? [new TextRun({ text: ' ', font: 'Arial', size: 2, color })] : block.runs.flatMap((run) => makeRun(run, color))
  }));
  const footer = options.pageNumbers ? new Footer({
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: 'Page ', font: 'Arial', size: 18, color }), PageNumber.CURRENT]
    })]
  }) : undefined;

  try {
    const document = new Document({
      background: { color: background },
      styles: {
        default: {
          document: {
            paragraph: { spacing: { after: paragraphSpacing, line: lineSpacing, lineRule: LineRuleType.AUTO } },
            run: { font: fontFamily(options.font), size: Math.round(options.fontSize * 2), color }
          }
        }
      },
      sections: [{
        properties: {
          page: {
            size: { width, height, orientation: options.orientation === 'landscape' ? PageOrientation.LANDSCAPE : PageOrientation.PORTRAIT },
            margin: {
              top: Math.round(options.margin * 20),
              right: Math.round(options.margin * 20),
              bottom: Math.round(options.margin * 20),
              left: Math.round(options.margin * 20),
              header: 360,
              footer: Math.max(180, Math.round(options.margin * 10))
            }
          }
        },
        ...(footer ? { footers: { default: footer } } : {}),
        children
      }]
    });
    return await Packer.toBuffer(document);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(422, 'Could not create the Word document with these settings');
  }
}
