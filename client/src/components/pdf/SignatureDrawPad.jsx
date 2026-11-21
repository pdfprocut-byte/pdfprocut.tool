import { useRef, useState } from 'react';
import '../../styles/signaturePlacement.css';

const canvasWidth = 1400;
const canvasHeight = 420;

function cropSignature(canvas) {
  const context = canvas.getContext('2d', { willReadFrequently: true });
  const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
  let left = canvas.width;
  let top = canvas.height;
  let right = -1;
  let bottom = -1;

  for (let y = 0; y < canvas.height; y += 1) {
    for (let x = 0; x < canvas.width; x += 1) {
      if (data[(y * canvas.width + x) * 4 + 3] > 8) {
        left = Math.min(left, x);
        top = Math.min(top, y);
        right = Math.max(right, x);
        bottom = Math.max(bottom, y);
      }
    }
  }

  if (right < left || bottom < top) return null;
  const padding = 28;
  left = Math.max(0, left - padding);
  top = Math.max(0, top - padding);
  right = Math.min(canvas.width - 1, right + padding);
  bottom = Math.min(canvas.height - 1, bottom + padding);
  const output = document.createElement('canvas');
  output.width = right - left + 1;
  output.height = bottom - top + 1;
  output.getContext('2d').drawImage(canvas, left, top, output.width, output.height, 0, 0, output.width, output.height);
  return output;
}

export default function SignatureDrawPad({ onUseSignature }) {
  const canvasRef = useRef(null);
  const drawingRef = useRef(false);
  const previousPointRef = useRef(null);
  const [color, setColor] = useState('#202124');
  const [hasInk, setHasInk] = useState(false);
  const [message, setMessage] = useState('');

  const pointFromEvent = (event) => {
    const canvas = canvasRef.current;
    const bounds = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - bounds.left) / bounds.width * canvas.width,
      y: (event.clientY - bounds.top) / bounds.height * canvas.height
    };
  };

  const startDrawing = (event) => {
    if (event.button !== undefined && event.button !== 0) return;
    event.preventDefault();
    const canvas = canvasRef.current;
    canvas.setPointerCapture(event.pointerId);
    drawingRef.current = true;
    previousPointRef.current = pointFromEvent(event);
    setMessage('');
  };

  const draw = (event) => {
    if (!drawingRef.current) return;
    event.preventDefault();
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    const point = pointFromEvent(event);
    const previous = previousPointRef.current;
    context.strokeStyle = color;
    context.lineWidth = 6;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.beginPath();
    context.moveTo(previous.x, previous.y);
    context.lineTo(point.x, point.y);
    context.stroke();
    previousPointRef.current = point;
    setHasInk(true);
  };

  const stopDrawing = (event) => {
    drawingRef.current = false;
    previousPointRef.current = null;
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const clear = () => {
    const canvas = canvasRef.current;
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    setHasInk(false);
    setMessage('');
  };

  const useSignature = () => {
    const trimmed = cropSignature(canvasRef.current);
    if (!trimmed) {
      setMessage('Draw your signature before using it.');
      return;
    }
    trimmed.toBlob((blob) => {
      if (!blob) {
        setMessage('Could not create the signature image. Please try again.');
        return;
      }
      onUseSignature(new File([blob], 'drawn-signature.png', { type: 'image/png' }));
    }, 'image/png');
  };

  return <section className="signature-draw-pad" aria-label="Draw your signature">
    <div className="signature-draw-tools">
      <label className="signature-draw-color">Pen color<input type="color" value={color} onChange={(event) => setColor(event.target.value)} aria-label="Signature pen color"/></label>
      <button type="button" className="signature-draw-clear" onClick={clear} disabled={!hasInk}>Clear</button>
      <button type="button" className="signature-draw-use" onClick={useSignature}>Use this signature</button>
    </div>
    <canvas ref={canvasRef} className="signature-draw-canvas" width={canvasWidth} height={canvasHeight} onPointerDown={startDrawing} onPointerMove={draw} onPointerUp={stopDrawing} onPointerCancel={stopDrawing} aria-label="Draw signature here"/>
    <small>Draw with your mouse, touch screen, or stylus. Choose a pen color before drawing each stroke.</small>
    {message && <small className="signature-draw-message" role="status">{message}</small>}
  </section>;
}
