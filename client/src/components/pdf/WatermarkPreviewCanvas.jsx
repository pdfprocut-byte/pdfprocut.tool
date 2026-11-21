import { useEffect, useRef } from 'react';

export default function WatermarkPreviewCanvas({ page, options }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    let active = true;
    const original = new Image();
    original.onload = () => {
      if (!active || !canvasRef.current) return;
      const canvas = canvasRef.current;
      canvas.width = page.width;
      canvas.height = page.height;
      const context = canvas.getContext('2d');
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(original, 0, 0, canvas.width, canvas.height);

      const label = String(options.text || '').trim().slice(0, 120);
      const fontSize = Math.max(1, Number(options.fontSize || 48) * page.scale);
      const fontName = options.font || 'HelveticaBold';
      const family = fontName.startsWith('Times') ? '"Times New Roman", serif' : fontName.startsWith('Courier') ? '"Courier New", monospace' : 'Arial, sans-serif';
      const bold = fontName.includes('Bold');
      const italic = fontName.includes('Italic') || fontName.includes('Oblique');
      const rotation = Number(options.rotation || 0) * Math.PI / 180;
      const opacity = Math.max(0, Math.min(1, Number(options.opacity ?? 0.25)));
      const layout = options.layout || 'center';

      if (options.kind === 'pageNumbers') {
        const startPage = Number(options.startPage || 1);
        if (page.number >= startPage) {
          const start = Number(options.start || 1);
          const number = start + page.number - startPage;
          const total = start + page.totalPages - startPage;
          const format = options.format || 'number';
          const label = format === 'page-number' ? `Page ${number}`
            : format === 'number-of-total' ? `${number} of ${total}`
              : format === 'page-of-total' ? `Page ${number} of ${total}`
                : String(number);
          context.save();
          context.globalAlpha = opacity;
          context.fillStyle = options.color || '#333333';
          context.textBaseline = 'alphabetic';
          context.font = `${italic ? 'italic ' : ''}${bold ? 'bold ' : ''}${fontSize}px ${family}`;
          const textWidth = context.measureText(label).width;
          const [vertical, horizontal] = String(options.position || 'bottom-center').split('-');
          const margin = Math.max(0, Number(options.margin ?? 24)) * page.scale;
          const x = horizontal === 'left' ? margin : horizontal === 'right' ? canvas.width - margin - textWidth : (canvas.width - textWidth) / 2;
          const y = vertical === 'top' ? margin + fontSize : canvas.height - margin;
          context.fillText(label, x, y);
          context.restore();
        }
        return;
      }

      if (label) {
        context.save();
        context.globalAlpha = opacity;
        context.fillStyle = options.color || '#cc1f36';
        context.textBaseline = 'alphabetic';
        context.font = `${italic ? 'italic ' : ''}${bold ? 'bold ' : ''}${fontSize}px ${family}`;
        const textWidth = context.measureText(label).width;
        const drawText = (x, y) => {
          context.save();
          context.translate(x, y);
          context.rotate(rotation);
          context.fillText(label, 0, 0);
          context.restore();
        };
        if (layout === 'bottom-right') {
          drawText(Math.max(4, canvas.width - textWidth - 8), canvas.height - 8);
        } else if (layout === 'tiled') {
          const stepX = Math.max(textWidth + fontSize * 2, 28);
          const stepY = Math.max(fontSize * 3, 17);
          const columns = Math.min(24, Math.ceil(canvas.width / stepX) + 1);
          const rows = Math.min(24, Math.ceil(canvas.height / stepY) + 1);
          for (let row = 0; row < rows; row++) {
            for (let column = 0; column < columns; column++) drawText(column * stepX + 4, row * stepY + fontSize);
          }
        } else {
          drawText((canvas.width - textWidth) / 2, (canvas.height + fontSize) / 2);
        }
        context.restore();
      }

      if (options.imageUrl) {
        const watermarkImage = new Image();
        watermarkImage.onload = () => {
          if (!active || !canvasRef.current) return;
          const maxSize = Math.max(10, Math.min(70, Number(options.imageSize || 30))) / 100;
          const scale = Math.min((canvas.width * maxSize) / watermarkImage.width, (canvas.height * maxSize) / watermarkImage.height);
          const imageWidth = watermarkImage.width * scale;
          const imageHeight = watermarkImage.height * scale;
          const drawImage = (x, y) => {
            context.save();
            context.globalAlpha = opacity;
            context.translate(x + imageWidth / 2, y + imageHeight / 2);
            context.rotate(rotation);
            context.drawImage(watermarkImage, -imageWidth / 2, -imageHeight / 2, imageWidth, imageHeight);
            context.restore();
          };
          if (layout === 'bottom-right') {
            drawImage(canvas.width - imageWidth - 8, canvas.height - imageHeight - 8);
          } else if (layout === 'tiled') {
            const stepX = imageWidth * 1.8;
            const stepY = imageHeight * 1.8;
            const columns = Math.min(12, Math.ceil(canvas.width / stepX));
            const rows = Math.min(12, Math.ceil(canvas.height / stepY));
            for (let row = 0; row < rows; row++) {
              for (let column = 0; column < columns; column++) drawImage(column * stepX, row * stepY);
            }
          } else {
            drawImage((canvas.width - imageWidth) / 2, (canvas.height - imageHeight) / 2);
          }
        };
        watermarkImage.src = options.imageUrl;
      }
    };
    original.src = page.image;
    return () => { active = false; };
  }, [page, options]);

  return <canvas ref={canvasRef} className="watermark-preview-canvas" aria-label={`Watermarked preview of page ${page.number}`}/>;
}
