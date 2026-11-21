import { useEffect, useRef } from 'react';

const paperSizes = { a4: [595.28, 841.89], letter: [612, 792], legal: [612, 1008] };

export default function ScanPreviewCanvas({ imageUrl, options }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    let active = true;
    const image = new Image();
    image.onload = () => {
      if (!active || !canvasRef.current) return;
      let [pageWidth, pageHeight] = options.pageSize === 'original'
        ? [image.width, image.height]
        : paperSizes[options.pageSize] || paperSizes.a4;
      const landscape = options.orientation === 'landscape' || (options.orientation === 'auto' && image.width > image.height);
      if (options.pageSize !== 'original' && landscape !== (pageWidth > pageHeight)) [pageWidth, pageHeight] = [pageHeight, pageWidth];

      const canvas = canvasRef.current;
      const scale = Math.min(0.35, 270 / pageWidth, 300 / pageHeight);
      canvas.width = Math.max(1, Math.round(pageWidth * scale));
      canvas.height = Math.max(1, Math.round(pageHeight * scale));
      const context = canvas.getContext('2d');
      context.fillStyle = options.backgroundColor || '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);

      const margin = options.fit === 'fill' ? 0 : Math.min(Number(options.margin || 0), pageWidth / 2, pageHeight / 2);
      const innerWidth = pageWidth - margin * 2;
      const innerHeight = pageHeight - margin * 2;
      const fitScale = options.fit === 'fill'
        ? Math.max(innerWidth / image.width, innerHeight / image.height)
        : Math.min(innerWidth / image.width, innerHeight / image.height);
      const drawWidth = image.width * fitScale * scale;
      const drawHeight = image.height * fitScale * scale;
      const x = (canvas.width - drawWidth) / 2;
      const y = (canvas.height - drawHeight) / 2;

      if (options.fit === 'fill') {
        context.save();
        context.beginPath();
        context.rect(0, 0, canvas.width, canvas.height);
        context.clip();
        context.drawImage(image, x, y, drawWidth, drawHeight);
        context.restore();
      } else {
        context.drawImage(image, x, y, drawWidth, drawHeight);
      }
    };
    image.src = imageUrl;
    return () => { active = false; };
  }, [imageUrl, options]);

  return <canvas ref={canvasRef} className="scan-preview-canvas" aria-label="Preview of this PDF page"/>;
}
