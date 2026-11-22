import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import FileUploader from '../components/pdf/FileUploader.jsx';
import { DownloadResultModal, OperationProgressModal } from '../components/pdf/FileOperationModals.jsx';
import { createDownloadName } from '../utils/downloadName.js';
import UploadedFileList from '../components/pdf/UploadedFileList.jsx';
import { useBrowserDraft } from '../lib/browserDraft.js';
import { readPdfText } from '../lib/pdfText.js';

export default function PdfToDocumentPage({ tool }) {
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [openingEditor, setOpeningEditor] = useState(false);
  const [conversionAvailable, setConversionAvailable] = useState(null);
  const [result, setResult] = useState(null);
  const draft = { state: {}, files: file ? [file] : [], signature: null };
  const { ready: draftReady, status: draftStatus } = useBrowserDraft(`tool:${tool.slug}`, draft, (saved) => setFile(saved.files[0] || null));

  useEffect(() => {
    let active = true;
    fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/pdf/pdf-to-document/config`)
      .then((response) => response.json())
      .then((payload) => { if (active) setConversionAvailable(Boolean(payload.data?.conversionAvailable)); })
      .catch(() => { if (active) setConversionAvailable(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => () => {
    if (result?.url) URL.revokeObjectURL(result.url);
  }, [result]);

  const convert = async () => {
    if (!file) return toast.error('Select a PDF first');
    setBusy(true);
    setResult(null);
    try {
      const body = new FormData();
      body.append('files', file);
      body.append('provider', 'online');
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/pdf/${tool.endpoint}`, {
        method: 'POST',
        body,
        credentials: 'include'
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || 'Could not convert this PDF');
      }
      setResult({ url: URL.createObjectURL(await response.blob()), name: createDownloadName(file, 'docx') });
      toast.success('PDF Pro Cut converted your file successfully');
    } catch (error) {
      toast.error(error.message || 'Could not convert this PDF');
    } finally {
      setBusy(false);
    }
  };

  const editDocument = async () => {
    if (!file) return;
    setOpeningEditor(true);
    try {
      const state = await readPdfText(file, file.name);
      navigate('/tools/text-to-document', { state });
    } catch (error) {
      toast.error(error.message || 'Could not open this PDF in the editor');
    } finally {
      setOpeningEditor(false);
    }
  };

  if (!draftReady) return <main className="container py-5 tool-page"><p className="small text-secondary">Restoring your saved work…</p></main>;

  return <main className="container py-5 tool-page">
    <Link to="/tools" className="back">← All tools</Link>
    <h2>{tool.name}</h2>
    <p className="lead">Convert selectable text in a PDF into an editable Word document.</p>
    {draftStatus && <p className={`small ${draftStatus === 'Autosave unavailable' ? 'text-warning' : 'text-success'}`} role="status">{draftStatus}</p>}
    <div className={`alert ${conversionAvailable === true ? 'alert-info' : 'alert-warning'}`} role="note">
      {conversionAvailable === true
        ? 'PDF Pro Cut converts your PDF to Word using our online conversion service. Your PDF is sent securely for processing; scanned pages can also use OCR. Some layout details may still shift in Word.'
        : conversionAvailable === false
          ? 'PDF Pro Cut online conversion is temporarily unavailable. PDF to Word conversion will be enabled when the service is ready.'
          : 'Preparing PDF Pro Cut conversion…'}
    </div>
    <FileUploader tool={tool} onFiles={(newFiles) => { setFile(newFiles[0] || null); setResult(null); }}/>
    {file && <UploadedFileList files={file}/>}
    <button className="btn btn-primary mt-4" type="button" onClick={convert} disabled={busy || !file || conversionAvailable !== true}>
      {busy ? 'Converting to Word…' : 'Convert to Word'}
    </button>
    <button className="btn btn-outline-primary mt-4 ms-2" type="button" onClick={editDocument} disabled={!file || busy || openingEditor}>
      {openingEditor ? 'Opening editor…' : 'Open text in editor'}
    </button>
    <OperationProgressModal show={busy} title="PDF Pro Cut is converting your file" description="Please wait while your Word document is prepared."/>
    <DownloadResultModal href={result?.url} fileName={result?.name} toolSlug={tool.slug} title="PDF Pro Cut converted your file" downloadLabel="Download Word file" onClose={() => setResult(null)}>
      <button className="btn btn-outline-primary" type="button" onClick={editDocument} disabled={openingEditor}>
        {openingEditor ? 'Opening editor…' : 'Edit document'}
      </button>
    </DownloadResultModal>
  </main>;
}
