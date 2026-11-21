import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { EditorContent, Extension, Node, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { TextStyle } from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import TextAlign from '@tiptap/extension-text-align';
import Image from '@tiptap/extension-image';
import { TableKit } from '@tiptap/extension-table';
import Placeholder from '@tiptap/extension-placeholder';
import CharacterCount from '@tiptap/extension-character-count';
import FontFamily from '@tiptap/extension-font-family';
import { apiRequest, apiBaseUrl, getCsrfToken } from '../lib/authApi.js';
import { useAuth } from '../context/AuthContext.jsx';
import {
  FaAlignCenter, FaAlignJustify, FaAlignLeft, FaAlignRight, FaArrowUp,
  FaBold, FaCheck, FaChevronDown, FaClock, FaCloud, FaFileAlt, FaFileDownload,
  FaFileImport, FaFileWord, FaFont, FaHeading, FaHighlighter, FaImage, FaItalic,
  FaLink, FaListOl, FaListUl, FaMinus, FaParagraph, FaPlus, FaPrint,
  FaRedo, FaSearch, FaStrikethrough, FaTable, FaTrash, FaUnderline,
  FaUndo, FaUnlink, FaTextWidth, FaTimes, FaEraser, FaIndent, FaOutdent
} from 'react-icons/fa';
import toast from 'react-hot-toast';
import '../styles/wordEditor.css';

const TABS = ['File', 'Home', 'Insert', 'Layout', 'Design', 'References', 'Review', 'View'];
const DEFAULT_SETTINGS = { pageSize: 'a4', orientation: 'portrait', margins: { top: 20, right: 20, bottom: 20, left: 20 }, header: '', footer: '', pageNumbers: true, pageColor: '#ffffff' };
const EMPTY_DOC = { type: 'doc', content: [{ type: 'paragraph' }] };

const PageBreak = Node.create({
  name: 'pageBreak', group: 'block', atom: true, selectable: true,
  parseHTML() { return [{ tag: 'div[data-word-page-break]' }]; },
  renderHTML() { return ['div', { 'data-word-page-break': 'true', class: 'word-page-break', contenteditable: 'false' }, ['span', {}, 'Page break']]; }
});

const WordFormat = Extension.create({
  name: 'wordFormat',
  addGlobalAttributes() {
    return [
      { types: ['textStyle'], attributes: { fontSize: { default: null, parseHTML: (element) => element.style.fontSize || null, renderHTML: (attrs) => attrs.fontSize ? { style: `font-size:${attrs.fontSize}` } : {} } } },
      { types: ['paragraph', 'heading'], attributes: {
        indent: { default: 0, parseHTML: (element) => Number(element.getAttribute('data-indent') || 0), renderHTML: (attrs) => attrs.indent ? { 'data-indent': attrs.indent, style: `margin-left:${attrs.indent}em` } : {} },
        lineSpacing: { default: 1.35, parseHTML: (element) => Number(element.getAttribute('data-line-spacing') || 1.35), renderHTML: (attrs) => ({ 'data-line-spacing': attrs.lineSpacing, style: `line-height:${attrs.lineSpacing}` }) }
      } }
    ];
  }
});

function ToolbarButton({ title, icon: Icon, onClick, active = false, disabled = false, children }) {
  return <button className={`word-tool-button${active ? ' is-active' : ''}`} type="button" title={title} aria-label={title} aria-pressed={active} disabled={disabled} onMouseDown={(event) => event.preventDefault()} onClick={onClick}>{Icon && <Icon/>}{children}</button>;
}

function SettingSelect({ label, value, onChange, children }) {
  return <label className="word-setting"><span>{label}</span><select value={value} onChange={(event) => onChange(event.target.value)}>{children}</select></label>;
}

function getTextMatches(editor, query) {
  if (!query) return [];
  const matches = [];
  const lower = query.toLocaleLowerCase();
  editor.state.doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return;
    const text = node.text.toLocaleLowerCase();
    let from = 0;
    while ((from = text.indexOf(lower, from)) !== -1) {
      matches.push({ from: pos + from, to: pos + from + query.length });
      from += query.length;
    }
  });
  return matches;
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Could not read this image.'));
    reader.readAsDataURL(file);
  });
}

export default function WordEditorPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState('Home');
  const [active, setActive] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const settingsRef = useRef(settings);
  const titleRef = useRef('Untitled document');
  const [title, setTitleState] = useState('Untitled document');
  const [saveState, setSaveState] = useState('Saved');
  const [dirtyVersion, setDirtyVersion] = useState(0);
  const [showLibrary, setShowLibrary] = useState(false);
  const [actionDialog, setActionDialog] = useState(null);
  const [dialogValue, setDialogValue] = useState('');
  const [tableRows, setTableRows] = useState('3');
  const [tableColumns, setTableColumns] = useState('3');
  const [findText, setFindText] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [matchInfo, setMatchInfo] = useState('');
  const [zoom, setZoom] = useState(100);
  const [showSpellcheck, setShowSpellcheck] = useState(true);
  const [loadingDocuments, setLoadingDocuments] = useState(true);
  const [loadError, setLoadError] = useState('');
  const imageInputRef = useRef(null);
  const importInputRef = useRef(null);
  const saveQueue = useRef(Promise.resolve());
  const activeRef = useRef(null);
  const performSaveRef = useRef(() => Promise.resolve(true));

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ link: { openOnClick: false } }), TextStyle, Color, Highlight.configure({ multicolor: true }),
      FontFamily, TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Image.configure({ inline: false, allowBase64: true, HTMLAttributes: { class: 'word-image' } }),
      TableKit.configure({ table: { resizable: true } }),
      Placeholder.configure({ placeholder: 'Start typing your document…' }), CharacterCount, WordFormat, PageBreak
    ],
    content: EMPTY_DOC,
    editorProps: { attributes: { class: 'word-editor-content', spellcheck: 'true', 'aria-label': 'Document editor' } },
    onUpdate: () => setDirtyVersion((version) => version + 1)
  }, []);

  const setTitle = useCallback((next) => { titleRef.current = next; setTitleState(next); setDirtyVersion((version) => version + 1); }, []);
  const updateSettings = useCallback((update) => {
    setSettings((current) => {
      const next = typeof update === 'function' ? update(current) : { ...current, ...update };
      settingsRef.current = next;
      setDirtyVersion((version) => version + 1);
      return next;
    });
  }, []);

  const refreshDocuments = useCallback(async () => {
    const { documents: saved = [] } = await apiRequest('documents');
    setDocuments(saved);
    return saved;
  }, []);

  const createNewDocument = useCallback(async () => {
    if (!await performSaveRef.current()) return;
    const data = await apiRequest('documents', { method: 'POST', body: { title: 'Untitled document', content: EMPTY_DOC, settings: DEFAULT_SETTINGS } });
    const doc = data.document;
    setActive(doc); activeRef.current = doc; setTitle('Untitled document');
    settingsRef.current = { ...DEFAULT_SETTINGS, margins: { ...DEFAULT_SETTINGS.margins } };
    setSettings(settingsRef.current);
    editor?.commands.setContent(EMPTY_DOC, { emitUpdate: false });
    await refreshDocuments();
    setShowLibrary(false); setTab('Home'); setSaveState('Saved');
  }, [editor, refreshDocuments, setTitle]);

  const openDocument = useCallback(async (id) => {
    if (activeRef.current?.id && activeRef.current.id !== id && !await performSaveRef.current()) return;
    const { document: doc } = await apiRequest(`documents/${id}`);
    setActive(doc); activeRef.current = doc;
    setTitleState(doc.title); titleRef.current = doc.title;
    const nextSettings = { ...DEFAULT_SETTINGS, ...(doc.settings || {}), margins: { ...DEFAULT_SETTINGS.margins, ...(doc.settings?.margins || {}) } };
    setSettings(nextSettings); settingsRef.current = nextSettings;
    editor?.commands.setContent(doc.content || EMPTY_DOC, { emitUpdate: false });
    setDirtyVersion((version) => version + 1);
    setSaveState('Saved'); setShowLibrary(false); setTab('Home');
  }, [editor]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate('/login', { replace: true, state: { from: '/word-editor' } }); return; }
    if (!editor) return;
    let live = true;
    setLoadingDocuments(true);
    setLoadError('');
    refreshDocuments().then(async (saved) => {
      if (!live) return;
      if (saved.length) await openDocument(saved[0].id);
      else await createNewDocument();
    }).catch((error) => { if (live) { setLoadError(error.message || 'Could not load your documents.'); toast.error(error.message || 'Could not load your documents.'); } })
      .finally(() => { if (live) setLoadingDocuments(false); });
    return () => { live = false; };
  }, [authLoading, user, editor, navigate, refreshDocuments, openDocument, createNewDocument]);

  const performSave = useCallback(() => {
    const doc = activeRef.current;
    if (!doc?.id || !editor) return Promise.resolve(true);
    const body = { title: titleRef.current.trim() || 'Untitled document', content: editor.getJSON(), settings: settingsRef.current };
    setSaveState('Saving…');
    saveQueue.current = saveQueue.current.catch(() => {}).then(() => apiRequest(`documents/${doc.id}`, { method: 'PUT', body }));
    return saveQueue.current.then(() => { setSaveState('Saved'); refreshDocuments().catch(() => {}); return true; }).catch((error) => { setSaveState('Save failed'); toast.error(error.message || 'Could not save this document.'); return false; });
  }, [editor, refreshDocuments]);

  useEffect(() => { performSaveRef.current = performSave; }, [performSave]);

  useEffect(() => {
    if (!active?.id || loadingDocuments) return;
    setSaveState('Unsaved changes');
    const timer = window.setTimeout(performSave, 900);
    return () => window.clearTimeout(timer);
  }, [dirtyVersion, active?.id, loadingDocuments, performSave]);

  const insertImage = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !editor) return;
    if (!['image/png', 'image/jpeg'].includes(file.type)) return toast.error('Choose a PNG or JPEG image.');
    if (file.size > 3 * 1024 * 1024) return toast.error('Images must be 3 MB or smaller.');
    try { editor.chain().focus().setImage({ src: await fileToDataUrl(file), alt: file.name }).run(); toast.success('Image added to the document.'); }
    catch (error) { toast.error(error.message); }
  };

  const importDocx = async (event) => {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file || !editor) return;
    if (!file.name.toLowerCase().endsWith('.docx')) return toast.error('Choose a .docx Word document.');
    const form = new FormData(); form.append('file', file);
    try {
      const response = await fetch(`${apiBaseUrl}/documents/import`, { method: 'POST', credentials: 'include', headers: { 'X-CSRF-Token': await getCsrfToken() }, body: form });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Could not import this DOCX document.');
      if (!await performSave()) return;
      const importedTitle = file.name.replace(/\.docx$/i, '').trim() || 'Imported document';
      const created = await apiRequest('documents', { method: 'POST', body: { title: importedTitle, content: EMPTY_DOC, settings: settingsRef.current } });
      setActive(created.document); activeRef.current = created.document;
      titleRef.current = importedTitle; setTitleState(importedTitle);
      editor.commands.setContent(payload.data.html || '<p></p>');
      setShowLibrary(false);
      await refreshDocuments();
      if (payload.data.warnings?.length) toast('Imported with some formatting adjustments.'); else toast.success('Word document imported.');
    } catch (error) { toast.error(error.message); }
  };

  const exportDocx = async () => {
    if (!active?.id) return;
    if (!await performSave()) return;
    try {
      const response = await fetch(`${apiBaseUrl}/documents/${active.id}/export/docx`, { credentials: 'include' });
      if (!response.ok) { const data = await response.json().catch(() => ({})); throw new Error(data.error || 'DOCX export failed.'); }
      const url = URL.createObjectURL(await response.blob());
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = `${title.trim() || 'document'}.docx`; anchor.click(); URL.revokeObjectURL(url);
      toast.success('DOCX downloaded.');
    } catch (error) { toast.error(error.message); }
  };

  const removeDocument = async () => {
    if (!active?.id || !window.confirm(`Delete “${title}” permanently?`)) return;
    try {
      await apiRequest(`documents/${active.id}`, { method: 'DELETE' });
      activeRef.current = null;
      const remaining = await refreshDocuments();
      if (remaining.length) await openDocument(remaining[0].id); else await createNewDocument();
      toast.success('Document deleted.');
    } catch (error) { toast.error(error.message); }
  };

  const addLink = () => {
    if (!editor) return;
    const current = editor.getAttributes('link').href || '';
    setDialogValue(current || 'https://'); setActionDialog('link');
  };

  const insertTable = () => {
    setTableRows('3'); setTableColumns('3'); setActionDialog('table');
  };

  const submitActionDialog = (event) => {
    event.preventDefault();
    if (actionDialog === 'table') {
      const rows = Number(tableRows); const cols = Number(tableColumns);
      if (!Number.isInteger(rows) || rows < 1 || rows > 20 || !Number.isInteger(cols) || cols < 1 || cols > 12) return toast.error('Tables support 1–20 rows and 1–12 columns.');
      editor?.chain().focus().insertTable({ rows, cols, withHeaderRow: true }).run();
    } else if (actionDialog === 'link') {
      const href = dialogValue.trim();
      if (!href) editor?.chain().focus().unsetLink().run();
      else if (/^(https?:\/\/|mailto:|tel:)/i.test(href)) editor?.chain().focus().setLink({ href }).run();
      else return toast.error('Links must start with https://, http://, mailto: or tel:.');
    } else if (actionDialog === 'header' || actionDialog === 'footer') {
      updateSettings((current) => ({ ...current, [actionDialog]: dialogValue }));
    }
    setActionDialog(null);
  };

  const changeFontSize = (size) => editor?.chain().focus().setMark('textStyle', { fontSize: `${size}pt` }).run();
  const changeLineSpacing = (spacing) => editor?.chain().focus().updateAttributes('paragraph', { lineSpacing: Number(spacing) }).run();
  const changeIndent = (amount) => {
    const current = Number(editor?.getAttributes('paragraph').indent || 0);
    editor?.chain().focus().updateAttributes('paragraph', { indent: Math.max(0, Math.min(8, current + amount)) }).run();
  };

  const findNext = (direction = 1) => {
    const matches = getTextMatches(editor, findText);
    if (!matches.length) { setMatchInfo('No matches'); return; }
    const current = editor.state.selection.from;
    let index = direction > 0 ? matches.findIndex((match) => match.from > current) : matches.findLastIndex((match) => match.from < current);
    if (index < 0) index = direction > 0 ? 0 : matches.length - 1;
    editor.chain().focus().setTextSelection(matches[index]).run();
    setMatchInfo(`${index + 1} of ${matches.length}`);
  };

  const replaceCurrent = () => {
    if (!editor || !findText || !editor.state.selection.empty) return;
    const selected = editor.state.doc.textBetween(editor.state.selection.from, editor.state.selection.to, '\n');
    if (selected.toLocaleLowerCase() !== findText.toLocaleLowerCase()) return findNext(1);
    editor.chain().focus().insertContent(replaceText).run();
    setMatchInfo('Replaced 1 match');
  };

  const replaceAll = () => {
    const matches = getTextMatches(editor, findText);
    if (!matches.length) { setMatchInfo('No matches'); return; }
    const tr = editor.state.tr;
    [...matches].reverse().forEach(({ from, to }) => tr.insertText(replaceText, from, to));
    editor.view.dispatch(tr); setMatchInfo(`Replaced ${matches.length} matches`);
  };

  const insertToc = () => {
    const headings = [];
    editor?.state.doc.descendants((node) => {
      if (node.type.name === 'heading') headings.push({ text: node.textContent, level: node.attrs.level });
    });
    if (!headings.length) return toast.error('Add one or more headings before inserting a table of contents.');
    const html = `<h2>Table of contents</h2>${headings.map(({ text, level }) => `<p style="margin-left:${Math.max(0, level - 1) * 20}px">${text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')}</p>`).join('')}`;
    editor.chain().focus().insertContent(html).run();
  };

  const words = editor?.storage.characterCount.words() || 0;
  const characters = editor?.storage.characterCount.characters() || 0;
  const outlineHeadings = editor?.state.doc.content.content.filter((node) => node.type.name === 'heading') || [];
  const activePageDimensions = settings.pageSize === 'letter' ? (settings.orientation === 'landscape' ? '279mm' : '216mm') : (settings.orientation === 'landscape' ? '297mm' : '210mm');
  const activePageHeight = settings.pageSize === 'letter' ? (settings.orientation === 'landscape' ? '216mm' : '279mm') : (settings.orientation === 'landscape' ? '210mm' : '297mm');

  return <main className="word-app">
    <header className="word-topbar">
      <div className="word-brand"><span className="word-brand-mark"><FaFileWord/></span><span>Word <b>Editor</b></span></div>
      <div className="word-file-name"><input aria-label="Document name" value={title} maxLength={180} onChange={(event) => setTitle(event.target.value)} onBlur={() => setTitle(title.trim() || 'Untitled document')}/><span className={`word-save-state ${saveState === 'Saved' ? 'is-saved' : ''}`}><FaCloud/>{saveState}</span></div>
      <div className="word-top-actions">
        <button type="button" onClick={() => setShowLibrary(true)}><FaFileAlt/> Open</button>
        <button type="button" onClick={() => createNewDocument().catch((error) => toast.error(error.message))}><FaPlus/> New</button>
        <button type="button" onClick={performSave}><FaCheck/> Save</button>
        <button className="word-action-primary" type="button" onClick={exportDocx}><FaFileDownload/> Download DOCX</button>
        <button type="button" onClick={() => window.print()}><FaPrint/> PDF / Print</button>
      </div>
    </header>

    <nav className="word-tabs" aria-label="Word editor ribbon tabs">{TABS.map((name) => <button key={name} type="button" className={tab === name ? 'is-selected' : ''} aria-selected={tab === name} onClick={() => setTab(name)}>{name}</button>)}</nav>

    <section className="word-ribbon" aria-label={`${tab} commands`}>
      {tab === 'File' && <div className="word-ribbon-row word-file-ribbon">
        <button onClick={() => createNewDocument().catch((error) => toast.error(error.message))}><FaPlus/> New document</button><button onClick={() => setShowLibrary(true)}><FaFileAlt/> Open document</button>
        <button onClick={performSave}><FaCheck/> Save now</button><button onClick={() => importInputRef.current?.click()}><FaFileImport/> Import DOCX</button>
        <button onClick={exportDocx}><FaFileDownload/> Export DOCX</button><button onClick={() => window.print()}><FaPrint/> Print / save as PDF</button>
        <button className="word-danger-action" onClick={removeDocument}><FaTrash/> Delete document</button>
        <span className="word-file-note"><FaClock/> Documents autosave to your account.</span>
      </div>}

      {tab === 'Home' && <div className="word-ribbon-row">
        <div className="word-ribbon-group word-font-group">
          <select aria-label="Font family" title="Font family" defaultValue="Arial" onChange={(event) => editor?.chain().focus().setFontFamily(event.target.value).run()}>
            {['Arial', 'Calibri', 'Aptos', 'Times New Roman', 'Georgia', 'Verdana', 'Courier New'].map((font) => <option key={font}>{font}</option>)}
          </select>
          <select aria-label="Font size" title="Font size" defaultValue="12" onChange={(event) => changeFontSize(event.target.value)}>{[8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 36, 48, 72].map((size) => <option key={size} value={size}>{size} pt</option>)}</select>
          <ToolbarButton title="Bold" icon={FaBold} active={editor?.isActive('bold')} onClick={() => editor?.chain().focus().toggleBold().run()}/>
          <ToolbarButton title="Italic" icon={FaItalic} active={editor?.isActive('italic')} onClick={() => editor?.chain().focus().toggleItalic().run()}/>
          <ToolbarButton title="Underline" icon={FaUnderline} active={editor?.isActive('underline')} onClick={() => editor?.chain().focus().toggleUnderline().run()}/>
          <ToolbarButton title="Strikethrough" icon={FaStrikethrough} active={editor?.isActive('strike')} onClick={() => editor?.chain().focus().toggleStrike().run()}/>
          <label className="word-color-control" title="Text color"><FaFont/><input type="color" aria-label="Text color" onChange={(event) => editor?.chain().focus().setColor(event.target.value).run()}/></label>
          <label className="word-color-control word-highlight-control" title="Highlight color"><FaHighlighter/><input type="color" aria-label="Highlight color" defaultValue="#fff1a8" onChange={(event) => editor?.chain().focus().toggleHighlight({ color: event.target.value }).run()}/></label>
        </div>
        <div className="word-ribbon-group">
          <select aria-label="Paragraph style" title="Paragraph style" defaultValue="paragraph" onChange={(event) => event.target.value === 'paragraph' ? editor?.chain().focus().setParagraph().run() : editor?.chain().focus().toggleHeading({ level: Number(event.target.value) }).run()}>
            <option value="paragraph">Normal</option><option value="1">Heading 1</option><option value="2">Heading 2</option><option value="3">Heading 3</option>
          </select>
          <ToolbarButton title="Align left" icon={FaAlignLeft} active={editor?.isActive({ textAlign: 'left' })} onClick={() => editor?.chain().focus().setTextAlign('left').run()}/>
          <ToolbarButton title="Align center" icon={FaAlignCenter} active={editor?.isActive({ textAlign: 'center' })} onClick={() => editor?.chain().focus().setTextAlign('center').run()}/>
          <ToolbarButton title="Align right" icon={FaAlignRight} active={editor?.isActive({ textAlign: 'right' })} onClick={() => editor?.chain().focus().setTextAlign('right').run()}/>
          <ToolbarButton title="Justify" icon={FaAlignJustify} active={editor?.isActive({ textAlign: 'justify' })} onClick={() => editor?.chain().focus().setTextAlign('justify').run()}/>
          <ToolbarButton title="Bulleted list" icon={FaListUl} active={editor?.isActive('bulletList')} onClick={() => editor?.chain().focus().toggleBulletList().run()}/>
          <ToolbarButton title="Numbered list" icon={FaListOl} active={editor?.isActive('orderedList')} onClick={() => editor?.chain().focus().toggleOrderedList().run()}/>
          <ToolbarButton title="Decrease indent" icon={FaOutdent} onClick={() => changeIndent(-1)}/><ToolbarButton title="Increase indent" icon={FaIndent} onClick={() => changeIndent(1)}/>
          <select aria-label="Line spacing" title="Line spacing" defaultValue="1.35" onChange={(event) => changeLineSpacing(event.target.value)}>{['1', '1.15', '1.35', '1.5', '2'].map((n) => <option value={n} key={n}>{n} line spacing</option>)}</select>
        </div>
        <div className="word-ribbon-group word-small-group"><ToolbarButton title="Undo" icon={FaUndo} disabled={!editor?.can().undo()} onClick={() => editor?.chain().focus().undo().run()}/><ToolbarButton title="Redo" icon={FaRedo} disabled={!editor?.can().redo()} onClick={() => editor?.chain().focus().redo().run()}/><ToolbarButton title="Clear formatting" icon={FaEraser} onClick={() => editor?.chain().focus().unsetAllMarks().clearNodes().run()}/></div>
      </div>}

      {tab === 'Insert' && <div className="word-ribbon-row">
        <div className="word-ribbon-group"><ToolbarButton title="Insert table" icon={FaTable} onClick={insertTable}/><ToolbarButton title="Add table row" icon={FaPlus} disabled={!editor?.can().addRowAfter()} onClick={() => editor?.chain().focus().addRowAfter().run()}/><ToolbarButton title="Add table column" icon={FaTextWidth} disabled={!editor?.can().addColumnAfter()} onClick={() => editor?.chain().focus().addColumnAfter().run()}/><ToolbarButton title="Delete table row" icon={FaMinus} disabled={!editor?.can().deleteRow()} onClick={() => editor?.chain().focus().deleteRow().run()}/><ToolbarButton title="Delete table column" icon={FaMinus} disabled={!editor?.can().deleteColumn()} onClick={() => editor?.chain().focus().deleteColumn().run()}/><ToolbarButton title="Merge cells" icon={FaTable} disabled={!editor?.can().mergeCells()} onClick={() => editor?.chain().focus().mergeCells().run()}/><ToolbarButton title="Split cell" icon={FaTable} disabled={!editor?.can().splitCell()} onClick={() => editor?.chain().focus().splitCell().run()}/><ToolbarButton title="Toggle table header row" icon={FaHeading} disabled={!editor?.can().toggleHeaderRow()} onClick={() => editor?.chain().focus().toggleHeaderRow().run()}/><ToolbarButton title="Delete table" icon={FaTrash} disabled={!editor?.can().deleteTable()} onClick={() => editor?.chain().focus().deleteTable().run()}/></div>
        <div className="word-ribbon-group"><ToolbarButton title="Insert image" icon={FaImage} onClick={() => imageInputRef.current?.click()}/><ToolbarButton title="Insert hyperlink" icon={FaLink} onClick={addLink}/><ToolbarButton title="Remove hyperlink" icon={FaUnlink} onClick={() => editor?.chain().focus().unsetLink().run()}/><ToolbarButton title="Insert page break" icon={FaFileAlt} onClick={() => editor?.chain().focus().insertContent({ type: 'pageBreak' }).run()}/></div>
        <div className="word-ribbon-group word-header-tools"><button onClick={() => { setDialogValue(settings.header); setActionDialog('header'); }}>Header</button><button onClick={() => { setDialogValue(settings.footer); setActionDialog('footer'); }}>Footer</button><label><input type="checkbox" checked={settings.pageNumbers} onChange={(event) => updateSettings((current) => ({ ...current, pageNumbers: event.target.checked }))}/> Page numbers</label></div>
      </div>}

      {tab === 'Layout' && <div className="word-ribbon-row word-layout-ribbon">
        <SettingSelect label="Paper size" value={settings.pageSize} onChange={(pageSize) => updateSettings((current) => ({ ...current, pageSize }))}><option value="a4">A4</option><option value="letter">Letter</option></SettingSelect>
        <SettingSelect label="Orientation" value={settings.orientation} onChange={(orientation) => updateSettings((current) => ({ ...current, orientation }))}><option value="portrait">Portrait</option><option value="landscape">Landscape</option></SettingSelect>
        {['top', 'right', 'bottom', 'left'].map((side) => <label className="word-setting word-margin-setting" key={side}><span>{side}{" " + 'margin ·' + " "}{settings.margins[side]} mm</span><input type="range" min="5" max="60" value={settings.margins[side]} onChange={(event) => updateSettings((current) => ({ ...current, margins: { ...current.margins, [side]: Number(event.target.value) } }))}/></label>)}
      </div>}

      {tab === 'Design' && <div className="word-ribbon-row">
        <div className="word-theme-buttons"><span>Document page color</span><label className="word-color-control"><FaFont/><input type="color" value={settings.pageColor} aria-label="Page color" onChange={(event) => updateSettings((current) => ({ ...current, pageColor: event.target.value }))}/></label><button onClick={() => updateSettings((current) => ({ ...current, pageColor: '#ffffff' }))}>Reset page color</button></div>
        <div className="word-ribbon-group"><ToolbarButton title="Insert horizontal rule" icon={FaMinus} onClick={() => editor?.chain().focus().setHorizontalRule().run()}/><ToolbarButton title="Set page background white" icon={FaEraser} onClick={() => updateSettings((current) => ({ ...current, pageColor: '#ffffff' }))}/></div>
      </div>}

      {tab === 'References' && <div className="word-ribbon-row"><div className="word-ribbon-group"><button onClick={insertToc}><FaListOl/> Insert table of contents</button></div><span className="word-file-note">Contents are generated from Heading 1–3 styles in this document.</span></div>}

      {tab === 'Review' && <div className="word-review-ribbon">
        <div className="word-find-row"><label><FaSearch/><input aria-label="Find text" placeholder="Find in document" value={findText} onChange={(event) => { setFindText(event.target.value); setMatchInfo(''); }}/></label><button onClick={() => findNext(-1)}>Previous</button><button onClick={() => findNext(1)}>Next</button><span>{matchInfo}</span></div>
        <div className="word-find-row"><input aria-label="Replace with" placeholder="Replace with" value={replaceText} onChange={(event) => setReplaceText(event.target.value)}/><button onClick={replaceCurrent}>Replace</button><button onClick={replaceAll}>Replace all</button><label className="word-spellcheck-toggle"><input type="checkbox" checked={showSpellcheck} onChange={(event) => { setShowSpellcheck(event.target.checked); editor?.setOptions({ editorProps: { attributes: { class: 'word-editor-content', spellcheck: String(event.target.checked), 'aria-label': 'Document editor' } } }); }}/> Spellcheck</label></div>
      </div>}

      {tab === 'View' && <div className="word-ribbon-row word-view-ribbon"><label>Zoom <input type="range" min="50" max="150" step="5" value={zoom} onChange={(event) => setZoom(Number(event.target.value))}/><b>{zoom}%</b></label><button onClick={() => setZoom(100)}>100%</button><button onClick={() => window.print()}><FaPrint/> Print preview / PDF</button><span className="word-file-note">{words}{" " + 'words ·' + " "}{characters} characters</span></div>}
    </section>

    <div className="word-workspace">
      <aside className="word-side-panel">
        <div className="word-side-heading"><b>Document</b><button title="Open documents" aria-label="Open documents" onClick={() => setShowLibrary(true)}><FaChevronDown/></button></div>
        <div className="word-side-active"><span className="word-file-icon"><FaFileWord/></span><div><b>{title || 'Untitled document'}</b><small>{saveState === 'Saved' ? 'All changes saved' : saveState}</small></div></div>
        <div className="word-outline-title"><FaHeading/> Document outline</div>
        <div className="word-outline-list">{outlineHeadings.length ? outlineHeadings.map((node, index) => <button key={`${index}-${node.textContent}`} onClick={() => { let offset = 0; editor.state.doc.forEach((item, at) => { if (item === node) offset = at; }); editor.chain().focus().setTextSelection(Math.min(editor.state.doc.content.size, offset + 1)).run(); }}>{node.textContent || 'Untitled heading'}</button>) : <small>Use heading styles to build an outline.</small>}</div>
        <div className="word-side-bottom"><FaCloud/><span>Saved to your account</span></div>
      </aside>

      <section className="word-canvas" aria-label="Document workspace">
        {loadingDocuments ? <div className="word-loading"><span/>Opening your documents…</div> : loadError ? <div className="word-load-error"><b>Your documents could not be opened</b><span>{loadError}</span><button onClick={() => window.location.reload()}>Try again</button></div> : <div className="word-page-wrap" style={{ '--page-width': activePageDimensions, '--page-height': activePageHeight, '--page-zoom': zoom / 100, '--page-color': settings.pageColor }}>
          <article className={`word-page ${settings.orientation}${settings.pageNumbers ? ' has-page-numbers' : ''}`} style={{ padding: `${settings.margins.top}mm ${settings.margins.right}mm ${settings.margins.bottom}mm ${settings.margins.left}mm`, backgroundColor: settings.pageColor }}>
            {settings.header && <div className="word-page-header">{settings.header}</div>}
            <EditorContent editor={editor}/>
            {settings.footer && <div className="word-page-footer">{settings.footer}{settings.pageNumbers && <span>Page 1</span>}</div>}
            {!settings.footer && settings.pageNumbers && <div className="word-page-number">1</div>}
          </article>
        </div>}
      </section>
      <aside className="word-inspector"><div className="word-inspector-title"><FaParagraph/><div><b>Document info</b><small>Live document details</small></div></div><div className="word-inspector-stat"><span>Words</span><b>{words}</b></div><div className="word-inspector-stat"><span>Characters</span><b>{characters}</b></div><div className="word-inspector-stat"><span>Paper</span><b>{settings.pageSize.toUpperCase()}</b></div><div className="word-inspector-stat"><span>Page layout</span><b>{settings.orientation}</b></div><div className="word-inspector-tip"><FaClock/><span>Changes save automatically as you type.</span></div></aside>
    </div>

    <footer className="word-statusbar"><span><FaCheck/> {saveState}</span><span>{words} words</span><span>{characters} characters</span><label>Zoom <input type="range" min="50" max="150" step="5" value={zoom} onChange={(event) => setZoom(Number(event.target.value))}/>{zoom}%</label></footer>

    <input ref={imageInputRef} hidden type="file" accept="image/png,image/jpeg" onChange={insertImage}/>
    <input ref={importInputRef} hidden type="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={importDocx}/>
    {showLibrary && <div className="word-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowLibrary(false); }}><section className="word-library" role="dialog" aria-modal="true" aria-labelledby="word-library-title"><header><div><span>Your workspace</span><h2 id="word-library-title">Open a document</h2></div><button className="word-modal-close" aria-label="Close document library" onClick={() => setShowLibrary(false)}><FaTimes/></button></header><div className="word-library-actions"><button className="word-action-primary" onClick={() => createNewDocument().catch((error) => toast.error(error.message))}><FaPlus/> Create new document</button><button onClick={() => importInputRef.current?.click()}><FaFileImport/> Import DOCX</button></div><div className="word-library-list">{documents.map((doc) => <button className={`word-library-item${doc.id === active?.id ? ' is-current' : ''}`} key={doc.id} onClick={() => openDocument(doc.id).catch((error) => toast.error(error.message))}><span className="word-file-icon"><FaFileWord/></span><span><b>{doc.title}</b><small>Edited {new Date(doc.updatedAt).toLocaleString()}</small></span><FaArrowUp className="word-open-arrow"/></button>)}{!documents.length && <p>No saved documents yet. Create one to get started.</p>}</div><div className="word-library-rename"><label>Rename current document<input value={title} maxLength={180} onChange={(event) => setTitle(event.target.value)}/></label><button onClick={() => setTitle(title.trim() || 'Untitled document')}>Apply name</button></div></section></div>}
    {actionDialog && <div className="word-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setActionDialog(null); }}><form className="word-action-dialog" role="dialog" aria-modal="true" onSubmit={submitActionDialog}><button type="button" className="word-modal-close" aria-label="Close" onClick={() => setActionDialog(null)}><FaTimes/></button><span className="word-dialog-kicker">Document tools</span><h2>{actionDialog === 'table' ? 'Insert a table' : actionDialog === 'link' ? 'Insert a hyperlink' : actionDialog === 'header' ? 'Edit page header' : 'Edit page footer'}</h2>{actionDialog === 'table' ? <div className="word-dialog-fields"><label>Rows<input type="number" min="1" max="20" value={tableRows} onChange={(event) => setTableRows(event.target.value)}/></label><label>Columns<input type="number" min="1" max="12" value={tableColumns} onChange={(event) => setTableColumns(event.target.value)}/></label></div> : <label className="word-dialog-label">{actionDialog === 'link' ? 'Web address or email link' : 'Text'}<input autoFocus value={dialogValue} maxLength={1000} onChange={(event) => setDialogValue(event.target.value)} placeholder={actionDialog === 'link' ? 'https://example.com' : 'Enter text'}/></label>}<div className="word-dialog-actions"><button type="button" onClick={() => setActionDialog(null)}>Cancel</button><button className="word-dialog-primary" type="submit">{actionDialog === 'table' ? 'Insert table' : 'Apply'}</button></div></form></div>}
  </main>;
}

