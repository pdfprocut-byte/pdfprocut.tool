import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import FileUploader from '../components/pdf/FileUploader.jsx';
import UploadedFileList from '../components/pdf/UploadedFileList.jsx';
import PdfPagePreview from '../components/pdf/PdfPagePreview.jsx';
import { DownloadResultModal, OperationProgressModal } from '../components/pdf/FileOperationModals.jsx';
import '../styles/watermark.css';
import { createDownloadName } from '../utils/downloadName.js';
import { useBrowserDraft } from '../lib/browserDraft.js';

const fontStyles = [
  ['Helvetica', 'Helvetica'],
  ['HelveticaBold', 'Helvetica Bold'],
  ['HelveticaOblique', 'Helvetica Italic'],
  ['HelveticaBoldOblique', 'Helvetica Bold Italic'],
  ['TimesRoman', 'Times New Roman'],
  ['TimesRomanBold', 'Times New Roman Bold'],
  ['TimesRomanItalic', 'Times New Roman Italic'],
  ['TimesRomanBoldItalic', 'Times New Roman Bold Italic'],
  ['Courier', 'Courier'],
  ['CourierBold', 'Courier Bold'],
  ['CourierOblique', 'Courier Italic'],
  ['CourierBoldOblique', 'Courier Bold Italic']
];

export default function WatermarkPage({ tool }) {
  const [file, setFile] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [imageUrl, setImageUrl] = useState('');
  const [text, setText] = useState('CONFIDENTIAL');
  const [color, setColor] = useState('#cc1f36');
  const [font, setFont] = useState('HelveticaBold');
  const [fontSize, setFontSize] = useState('48');
  const [imageSize, setImageSize] = useState('30');
  const [opacity, setOpacity] = useState('0.25');
  const [rotation, setRotation] = useState('-35');
  const [layout, setLayout] = useState('center');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const draft = { state: { text, color, font, fontSize, imageSize, opacity, rotation, layout }, files: file ? [file] : [], signature: imageFile };
  const { ready: draftReady, status: draftStatus } = useBrowserDraft(`tool:${tool.slug}`, draft, (saved) => {
    setFile(saved.files[0] || null);
    setImageFile(saved.signature || null);
    const state = saved.state || {};
    if (state.text !== undefined) setText(state.text);
    if (state.color) setColor(state.color);
    if (state.font) setFont(state.font);
    if (state.fontSize) setFontSize(state.fontSize);
    if (state.imageSize) setImageSize(state.imageSize);
    if (state.opacity) setOpacity(state.opacity);
    if (state.rotation) setRotation(state.rotation);
    if (state.layout) setLayout(state.layout);
  });

  useEffect(() => {
    if (!imageFile) {
      setImageUrl('');
      return undefined;
    }
    const url = URL.createObjectURL(imageFile);
    setImageUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [imageFile]);

  const addWatermark = async () => {
    if (!file) return toast.error('Select a PDF first');
    if (!text.trim() && !imageFile) return toast.error('Enter watermark text or choose an image');
    setBusy(true);
    setResult(null);
    try {
      const body = new FormData();
      body.append('files', file);
      if (text.trim()) body.append('text', text.trim());
      if (imageFile) body.append('watermarkImage', imageFile);
      body.append('color', color);
      body.append('font', font);
      body.append('fontSize', fontSize);
      body.append('imageSize', imageSize);
      body.append('opacity', opacity);
      body.append('rotation', rotation);
      body.append('layout', layout);

      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/pdf/${tool.endpoint}`, { method: 'POST', body, credentials: 'include' });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw Error(error.error || 'Could not add the watermark');
      }
      setResult(URL.createObjectURL(await response.blob()));
      toast.success('Watermark added');
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusy(false);
    }
  };

  if (!draftReady) return <main className="container py-5 watermark-page"><p className="small text-secondary">Restoring your saved work…</p></main>;

  return <main className="container py-5 watermark-page">
    <Link to="/tools" className="back">All tools</Link>
    <h2>{tool.name}</h2>
    <p className="lead">Add styled text, an image, or both to every PDF page.</p>
    {draftStatus && <p className={`small ${draftStatus === 'Autosave unavailable' ? 'text-warning' : 'text-success'}`} role="status">{draftStatus}</p>}
    <FileUploader tool={tool} onFiles={(files) => { setFile(files[0] || null); setResult(null); }}/>
    {file && <UploadedFileList files={file}/>}
    <div className="watermark-workspace">
      <section className="watermark-preview-panel">
        {file ? <PdfPagePreview file={file} selectedPages={[]} interactive={false} watermarkPreview={{ text, color, font, fontSize, imageSize, opacity, rotation, layout, imageUrl }}/> : <div className="watermark-empty">Upload a PDF to see the live watermark preview.</div>}
      </section>
      <div className="watermark-control-panel">
    <section className="watermark-options">
      <h2>Watermark design</h2>
      <label className="watermark-text-field">Text<input className="form-control" value={text} maxLength={120} placeholder="Leave blank to use only an image" onChange={(event) => setText(event.target.value)}/></label>
      <label>Text color<span className="watermark-color-control"><input type="color" value={color} onChange={(event) => setColor(event.target.value)}/><small>{color.toUpperCase()}</small></span></label>
      <label>Font style<select className="form-select" value={font} onChange={(event) => setFont(event.target.value)}>{fontStyles.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label>Font size (pt)<input className="form-control" type="number" min="8" max="144" value={fontSize} onChange={(event) => setFontSize(event.target.value)}/></label>
      <label>Image size <span>{imageSize}%</span><input className="form-range" type="range" min="10" max="70" value={imageSize} disabled={!imageFile} onChange={(event) => setImageSize(event.target.value)}/></label>
      <label>Design<select className="form-select" value={layout} onChange={(event) => setLayout(event.target.value)}><option value="center">Center</option><option value="tiled">Repeat across page</option><option value="bottom-right">Bottom right</option></select></label>
      <label>Rotation <span>{rotation} deg</span><input className="form-range" type="range" min="-180" max="180" value={rotation} onChange={(event) => setRotation(event.target.value)}/></label>
      <label>Opacity <span>{Math.round(Number(opacity) * 100)}%</span><input className="form-range" type="range" min="0.05" max="1" step="0.05" value={opacity} onChange={(event) => setOpacity(event.target.value)}/></label>
      <label className="watermark-image-field">Optional image (PNG or JPG)<input className="form-control" type="file" accept="image/png,image/jpeg" onChange={(event) => { setImageFile(event.target.files?.[0] || null); event.target.value = ''; }}/>{imageFile && <small className="watermark-image-name">{imageFile.name}<button type="button" className="watermark-clear-image" onClick={() => setImageFile(null)}>Remove image</button></small>}</label>
    </section>

    <button className="btn btn-primary mt-4" onClick={addWatermark} disabled={busy || !file}>{busy ? 'Processing...' : 'Add watermark'}</button>
    <OperationProgressModal show={busy} title="PDF Pro Cut is adding your watermark" description="Please wait while your PDF is updated."/>
    <DownloadResultModal href={result} fileName={file ? createDownloadName(file, 'pdf') : ''} toolSlug={tool.slug} title="PDF Pro Cut added your watermark" downloadLabel="Download PDF" onClose={() => setResult(null)}/>
      </div>
    </div>
  </main>;
}
