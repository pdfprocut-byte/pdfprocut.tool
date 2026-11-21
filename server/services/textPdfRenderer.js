import { createCanvas, GlobalFonts, PDFDocument as CanvasPdfDocument } from '@napi-rs/canvas';
import { PDFDocument, StandardFontEmbedder, StandardFonts } from 'pdf-lib';
import { textDirection } from '../../shared/documentText.mjs';

const winAnsi = StandardFontEmbedder.for(StandardFonts.Helvetica).encoding;
const windowsFallbacks = new Set([
  'Segoe UI', 'Nirmala UI', 'Ebrima', 'Leelawadee UI', 'Microsoft Himalaya',
  'Microsoft YaHei', 'Microsoft JhengHei', 'Yu Gothic', 'Malgun Gothic', 'Mongolian Baiti',
  'Myanmar Text', 'Segoe UI Historic', 'Segoe UI Symbol', 'Segoe UI Emoji'
]);
const fallbackFamilies = GlobalFonts.families.map(({ family }) => family)
  .filter((family) => family.startsWith('Noto ') || windowsFallbacks.has(family))
  .map((family) => JSON.stringify(family))
  .join(', ');
const rtlFamily = GlobalFonts.has('Segoe UI') ? '"Segoe UI", ' : '';
function canUseStandardFont(text) {
  for (const character of text) {
    if (character === '\n' || character === '\r') continue;
    if (!winAnsi.canEncodeUnicodeCodePoint(character.codePointAt(0))) return false;
  }
  return true;
}

function applyTextStyle(context, value, name, size) {
  const [family, generic] = name.startsWith('Times') ? ['"Times New Roman"', 'serif']
    : name.startsWith('Courier') ? ['"Courier New"', 'monospace']
      : ['Arial', 'sans-serif'];
  context.direction = textDirection(value);
  const primary = context.direction === 'rtl' ? rtlFamily + family : family;
  const families = [primary, fallbackFamilies, generic].filter(Boolean).join(', ');
  const weight = /bold/i.test(name) ? 'bold ' : '';
  const slant = /italic|oblique/i.test(name) ? 'italic ' : '';
  context.font = `${slant}${weight}${size}px ${families}`;
}

const cssColor = ({ red, green, blue }) => `rgb(${[red, green, blue].map((value) => Math.round(value * 255)).join(', ')})`;

function canvasDocument() {
  const pages = [];
  const measure = createCanvas(1, 1).getContext('2d');
  return {
    embedFont(name) {
      return {
        name,
        widthOfTextAtSize(value, size) {
          applyTextStyle(measure, value, name, size);
          return measure.measureText(value).width;
        }
      };
    },
    addPage([width, height]) {
      const operations = [];
      const page = {
        drawRectangle(rect) {
          operations.push((context) => {
            context.fillStyle = cssColor(rect.color);
            context.fillRect(rect.x, height - rect.y - rect.height, rect.width, rect.height);
          });
        },
        drawText(value, { x, y, size, font, color }) {
          operations.push((context) => {
            applyTextStyle(context, value, font.name, size);
            context.textAlign = 'left';
            context.fillStyle = cssColor(color);
            context.fillText(value, x, height - y);
          });
        },
        drawLine({ start, end, thickness, color }) {
          operations.push((context) => {
            context.beginPath();
            context.strokeStyle = cssColor(color);
            context.lineWidth = thickness;
            context.moveTo(start.x, height - start.y);
            context.lineTo(end.x, height - end.y);
            context.stroke();
          });
        }
      };
      pages.push({ width, height, operations, page });
      return page;
    },
    getPages() {
      return pages.map(({ page }) => page);
    },
    save() {
      const document = new CanvasPdfDocument({ creator: 'PDFPro' });
      for (const { width, height, operations } of pages) {
        const context = document.beginPage(width, height);
        for (const draw of operations) draw(context);
        document.endPage();
      }
      return document.close();
    }
  };
}

export async function createTextPdfDocument(texts) {
  const unicode = texts.some((text) => !canUseStandardFont(text));
  const document = unicode ? canvasDocument() : await PDFDocument.create();
  return { document, unicode };
}
