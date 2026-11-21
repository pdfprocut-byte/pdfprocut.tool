import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { getToolCategoryClass, tools } from '../tools.js';
import FileUploader from '../components/pdf/FileUploader.jsx';
import PdfPagePreview from '../components/pdf/PdfPagePreview.jsx';
import { DownloadResultModal, OperationProgressModal } from '../components/pdf/FileOperationModals.jsx';
import MergePdfPage from './MergePdfPage.jsx';
import RemovePagesPage from './RemovePagesPage.jsx';
import WatermarkPage from './WatermarkPage.jsx';
import PageNumbersPage from './PageNumbersPage.jsx';
import ScanToPdfPage from './ScanToPdfPage.jsx';
import TextToPdfPage from './TextToPdfPage.jsx';
import PdfToDocumentPage from './PdfToDocumentPage.jsx';
import CompressFilesPage from './CompressFilesPage.jsx';
import CompressImagePage from './CompressImagePage.jsx';
import ExtraPdfToolPage from './ExtraPdfToolPage.jsx';
import { createDownloadName } from '../utils/downloadName.js';
import ToolGuide from '../components/tools/ToolGuide.jsx';
import UploadedFileList from '../components/pdf/UploadedFileList.jsx';
import { useBrowserDraft } from '../lib/browserDraft.js';
import { apiBaseUrl } from '../lib/authApi.js';
import { readPdfText } from '../lib/pdfText.js';

export default function ToolPage() {
  const { slug } = useParams();
  const tool = tools.find((item) => item.slug === slug);
  return <div className={`tool-workspace${tool ? ` ${getToolCategoryClass(tool.category)}` : ''}`}>
    <ToolPageContent key={slug} tool={tool}/>
  </div>;
}

function ToolPageContent({ tool }) {
  const navigate = useNavigate();
  const [files, setFiles] = useState([]); const [busy, setBusy] = useState(false);
  const [pages, setPages] = useState(''); const [selected, setSelected] = useState([]);
  const [text, setText] = useState('CONFIDENTIAL'); const [angle, setAngle] = useState('90');
  const [password, setPassword] = useState(''); const [confirmPassword, setConfirmPassword] = useState('');
  const [start, setStart] = useState('1'); const [result, setResult] = useState(null);
  const [ocrLanguages, setOcrLanguages] = useState(['eng']);
  const [openingText, setOpeningText] = useState(false);
  const customEndpoint = ['remove-pages', 'add-watermark', 'add-page-numbers', 'scan-to-pdf', 'convert-to-pdf', 'text-to-pdf', 'text-to-document', 'pdf-to-document', 'compress', 'compress-image', 'repair-pdf', 'crop-pdf', 'edit-pdf', 'flatten-pdf', 'extract-images', 'unlock-pdf', 'clean-metadata', 'sign-pdf', 'redact-pdf', 'pdf-forms', 'html-to-pdf', 'to-jpg', 'to-png', 'to-markdown', 'to-excel', 'pdf-to-powerpoint', 'pdf-to-pdfa', 'office-to-pdf', 'summarize', 'compare'];
  const isCustomTool = Boolean(tool && (customEndpoint.includes(tool.endpoint) || tool.merge));
  const savedDraft = { state: { pages, selected, text, angle, start, ...(tool?.ocr && { ocrLanguages }) }, files, signature: null };
  const { ready: draftReady, status: draftStatus } = useBrowserDraft(tool ? `tool:${tool.slug}` : '', savedDraft, (draft) => {
    setFiles(draft.files || []);
    const state = draft.state || {};
    if (state.pages !== undefined) setPages(state.pages);
    if (state.selected) setSelected(state.selected);
    if (state.text !== undefined) setText(state.text);
    if (state.angle !== undefined) setAngle(state.angle);
    if (state.start !== undefined) setStart(state.start);
    if (Array.isArray(state.ocrLanguages) && state.ocrLanguages.length) setOcrLanguages(state.ocrLanguages);
  }, Boolean(tool && !isCustomTool));
  if (!tool) return <main className="container py-5">Tool not found.</main>;
  let customToolPage = null;
  if (tool.endpoint === 'remove-pages') customToolPage = <RemovePagesPage tool={tool}/>;
  else if (tool.endpoint === 'add-watermark') customToolPage = <WatermarkPage tool={tool}/>;
  else if (tool.endpoint === 'add-page-numbers') customToolPage = <PageNumbersPage tool={tool}/>;
  else if (tool.endpoint === 'scan-to-pdf' || tool.endpoint === 'convert-to-pdf') customToolPage = <ScanToPdfPage tool={tool}/>;
  else if (tool.endpoint === 'text-to-pdf') customToolPage = <TextToPdfPage tool={tool}/>;
  else if (tool.endpoint === 'text-to-document') customToolPage = <TextToPdfPage tool={tool} format="docx"/>;
  else if (tool.endpoint === 'pdf-to-document') customToolPage = <PdfToDocumentPage tool={tool}/>;
  else if (tool.endpoint === 'compress') customToolPage = <CompressFilesPage tool={tool}/>;
  else if (tool.endpoint === 'compress-image') customToolPage = <CompressImagePage tool={tool}/>;
  else if (['repair-pdf', 'crop-pdf', 'edit-pdf', 'flatten-pdf', 'extract-images', 'unlock-pdf', 'clean-metadata', 'sign-pdf', 'redact-pdf', 'pdf-forms', 'html-to-pdf', 'to-jpg', 'to-png', 'to-markdown', 'to-excel', 'pdf-to-powerpoint', 'pdf-to-pdfa', 'office-to-pdf', 'summarize', 'compare'].includes(tool.endpoint)) customToolPage = <ExtraPdfToolPage tool={tool}/>;
  else if (tool.merge) customToolPage = <MergePdfPage tool={tool}/>;
  if (customToolPage) return <>{customToolPage}<ToolGuide tool={tool}/></>;
  if (!draftReady) return <main className="container py-5 tool-page"><p className="small text-secondary">Restoring your saved work…</p></main>;
  const togglePage = (page) => setSelected((current) => { const next = current.includes(page) ? current.filter((number) => number !== page) : [...current, page].sort((a,b) => a-b); setPages(next.join(',')); return next; });
  const submit = async () => {
    if (!files.length) return toast.error('Select a file first');
    if (tool.protect && password.length < 8) return toast.error('Use a password with at least 8 characters');
    if (tool.protect && password !== confirmPassword) return toast.error('The passwords do not match');
    if (tool.pages && !pages) return toast.error('Select at least one page');
    setBusy(true); setResult(null);
    try {
      const body = new FormData(); files.forEach((file) => body.append('files', file));
      if (tool.pages) body.append('pages', pages); if (tool.text) body.append('text', text);
      if (tool.rotate) body.append('angle', angle); if (tool.start) body.append('start', start);
      if (tool.protect) body.append('password', password);
      if (tool.ocr) body.append('languages', ocrLanguages.join('+'));
      const response = await fetch(`${apiBaseUrl}/pdf/${tool.endpoint}`, { method: 'POST', body, credentials: 'include' });
      if (!response.ok) { const error = await response.json(); throw Error(error.error); }
      setResult(URL.createObjectURL(await response.blob())); toast.success('Your PDF is ready');
    } catch (error) { toast.error(error.message); } finally { setBusy(false); }
  };
  const openOcrText = async () => {
    setOpeningText(true);
    try {
      const response = await fetch(result);
      if (!response.ok) throw new Error('Could not open the completed PDF.');
      const state = await readPdfText(await response.blob(), createDownloadName(files[0], 'pdf'));
      navigate('/tools/text-to-document', { state });
    } catch (error) {
      toast.error(error.message || 'Could not open the recognized text.');
    } finally {
      setOpeningText(false);
    }
  };
  return <><main className="container py-5 tool-page">
    <Link to="/tools" className="back">← All tools</Link>
    <h2>{tool.name}</h2><p className="lead">{tool.description}</p>
    {draftStatus && <p className={`small ${draftStatus === 'Autosave unavailable' ? 'text-warning' : 'text-success'}`} role="status">{draftStatus}</p>}
    <FileUploader tool={tool} onFiles={(newFiles) => { setFiles(tool.multiple ? newFiles : newFiles.slice(0, 1)); setSelected([]); setPages(''); setResult(null); }}/>
    {files.length > 0 && <UploadedFileList files={files}/>}
    {tool.pages && files[0]?.type === 'application/pdf' && <PdfPagePreview file={files[0]} selectedPages={selected} onToggle={togglePage}/>}
    {tool.protect && <div className="row g-3 mt-1">
      <label className="col-md-6">PDF password<input className="form-control" type="password" autoComplete="new-password" minLength="8" maxLength="128" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters"/></label>
      <label className="col-md-6">Confirm password<input className="form-control" type="password" autoComplete="new-password" minLength="8" maxLength="128" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)}/></label>
      <small className="text-secondary">You will need this password to open the protected PDF. Encryption uses AES-256.</small>
    </div>}
    {tool.ocr && <OcrLanguagePicker selected={ocrLanguages} onChange={setOcrLanguages} disabled={busy}/>}
    {tool.pages && <label className="mt-3">Selected pages<input className="form-control" placeholder="Click pages above or type 1-3,5" value={pages} onChange={(event) => { setPages(event.target.value); setSelected([]); }}/></label>}
    {tool.text && <label className="mt-3">Watermark text<input className="form-control" value={text} onChange={(event) => setText(event.target.value)}/></label>}
    {tool.rotate && <label className="mt-3">Rotation<select className="form-select" value={angle} onChange={(event) => setAngle(event.target.value)}><option>90</option><option>180</option><option>270</option></select></label>}
    {tool.start && <label className="mt-3">Starting page number<input className="form-control" type="number" value={start} onChange={(event) => setStart(event.target.value)}/></label>}
    <button className="btn btn-primary mt-4" onClick={submit} disabled={busy}>{busy ? 'Processing…' : tool.ocr && files.length ? 'Create searchable PDF' : tool.name}</button>
    <OperationProgressModal show={busy} title={`PDF Pro Cut is processing ${tool.name.toLowerCase()}`} description="Please wait while your file is prepared."/>
    <DownloadResultModal href={result} fileName={files[0] ? createDownloadName(files[0], 'pdf') : ''} toolSlug={tool.slug} title={`PDF Pro Cut completed ${tool.name.toLowerCase()}`} downloadLabel="Download result" onClose={() => setResult(null)}>
      {tool.ocr && <button className="btn btn-outline-primary" type="button" onClick={openOcrText} disabled={openingText}>
        {openingText ? 'Opening editor…' : 'Open text in editor'}
      </button>}
    </DownloadResultModal>
  </main><ToolGuide tool={tool}/></>;
}

function OcrLanguagePicker({ selected, onChange, disabled }) {
  const [config, setConfig] = useState(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`${apiBaseUrl}/pdf/ocr-pdf/languages`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error('Could not load OCR languages');
        return response.json();
      })
      .then(({ data }) => setConfig(data))
      .catch(() => { if (!controller.signal.aborted) setFailed(true); });
    return () => controller.abort();
  }, []);

  const languages = config?.languages || [{ code: 'eng', name: 'English' }, { code: 'mal', name: 'Malayalam' }];
  const selectors = selected.length < (config?.maxLanguages || 2) ? [...selected, ''] : selected;
  return <fieldset className="mt-3" disabled={disabled}>
    <legend className="fs-6 fw-semibold">Document languages</legend>
    <div className="row g-2">
      {selectors.map((value, index) => <label className="col-sm-6 col-lg-4" key={index}>
        {index === 0 ? 'Primary language' : `Additional language ${index}`}
        <select className="form-select" value={value} onChange={(event) => {
          const next = [...selected];
          next[index] = event.target.value;
          onChange(next.filter(Boolean));
        }}>
          {index > 0 && <option value="">None</option>}
          {value && !languages.some(({ code }) => code === value) && <option value={value}>{value}</option>}
          {languages.filter(({ code }) => code === value || !selected.includes(code))
            .map(({ code, name }) => <option key={code} value={code}>{name}</option>)}
        </select>
      </label>)}
    </div>
    <p className="text-secondary mt-2 mb-0">Select the languages on the scanned pages. PDFs can contain up to 30 pages.</p>
    {failed && <p className="text-secondary mt-1 mb-0" role="status">The full language list could not be loaded.</p>}
  </fieldset>;
}
