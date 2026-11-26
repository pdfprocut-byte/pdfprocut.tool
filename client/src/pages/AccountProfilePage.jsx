import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { FaDownload, FaEdit, FaExternalLinkAlt, FaSave, FaTrashAlt } from 'react-icons/fa';
import { useAuth } from '../context/AuthContext.jsx';
import { useProfile } from '../context/ProfileContext.jsx';
import { authRequest } from '../lib/authApi.js';
import SavedDocumentThumbnail from '../components/pdf/SavedDocumentThumbnail.jsx';
import ConfirmActionDialog from '../components/ConfirmActionDialog.jsx';
import { createDownloadName } from '../utils/downloadName.js';
import '../styles/accountProfile.css';
import '../styles/accountDashboard.css';

const formatTool = (name = 'PDF tool') => String(name).split('-').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
const formatSize = (bytes = 0) => bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : bytes >= 1024 ? `${Math.round(bytes / 1024)} KB` : `${bytes} B`;
const blankProfile = (user) => ({ name: user?.name || '', phone: user?.phone || '', profession: user?.profession || '', age: user?.age == null ? '' : String(user.age), country: user?.country || '', profilePhoto: user?.profilePhoto || '' });

async function prepareProfilePhoto(file) {
  if (!file?.type.startsWith('image/')) throw new Error('Choose an image file for your profile photo.');
  if (file.size > 10 * 1024 * 1024) throw new Error('Choose a photo smaller than 10 MB.');
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 384 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  try {
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Your browser could not prepare this photo.');
    context.fillStyle = '#fff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error('Your browser could not prepare this photo.')), 'image/jpeg', 0.78));
    if (blob.size > 420_000) throw new Error('Choose a smaller profile photo.');
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error('Your browser could not read this photo.'));
      reader.readAsDataURL(blob);
    });
  } finally {
    bitmap.close();
    canvas.width = 0;
    canvas.height = 0;
  }
}

function ProfileAvatar({ user }) {
  return user.profilePhoto
    ? <img className="account-profile-avatar" src={user.profilePhoto} alt={`${user.name || 'Your'} profile`} />
    : <div className="account-profile-avatar account-profile-avatar-empty" aria-label="No profile photo">{user.name?.trim()?.[0]?.toUpperCase() || '?'}</div>;
}

export default function AccountProfilePage() {
  const navigate = useNavigate();
  const { user, setUser, loading } = useAuth();
  const {
    documents, loading: archiveLoading, storageError,
    downloadDocument, renameDocument, removeDocument, setPendingToolFile
  } = useProfile();
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [profileDraft, setProfileDraft] = useState(() => blankProfile(user));
  const [editingProfile, setEditingProfile] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [documentBusy, setDocumentBusy] = useState('');
  const [editingDocument, setEditingDocument] = useState(null);
  const [documentName, setDocumentName] = useState('');
  const [documentToRemove, setDocumentToRemove] = useState(null);
  useEffect(() => { setProfileDraft(blankProfile(user)); }, [user]);

  if (loading) return <main className="container py-5 account-profile"><p>Loading account...</p></main>;
  if (!user) return <Navigate to="/login" replace />;

  const saveProfile = async (event) => {
    event.preventDefault();
    setSavingProfile(true);
    setError('');
    setNotice('');
    try {
      const response = await authRequest('profile', {
        method: 'PUT',
        body: { ...profileDraft, age: profileDraft.age === '' ? null : Number(profileDraft.age) }
      });
      setUser(response.user);
      setProfileDraft(blankProfile(response.user));
      setEditingProfile(false);
      setNotice('Your profile details were saved.');
    } catch (requestError) {
      setError(requestError.message || 'Could not save your profile.');
    } finally { setSavingProfile(false); }
  };

  const selectPhoto = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setPhotoBusy(true);
    setError('');
    try {
      const profilePhoto = await prepareProfilePhoto(file);
      setProfileDraft((current) => ({ ...current, profilePhoto }));
    }
    catch (photoError) { setError(photoError.message || 'Could not load this photo.'); }
    finally { setPhotoBusy(false); }
  };

  const downloadSavedDocument = async (document) => {
    setDocumentBusy(document.id);
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
    } catch (documentError) { setError(documentError.message || 'Could not download this saved document.'); }
    finally { setDocumentBusy(''); }
  };

  const openDocumentInTools = async (document) => {
    setDocumentBusy(document.id);
    setError('');
    try {
      const blob = await downloadDocument(document.id);
      setPendingToolFile(new File([blob], document.name, { type: document.type || blob.type || 'application/octet-stream' }));
      navigate('/tools');
    } catch (documentError) { setError(documentError.message || 'Could not open this document in the tools.'); }
    finally { setDocumentBusy(''); }
  };

  const saveDocumentName = async (event) => {
    event.preventDefault();
    setDocumentBusy(editingDocument);
    setError('');
    try {
      await renameDocument(editingDocument, documentName);
      setEditingDocument(null);
      setNotice('Document name updated.');
    } catch (documentError) { setError(documentError.message || 'Could not rename this document.'); }
    finally { setDocumentBusy(''); }
  };

  const deleteSavedDocument = (document) => setDocumentToRemove(document);

  const confirmRemoveSavedDocument = async () => {
    const document = documentToRemove;
    if (!document) return;
    setDocumentBusy(document.id);
    setError('');
    try {
      await removeDocument(document.id);
      setNotice('Document removed from your archive.');
    } catch (documentError) { setError(documentError.message || 'Could not remove this document.'); }
    finally { setDocumentBusy(''); setDocumentToRemove(null); }
  };

  const cancelProfileEdit = () => {
    setProfileDraft(blankProfile(user));
    setEditingProfile(false);
    setError('');
  };

  return <main className="container py-5 account-profile account-dashboard">
    <div className="account-dashboard-heading">
      <div><span>ACCOUNT CENTER</span><h1>My account</h1><p>Manage your profile and saved files in one place.</p></div>
      <Link to="/tools" className="account-dashboard-tools-link">Browse tools</Link>
    </div>
    <div className="account-dashboard-layout">
    <aside className="account-dashboard-profile-card">
      <div className="account-dashboard-profile-top"><ProfileAvatar user={user} /><span>PROFILE</span></div>
      <div className="account-profile-identity">
        <span>YOUR ACCOUNT</span>
        <h2>{user.name}</h2>
        <p>{user.email}</p>
        {(user.profession || user.country) && <div className="account-profile-badges">
          {user.profession && <span>{user.profession}</span>}
          {user.country && <span>{user.country}</span>}
        </div>}
      </div>
      <button className="account-profile-edit-button" type="button" onClick={() => { setEditingProfile((current) => !current); setNotice(''); setError(''); }}>{editingProfile ? 'Close editor' : 'Edit profile'}</button>
      <div className="account-dashboard-profile-note"><strong>Your workspace</strong><span>Profile details and saved files are kept together in your account.</span></div>
    </aside>

    <div className="account-dashboard-content">

    {error && <p className="account-profile-error" role="alert">{error}</p>}
    {notice && <p className="account-profile-success" role="status">{notice}</p>}

    {editingProfile && <section className="account-profile-section account-profile-edit-card">
      <div className="account-profile-heading"><div><h2>Edit your details</h2><p>Your account details sync when you save.</p></div></div>
      <form className="account-profile-form" onSubmit={saveProfile}>
        <label>Full name<input autoComplete="name" required maxLength="80" value={profileDraft.name} onChange={(event) => setProfileDraft({ ...profileDraft, name: event.target.value })} /></label>
        <label>Email address<input type="email" value={user.email} readOnly disabled /></label>
        <label>Phone number<input type="tel" autoComplete="tel" maxLength="30" placeholder="Add your phone number" value={profileDraft.phone} onChange={(event) => setProfileDraft({ ...profileDraft, phone: event.target.value })} /></label>
        <label>Profession<input autoComplete="organization-title" maxLength="100" placeholder="e.g. Student, Designer" value={profileDraft.profession} onChange={(event) => setProfileDraft({ ...profileDraft, profession: event.target.value })} /></label>
        <label>Country<input autoComplete="country-name" maxLength="80" placeholder="e.g. India" value={profileDraft.country} onChange={(event) => setProfileDraft({ ...profileDraft, country: event.target.value })} /></label>
        <label className="account-profile-photo-field">Profile picture<input type="file" accept="image/*" onChange={selectPhoto} disabled={photoBusy} /><small>Images are resized before they are saved.</small></label>
        <div className="account-profile-photo-preview"><ProfileAvatar user={{ ...user, ...profileDraft }} />{profileDraft.profilePhoto && <button type="button" className="account-profile-text-button" onClick={() => setProfileDraft({ ...profileDraft, profilePhoto: '' })}>Remove photo</button>}</div>
        <div className="account-profile-form-actions"><button type="submit" disabled={savingProfile || photoBusy}>{savingProfile ? 'Saving...' : 'Save profile'}</button><button type="button" className="secondary" onClick={cancelProfileEdit}>Cancel</button></div>
      </form>
    </section>}

    <section className="account-profile-section" id="saved-documents">
      <div className="account-profile-heading"><div><span className="account-profile-kicker">ON THIS DEVICE</span><h2>Saved documents</h2><p>Completed files are saved here temporarily and automatically removed after 30 minutes. Download a copy to keep it.</p></div><span className="account-dashboard-document-count">{documents.length} {documents.length === 1 ? 'file' : 'files'}</span></div>
      {storageError && <p className="account-profile-error" role="alert">{storageError}</p>}
      {archiveLoading ? <p className="account-profile-empty">Loading your saved documents...</p> : documents.length ? <div className="account-saved-document-list">{documents.map((document) => <article className="account-saved-document" key={document.id}>
        <SavedDocumentThumbnail document={document} />
        {editingDocument === document.id ? <form className="account-document-rename" onSubmit={saveDocumentName}>
          <label><span className="visually-hidden">New document name</span><input autoFocus required maxLength="160" value={documentName} onChange={(event) => setDocumentName(event.target.value)} /></label>
          <button type="submit" disabled={documentBusy === document.id}><FaSave /> Save</button><button type="button" className="secondary" onClick={() => setEditingDocument(null)}>Cancel</button>
        </form> : <div className="account-saved-document-info"><strong title={document.name}>{document.name}</strong><span>{formatTool(document.tool)} · {formatSize(document.size)} · {new Date(document.createdAt).toLocaleDateString()}</span></div>}
        {editingDocument !== document.id && <div className="account-saved-document-actions">
          <button type="button" disabled={documentBusy === document.id} onClick={() => downloadSavedDocument(document)}><FaDownload /> Download</button>
          <button type="button" disabled={documentBusy === document.id} onClick={() => { setEditingDocument(document.id); setDocumentName(document.name); }}><FaEdit /> Rename</button>
          <button type="button" disabled={documentBusy === document.id} onClick={() => openDocumentInTools(document)}><FaExternalLinkAlt /> Edit with tools</button>
          <button type="button" className="remove" disabled={documentBusy === document.id} onClick={() => deleteSavedDocument(document)}><FaTrashAlt /> Remove</button>
        </div>}
      </article>)}</div> : <div className="account-profile-empty"><p>No saved documents yet.</p><span>Completed outputs are saved in this browser automatically while storage space is available.</span><Link to="/tools">Browse file tools</Link></div>}
      <p className="account-profile-private-note">Files stay in this browser and are separated by signed-in account. Input files are not archived.</p>
    </section>
    </div>
    </div>

    <ConfirmActionDialog
      open={Boolean(documentToRemove)}
      title="Remove saved document?"
      message={documentToRemove ? `Remove ${documentToRemove.name} from your saved documents?` : ''}
      confirmLabel="OK"
      cancelLabel="Cancel"
      onCancel={() => setDocumentToRemove(null)}
      onConfirm={confirmRemoveSavedDocument}
    />
  </main>;
}

