import { useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import FileUploader from '../components/pdf/FileUploader.jsx';
import UploadedFileList from '../components/pdf/UploadedFileList.jsx';
import PdfPagePreview from '../components/pdf/PdfPagePreview.jsx';
import { DownloadResultModal, OperationProgressModal } from '../components/pdf/FileOperationModals.jsx';
import '../styles/pageNumbers.css';
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

export default function PageNumbersPage({ tool }) {
  const [file, setFile] = useState(null);
  const [pageCount, setPageCount] = useState(0);
  const [start, setStart] = useState('1');
  const [startPage, setStartPage] = useState('1');
  const [format, setFormat] = useState('number');
  const [position, setPosition] = useState('bottom-center');
  const [font, setFont] = useState('Helvetica');
  const [fontSize, setFontSize] = useState('11');
  const [color, setColor] = useState('#333333');
  const [opacity, setOpacity] = useState('1');
  const [margin, setMargin] = useState('24');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const draft = { state: { start, startPage, format, position, font, fontSize, color, opacity, margin }, files: file ? [file] : [], signature: null };
  const { ready: draftReady, status: draftStatus } = useBrowserDraft(`tool:${tool.slug}`, draft, (saved) => {
    setFile(saved.files[0] || null);
    const state = saved.state || {};
    if (state.start) setStart(state.start);
    if (state.startPage) setStartPage(state.startPage);
    if (state.format) setFormat(state.format);
    if (state.position) setPosition(state.position);
    if (state.font) setFont(state.font);
    if (state.fontSize) setFontSize(state.fontSize);
    if (state.color) setColor(state.color);
    if (state.opacity) setOpacity(state.opacity);
    if (state.margin) setMargin(state.margin);
  });

  const update = (setter, value) => {
    setter(value);
    setResult(null);
  };

  const addPageNumbers = async () => {
    if (!file) return toast.error('Select a PDF first');
    if (!Number.isInteger(Number(start)) || Number(start) < 1) return toast.error('Enter a valid starting number');
    if (!Number.isInteger(Number(startPage)) || Number(startPage) < 1 || (pageCount && Number(startPage) > pageCount)) return toast.error('Choose a starting page within the PDF');
    setBusy(true);
    setResult(null);
    try {
      const body = new FormData();
      body.append('files', file);
      body.append('start', start);
      body.append('startPage', startPage);
      body.append('format', format);
      body.append('position', position);
      body.append('font', font);
      body.append('fontSize', fontSize);
      body.append('color', color);
      body.append('opacity', opacity);
      body.append('margin', margin);
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/pdf/${tool.endpoint}`, { method: 'POST', body, credentials: 'include' });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw Error(error.error || 'Could not add page numbers');
      }
      setResult(URL.createObjectURL(await response.blob()));
      toast.success('Page numbers added');
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusy(false);
    }
  };

  const preview = { kind: 'pageNumbers', start, startPage, format, position, font, fontSize, color, opacity, margin };

  if (!draftReady) return <main className="container py-5 page-numbers-page"><p className="small text-secondary">Restoring your saved work…</p></main>;

  return <main className="container py-5 page-numbers-page">
    <Link to="/tools" className="back">All tools</Link>
    <h2>{tool.name}</h2>
    <p className="lead">Choose how page numbers look and see them on the PDF before applying.</p>
    {draftStatus && <p className={`small ${draftStatus === 'Autosave unavailable' ? 'text-warning' : 'text-success'}`} role="status">{draftStatus}</p>}
    <FileUploader tool={tool} onFiles={(files) => { setFile(files[0] || null); setPageCount(0); setResult(null); }}/>
    {file && <UploadedFileList files={file}/>}

    <div className="page-numbers-workspace">
      <section className="page-numbers-preview-panel">
        {file ? <PdfPagePreview file={file} selectedPages={[]} interactive={false} pageNumbersPreview={preview} onPagesReady={(pages) => setPageCount(pages.length)}/> : <div className="page-numbers-empty">Upload a PDF to see page numbers update in the preview.</div>}
      </section>
      <div className="page-numbers-control-panel">
        <section className="page-number-options">
          <h2>Number design</h2>
          <label>Starting number<input className="form-control" type="number" min="1" max="1000000" value={start} onChange={(event) => update(setStart, event.target.value)}/></label>
          <label>Start on PDF page<input className="form-control" type="number" min="1" max={pageCount || undefined} value={startPage} onChange={(event) => update(setStartPage, event.target.value)}/></label>
          <label>Number format<select className="form-select" value={format} onChange={(event) => update(setFormat, event.target.value)}><option value="number">1</option><option value="page-number">Page 1</option><option value="number-of-total">1 of 10</option><option value="page-of-total">Page 1 of 10</option></select></label>
          <label>Position<select className="form-select" value={position} onChange={(event) => update(setPosition, event.target.value)}><option value="top-left">Top left</option><option value="top-center">Top center</option><option value="top-right">Top right</option><option value="bottom-left">Bottom left</option><option value="bottom-center">Bottom center</option><option value="bottom-right">Bottom right</option></select></label>
          <label>Font style<select className="form-select" value={font} onChange={(event) => update(setFont, event.target.value)}>{fontStyles.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label>Font size (pt)<input className="form-control" type="number" min="6" max="48" value={fontSize} onChange={(event) => update(setFontSize, event.target.value)}/></label>
          <label className="page-number-color-field">Text color<span className="page-number-color-control"><input type="color" value={color} onChange={(event) => update(setColor, event.target.value)}/><small>{color.toUpperCase()}</small></span></label>
          <label>Margin (pt)<input className="form-control" type="number" min="0" max="120" value={margin} onChange={(event) => update(setMargin, event.target.value)}/></label>
          <label className="page-number-opacity-field">Opacity <span>{Math.round(Number(opacity) * 100)}%</span><input className="form-range" type="range" min="0.05" max="1" step="0.05" value={opacity} onChange={(event) => update(setOpacity, event.target.value)}/></label>
        </section>
        <button className="btn btn-primary mt-4" onClick={addPageNumbers} disabled={busy || !file}>{busy ? 'Processing...' : 'Add page numbers'}</button>
        <OperationProgressModal show={busy} title="PDF Pro Cut is adding page numbers" description="Please wait while your PDF is updated."/>
        <DownloadResultModal href={result} fileName={file ? createDownloadName(file, 'pdf') : ''} toolSlug={tool.slug} title="PDF Pro Cut added page numbers" downloadLabel="Download PDF" onClose={() => setResult(null)}/>
      </div>
    </div>
  </main>;
}
