import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { createDownloadName } from '../utils/downloadName.js';
import { getSession } from '../lib/authApi.js';
import { getPhotoRoomBackgroundStatus, processPhotoBackground } from '../lib/photoRoomBackground.js';
import '../styles/imageBackgroundTool.css';

const maxFileBytes = 25 * 1024 * 1024;
const maxImagePixels = 25_000_000;

export default function ImageBackgroundToolPage({ tool }) {
  const [available, setAvailable] = useState(null);
  const [signedIn, setSignedIn] = useState(null);
  const [file, setFile] = useState(null);
  const [inputUrl, setInputUrl] = useState('');
  const [result, setResult] = useState(null);
  const [mode, setMode] = useState('transparent');
  const [backgroundColor, setBackgroundColor] = useState('#ffffff');
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    getPhotoRoomBackgroundStatus()
      .then((enabled) => { if (!cancelled) setAvailable(enabled); })
      .catch(() => { if (!cancelled) setAvailable(false); });
    getSession()
      .then((session) => { if (!cancelled) setSignedIn(Boolean(session.user)); })
      .catch(() => { if (!cancelled) setSignedIn(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => () => { if (inputUrl) URL.revokeObjectURL(inputUrl); }, [inputUrl]);
  useEffect(() => () => { if (result?.url) URL.revokeObjectURL(result.url); }, [result?.url]);

  const selectFile = async (nextFile) => {
    setError('');
    if (result?.url) URL.revokeObjectURL(result.url);
    setResult(null);
    if (inputUrl) URL.revokeObjectURL(inputUrl);
    setFile(null);
    setConsent(false);
    if (!nextFile) { setInputUrl(''); return; }
    if (nextFile.size > maxFileBytes) { setInputUrl(''); setError('Choose an image smaller than 25 MB.'); return; }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(nextFile.type)) { setInputUrl(''); setError('Choose a JPG, PNG, or WebP image.'); return; }
    try {
      const bitmap = await createImageBitmap(nextFile);
      const validSize = bitmap.width * bitmap.height <= maxImagePixels && Math.max(bitmap.width, bitmap.height) <= 6000;
      bitmap.close();
      if (!validSize) { setInputUrl(''); setError('PhotoRoom supports images up to 25 megapixels and 6,000 pixels on the longest side.'); return; }
    } catch {
      setInputUrl(''); setError('This image could not be opened. Try another JPG, PNG, or WebP image.');
      return;
    }
    setFile(nextFile);
    setInputUrl(URL.createObjectURL(nextFile));
  };

  const process = async () => {
    if (!file) return setError('Choose an image first.');
    if (!consent) return setError('Confirm the PhotoRoom processing notice before continuing.');
    setBusy(true);
    setError('');
    if (result?.url) URL.revokeObjectURL(result.url);
    setResult(null);
    try {
      const blob = await processPhotoBackground(file, {
        backgroundColor: mode === 'color' ? backgroundColor : '',
        consent
      });
      setResult({ blob, url: URL.createObjectURL(blob) });
    } catch (processError) {
      setError(processError.message || 'Could not remove this image background.');
    } finally {
      setBusy(false);
    }
  };

  return <main className="container py-5 tool-page image-background-tool">
    <h1>{tool.name}</h1>
    <p className="lead">Remove a photo background cleanly, keep it transparent, or replace it with a solid color.</p>

    {available === false && <div className="alert alert-warning" role="status">
      AI background processing is not configured on this server. Add <code>PHOTOROOM_API_KEY</code> to the server environment to enable it.
    </div>}
    {available === null && <p className="small text-secondary" role="status">Checking the background service…</p>}
    {available && signedIn === false && <p className="alert alert-info" role="status">Sign in before using AI background processing. <Link to="/login">Sign in</Link></p>}

    <section className="image-background-controls" aria-label="Background settings">
      <label className="government-file-label">Choose a photo (JPG, PNG, or WebP)
        <input type="file" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" onChange={(event) => { selectFile(event.target.files?.[0]); event.target.value = ''; }}/>
      </label>
      <label className="government-inline-field">Output background
        <select className="form-select" value={mode} onChange={(event) => { setMode(event.target.value); setResult((current) => { if (current?.url) URL.revokeObjectURL(current.url); return null; }); }}>
          <option value="transparent">Transparent PNG</option>
          <option value="color">Solid color</option>
        </select>
      </label>
      {mode === 'color' && <label className="government-inline-field">Replacement color
        <input className="form-control form-control-color" type="color" value={backgroundColor} onChange={(event) => { setBackgroundColor(event.target.value); setResult((current) => { if (current?.url) URL.revokeObjectURL(current.url); return null; }); }}/>
      </label>}
      <label className="image-background-consent">
        <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)}/>
        <span>I agree to send this image through PDF Pro Cut to PhotoRoom for background processing. I will not send a signature or an image I do not have permission to use.</span>
      </label>
      <p className="small text-secondary mb-0">PhotoRoom processes this request in the United States. It says API images are discarded after processing and are not used to train its models. Do not use this tool for a sensitive ID photo if that transfer is not acceptable.</p>
      <button className="btn btn-primary" type="button" onClick={process} disabled={!available || !signedIn || !file || !consent || busy}>
        {busy ? 'Removing background…' : mode === 'color' ? 'Replace background' : 'Remove background'}
      </button>
      {error && <p className="alert alert-danger mb-0" role="alert">{error}</p>}
    </section>

    <div className="image-background-previews">
      {inputUrl && <figure><figcaption>Original image</figcaption><img src={inputUrl} alt="Selected original"/></figure>}
      {result && <figure className="image-background-result"><figcaption>Processed image</figcaption><img src={result.url} alt="Background-removed result"/><a className="btn btn-outline-primary" href={result.url} download={createDownloadName(file, 'png', tool.slug)}>Download PNG</a></figure>}
    </div>
  </main>;
}
