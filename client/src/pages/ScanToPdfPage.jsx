import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import FileUploader from '../components/pdf/FileUploader.jsx';
import ScanPreviewCanvas from '../components/pdf/ScanPreviewCanvas.jsx';
import { DownloadResultModal, OperationProgressModal } from '../components/pdf/FileOperationModals.jsx';
import '../styles/scanToPdf.css';
import { createMergeDownloadName } from '../utils/downloadName.js';
import { useBrowserDraft } from '../lib/browserDraft.js';

export function ScanImageCard({ item, index, count, options, onRemove, onMove, onDragStart, onDrop }) {
  const [imageUrl, setImageUrl] = useState('');

  useEffect(() => {
    const url = URL.createObjectURL(item.file);
    setImageUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [item.file]);

  return <article className="scan-image-card" draggable onDragStart={(event) => onDragStart(event, item.id)} onDragOver={(event) => event.preventDefault()} onDrop={(event) => onDrop(event, item.id)}>
    <div className="scan-image-preview">{imageUrl && <ScanPreviewCanvas imageUrl={imageUrl} options={options}/>}</div>
    <strong title={item.file.name}>{item.file.name}</strong>
    <div className="scan-image-controls">
      <label>Page<input type="number" min="1" max={count} value={index + 1} onChange={(event) => onMove(index, Number(event.target.value) - 1)} aria-label={`Page order for ${item.file.name}`}/></label>
      <button type="button" onClick={() => onMove(index, index - 1)} disabled={index === 0} aria-label={`Move ${item.file.name} earlier`}>↑</button>
      <button type="button" onClick={() => onMove(index, index + 1)} disabled={index === count - 1} aria-label={`Move ${item.file.name} later`}>↓</button>
      <button type="button" className="scan-remove-image" onClick={() => onRemove(item.id)}>Remove</button>
    </div>
  </article>;
}

export default function ScanToPdfPage({ tool }) {
  const [images, setImages] = useState([]);
  const [pageSize, setPageSize] = useState('a4');
  const [orientation, setOrientation] = useState('auto');
  const [fit, setFit] = useState('contain');
  const [margin, setMargin] = useState('24');
  const [backgroundColor, setBackgroundColor] = useState('#ffffff');
  const [draggingId, setDraggingId] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const nextId = useRef(1);
  const draft = { state: { imageIds: images.map((item) => item.id), pageSize, orientation, fit, margin, backgroundColor }, files: images.map((item) => item.file), signature: null };
  const { ready: draftReady, status: draftStatus } = useBrowserDraft(`tool:${tool.slug}`, draft, (saved) => {
    const imageIds = saved.state?.imageIds || [];
    setImages((saved.files || []).map((file, index) => ({ id: imageIds[index] || String(index + 1), file })));
    nextId.current = Math.max(0, ...imageIds.map((id) => Number(id) || 0)) + 1;
    if (saved.state?.pageSize) setPageSize(saved.state.pageSize);
    if (saved.state?.orientation) setOrientation(saved.state.orientation);
    if (saved.state?.fit) setFit(saved.state.fit);
    if (saved.state?.margin) setMargin(saved.state.margin);
    if (saved.state?.backgroundColor) setBackgroundColor(saved.state.backgroundColor);
  });

  const update = (setter, value) => {
    setter(value);
    setResult(null);
  };

  const addImages = (files) => {
    const remaining = 20 - images.length;
    if (files.length > remaining) toast.error('You can add up to 20 images');
    const accepted = files.slice(0, Math.max(0, remaining)).filter((file) => ['image/png', 'image/jpeg'].includes(file.type));
    if (!accepted.length) return;
    setImages((current) => [...current, ...accepted.map((file) => ({ id: String(nextId.current++), file }))]);
    setResult(null);
  };

  const moveImage = (fromIndex, toIndex) => {
    setImages((current) => {
      if (!Number.isInteger(toIndex) || toIndex < 0 || toIndex >= current.length || fromIndex < 0 || fromIndex >= current.length) return current;
      const next = [...current];
      const [item] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, item);
      return next;
    });
    setResult(null);
  };

  const reorderById = (sourceId, targetId) => {
    setImages((current) => {
      const sourceIndex = current.findIndex((item) => item.id === sourceId);
      const targetIndex = current.findIndex((item) => item.id === targetId);
      if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return current;
      const next = [...current];
      const [item] = next.splice(sourceIndex, 1);
      next.splice(next.findIndex((entry) => entry.id === targetId), 0, item);
      return next;
    });
    setResult(null);
  };

  const removeImage = (id) => {
    setImages((current) => current.filter((item) => item.id !== id));
    setResult(null);
  };

  const onDrop = (event, targetId) => {
    event.preventDefault();
    const sourceId = event.dataTransfer.getData('text/plain');
    if (sourceId) reorderById(sourceId, targetId);
    setDraggingId('');
  };

  if (!draftReady) return <main className="container py-5 scan-to-pdf-page"><p className="small text-secondary">Restoring your saved work…</p></main>;

  const createPdf = async () => {
    if (!images.length) return toast.error('Select at least one JPG or PNG image');
    setBusy(true);
    setResult(null);
    try {
      const body = new FormData();
      images.forEach((item) => body.append('files', item.file));
      body.append('options', JSON.stringify({ pageSize, orientation, fit, margin, backgroundColor }));
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/pdf/${tool.endpoint}`, { method: 'POST', body, credentials: 'include' });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw Error(error.error || 'Could not create the PDF');
      }
      setResult(URL.createObjectURL(await response.blob()));
      toast.success('PDF created');
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusy(false);
    }
  };

  const previewOptions = { pageSize, orientation, fit, margin, backgroundColor };

  return <main className="container py-5 scan-page">
    <Link to="/tools" className="back">All tools</Link>
    <h2>{tool.name}</h2>
    <p className="lead">{tool.endpoint === 'convert-to-pdf' ? 'Arrange images and choose how each image page should look in your PDF.' : 'Arrange image pages and choose the PDF page layout.'}</p>
    {draftStatus && <p className={`small ${draftStatus === 'Autosave unavailable' ? 'text-warning' : 'text-success'}`} role="status">{draftStatus}</p>}
    <FileUploader tool={tool} onFiles={addImages}/>

    <div className="scan-workspace">
      <section className="scan-pages-panel">
        <div className="scan-panel-heading"><h2>PDF pages <span>{images.length}</span></h2><small>Drag pages, change their number, or remove one.</small></div>
        {!images.length && <div className="scan-empty">Add JPG or PNG images to see the pages here.</div>}
        <div className="scan-pages-grid">
          {images.map((item, index) => <ScanImageCard key={item.id} item={item} index={index} count={images.length} options={previewOptions} onMove={moveImage} onRemove={removeImage} onDragStart={(event, id) => { event.dataTransfer.setData('text/plain', id); setDraggingId(id); }} onDrop={onDrop}/>) }
        </div>
        {draggingId && <small className="scan-drag-hint">Drop on another page to change the order.</small>}
      </section>

      <aside className="scan-settings-panel">
        <section className="scan-options">
          <h2>Page settings</h2>
          <label>Paper size<select className="form-select" value={pageSize} onChange={(event) => update(setPageSize, event.target.value)}><option value="a4">A4</option><option value="letter">US Letter</option><option value="legal">US Legal</option><option value="original">Original image size</option></select></label>
          <label>Orientation<select className="form-select" value={orientation} disabled={pageSize === 'original'} onChange={(event) => update(setOrientation, event.target.value)}><option value="auto">Match image</option><option value="portrait">Portrait</option><option value="landscape">Landscape</option></select></label>
          <label>Image fit<select className="form-select" value={fit} onChange={(event) => update(setFit, event.target.value)}><option value="contain">Fit image (keep all)</option><option value="fill">Fill page (crop edges)</option></select></label>
          <label>Margin <span>{fit === 'fill' ? '0' : margin} pt</span><input className="form-range" type="range" min="0" max="72" step="1" value={margin} disabled={fit === 'fill'} onChange={(event) => update(setMargin, event.target.value)}/></label>
          <label>Page background<span className="scan-color-control"><input type="color" value={backgroundColor} onChange={(event) => update(setBackgroundColor, event.target.value)}/><small>{backgroundColor.toUpperCase()}</small></span></label>
          <p className="scan-option-hint">Fill page may crop image edges. Fit image keeps the whole image and uses the selected background for empty space.</p>
        </section>
        <button className="btn btn-primary mt-4" onClick={createPdf} disabled={busy || !images.length}>{busy ? 'Processing...' : tool.endpoint === 'convert-to-pdf' ? 'Convert to PDF' : 'Create PDF'}</button>
        <OperationProgressModal show={busy} title="PDF Pro Cut is creating your PDF" description="Please wait while the image pages are assembled."/>
        <DownloadResultModal href={result} fileName={createMergeDownloadName(images.map((item) => item.file))} toolSlug={tool.slug} title="PDF Pro Cut created your PDF" downloadLabel="Download PDF" onClose={() => setResult(null)}/>
      </aside>
    </div>
  </main>;
}
