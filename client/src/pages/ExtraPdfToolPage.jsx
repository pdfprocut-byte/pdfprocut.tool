import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useProfile } from '../context/ProfileContext.jsx';
import FileUploader from '../components/pdf/FileUploader.jsx';
import { DownloadResultModal, OperationProgressModal } from '../components/pdf/FileOperationModals.jsx';
import { createDownloadName } from '../utils/downloadName.js';
import UploadedFileList from '../components/pdf/UploadedFileList.jsx';
import SignaturePlacementPreview from '../components/pdf/SignaturePlacementPreview.jsx';
import SignatureDrawPad from '../components/pdf/SignatureDrawPad.jsx';
import { useBrowserDraft } from '../lib/browserDraft.js';
import '../styles/extractImages.css';

const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export default function ExtraPdfToolPage({ tool }) {
  const { recordOperation } = useProfile();
  const [files, setFiles] = useState([]);
  const [signature, setSignature] = useState(null);
  const [signatureMode, setSignatureMode] = useState('upload');
  const [password, setPassword] = useState('');
  const [redactionTerms, setRedactionTerms] = useState('');
  const [html, setHtml] = useState('<h1>Document title</h1><p>Paste or edit basic HTML content here.</p>');
  const [formFields, setFormFields] = useState([]);
  const [formValues, setFormValues] = useState({});
  const [fieldsLoading, setFieldsLoading] = useState(false);
  const [crop, setCrop] = useState({ left: '0', right: '0', top: '0', bottom: '0', pages: '' });
  const [editOptions, setEditOptions] = useState({ text: '', page: '1', x: '48', y: '48', size: '18', color: '#202124', font: 'Helvetica' });
  const [signOptions, setSignOptions] = useState({ page: '1', widthPercent: '22', xPercent: '68', yPercent: '82', rotation: '0', opacity: '100', frameWidth: '0', frameColor: '#d9273d' });
  const [signPageCount, setSignPageCount] = useState(0);
  const [activeSignLayer, setActiveSignLayer] = useState('image');
  const [textItems, setTextItems] = useState([]);
  const [activeTextId, setActiveTextId] = useState('');
  const [jpegQuality, setJpegQuality] = useState('88');
  const [imageFormat, setImageFormat] = useState(tool.endpoint === 'to-png' ? 'png' : 'jpg');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [embeddedImages, setEmbeddedImages] = useState([]);
  const [selectedImageIds, setSelectedImageIds] = useState(new Set());
  const [imagesLoading, setImagesLoading] = useState(false);
  const [imageInspectionError, setImageInspectionError] = useState('');

  const savedDraft = {
    state: { signatureMode, redactionTerms, html, formValues, crop, editOptions, signOptions, activeSignLayer, textItems, activeTextId, jpegQuality, imageFormat },
    files,
    signature
  };
  const { ready: draftReady, status: draftStatus } = useBrowserDraft(`tool:${tool.slug}`, savedDraft, (draft) => {
    const state = draft.state || {};
    setFiles(draft.files || []);
    setSignature(draft.signature || null);
    if (state.signatureMode) setSignatureMode(state.signatureMode);
    if (state.redactionTerms !== undefined) setRedactionTerms(state.redactionTerms);
    if (state.html !== undefined) setHtml(state.html);
    if (state.formValues) setFormValues(state.formValues);
    if (state.crop) setCrop(state.crop);
    if (state.editOptions) setEditOptions(state.editOptions);
    if (state.signOptions) setSignOptions(state.signOptions);
    if (state.activeSignLayer) setActiveSignLayer(state.activeSignLayer);
    if (state.textItems) setTextItems(state.textItems);
    if (state.activeTextId !== undefined) setActiveTextId(state.activeTextId);
    if (state.jpegQuality) setJpegQuality(state.jpegQuality);
    if (state.imageFormat === 'jpg' || state.imageFormat === 'png') setImageFormat(state.imageFormat);
  });

  useEffect(() => () => {
    if (result?.url) URL.revokeObjectURL(result.url);
  }, [result]);

  const isCompare = tool.endpoint === 'compare';
  const isSummary = tool.endpoint === 'summarize';
  const isSign = tool.endpoint === 'sign-pdf';
  const isImagePlacement = tool.slug === 'add-image-to-pdf';
  const isUnlock = tool.endpoint === 'unlock-pdf';
  const isMetadataCleaner = tool.endpoint === 'clean-metadata';
  const isFlatten = tool.endpoint === 'flatten-pdf';
  const isExtractImages = tool.endpoint === 'extract-images';
  const isImageConversion = tool.endpoint === 'to-jpg' || tool.endpoint === 'to-png';
  const isCrop = tool.endpoint === 'crop-pdf';
  const isRedact = tool.endpoint === 'redact-pdf';
  const isForms = tool.endpoint === 'pdf-forms';
  const isHtml = tool.endpoint === 'html-to-pdf';
  const isEdit = tool.endpoint === 'edit-pdf';
  const isPowerPoint = tool.endpoint === 'pdf-to-powerpoint';
  const isPdfA = tool.endpoint === 'pdf-to-pdfa';
  const isOfficeConversion = tool.endpoint === 'office-to-pdf';
  const validFiles = isHtml ? Boolean(html.trim()) : isCompare ? files.length === 2 : files.length === 1;

  useEffect(() => {
    if (!isExtractImages || !files[0]) {
      setEmbeddedImages([]);
      setSelectedImageIds(new Set());
      setImageInspectionError('');
      setImagesLoading(false);
      return undefined;
    }
    let active = true;
    const inspect = async () => {
      setImagesLoading(true);
      setEmbeddedImages([]);
      setSelectedImageIds(new Set());
      setImageInspectionError('');
      try {
        const body = new FormData();
        body.append('files', files[0]);
        const response = await fetch(`${apiBase}/pdf/extract-images/inspect`, { method: 'POST', body, credentials: 'include' });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || 'Could not find images in this PDF');
        const images = payload.data?.images || [];
        if (active) {
          setEmbeddedImages(images);
          setSelectedImageIds(new Set(images.map((image) => image.id)));
        }
      } catch (error) {
        if (active) setImageInspectionError(error.message || 'Could not find images in this PDF');
      } finally {
        if (active) setImagesLoading(false);
      }
    };
    inspect();
    return () => { active = false; };
  }, [files, isExtractImages]);

  const addTextItem = () => {
    if (textItems.length >= 20) return;
    const id = globalThis.crypto?.randomUUID?.() || `text-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const item = { id, text: 'New text', xPercent: '12', yPercent: '16', size: '20', color: '#d9273d', font: 'HelveticaBold' };
    setTextItems((current) => [...current, item]);
    setActiveTextId(id);
    setActiveSignLayer('text');
  };

  const updateTextItem = (id, changes) => setTextItems((current) => current.map((item) => item.id === id ? { ...item, ...changes } : item));

  const removeTextItem = (id) => {
    const nextItems = textItems.filter((item) => item.id !== id);
    setTextItems(nextItems);
    if (activeTextId === id) {
      setActiveTextId(nextItems.at(-1)?.id || '');
      if (!nextItems.length) setActiveSignLayer('image');
    }
  };

  useEffect(() => {
    let cancelled = false;
    if (!isForms || !files[0]) { setFormFields([]); setFormValues({}); setFieldsLoading(false); return undefined; }
    const loadFields = async () => {
      setFieldsLoading(true);
      setFormFields([]);
      try {
        const body = new FormData();
        body.append('files', files[0]);
        const response = await fetch(`${apiBase}/pdf/form-fields`, { method: 'POST', body, credentials: 'include' });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || 'Could not inspect this PDF form');
        if (!cancelled) {
          const fields = payload.data?.fields || [];
          setFormFields(fields);
          setFormValues((current) => ({ ...Object.fromEntries(fields.map((field) => [field.name, field.value ?? String(Boolean(field.checked))])), ...current }));
        }
      } catch (error) {
        if (!cancelled) toast.error(error.message || 'Could not inspect this PDF form');
      } finally {
        if (!cancelled) setFieldsLoading(false);
      }
    };
    loadFields();
    return () => { cancelled = true; };
  }, [files, isForms]);

  const submit = async () => {
    if (!validFiles) return toast.error(isHtml ? 'Enter HTML content first' : isCompare ? 'Choose exactly two PDFs to compare' : 'Select one PDF first');
    if (isExtractImages && (!embeddedImages.length || !selectedImageIds.size)) return toast.error('Select at least one image to extract');
    if (isForms && !formFields.length) return toast.error('This PDF has no fillable form fields');
    if (isSign && !signature) return toast.error(isImagePlacement ? 'Select a PNG or JPG image to add' : 'Select a PNG or JPG signature image');
    if (isUnlock && !password) return toast.error('Enter the PDF password');
    if (isRedact && !redactionTerms.trim()) return toast.error('Enter the words or phrases to redact');
    setBusy(true);
    setResult(null);
    try {
      const body = new FormData();
      files.forEach((file) => body.append('files', file));
      if (isExtractImages) body.append('selectedImages', JSON.stringify([...selectedImageIds]));
      if (isHtml) body.append('html', html);
      if (isEdit) Object.entries(editOptions).forEach(([key, value]) => body.append(key, value));
      if (isSign) {
        body.append('signature', signature);
        Object.entries(signOptions).forEach(([key, value]) => body.append(key, value));
        body.append('textItems', JSON.stringify(textItems.map(({ id, ...item }) => item)));
      }
      if (isUnlock) body.append('password', password);
      if (isCrop) Object.entries(crop).forEach(([key, value]) => body.append(key, value));
      if (isRedact) body.append('terms', redactionTerms);
      if (isForms) body.append('values', JSON.stringify(formValues));
      if (isImageConversion && imageFormat === 'jpg') body.append('quality', jpegQuality);
      const endpoint = isForms ? 'fill-form' : isImageConversion ? (imageFormat === 'png' ? 'to-png' : 'to-jpg') : tool.endpoint;
      const response = await fetch(`${apiBase}/pdf/${endpoint}`, { method: 'POST', body, credentials: 'include' });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || `Could not run ${tool.name}`);
      }
      if (isCompare || isSummary) {
        const payload = await response.json();
        setResult({ data: payload.data });
        recordOperation({ token: crypto.randomUUID(), tool: tool.name, outputName: isSummary ? 'PDF summary' : 'PDF comparison report' });
      } else {
        const blob = await response.blob();
        const extension = blob.type.includes('zip') ? 'zip' : blob.type.includes('spreadsheetml') ? 'xlsx' : blob.type.includes('presentationml') ? 'pptx' : blob.type.includes('markdown') ? 'md' : 'pdf';
        const suffix = isMetadataCleaner ? 'metadata-cleaned' : isFlatten ? 'flattened' : isExtractImages ? 'extracted-images' : isImageConversion ? `${imageFormat}-pages` : undefined;
        setResult({ url: URL.createObjectURL(blob), name: createDownloadName(files[0], extension, suffix) });
      }
      toast.success(`${tool.name} is ready`);
    } catch (error) {
      toast.error(error.message || `Could not run ${tool.name}`);
    } finally {
      setBusy(false);
    }
  };

  if (!draftReady) return <main className="container py-5 tool-page"><p className="small text-secondary">Restoring your saved work…</p></main>;

  return <main className={`container py-5 tool-page${isImagePlacement ? ' tool-page-image-placement' : ''}`}>
    <Link to="/tools" className="back">← All tools</Link>
    <h2>{tool.name}</h2>
    <p className="lead">{tool.description}</p>
    {draftStatus && <p className={`small ${draftStatus === 'Autosave unavailable' ? 'text-warning' : 'text-success'}`} role="status">{draftStatus}</p>}
    {isOfficeConversion && <p className="small text-secondary">Office files are converted using the available conversion service. If Adobe PDF Services is enabled, processing may count toward the Adobe plan.</p>}
    {isPowerPoint && <p className="small text-secondary">Slides contain page images to preserve the PDF appearance; slide text is not editable.</p>}
    {isPdfA && <p className="small text-secondary">The PDF/A-1b result is image-based to remove unsupported content, so text is not selectable. For formal archiving, verify the output with a PDF/A validator.</p>}
    {isMetadataCleaner && <p className="small text-secondary">Removes document properties, document-level XMP metadata, and the document language tag. It does not redact page content or remove metadata embedded in images, comments, or attachments.</p>}
    {isFlatten && <p className="small text-secondary">Forms and annotations are rendered into fixed page images. The result will not have interactive fields or selectable page text.</p>}
    {isExtractImages && <p className="small text-secondary">Review the embedded image previews, select the pictures to keep, and download them as PNG files. Text and vector drawings are not extracted.</p>}
    {isImageConversion && <label className="mt-3">Image format<select className="form-select" value={imageFormat} onChange={(event) => setImageFormat(event.target.value)}><option value="jpg">JPG</option><option value="png">PNG</option></select></label>}
    {isHtml ? <label className="mt-3">HTML content<textarea className="form-control" rows="10" maxLength="500000" value={html} onChange={(event) => setHtml(event.target.value)}/></label> : <FileUploader tool={tool} onFiles={(selected) => { setFiles(isCompare ? selected.slice(0, 2) : selected.slice(0, 1)); setFormValues({}); if (isSign) { setSignPageCount(0); setSignOptions((current) => ({ ...current, page: '1' })); } setResult(null); }}/>} 
    {files.length > 0 && <UploadedFileList files={files}/>}

    {isExtractImages && files.length > 0 && <section className="extract-image-review mt-4" aria-labelledby="extract-image-review-title">
      <div className="extract-image-review-heading">
        <div><h3 id="extract-image-review-title">Review images to extract</h3><p>Select the pictures you want in the ZIP file.</p></div>
        {embeddedImages.length > 0 && <div className="extract-image-review-actions"><button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setSelectedImageIds(new Set(embeddedImages.map((image) => image.id)))}>Select all</button><button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setSelectedImageIds(new Set())}>Clear selection</button></div>}
      </div>
      {imagesLoading && <p className="small text-secondary" role="status">Finding and preparing image previews...</p>}
      {imageInspectionError && <p className="small text-danger" role="alert">{imageInspectionError}</p>}
      {!imagesLoading && embeddedImages.length > 0 && <>
        <p className="small text-secondary">{selectedImageIds.size} of {embeddedImages.length} selected</p>
        <div className="extract-image-grid">
          {embeddedImages.map((image) => <label className={`extract-image-card${selectedImageIds.has(image.id) ? ' selected' : ''}`} key={image.id}>
            <img src={image.preview} alt={`Image ${image.imageNumber} from page ${image.pageNumber}`}/>
            <span className="extract-image-card-meta"><input type="checkbox" checked={selectedImageIds.has(image.id)} onChange={() => setSelectedImageIds((current) => {
              const next = new Set(current);
              if (next.has(image.id)) next.delete(image.id); else next.add(image.id);
              return next;
            })}/><span><strong>Page {image.pageNumber} - Image {image.imageNumber}</strong><small>{image.width} x {image.height} px</small></span></span>
          </label>)}
        </div>
      </>}
    </section>}

    {isCrop && <section className="row g-3 mt-2">
      {['left', 'right', 'top', 'bottom'].map((edge) => <label className="col-6" key={edge}>{edge[0].toUpperCase() + edge.slice(1)} margin (pt)<input className="form-control" type="number" min="0" max="500" value={crop[edge]} onChange={(event) => setCrop((current) => ({ ...current, [edge]: event.target.value }))}/></label>)}
      <label className="col-12">Pages to crop (optional)<input className="form-control" placeholder="All pages or 1-3,5" value={crop.pages} onChange={(event) => setCrop((current) => ({ ...current, pages: event.target.value }))}/></label>
    </section>}

    {isEdit && <section className="row g-3 mt-2">
      <label className="col-12">Text to add<textarea className="form-control" rows="3" maxLength="500" value={editOptions.text} onChange={(event) => setEditOptions((current) => ({ ...current, text: event.target.value }))}/></label>
      <label className="col-md-4">Page<input className="form-control" type="number" min="1" value={editOptions.page} onChange={(event) => setEditOptions((current) => ({ ...current, page: event.target.value }))}/></label>
      <label className="col-md-4">X position (pt)<input className="form-control" type="number" min="0" value={editOptions.x} onChange={(event) => setEditOptions((current) => ({ ...current, x: event.target.value }))}/></label>
      <label className="col-md-4">Y position (pt)<input className="form-control" type="number" min="0" value={editOptions.y} onChange={(event) => setEditOptions((current) => ({ ...current, y: event.target.value }))}/></label>
      <label className="col-md-4">Font size (pt)<input className="form-control" type="number" min="6" max="72" value={editOptions.size} onChange={(event) => setEditOptions((current) => ({ ...current, size: event.target.value }))}/></label>
      <label className="col-md-4">Font<select className="form-select" value={editOptions.font} onChange={(event) => setEditOptions((current) => ({ ...current, font: event.target.value }))}><option>Helvetica</option><option>Helvetica-Bold</option><option>Times-Roman</option><option>Courier</option></select></label>
      <label className="col-md-4">Text color<input className="form-control form-control-color" type="color" value={editOptions.color} onChange={(event) => setEditOptions((current) => ({ ...current, color: event.target.value }))}/></label>
    </section>}

    {isUnlock && <section className="unlock-password-section mt-3"><label>PDF password<input className="form-control" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter the password to unlock"/></label><details className="unlock-help"><summary>I don’t know the password</summary><p>For security, an encrypted PDF can only be unlocked with its correct password. Ask the document owner to share the password or send you an unlocked copy. If you created the PDF, check your password manager or the app where you originally protected it.</p></details></section>}

    {isRedact && <>
      <label className="mt-3">Words or phrases to redact (separate with commas)<textarea className="form-control" rows="3" value={redactionTerms} onChange={(event) => setRedactionTerms(event.target.value)} placeholder="Example: account number, private address"/></label>
      <p className="small text-warning mt-2">Redaction rasterizes pages to remove the matched text from the output. Review every page before sharing.</p>
    </>}

    {isForms && files.length > 0 && <section className="mt-3"><h2 className="h5">Form fields</h2>{fieldsLoading ? <p>Reading form fields…</p> : formFields.length ? formFields.map((field) => {
      const isCheckbox = /CheckBox/.test(field.type);
      const hasOptions = Array.isArray(field.options) && field.options.length > 0;
      return <label className="mb-3" key={field.name}>{field.name}{isCheckbox
        ? <input className="form-check-input d-block" type="checkbox" checked={formValues[field.name] === 'true'} onChange={(event) => setFormValues((current) => ({ ...current, [field.name]: String(event.target.checked) }))}/>
        : hasOptions
          ? <select className="form-select" value={formValues[field.name] || ''} onChange={(event) => setFormValues((current) => ({ ...current, [field.name]: event.target.value }))}><option value="">Choose an option</option>{field.options.map((option) => <option key={option} value={option}>{option}</option>)}</select>
          : <input className="form-control" value={formValues[field.name] || ''} onChange={(event) => setFormValues((current) => ({ ...current, [field.name]: event.target.value }))}/>}</label>;
    }) : <p className="text-secondary">No fillable fields were found in this PDF.</p>}</section>}

    {isSign && <section className="mt-3">
      {!isImagePlacement && <div className="signature-source-switch" role="group" aria-label="Choose how to add a signature">
        <button type="button" className={signatureMode === 'upload' ? 'active' : ''} onClick={() => { setSignatureMode('upload'); setSignature(null); }}>Upload image</button>
        <button type="button" className={signatureMode === 'draw' ? 'active' : ''} onClick={() => { setSignatureMode('draw'); setSignature(null); }}>Draw signature</button>
      </div>}
      {(isImagePlacement || signatureMode === 'upload') && <label>{isImagePlacement ? 'Image to add (PNG or JPG)' : 'Signature image (PNG or JPG)'}<input key={signatureMode} className="form-control" type="file" accept="image/png,image/jpeg" onChange={(event) => setSignature(event.target.files?.[0] || null)}/></label>}
      {!isImagePlacement && signatureMode === 'draw' && <SignatureDrawPad onUseSignature={(file) => { setSignature(file); toast.success('Drawn signature is ready'); }} />}
      {signature && <UploadedFileList files={signature}/>}
      {files[0] && signature && <SignaturePlacementPreview
        pdfFile={files[0]}
        signatureFile={signature}
        pageNumber={signOptions.page}
        widthPercent={signOptions.widthPercent}
        rotation={signOptions.rotation}
        opacity={signOptions.opacity}
        frameWidth={signOptions.frameWidth}
        frameColor={signOptions.frameColor}
        textItems={textItems}
        activeLayer={activeSignLayer}
        activeTextId={activeTextId}
        xPercent={signOptions.xPercent}
        yPercent={signOptions.yPercent}
        placementLabel={isImagePlacement ? 'image' : 'signature'}
        onPositionChange={(position) => setSignOptions((current) => ({ ...current, ...position }))}
        onRotationChange={(rotation) => setSignOptions((current) => ({ ...current, rotation }))}
        onTextPositionChange={(id, position) => updateTextItem(id, position)}
        onTextSelect={(id) => { setActiveTextId(id); setActiveSignLayer('text'); }}
        onActiveLayerChange={setActiveSignLayer}
        onPageCount={(count) => { setSignPageCount(count); setSignOptions((current) => Number(current.page) > count ? { ...current, page: String(count) } : current); }}
        controls={({ changeRotation, setActiveLayer }) => <>
          <h4>Placement tools</h4>
          <label>PDF page<input className="form-control" type="number" min="1" max={signPageCount || undefined} value={signOptions.page} onChange={(event) => setSignOptions((current) => ({ ...current, page: event.target.value }))}/></label>
          <div className="signature-layer-buttons"><button type="button" className={activeSignLayer === 'image' ? 'active' : ''} onClick={() => setActiveLayer('image')}>Place image</button><button type="button" className={activeSignLayer === 'text' ? 'active' : ''} disabled={!textItems.length} onClick={() => { if (activeTextId) setActiveLayer('text'); else { setActiveTextId(textItems[0].id); setActiveLayer('text'); } }}>Place text</button></div>
          <label>{isImagePlacement ? 'Image size' : 'Signature size'} <output>{signOptions.widthPercent}%</output><input className="form-range" type="range" min="5" max="60" step="1" value={signOptions.widthPercent} onChange={(event) => setSignOptions((current) => ({ ...current, widthPercent: event.target.value }))}/></label>
          <label>Rotation <output>{Number(signOptions.rotation).toFixed(1)}°</output><input className="form-range" type="range" min="0" max="359.9" step="0.1" value={signOptions.rotation} onChange={(event) => changeRotation(event.target.value)}/></label>
          <label>Opacity <output>{signOptions.opacity}%</output><input className="form-range" type="range" min="0" max="100" step="1" value={signOptions.opacity} onChange={(event) => setSignOptions((current) => ({ ...current, opacity: event.target.value }))}/></label>
          <label>Frame width <output>{signOptions.frameWidth} pt</output><input className="form-range" type="range" min="0" max="20" step="1" value={signOptions.frameWidth} onChange={(event) => setSignOptions((current) => ({ ...current, frameWidth: event.target.value }))}/></label>
          <label>Frame color<span className="signature-color-field"><small>{signOptions.frameColor}</small><input type="color" value={signOptions.frameColor} onChange={(event) => setSignOptions((current) => ({ ...current, frameColor: event.target.value }))}/></span></label>
          <div className="signature-text-list-heading"><h5>Text layers <small>{textItems.length}/20</small></h5><button type="button" className="signature-add-text" onClick={addTextItem} disabled={textItems.length >= 20}>+ Add text</button></div>
          {!textItems.length && <small>Add a text layer to place words anywhere on this page.</small>}
          <div className="signature-text-layers">{textItems.map((item, index) => <section className={`signature-text-layer ${activeTextId === item.id ? 'selected' : ''}`} key={item.id}>
            <div className="signature-text-layer-heading"><button type="button" className="signature-text-select" onClick={() => { setActiveTextId(item.id); setActiveLayer('text'); }}>{`Text ${index + 1}`}{activeTextId === item.id ? ' · selected' : ''}</button><button type="button" className="signature-text-remove" aria-label={`Remove text ${index + 1}`} onClick={() => removeTextItem(item.id)}>×</button></div>
            <label>Text<textarea className="form-control" rows="2" maxLength="250" value={item.text} onChange={(event) => updateTextItem(item.id, { text: event.target.value })}/></label>
            <label>Font style<select className="form-select" value={item.font} onChange={(event) => updateTextItem(item.id, { font: event.target.value })}><option value="Helvetica">Helvetica</option><option value="HelveticaBold">Helvetica Bold</option><option value="HelveticaOblique">Helvetica Italic</option><option value="HelveticaBoldOblique">Helvetica Bold Italic</option><option value="TimesRoman">Times New Roman</option><option value="TimesRomanBold">Times New Roman Bold</option><option value="TimesRomanItalic">Times New Roman Italic</option><option value="TimesRomanBoldItalic">Times New Roman Bold Italic</option><option value="Courier">Courier</option><option value="CourierBold">Courier Bold</option><option value="CourierOblique">Courier Italic</option><option value="CourierBoldOblique">Courier Bold Italic</option></select></label>
            <label>Text size <output>{item.size} pt</output><input className="form-range" type="range" min="6" max="72" step="1" value={item.size} onChange={(event) => updateTextItem(item.id, { size: event.target.value })}/></label>
            <label>Text color<span className="signature-color-field"><small>{item.color}</small><input type="color" value={item.color} onChange={(event) => updateTextItem(item.id, { color: event.target.value })}/></span></label>
          </section>)}</div>
          <small>Drag the red arrow to rotate the image. Select a text layer, then click the page or drag its text to position it.</small>
        </>}
      />}
    </section>}

    {isImageConversion && imageFormat === 'jpg' && <label className="mt-3">JPG quality ({jpegQuality}%)<input className="form-range" type="range" min="50" max="100" value={jpegQuality} onChange={(event) => setJpegQuality(event.target.value)}/></label>}

    <button className="btn btn-primary mt-4" type="button" onClick={submit} disabled={busy || !validFiles || fieldsLoading || (isExtractImages && (imagesLoading || !embeddedImages.length || !selectedImageIds.size)) || (isForms && !formFields.length) || (isSign && !signature) || (isUnlock && !password)}>
      {busy ? 'Processing…' : isForms ? 'Fill and save PDF form' : isMetadataCleaner ? 'Clean PDF metadata' : isFlatten ? 'Flatten PDF' : isExtractImages ? 'Extract images' : tool.name}
    </button>

    <OperationProgressModal show={busy} title={`PDF Pro Cut is processing ${tool.name.toLowerCase()}`} description="Please wait while your file is prepared."/>
    <DownloadResultModal href={result?.url} fileName={result?.name} toolSlug={tool.slug} title={`PDF Pro Cut completed ${tool.name.toLowerCase()}`} downloadLabel={`Download ${result?.name || 'file'}`} onClose={() => setResult(null)}/>
    {isSummary && result?.data && <section className="alert alert-light border mt-4"><h2 className="h5">Summary</h2><p className="mb-2">{result.data.summary}</p><small>Extracted from selectable text · {result.data.sentenceCount}{" " + 'sentences reviewed ·' + " "}{result.data.sourceCharacters.toLocaleString()} characters</small></section>}
    {isCompare && result?.data && <section className="alert alert-light border mt-4"><h2 className="h5">Comparison</h2><p>{result.data.changedPageCount ? `${result.data.changedPageCount} page(s) differ.` : 'The extracted text matches on every page.'}</p><p className="small text-secondary">PDF 1: {result.data.firstPageCount}{" " + 'pages · PDF 2:' + " "}{result.data.secondPageCount} pages</p>{result.data.pages.length > 0 && <ul className="mb-0">{result.data.pages.map((page) => <li key={page.page}>Page {page.page}: {page.status}</li>)}</ul>}</section>}
  </main>;
}
