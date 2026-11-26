import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FaDownload, FaEdit, FaExternalLinkAlt, FaSave, FaTimes, FaTrashAlt } from 'react-icons/fa';
import { useAuth } from '../context/AuthContext.jsx';
import { useProfile } from '../context/ProfileContext.jsx';
import SavedDocumentThumbnail from '../components/pdf/SavedDocumentThumbnail.jsx';
import ConfirmActionDialog from '../components/ConfirmActionDialog.jsx';
import { createDownloadName } from '../utils/downloadName.js';
import '../styles/profile.css';

async function makeProfilePhoto(file) {
  if (!file) return '';
  if (!file.type.startsWith('image/')) throw new Error('Choose an image file for your profile photo.');
  if (file.size > 10 * 1024 * 1024) throw new Error('Choose a profile photo smaller than 10 MB.');
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 384 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  try {
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Your browser could not prepare this photo.');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error('Your browser could not prepare this photo.')), 'image/jpeg', 0.84));
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('Your browser could not read this photo.'));
      reader.readAsDataURL(blob);
    });
  } finally {
    bitmap.close();
    canvas.width = 0;
    canvas.height = 0;
  }
}

function ProfileAvatar({ photo, name }) {
  return photo
    ? <img className="local-profile-avatar" src={photo} alt={`${name || 'Profile'} profile`}/>
    : <div className="local-profile-avatar local-profile-avatar-empty" aria-label="No profile photo">{name?.trim()?.[0]?.toUpperCase() || '?'}</div>;
}

function activityCategory(entry) {
  const label = `${entry.tool} ${entry.outputName}`.toLowerCase();
  if (/compress|reduce size/.test(label)) return 'Compress';
  if (/merge|split|organize|remove pages|extract|scan/.test(label)) return 'Organize';
  if (/convert|to pdf|to word|to excel|to powerpoint|to jpg/.test(label)) return 'Convert';
  if (/watermark|page numbers|rotate|crop|edit|sign|redact|protect|unlock|repair|form/.test(label)) return 'Edit';
  return 'Other';
}

function formatDocumentSize(bytes) {
  if (!bytes) return '0 KB';
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

export default function ProfilePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    profile, history, documents, hasProfile, loading, storageError,
    createProfile, updateProfile, deleteProfile, clearHistory, removeHistoryItem,
    downloadDocument, renameDocument, removeDocument, setPendingToolFile
  } = useProfile();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [photo, setPhoto] = useState('');
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [historySearch, setHistorySearch] = useState('');
  const [historyCategory, setHistoryCategory] = useState('All work');
  const [historyPeriod, setHistoryPeriod] = useState('all');
  const [historySort, setHistorySort] = useState('newest');
  const [editingDocument, setEditingDocument] = useState(null);
  const [documentName, setDocumentName] = useState('');
  const [documentToRemove, setDocumentToRemove] = useState(null);

  const historySummary = useMemo(() => {
    const recentCutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const recentCount = history.filter((entry) => new Date(entry.createdAt).getTime() >= recentCutoff).length;
    const counts = history.reduce((result, entry) => {
      result[entry.tool] = (result[entry.tool] || 0) + 1;
      return result;
    }, {});
    const topTool = Object.entries(counts).sort((left, right) => right[1] - left[1])[0]?.[0] || '—';
    return { total: history.length, recentCount, topTool };
  }, [history]);

  const visibleHistory = useMemo(() => {
    const query = historySearch.trim().toLowerCase();
    const cutoff = historyPeriod === 'all' ? 0 : Date.now() - Number(historyPeriod) * 24 * 60 * 60 * 1000;
    return [...history]
      .filter((entry) => {
        const matchesQuery = !query || `${entry.tool} ${entry.outputName}`.toLowerCase().includes(query);
        const matchesCategory = historyCategory === 'All work' || activityCategory(entry) === historyCategory;
        const matchesPeriod = new Date(entry.createdAt).getTime() >= cutoff;
        return matchesQuery && matchesCategory && matchesPeriod;
      })
      .sort((left, right) => historySort === 'newest'
        ? right.createdAt.localeCompare(left.createdAt)
        : left.createdAt.localeCompare(right.createdAt));
  }, [history, historySearch, historyCategory, historyPeriod, historySort]);

  useEffect(() => {
    if (profile) {
      setName(profile.name || '');
      setEmail(profile.email || '');
      setPhone(profile.phone || '');
      setPhoto(profile.photo || '');
    } else {
      setName(user?.name || '');
      setEmail(user?.email || '');
    }
  }, [profile, user]);

  const changePhoto = async (event) => {
    const selected = event.target.files?.[0];
    event.target.value = '';
    if (!selected) return;
    setError('');
    try { setPhoto(await makeProfilePhoto(selected)); }
    catch (photoError) { setError(photoError.message || 'Could not load this profile photo.'); }
  };

  const saveNewProfile = async (event) => {
    event.preventDefault();
    setError('');
    setNotice('');
    setBusy(true);
    try {
      await createProfile({ name: name.trim(), email: email.trim().toLowerCase(), phone: phone.trim(), photo });
      setNotice('Your local profile is ready on this device.');
    } catch (saveError) {
      setError(saveError.message || 'Could not create your local profile.');
    } finally { setBusy(false); }
  };

  const saveChanges = async (event) => {
    event.preventDefault();
    setError('');
    setNotice('');
    setBusy(true);
    try {
      await updateProfile({ name: name.trim(), email: email.trim().toLowerCase(), phone: phone.trim(), photo });
      setEditing(false);
      setNotice('Profile saved on this device.');
    } catch (saveError) {
      setError(saveError.message || 'Could not save profile changes.');
    } finally { setBusy(false); }
  };

  const removeProfile = async () => {
    if (!window.confirm('Erase this local profile and its saved work history from this browser?')) return;
    setBusy(true);
    try {
      await deleteProfile();
      setEditing(false);
      setNotice('Local profile and work history erased.');
    } catch {
      setError('Could not erase the local profile from browser storage.');
    } finally { setBusy(false); }
  };

  const removeHistory = async () => {
    if (!window.confirm('Clear all completed work from this profile?')) return;
    setError('');
    try { await clearHistory(); setNotice('Work history cleared.'); }
    catch (clearError) { setError(clearError.message || 'Could not clear work history.'); }
  };

  const removeHistoryEntry = async (id) => {
    try { await removeHistoryItem(id); }
    catch (removeError) { setError(removeError.message || 'Could not remove this history entry.'); }
  };

  const handleDownloadDocument = async (document) => {
    setError('');
    try {
      const blob = await downloadDocument(document.id);
      const url = URL.createObjectURL(blob);
      const anchor = window.document.createElement('a');
      anchor.href = url;
      anchor.download = createDownloadName({ name: document.name }, document.name.match(/\.([^.]+)$/)?.[1] || 'file');
      window.document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (downloadError) {
      setError(downloadError.message || 'Could not download this saved document.');
    }
  };

  const startDocumentRename = (document) => {
    setEditingDocument(document.id);
    setDocumentName(document.name);
    setError('');
  };

  const saveDocumentRename = async (event) => {
    event.preventDefault();
    try {
      await renameDocument(editingDocument, documentName);
      setEditingDocument(null);
      setNotice('Document name updated.');
    } catch (renameError) {
      setError(renameError.message || 'Could not edit this document name.');
    }
  };

  const launchDocumentInTools = async (document) => {
    setError('');
    try {
      const blob = await downloadDocument(document.id);
      setPendingToolFile(new File([blob], document.name, { type: document.type || blob.type || 'application/octet-stream' }));
      navigate('/tools');
    } catch (openError) {
      setError(openError.message || 'Could not open this document in the tools.');
    }
  };

  const handleRemoveDocument = (document) => setDocumentToRemove(document);

  const confirmRemoveDocument = async () => {
    const document = documentToRemove;
    if (!document) return;
    try {
      await removeDocument(document.id);
      setNotice('Document removed from your local archive.');
    } catch (removeError) {
      setError(removeError.message || 'Could not remove this document.');
    } finally { setDocumentToRemove(null); }
  };

  if (loading) return <main className="container py-5 profile-page"><p>Loading local profile…</p></main>;

  if (!hasProfile) return <main className="container py-5 profile-page">
    <section className="profile-editor-card">
      <span className="profile-eyebrow">LOCAL PROFILE</span>
      <h1>Create your profile</h1>
      <p>Your profile details and work history are saved in this browser. They are not encrypted by the app, so avoid saving sensitive information here.</p>
      {error && <p className="profile-error" role="alert">{error}</p>}
      {notice && <p className="profile-success" role="status">{notice}</p>}
      {storageError && <p className="profile-error" role="alert">{storageError}</p>}
      <form className="profile-form" onSubmit={saveNewProfile}>
        <label>Profile name<input type="text" autoComplete="name" required maxLength="80" value={name} onChange={(event) => setName(event.target.value)}/></label>
        <label>Gmail ID / email<input type="email" autoComplete="email" required maxLength="254" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@gmail.com"/></label>
        <label>Phone number <span>(optional)</span><input type="tel" autoComplete="tel" maxLength="30" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="Add a phone number"/></label>
        <label>Profile photo <span>(optional)</span><input type="file" accept="image/*" onChange={changePhoto}/></label>
        <div className="profile-photo-preview"><ProfileAvatar photo={photo} name={name}/><span>Your resized photo is stored in this browser.</span></div>
        <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? 'Creating profile…' : 'Create local profile'}</button>
      </form>
    </section>
  </main>;

  return <main className="container py-5 profile-page">
    <section className="profile-welcome-card">
      <ProfileAvatar photo={profile.photo} name={profile.name}/>
      <div className="profile-welcome-info"><span className="profile-eyebrow">LOCAL PROFILE</span><h1>{profile.name}</h1><p>{profile.email}{profile.phone ? ` · ${profile.phone}` : ''}</p><span className="profile-local-badge">Saved in this browser</span></div>
      <div className="profile-welcome-actions"><button className="btn btn-outline-primary" type="button" onClick={() => { setEditing((value) => !value); setNotice(''); }}> {editing ? 'Close editor' : 'Edit profile'}</button></div>
    </section>
    {error && <p className="profile-error" role="alert">{error}</p>}
    {notice && <p className="profile-success" role="status">{notice}</p>}
    {storageError && <p className="profile-error" role="alert">{storageError}</p>}
    <section className="profile-stat-grid" aria-label="Work history summary">
      <article className="profile-stat-card"><span>Saved operations</span><strong>{historySummary.total}</strong><small>Latest 100 are kept</small></article>
      <article className="profile-stat-card"><span>Last 30 days</span><strong>{historySummary.recentCount}</strong><small>Completed operations</small></article>
      <article className="profile-stat-card"><span>Most used tool</span><strong className="profile-stat-tool" title={historySummary.topTool}>{historySummary.topTool}</strong><small>{history.length ? 'Based on your history' : 'Use a tool to get started'}</small></article>
    </section>
    {editing && <section className="profile-card profile-edit-card">
      <form className="profile-form" onSubmit={saveChanges}>
        <h2>Edit profile</h2>
        <label>Profile name<input type="text" autoComplete="name" required maxLength="80" value={name} onChange={(event) => setName(event.target.value)}/></label>
        <label>Gmail ID / email<input type="email" autoComplete="email" required maxLength="254" value={email} onChange={(event) => setEmail(event.target.value)}/></label>
        <label>Phone number <span>(optional)</span><input type="tel" autoComplete="tel" maxLength="30" value={phone} onChange={(event) => setPhone(event.target.value)}/></label>
        <label>Change profile photo<input type="file" accept="image/*" onChange={changePhoto}/></label>
        <div className="profile-photo-preview"><ProfileAvatar photo={photo} name={name}/>{photo && <button className="profile-text-button" type="button" onClick={() => setPhoto('')}>Remove photo</button>}</div>
        <div className="profile-form-actions"><button className="btn btn-primary" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button><button className="btn btn-outline-secondary" type="button" onClick={() => { setEditing(false); setError(''); }}>Cancel</button></div>
      </form>
    </section>}

    <section className="profile-documents-card" aria-labelledby="profile-documents-title">
      <div className="profile-history-heading"><div><span className="profile-eyebrow">LOCAL ARCHIVE</span><h2 id="profile-documents-title">Saved documents</h2><p>The app checks for and removes saved files after 30 minutes while the site is open. Download a copy to keep it.</p></div><span className="profile-document-count">{documents.length} {documents.length === 1 ? 'file' : 'files'}</span></div>
      {documents.length ? <div className="profile-document-list">{documents.map((document) => <article className="profile-document-card" key={document.id}>
        <SavedDocumentThumbnail document={document}/>
        {editingDocument === document.id ? <form className="profile-document-rename" onSubmit={saveDocumentRename}>
          <label><span className="visually-hidden">Edit document name</span><input autoFocus value={documentName} onChange={(event) => setDocumentName(event.target.value)} maxLength="160" required/></label>
          <button className="btn btn-sm btn-primary" type="submit"><FaSave aria-hidden="true"/> Save</button><button className="btn btn-sm btn-outline-secondary" type="button" onClick={() => setEditingDocument(null)}><FaTimes aria-hidden="true"/> Cancel</button>
        </form> : <div className="profile-document-info"><strong title={document.name}>{document.name}</strong><span>{document.tool} · {formatDocumentSize(document.size)} · {new Date(document.createdAt).toLocaleDateString()}</span></div>}
        {editingDocument !== document.id && <div className="profile-document-actions">
          <button className="profile-document-download" type="button" onClick={() => handleDownloadDocument(document)}><FaDownload aria-hidden="true"/> Download</button>
          <button type="button" onClick={() => startDocumentRename(document)}><FaEdit aria-hidden="true"/> Rename</button>
          <button type="button" onClick={() => launchDocumentInTools(document)}><FaExternalLinkAlt aria-hidden="true"/> Edit with tools</button>
          <button className="profile-document-remove" type="button" onClick={() => handleRemoveDocument(document)}><FaTrashAlt aria-hidden="true"/> Remove</button>
        </div>}
      </article>)}</div> : <div className="profile-empty-history"><p>Completed files will be saved here automatically.</p><span>The app removes saved files after 30 minutes while the site is open. Download a copy to keep it.</span><div><Link to="/tools">Browse tools</Link></div></div>}
    </section>

    <section className="profile-history-card" aria-labelledby="profile-history-title">
      <div className="profile-history-heading"><div><span className="profile-eyebrow">ON THIS DEVICE</span><h2 id="profile-history-title">Completed work</h2><p>Search, filter, or sort your latest 100 operations.</p></div>{history.length > 0 && <button className="profile-text-button" type="button" onClick={removeHistory}>Clear history</button>}</div>
      {history.length > 0 && <div className="profile-history-controls">
        <label className="profile-history-search"><span className="visually-hidden">Search work history</span><input type="search" placeholder="Search tools or filenames" value={historySearch} onChange={(event) => setHistorySearch(event.target.value)}/></label>
        <label><span className="visually-hidden">Filter by category</span><select value={historyCategory} onChange={(event) => setHistoryCategory(event.target.value)}><option>All work</option><option>Organize</option><option>Compress</option><option>Convert</option><option>Edit</option><option>Other</option></select></label>
        <label><span className="visually-hidden">Filter by date</span><select value={historyPeriod} onChange={(event) => setHistoryPeriod(event.target.value)}><option value="all">Any time</option><option value="7">Last 7 days</option><option value="30">Last 30 days</option></select></label>
        <label><span className="visually-hidden">Sort history</span><select value={historySort} onChange={(event) => setHistorySort(event.target.value)}><option value="newest">Newest first</option><option value="oldest">Oldest first</option></select></label>
      </div>}
      {history.length > 0 && <p className="profile-result-count">Showing {visibleHistory.length}{" " + 'of' + " "}{history.length}{" " + 'saved' + " "}{history.length === 1 ? 'operation' : 'operations'}</p>}
      {visibleHistory.length ? <ul className="profile-history-list">{visibleHistory.map((entry) => {
        const category = activityCategory(entry);
        return <li key={entry.id}>
          <div className="profile-history-main"><span className={`profile-activity-tag profile-activity-${category.toLowerCase()}`}>{category}</span><strong>{entry.tool}</strong><span>{entry.outputName}</span></div>
          <div className="profile-history-meta"><time dateTime={entry.createdAt}>{new Date(entry.createdAt).toLocaleString()}</time><button className="profile-remove-entry" type="button" onClick={() => removeHistoryEntry(entry.id)} aria-label={`Remove ${entry.outputName} from history`}>Remove</button></div>
        </li>;
      })}</ul> : history.length ? <div className="profile-empty-history"><p>No work matches these filters.</p><button className="profile-text-button" type="button" onClick={() => { setHistorySearch(''); setHistoryCategory('All work'); setHistoryPeriod('all'); }}>Reset filters</button></div> : <div className="profile-empty-history"><p>Completed work will appear here after you use a tool.</p><Link to="/tools">Browse tools</Link></div>}
    </section>
    <p className="profile-data-note">Profile details, work history, and saved outputs are stored locally in this browser without app-level encryption. Input files are not archived.</p>
    <button className="profile-text-button profile-delete-button" type="button" onClick={removeProfile}>Erase profile and local work history</button>
    <ConfirmActionDialog
      open={Boolean(documentToRemove)}
      title="Remove saved document?"
      message={documentToRemove ? `Remove ${documentToRemove.name} from your saved documents?` : ''}
      confirmLabel="OK"
      cancelLabel="Cancel"
      onCancel={() => setDocumentToRemove(null)}
      onConfirm={confirmRemoveDocument}
    />
  </main>;
}
