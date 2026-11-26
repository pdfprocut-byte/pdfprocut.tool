import { useEffect, useMemo, useRef, useState } from 'react';
import { FaRedoAlt } from 'react-icons/fa';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import '../../styles/signaturePlacement.css';

GlobalWorkerOptions.workerSrc = workerUrl;

export default function SignaturePlacementPreview({ pdfFile, signatureFile, pageNumber, widthPercent, rotation = '0', opacity = '100', frameWidth = '0', frameColor = '#d9273d', textItems = [], activeLayer = 'image', activeTextId, xPercent, yPercent, onPositionChange, onRotationChange, onTextPositionChange, onTextSelect, onActiveLayerChange, onPageCount, placementLabel = 'signature', controls }) {
  const [pagePreview, setPagePreview] = useState(null);
  const [signatureUrl, setSignatureUrl] = useState('');
  const [error, setError] = useState('');
  const [signatureAspect, setSignatureAspect] = useState(3);
  const previewRef = useRef(null);
  const textPreviewRefs = useRef(new Map());
  const dragRef = useRef(null);
  const textDragRef = useRef(null);
  const rotateRef = useRef(null);
  const fileKey = useMemo(() => `${pdfFile?.name}-${pdfFile?.lastModified}-${pageNumber}`, [pdfFile, pageNumber]);
  const rotationAngle = ((Number(rotation) || 0) % 360 + 360) % 360;
  const radians = rotationAngle * Math.PI / 180;
  const absCos = Math.abs(Math.cos(radians));
  const absSin = Math.abs(Math.sin(radians));
  const rotatedNaturalWidth = absCos * signatureAspect + absSin;
  const rotatedNaturalHeight = absSin * signatureAspect + absCos;
  const getDisplayBox = (angle) => {
    if (!pagePreview) return { width: Number(widthPercent) || 22, height: 0 };
    const angleRadians = angle * Math.PI / 180;
    const cos = Math.abs(Math.cos(angleRadians));
    const sin = Math.abs(Math.sin(angleRadians));
    const boxAspect = (cos * signatureAspect + sin) / (sin * signatureAspect + cos);
    const horizontalMargin = Math.min(36, pagePreview.width / 20);
    const verticalMargin = Math.min(36, pagePreview.height / 20);
    const widthLimit = (pagePreview.width - horizontalMargin * 2) / pagePreview.width * 100;
    const heightLimit = (pagePreview.height - verticalMargin * 2) * boxAspect / pagePreview.width * 100;
    const boxWidth = Math.max(1, Math.min(Number(widthPercent) || 22, widthLimit, heightLimit));
    return { width: boxWidth, height: boxWidth * pagePreview.width / pagePreview.height / boxAspect };
  };
  const displayBox = useMemo(() => getDisplayBox(rotationAngle), [pagePreview, signatureAspect, widthPercent, rotationAngle]);
  const displayWidthPercent = displayBox.width;
  const displayHeightPercent = displayBox.height;

  useEffect(() => {
    if (!signatureFile) { setSignatureUrl(''); setSignatureAspect(3); return undefined; }
    const url = URL.createObjectURL(signatureFile);
    setSignatureUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [signatureFile]);

  useEffect(() => {
    let active = true;
    let loadingTask;
    let renderTask;
    const renderPage = async () => {
      setPagePreview(null);
      setError('');
      if (!pdfFile) return;
      try {
        const data = await pdfFile.arrayBuffer();
        if (!active) return;
        loadingTask = getDocument({ data });
        const document = await loadingTask.promise;
        if (!active) { await document.destroy(); return; }
        onPageCount?.(document.numPages);
        const safePageNumber = Math.min(Math.max(1, Number(pageNumber) || 1), document.numPages);
        const page = await document.getPage(safePageNumber);
        const baseViewport = page.getViewport({ scale: 1 });
        const maxWidth = Math.min(640, window.innerWidth - 64);
        const maxHeight = Math.min(760, window.innerHeight * 0.72);
        const scale = Math.min(maxWidth / baseViewport.width, maxHeight / baseViewport.height, 1.5);
        const displayViewport = page.getViewport({ scale });
        const pixelRatio = Math.min(Math.max(window.devicePixelRatio || 1, 2), 2.5);
        const renderViewport = page.getViewport({ scale: scale * pixelRatio });
        const canvas = window.document.createElement('canvas');
        canvas.width = Math.ceil(renderViewport.width);
        canvas.height = Math.ceil(renderViewport.height);
        renderTask = page.render({ canvasContext: canvas.getContext('2d'), viewport: renderViewport });
        await renderTask.promise;
        if (active) setPagePreview({ src: canvas.toDataURL('image/png'), width: displayViewport.width, height: displayViewport.height, scale, pageCount: document.numPages });
        canvas.width = 0;
        canvas.height = 0;
        await document.destroy();
      } catch {
        if (active) setError('Could not show this PDF page. It may be encrypted or damaged.');
      }
    };
    renderPage();
    return () => {
      active = false;
      renderTask?.cancel();
      loadingTask?.destroy().catch(() => {});
    };
  }, [pdfFile, signatureFile, pageNumber, fileKey]);

  const clampPosition = (left, top, boxWidth = displayWidthPercent, boxHeight = displayHeightPercent) => {
    const maxTop = Math.max(0, 100 - boxHeight);
    const maxLeft = Math.max(0, 100 - boxWidth);
    return {
      xPercent: String(Math.min(maxLeft, Math.max(0, left))),
      yPercent: String(Math.min(maxTop, Math.max(0, top)))
    };
  };

  const clampTextPosition = (id, left, top) => {
    const pageBounds = previewRef.current?.getBoundingClientRect();
    const textBounds = textPreviewRefs.current.get(id)?.getBoundingClientRect();
    const textWidth = pageBounds && textBounds ? textBounds.width / pageBounds.width * 100 : 0;
    const textHeight = pageBounds && textBounds ? textBounds.height / pageBounds.height * 100 : 0;
    return {
      xPercent: String(Math.min(Math.max(0, 100 - textWidth), Math.max(0, left))),
      yPercent: String(Math.min(Math.max(0, 100 - textHeight), Math.max(0, top)))
    };
  };

  useEffect(() => {
    if (!pagePreview) return;
    textItems.forEach((item) => {
      if (!item.text?.trim()) return;
      const next = clampTextPosition(item.id, Number(item.xPercent), Number(item.yPercent));
      if (next.xPercent !== String(item.xPercent) || next.yPercent !== String(item.yPercent)) onTextPositionChange(item.id, next);
    });
  }, [pagePreview, textItems]);

  const setRotationKeepingCenter = (value, centerX = Number(xPercent) + displayWidthPercent / 2, centerY = Number(yPercent) + displayHeightPercent / 2) => {
    const nextAngle = ((Number(value) % 360) + 360) % 360;
    if (pagePreview) {
      const nextBox = getDisplayBox(nextAngle);
      onPositionChange(clampPosition(centerX - nextBox.width / 2, centerY - nextBox.height / 2, nextBox.width, nextBox.height));
    }
    onRotationChange(String(Math.round(nextAngle * 10) / 10));
  };

  useEffect(() => {
    if (!pagePreview) return;
    const next = clampPosition(Number(xPercent), Number(yPercent));
    if (next.xPercent !== String(xPercent) || next.yPercent !== String(yPercent)) onPositionChange(next);
  }, [pagePreview, displayWidthPercent, displayHeightPercent]);

  const placeAtPointer = (event, centerSignature) => {
    const bounds = previewRef.current?.getBoundingClientRect();
    if (!bounds) return;
    const pointX = (event.clientX - bounds.left) / bounds.width * 100;
    const pointY = (event.clientY - bounds.top) / bounds.height * 100;
    const next = clampPosition(pointX - (centerSignature ? displayWidthPercent / 2 : 0), pointY - (centerSignature ? displayHeightPercent / 2 : 0));
    onPositionChange(next);
  };

  const placeTextAtPointer = (event) => {
    const pageBounds = previewRef.current?.getBoundingClientRect();
    if (!pageBounds) return;
    const item = textItems.find((current) => current.id === activeTextId);
    if (!item) return;
    const textBounds = textPreviewRefs.current.get(item.id)?.getBoundingClientRect();
    const textWidth = textBounds?.width || 0;
    const textHeight = textBounds?.height || 0;
    const left = (event.clientX - pageBounds.left - textWidth / 2) / pageBounds.width * 100;
    const top = (event.clientY - pageBounds.top - textHeight / 2) / pageBounds.height * 100;
    onTextPositionChange(item.id, clampTextPosition(item.id, left, top));
  };

  const onCanvasClick = (event) => {
    if (dragRef.current) return;
    if (activeLayer === 'text' && textItems.some((item) => item.id === activeTextId && item.text?.trim())) { placeTextAtPointer(event); return; }
    if (signatureFile) placeAtPointer(event, true);
  };

  const onSignaturePointerDown = (event) => {
    event.preventDefault();
    event.stopPropagation();
    dragRef.current = { startX: event.clientX, startY: event.clientY, x: Number(xPercent), y: Number(yPercent) };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onSignaturePointerMove = (event) => {
    if (!dragRef.current) return;
    const bounds = previewRef.current?.getBoundingClientRect();
    if (!bounds) return;
    const left = dragRef.current.x + (event.clientX - dragRef.current.startX) / bounds.width * 100;
    const top = dragRef.current.y + (event.clientY - dragRef.current.startY) / bounds.height * 100;
    onPositionChange(clampPosition(left, top));
  };

  const onSignaturePointerUp = () => { dragRef.current = null; };

  const onTextPointerDown = (event, item) => {
    event.preventDefault();
    event.stopPropagation();
    onTextSelect(item.id);
    textDragRef.current = { id: item.id, startX: event.clientX, startY: event.clientY, x: Number(item.xPercent), y: Number(item.yPercent) };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onTextPointerMove = (event) => {
    if (!textDragRef.current) return;
    const bounds = previewRef.current?.getBoundingClientRect();
    if (!bounds) return;
    const left = textDragRef.current.x + (event.clientX - textDragRef.current.startX) / bounds.width * 100;
    const top = textDragRef.current.y + (event.clientY - textDragRef.current.startY) / bounds.height * 100;
    onTextPositionChange(textDragRef.current.id, clampTextPosition(textDragRef.current.id, left, top));
  };

  const onTextPointerUp = () => { textDragRef.current = null; };

  const onRotatePointerDown = (event) => {
    event.preventDefault();
    event.stopPropagation();
    const overlayBounds = event.currentTarget.parentElement.getBoundingClientRect();
    const centerX = overlayBounds.left + overlayBounds.width / 2;
    const centerY = overlayBounds.top + overlayBounds.height / 2;
    rotateRef.current = {
      centerX,
      centerY,
      startAngle: Math.atan2(event.clientY - centerY, event.clientX - centerX) * 180 / Math.PI,
      startingRotation: rotationAngle
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onRotatePointerMove = (event) => {
    if (!rotateRef.current) return;
    const pointerAngle = Math.atan2(event.clientY - rotateRef.current.centerY, event.clientX - rotateRef.current.centerX) * 180 / Math.PI;
    let delta = pointerAngle - rotateRef.current.startAngle;
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;
    const nextAngle = Math.round(((rotateRef.current.startingRotation + delta) % 360 + 360) % 360 * 10) / 10;
    const pageBounds = previewRef.current?.getBoundingClientRect();
    if (pageBounds) {
      const centerX = (rotateRef.current.centerX - pageBounds.left) / pageBounds.width * 100;
      const centerY = (rotateRef.current.centerY - pageBounds.top) / pageBounds.height * 100;
      setRotationKeepingCenter(nextAngle, centerX, centerY);
    } else {
      onRotationChange(String(nextAngle));
    }
  };

  const onRotatePointerUp = () => { rotateRef.current = null; };

  const onSignatureKeyDown = (event) => {
    const step = event.shiftKey ? 5 : 1;
    let left = Number(xPercent);
    let top = Number(yPercent);
    if (event.key === 'ArrowLeft') left -= step;
    else if (event.key === 'ArrowRight') left += step;
    else if (event.key === 'ArrowUp') top -= step;
    else if (event.key === 'ArrowDown') top += step;
    else return;
    event.preventDefault();
    onPositionChange(clampPosition(left, top));
  };

  return <section className="signature-placement-section">
    <div className="signature-placement-heading"><div><h3>Choose {placementLabel} position</h3><p>Select an image or text layer in the side tools, then click the page or drag the layer. The red handle rotates images.</p></div><span>Page {pageNumber || 1}{pagePreview ? ` of ${pagePreview.pageCount}` : ''} · {rotationAngle.toFixed(1)}°</span></div>
    <div className="signature-placement-layout">
      <div className="signature-placement-main">
        {error && <p className="signature-placement-error" role="alert">{error}</p>}
        {!error && !pagePreview && <div className="signature-placement-loading"><span/>Loading page preview…</div>}
        {pagePreview && <div className="signature-placement-workspace">
          <div className="signature-placement-page" ref={previewRef} style={{ aspectRatio: `${pagePreview.width} / ${pagePreview.height}` }} onClick={onCanvasClick}>
            <img className="signature-placement-pdf-page" src={pagePreview.src} alt={`PDF page ${pageNumber} preview`}/>
            {signatureFile && <div className="signature-placement-stamp" style={{ left: `${xPercent}%`, top: `${yPercent}%`, width: `${displayWidthPercent}%`, height: `${displayHeightPercent}%` }} onClick={(event) => event.stopPropagation()} onPointerDown={onSignaturePointerDown} onPointerMove={onSignaturePointerMove} onPointerUp={onSignaturePointerUp} onPointerCancel={onSignaturePointerUp} onKeyDown={onSignatureKeyDown} role="button" tabIndex={0} aria-label={`Drag to position your ${placementLabel}; use arrow keys to adjust`}>
              <img src={signatureUrl} alt={`${placementLabel} placement preview`} style={{ width: `${signatureAspect / rotatedNaturalWidth * 100}%`, height: `${1 / rotatedNaturalHeight * 100}%`, transform: `translate(-50%, -50%) rotate(${rotationAngle}deg)`, opacity: Number(opacity) / 100, border: Number(frameWidth) > 0 ? `${Number(frameWidth) * pagePreview.scale}px solid ${frameColor}` : 'none', boxSizing: 'border-box' }} onClick={(event) => event.stopPropagation()} onLoad={(event) => setSignatureAspect(event.currentTarget.naturalWidth / event.currentTarget.naturalHeight || 3)}/>
              <button type="button" className="signature-rotate-handle" aria-label="Drag to rotate image" title="Drag to rotate" onClick={(event) => event.stopPropagation()} onPointerDown={onRotatePointerDown} onPointerMove={onRotatePointerMove} onPointerUp={onRotatePointerUp} onPointerCancel={onRotatePointerUp}><FaRedoAlt/></button>
            </div>}
            {textItems.filter((item) => item.text?.trim()).map((item) => <div key={item.id} ref={(element) => { if (element) textPreviewRefs.current.set(item.id, element); else textPreviewRefs.current.delete(item.id); }} className={`signature-text-placement ${activeLayer === 'text' && activeTextId === item.id ? 'active' : ''}`} style={{ left: `${item.xPercent}%`, top: `${item.yPercent}%`, maxWidth: `${Math.max(1, 100 - Number(item.xPercent || 0))}%`, color: item.color, fontSize: `${Number(item.size || 18) * pagePreview.scale}px`, fontFamily: String(item.font || '').startsWith('TimesRoman') ? 'Georgia, serif' : String(item.font || '').startsWith('Courier') ? 'Courier New, monospace' : 'Arial, sans-serif', fontWeight: /Bold/.test(item.font || '') ? 700 : 400, fontStyle: /Italic|Oblique/.test(item.font || '') ? 'italic' : 'normal' }} onClick={(event) => event.stopPropagation()} onPointerDown={(event) => onTextPointerDown(event, item)} onPointerMove={onTextPointerMove} onPointerUp={onTextPointerUp} onPointerCancel={onTextPointerUp} role="button" tabIndex={0} aria-label={`Drag to position text ${item.id}`}>
              {item.text}
            </div>)}
          </div>
        </div>}
      </div>
      {controls && <aside className="signature-placement-tools">{typeof controls === 'function' ? controls({ changeRotation: setRotationKeepingCenter, setActiveLayer: onActiveLayerChange }) : controls}</aside>}
    </div>
  </section>;
}
