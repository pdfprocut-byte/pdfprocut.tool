import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import { DownloadResultModal, OperationProgressModal } from '../components/pdf/FileOperationModals.jsx';
import OfficePdfDocumentPreview from '../components/pdf/OfficePdfDocumentPreview.jsx';
import ToolGuide from '../components/tools/ToolGuide.jsx';
import { apiBaseUrl, getCsrfToken } from '../lib/authApi.js';
import { analyticsRequestHeaders } from '../lib/analyticsTracking.js';
import { useBrowserDraft } from '../lib/browserDraft.js';
import { createDownloadName } from '../utils/downloadName.js';
import { decodeTextFile } from '../../../shared/documentText.mjs';
import '../styles/textToPdf.css';
import '../styles/textDocumentApp.css';

const fonts = [
  ['Helvetica', 'Arial'], ['HelveticaBold', 'Arial Bold'], ['HelveticaOblique', 'Arial Italic'], ['HelveticaBoldOblique', 'Arial Bold Italic'],
  ['TimesRoman', 'Times New Roman'], ['TimesRomanBold', 'Times New Roman Bold'], ['TimesRomanItalic', 'Times New Roman Italic'], ['TimesRomanBoldItalic', 'Times New Roman Bold Italic'],
  ['Courier', 'Courier New'], ['CourierBold', 'Courier New Bold'], ['CourierOblique', 'Courier New Italic'], ['CourierBoldOblique', 'Courier New Bold Italic']
];

const cssFont = (font) => font.startsWith('TimesRoman') ? 'Georgia, serif' : font.startsWith('Courier') ? 'Courier New, monospace' : 'Arial, sans-serif';
const escapeHtml = (value) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function makeTextHtml(value) {
  return value.split(/\r\n?|\n/).map((line) => `<p dir="auto">${line ? escapeHtml(line) : '<br>'}</p>`).join('');
}

export default function TextToPdfPage({ tool, format = 'pdf' }) {
  const location = useLocation();
  const outputLabel = format === 'docx' ? 'Document' : 'PDF';
  const outputExtension = format === 'docx' ? 'docx' : 'pdf';
  const editorRef = useRef(null);
  const workspaceRef = useRef(null);
  const savedRange = useRef(null);
  const textFileRef = useRef(null);
  const textLoadRef = useRef(0);
  const [html, setHtml] = useState('');
  const [plainText, setPlainText] = useState('');
  const [options, setOptions] = useState({ pageSize: 'a4', orientation: 'portrait', margin: '48', font: 'Helvetica', fontSize: '12', color: '#202124', highlight: '#fff2a8', align: 'left', lineSpacing: '1.35', paragraphSpacing: '8', backgroundColor: '#ffffff', pageNumbers: true });
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [documentName, setDocumentName] = useState(location.state?.documentName || 'Untitled document');
  const [activeRibbon, setActiveRibbon] = useState('Home');
  const [findText, setFindText] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [spellCheckEnabled, setSpellCheckEnabled] = useState(true);
  const [showGuide, setShowGuide] = useState(false);
  const [showPagePreview, setShowPagePreview] = useState(false);
  const [previewZoom, setPreviewZoom] = useState(110);
  const [officeSourceFile, setOfficeSourceFile] = useState(null);
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [officePreviewPdf, setOfficePreviewPdf] = useState(null);
  const [officePreviewLoading, setOfficePreviewLoading] = useState(false);
  const [officePreviewPageCount, setOfficePreviewPageCount] = useState(0);
  const [pageInfo, setPageInfo] = useState({ current: 1, total: 1 });
  const pagePreviewHost = useRef(null);
  const draft = { state: { html, plainText, options, documentName, activeRibbon, findText, replaceText, spellCheckEnabled, uploadedFileName }, files: officeSourceFile ? [officeSourceFile] : [], signature: null };
  const { ready: draftReady, status: draftStatus } = useBrowserDraft(`tool:${tool.slug}`, draft, (saved) => {
    const state = saved.state || {};
    setHtml(state.html || '');
    setPlainText(state.plainText || '');
    if (state.options) setOptions(state.options);
    if (state.documentName !== undefined) setDocumentName(state.documentName);
    if (state.activeRibbon) setActiveRibbon(state.activeRibbon);
    if (state.findText !== undefined) setFindText(state.findText);
    if (state.replaceText !== undefined) setReplaceText(state.replaceText);
    if (state.spellCheckEnabled !== undefined) setSpellCheckEnabled(state.spellCheckEnabled);
    setOfficeSourceFile(saved.files[0] || null);
    setUploadedFileName(state.uploadedFileName || saved.files[0]?.name || '');
  });
  useEffect(() => () => { if (result) URL.revokeObjectURL(result); }, [result]);
  useEffect(() => {
    if (draftReady && editorRef.current && html) editorRef.current.innerHTML = html;
  }, [draftReady]);
  useEffect(() => {
    const initialText = location.state?.initialText;
    if (!draftReady || format !== 'docx' || typeof initialText !== 'string') return;
    const initialHtml = makeTextHtml(initialText);
    if (editorRef.current) editorRef.current.innerHTML = initialHtml;
    setHtml(initialHtml);
    setPlainText(initialText);
    setDocumentName(location.state.documentName || 'Imported document');
    setOfficeSourceFile(null);
    setUploadedFileName('');
    setOfficePreviewPdf(null);
    setOfficePreviewLoading(false);
    setOfficePreviewPageCount(0);
    setResult(null);
  }, [draftReady, format, location.key, location.state]);
  useEffect(() => {
    if (format !== 'docx') return undefined;
    const previousBodyOverflow = document.body.style.overflow;
    const previousRootOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousRootOverflow;
    };
  }, [format]);
  useEffect(() => {
    if (format === 'docx') return undefined;
    const previousBodyOverflow = document.body.style.overflow;
    const previousRootOverflow = document.documentElement.style.overflow;
    let pinned = false;
    const checkWorkspacePosition = () => {
      if (window.innerWidth < 981) {
        if (pinned) {
          pinned = false;
          document.body.classList.remove('text-editor-pinned');
          workspaceRef.current?.classList.remove('is-pinned');
          document.body.style.removeProperty('--text-editor-navbar-height');
          document.body.style.overflow = previousBodyOverflow;
          document.documentElement.style.overflow = previousRootOverflow;
        }
        return;
      }
      if (pinned || !workspaceRef.current) return;
      const navbar = document.querySelector('.pdfpro-navbar');
      const navbarHeight = Math.ceil(navbar?.offsetHeight || (window.innerWidth >= 992 ? 88 : 78));
      if (workspaceRef.current.getBoundingClientRect().top <= navbarHeight + 1) {
        pinned = true;
        document.body.style.setProperty('--text-editor-navbar-height', `${navbarHeight}px`);
        document.body.classList.add('text-editor-pinned');
        workspaceRef.current.classList.add('is-pinned');
        document.body.style.overflow = 'hidden';
        document.documentElement.style.overflow = 'hidden';
      }
    };
    window.addEventListener('scroll', checkWorkspacePosition, { passive: true });
    window.addEventListener('resize', checkWorkspacePosition);
    const frame = window.requestAnimationFrame(checkWorkspacePosition);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('scroll', checkWorkspacePosition);
      window.removeEventListener('resize', checkWorkspacePosition);
      document.body.classList.remove('text-editor-pinned');
      workspaceRef.current?.classList.remove('is-pinned');
      document.body.style.removeProperty('--text-editor-navbar-height');
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousRootOverflow;
    };
  }, [format]);
  useEffect(() => {
    if (!showPagePreview || !pagePreviewHost.current || !editorRef.current) return undefined;
    const paper = options.pageSize === 'legal' ? [612, 1008] : options.pageSize === 'letter' ? [612, 792] : [595.28, 841.89];
    const [pageWidth, pageHeight] = options.orientation === 'landscape' ? [paper[1], paper[0]] : paper;
    const scale = Math.min((window.innerWidth - 64) / pageWidth, (window.innerHeight - 148) / pageHeight) * (previewZoom / 100);
    const preview = editorRef.current.cloneNode(true);
    preview.removeAttribute('contenteditable');
    preview.removeAttribute('role');
    preview.removeAttribute('aria-label');
    preview.classList.remove('word-page-editor');
    preview.classList.add('text-page-preview-copy');
    preview.style.width = `${Math.round(pageWidth * scale)}px`;
    preview.style.height = `${Math.round(pageHeight * scale)}px`;
    preview.style.padding = `${Number(options.margin) * scale}px`;
    preview.style.fontSize = `${Number(options.fontSize) * scale}px`;
    preview.style.lineHeight = options.lineSpacing;
    preview.style.setProperty('--text-paragraph-space', `${Number(options.paragraphSpacing) * scale}px`);
    preview.style.setProperty('--text-page-height', `${Math.round(pageHeight * scale)}px`);
    preview.style.maxHeight = 'none';
    preview.style.margin = '0';
    preview.style.overflow = 'hidden';
    preview.style.transform = 'perspective(1600px) rotateX(1deg)';
    preview.style.transformOrigin = 'top center';
    preview.querySelectorAll('script,iframe,object,embed,form,input,button').forEach((node) => node.remove());
    preview.querySelectorAll('*').forEach((node) => [...node.attributes].forEach((attribute) => {
      if (/^on/i.test(attribute.name) || attribute.name === 'href') node.removeAttribute(attribute.name);
    }));
    pagePreviewHost.current.replaceChildren(preview);
    preview.scrollTop = editorRef.current.scrollTop * (preview.clientHeight / Math.max(1, editorRef.current.clientHeight));
    return () => pagePreviewHost.current?.replaceChildren();
  }, [showPagePreview, html, options, previewZoom]);
  useEffect(() => {
    if (!showPagePreview) return undefined;
    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const closeOnEscape = (event) => { if (event.key === 'Escape') setShowPagePreview(false); };
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('keydown', closeOnEscape);
      document.body.style.overflow = previousBodyOverflow;
    };
  }, [showPagePreview]);
  useEffect(() => {
    if (!officeSourceFile) return undefined;
    const controller = new AbortController();
    let active = true;
    const createOfficePreview = async () => {
      setOfficePreviewLoading(true);
      try {
        const body = new FormData();
        body.append('files', officeSourceFile);
        const response = await fetch(`${apiBaseUrl}/pdf/office-to-pdf`, { method: 'POST', body, credentials: 'include', headers: analyticsRequestHeaders(), signal: controller.signal });
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.error || 'Could not render the original Word layout.');
        }
        const pdf = await response.blob();
        if (active) setOfficePreviewPdf(new File([pdf], `${officeSourceFile.name.replace(/\.docx$/i, '')}.pdf`, { type: 'application/pdf' }));
      } catch (error) {
        if (active && error.name !== 'AbortError') toast.error(error.message || 'Could not render the original Word layout.');
      } finally {
        if (active) setOfficePreviewLoading(false);
      }
    };
    createOfficePreview();
    return () => { active = false; controller.abort(); };
  }, [officeSourceFile]);
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return undefined;
    const updatePages = () => {
      const pageHeight = Math.max(1, editor.clientHeight);
      const total = Math.max(1, Math.ceil((editor.scrollHeight - 1) / pageHeight));
      const current = Math.min(total, Math.floor((editor.scrollTop + 1) / pageHeight) + 1);
      editor.dataset.currentPage = String(current);
      editor.dataset.pageCount = String(total);
      editor.style.setProperty('--text-page-height', `${pageHeight}px`);
      setPageInfo((previous) => previous.current === current && previous.total === total ? previous : { current, total });
    };
    const observer = new ResizeObserver(updatePages);
    observer.observe(editor);
    editor.addEventListener('input', updatePages);
    editor.addEventListener('scroll', updatePages, { passive: true });
    updatePages();
    return () => {
      observer.disconnect();
      editor.removeEventListener('input', updatePages);
      editor.removeEventListener('scroll', updatePages);
    };
  }, [html, options.pageSize, options.orientation, options.margin, options.fontSize, options.lineSpacing, options.paragraphSpacing]);

  const update = (key, value) => {
    if (officeSourceFile && !Object.is(options[key], value)) {
      setOfficeSourceFile(null);
      setOfficePreviewPdf(null);
      setOfficePreviewLoading(false);
      setOfficePreviewPageCount(0);
    }
    setOptions((current) => ({ ...current, [key]: value }));
    setResult(null);
  };

  const syncEditor = () => {
    const editor = editorRef.current;
    if (!editor) return;
    setHtml(editor.innerHTML);
    setPlainText(editor.innerText || editor.textContent || '');
    setResult(null);
    setOfficeSourceFile(null);
    setOfficePreviewPdf(null);
    setOfficePreviewLoading(false);
    setOfficePreviewPageCount(0);
  };

  const saveSelection = () => {
    const selection = window.getSelection();
    if (selection?.rangeCount && editorRef.current?.contains(selection.anchorNode)) savedRange.current = selection.getRangeAt(0).cloneRange();
  };

  const restoreSelection = () => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    const selection = window.getSelection();
    if (savedRange.current && selection) {
      selection.removeAllRanges();
      selection.addRange(savedRange.current);
    }
  };

  const command = (name, value = null) => {
    restoreSelection();
    document.execCommand('styleWithCSS', false, true);
    document.execCommand(name, false, value);
    saveSelection();
    syncEditor();
  };

  const insertMarkup = (markup) => {
    restoreSelection();
    document.execCommand('insertHTML', false, markup);
    saveSelection();
    syncEditor();
  };

  const insertDateTime = () => command('insertText', new Date().toLocaleString());
  const insertPageBreak = () => insertMarkup('<div data-page-break="true"><br></div>');
  const insertHorizontalRule = () => insertMarkup('<hr>');

  const findNext = () => {
    const editor = editorRef.current;
    const needle = findText.trim().toLocaleLowerCase();
    if (!editor || !needle) return toast.error('Enter text to find');
    const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
    const nodes = [];
    let node;
    while ((node = walker.nextNode())) if (node.nodeValue) nodes.push(node);
    if (!nodes.length) return toast.error('No matching text found');
    const previous = savedRange.current;
    const previousIndex = previous && editor.contains(previous.endContainer) ? nodes.indexOf(previous.endContainer) : -1;
    const startIndex = previousIndex >= 0 ? previousIndex : 0;
    const startOffset = previousIndex >= 0 ? previous.endOffset : 0;
    let match = null;
    for (let pass = 0; pass < 2 && !match; pass += 1) {
      const firstIndex = pass === 0 ? startIndex : 0;
      const lastIndex = pass === 0 ? nodes.length - 1 : startIndex;
      for (let index = firstIndex; index <= lastIndex; index += 1) {
        const current = nodes[index];
        const from = pass === 0 && index === startIndex ? startOffset : 0;
        const limit = pass === 1 && index === startIndex ? startOffset : current.nodeValue.length;
        const found = current.nodeValue.toLocaleLowerCase().indexOf(needle, from);
        if (found >= 0 && found + needle.length <= limit) { match = { node: current, start: found, end: found + needle.length }; break; }
      }
    }
    if (!match) return toast.error('No matching text found');
    const range = document.createRange();
    range.setStart(match.node, match.start);
    range.setEnd(match.node, match.end);
    editor.focus();
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    savedRange.current = range.cloneRange();
  };

  const replaceCurrent = () => {
    if (!findText.trim()) return toast.error('Enter text to find');
    const editor = editorRef.current;
    const saved = savedRange.current;
    if (!editor || !saved || !editor.contains(saved.startContainer) || saved.toString().toLocaleLowerCase() !== findText.toLocaleLowerCase()) return findNext();
    const range = saved.cloneRange();
    range.deleteContents();
    const replacement = document.createTextNode(replaceText);
    range.insertNode(replacement);
    range.setStartAfter(replacement);
    range.collapse(true);
    editor.focus();
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    savedRange.current = range.cloneRange();
    syncEditor();
  };

  const replaceAll = () => {
    const editor = editorRef.current;
    const needle = findText.trim();
    if (!editor || !needle) return toast.error('Enter text to find');
    const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const expression = new RegExp(escaped, 'gi');
    const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
    let count = 0;
    let node;
    while ((node = walker.nextNode())) {
      const matches = node.nodeValue.match(expression);
      if (!matches) continue;
      count += matches.length;
      node.nodeValue = node.nodeValue.replace(expression, () => replaceText);
    }
    syncEditor();
    toast.success(`${count} ${count === 1 ? 'match' : 'matches'} replaced`);
  };

  const loadText = async (files) => {
    const file = files[0];
    if (!file) return;
    const loadId = ++textLoadRef.current;
    const isDocx = /\.docx$/i.test(file.name);
    try {
      let contentHtml;
      if (isDocx) {
        const body = new FormData();
        body.append('file', file);
        const response = await fetch(`${apiBaseUrl}/documents/import`, {
          method: 'POST', credentials: 'include',
          headers: { 'X-CSRF-Token': await getCsrfToken() }, body
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(response.status === 401 ? 'Sign in to import a Word document.' : payload.error || 'Could not import this Word document.');
        if (loadId !== textLoadRef.current) return;
        contentHtml = payload.data?.html || '<p></p>';
        if (payload.data?.warnings?.length) toast('Word document imported with some formatting adjustments.');
        else toast.success('Word document imported.');
        setDocumentName(file.name.replace(/\.docx$/i, '').trim() || 'Imported document');
      } else if (/\.txt$/i.test(file.name) || file.type === 'text/plain') {
        contentHtml = makeTextHtml(decodeTextFile(await file.arrayBuffer()));
      } else {
        throw new Error('Choose a .txt or .docx document.');
      }
      if (loadId !== textLoadRef.current) return;
      setOfficeSourceFile(null);
      setOfficePreviewPdf(null);
      setOfficePreviewLoading(isDocx);
      setOfficePreviewPageCount(0);
      setUploadedFileName(file.name);
      if (editorRef.current) editorRef.current.innerHTML = contentHtml;
      setHtml(contentHtml);
      setPlainText(editorRef.current?.innerText || editorRef.current?.textContent || '');
      setResult(null);
      if (isDocx) setOfficeSourceFile(file);
    } catch (error) {
      if (loadId === textLoadRef.current) toast.error(error.message || 'Could not read this file.');
    }
  };

  const removeUploadedFile = () => {
    textLoadRef.current += 1;
    setUploadedFileName('');
    setOfficeSourceFile(null);
    setOfficePreviewPdf(null);
    setOfficePreviewLoading(false);
    setOfficePreviewPageCount(0);
    setHtml('');
    setPlainText('');
    setDocumentName('Untitled document');
    setResult(null);
    savedRange.current = null;
    if (editorRef.current) editorRef.current.innerHTML = '';
  };

  const chooseColor = (key, value, commandName) => {
    update(key, value);
    command(commandName, value);
  };

  const setFontSize = (value) => {
    update('fontSize', value);
    restoreSelection();
    const selection = window.getSelection();
    const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
    if (range && !range.collapsed && range.startContainer === range.endContainer && range.startContainer.nodeType === Node.TEXT_NODE) {
      const span = document.createElement('span');
      span.style.fontSize = `${value}pt`;
      span.append(range.extractContents());
      range.insertNode(span);
      const nextRange = document.createRange();
      nextRange.selectNodeContents(span);
      selection.removeAllRanges();
      selection.addRange(nextRange);
      saveSelection();
      syncEditor();
    }
  };

  const setDocumentAlignment = (value) => {
    update('align', value);
    if (editorRef.current) {
      [...editorRef.current.children].forEach((block) => { block.style.textAlign = value; });
      syncEditor();
    }
  };

  const createOutput = async () => {
    if (officeSourceFile && ((format === 'pdf' && officePreviewPdf) || format === 'docx')) {
      const source = format === 'pdf' ? officePreviewPdf : officeSourceFile;
      setResult(URL.createObjectURL(source));
      toast.success(`${outputLabel} created with the original Word layout`);
      return;
    }
    if (!plainText.trim()) return toast.error('Enter or upload text first');
    setBusy(true);
    setResult(null);
    try {
      const body = new FormData();
      body.append('html', html || editorRef.current?.innerHTML || '');
      body.append('options', JSON.stringify(options));
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/pdf/${tool.endpoint}`, { method: 'POST', body, credentials: 'include' });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw Error(error.error || `Could not create the ${outputLabel.toLowerCase()}`);
      }
      setResult(URL.createObjectURL(await response.blob()));
      toast.success(`${outputLabel} created`);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusy(false);
    }
  };

  const paper = options.pageSize === 'legal' ? [612, 1008] : options.pageSize === 'letter' ? [612, 792] : [595.28, 841.89];
  const [pageWidth, pageHeight] = options.orientation === 'landscape' ? [paper[1], paper[0]] : paper;
  const previewMaxWidth = format === 'docx' ? 790 : 600;
  const previewMaxHeight = format === 'docx' ? 900 : 800;
  const scale = Math.min(previewMaxWidth / pageWidth, previewMaxHeight / pageHeight);
  const wordCount = plainText.trim() ? plainText.trim().split(/\s+/).length : 0;
  const downloadName = createDownloadName({ name: officeSourceFile?.name || uploadedFileName || documentName }, outputExtension);
  const editorStyle = {
    width: `min(100%, ${pageWidth * scale}px)`, aspectRatio: `${pageWidth} / ${pageHeight}`,
    padding: `${Number(options.margin) * scale}px`, backgroundColor: options.backgroundColor,
    fontFamily: cssFont(options.font), fontSize: `${Number(options.fontSize) * scale}px`, color: options.color,
    fontWeight: options.font.includes('Bold') ? 700 : 400,
    fontStyle: options.font.includes('Italic') || options.font.includes('Oblique') ? 'italic' : 'normal',
    textAlign: options.align, lineHeight: Number(options.lineSpacing),
    '--text-paragraph-space': `${Number(options.paragraphSpacing) * scale}px`,
  };

  const toolbarButton = (label, title, onClick, className = '') => <button type="button" className={`text-toolbar-button ${className}`} title={title} aria-label={title} onMouseDown={(event) => event.preventDefault()} onClick={onClick}>{label}</button>;

  const wordToolbar = <div className="text-toolbar word-toolbar" onMouseDown={saveSelection}>
    <select className="form-select text-toolbar-select" aria-label="Paragraph style" defaultValue="P" onChange={(event) => command('formatBlock', event.target.value)}><option value="P">Normal</option><option value="H1">Title</option><option value="H2">Heading 1</option><option value="H3">Heading 2</option><option value="BLOCKQUOTE">Quote</option></select>
    <select className="form-select text-toolbar-select" aria-label="Font family" value={options.font} onChange={(event) => { update('font', event.target.value); command('fontName', event.target.value); }}>{fonts.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
    <select className="form-select text-toolbar-size" aria-label="Font size" value={options.fontSize} onChange={(event) => setFontSize(event.target.value)}>{[8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36].map((size) => <option key={size} value={size}>{size} pt</option>)}</select>
    {toolbarButton('B', 'Bold', () => command('bold'), 'text-toolbar-bold')}
    {toolbarButton('I', 'Italic', () => command('italic'), 'text-toolbar-italic')}
    {toolbarButton('U', 'Underline', () => command('underline'), 'text-toolbar-underline')}
    {toolbarButton('S', 'Strikethrough', () => command('strikeThrough'), 'text-toolbar-strike')}
    {toolbarButton('x^2', 'Superscript', () => command('superscript'))}
    {toolbarButton('x_2', 'Subscript', () => command('subscript'))}
    <label className="text-toolbar-color" title="Text color">A<input type="color" value={options.color} onChange={(event) => chooseColor('color', event.target.value, 'foreColor')}/></label>
    <label className="text-toolbar-color text-highlight" title="Text highlight">H<input type="color" value={options.highlight} onChange={(event) => chooseColor('highlight', event.target.value, 'hiliteColor')}/></label>
    {toolbarButton('Left', 'Align left', () => { update('align', 'left'); command('justifyLeft'); })}
    {toolbarButton('Center', 'Center text', () => { update('align', 'center'); command('justifyCenter'); })}
    {toolbarButton('Right', 'Align right', () => { update('align', 'right'); command('justifyRight'); })}
    {toolbarButton('Justify', 'Justify text', () => { update('align', 'justify'); command('justifyFull'); })}
    {toolbarButton('Bullets', 'Bulleted list', () => command('insertUnorderedList'))}
    {toolbarButton('1. List', 'Numbered list', () => command('insertOrderedList'))}
    {toolbarButton('Outdent', 'Decrease indent', () => command('outdent'))}
    {toolbarButton('Indent', 'Increase indent', () => command('indent'))}
    {toolbarButton('Undo', 'Undo', () => command('undo'))}
    {toolbarButton('Redo', 'Redo', () => command('redo'))}
    {toolbarButton('Clear', 'Clear text formatting', () => command('removeFormat'))}
  </div>;

  const wordPageSettings = <div className="word-layout-options">
    <label>Paper size<select className="form-select" value={options.pageSize} onChange={(event) => update('pageSize', event.target.value)}><option value="a4">A4</option><option value="letter">US Letter</option><option value="legal">US Legal</option></select></label>
    <label>Orientation<select className="form-select" value={options.orientation} onChange={(event) => update('orientation', event.target.value)}><option value="portrait">Portrait</option><option value="landscape">Landscape</option></select></label>
    <label>Font size <span>{options.fontSize} pt</span><input className="form-range" type="range" min="8" max="36" step="1" value={options.fontSize} onChange={(event) => update('fontSize', event.target.value)}/></label>
    <label>Alignment<select className="form-select" value={options.align} onChange={(event) => setDocumentAlignment(event.target.value)}><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option><option value="justify">Justify</option></select></label>
    <label>Line spacing <span>{options.lineSpacing}x</span><select className="form-select" value={options.lineSpacing} onChange={(event) => update('lineSpacing', event.target.value)}><option value="1">Single</option><option value="1.15">1.15</option><option value="1.35">1.35</option><option value="1.5">1.5</option><option value="2">Double</option></select></label>
    <label>Paragraph spacing <span>{options.paragraphSpacing} pt</span><input className="form-range" type="range" min="0" max="24" step="2" value={options.paragraphSpacing} onChange={(event) => update('paragraphSpacing', event.target.value)}/></label>
    <label>Page margins <span>{options.margin} pt</span><input className="form-range" type="range" min="18" max="108" step="2" value={options.margin} onChange={(event) => update('margin', event.target.value)}/></label>
    <label>Page color<span className="text-color-control"><input type="color" value={options.backgroundColor} onChange={(event) => update('backgroundColor', event.target.value)}/><small>{options.backgroundColor.toUpperCase()}</small></span></label>
    <label className="text-page-number-option"><input type="checkbox" checked={options.pageNumbers} onChange={(event) => update('pageNumbers', event.target.checked)}/> Add page numbers</label>
  </div>;

  const wordEditor = <div className="word-page-stage">
    <div className="text-document-editor word-page-editor" ref={editorRef} dir="auto" contentEditable suppressContentEditableWarning role="textbox" aria-label="Word document editor" aria-multiline="true" spellCheck={spellCheckEnabled} data-page-number={options.pageNumbers} data-current-page={pageInfo.current} data-page-count={pageInfo.total} data-placeholder="Start typing your document..." style={editorStyle} onInput={syncEditor} onMouseUp={saveSelection} onKeyUp={saveSelection}/>
  </div>;

  const onTextFileChange = (event) => {
    loadText(event.target.files);
    event.target.value = '';
  };

  if (!draftReady) return <main className="container py-5"><p className="small text-secondary">Restoring your saved work…</p></main>;

  if (format === 'docx') return <main className="word-app">
    <header className="word-titlebar">
      <div className="word-app-mark">W</div>
      <button type="button" className="word-open-button" onClick={() => textFileRef.current?.click()}>Open text</button>
      <input ref={textFileRef} hidden type="file" accept=".txt,text/plain" onChange={onTextFileChange}/>
      <input className="word-document-name" aria-label="Document name" value={documentName} onChange={(event) => setDocumentName(event.target.value)} />
      <span className="word-save-state">{result ? 'Document created' : draftStatus || 'Ready'}</span>
      <div className="word-title-actions">
        <Link to="/tools" className="word-exit-link">Exit editor</Link>
        <button type="button" className="word-export-button" onClick={createOutput} disabled={busy || !plainText.trim()}>{busy ? 'Creating...' : 'Create DOCX'}</button>
      </div>
    </header>
    <nav className="word-ribbon-tabs" aria-label="Document tools">
      {['Home', 'Insert', 'Layout', 'Review'].map((tab) => <button type="button" key={tab} className={activeRibbon === tab ? 'active' : ''} onClick={() => setActiveRibbon(tab)}>{tab}</button>)}
    </nav>
    <section className="word-ribbon" aria-label={`${activeRibbon} tools`}>
      {activeRibbon === 'Home' && <>{wordToolbar}<small>Formatting</small></>}
      {activeRibbon === 'Insert' && <div className="word-insert-tools" onMouseDown={saveSelection}>
        <label>Insert style<select className="form-select text-toolbar-select" defaultValue="P" onChange={(event) => command('formatBlock', event.target.value)}><option value="P">Normal text</option><option value="H1">Title</option><option value="H2">Heading 1</option><option value="H3">Heading 2</option><option value="BLOCKQUOTE">Quote</option></select></label>
        {toolbarButton('Bulleted list', 'Insert a bulleted list', () => command('insertUnorderedList'))}
        {toolbarButton('Numbered list', 'Insert a numbered list', () => command('insertOrderedList'))}
        {toolbarButton('Indent', 'Increase indent', () => command('indent'))}
        {toolbarButton('Outdent', 'Decrease indent', () => command('outdent'))}
        {toolbarButton('Date & time', 'Insert the current date and time', insertDateTime)}
        {toolbarButton('Horizontal line', 'Insert a horizontal line', insertHorizontalRule)}
        {toolbarButton('Page break', 'Start the next content on a new page', insertPageBreak)}
      </div>}
      {activeRibbon === 'Layout' && wordPageSettings}
      {activeRibbon === 'Review' && <div className="word-review-tools">
        <label>Find<input className="form-control" value={findText} onChange={(event) => setFindText(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && findNext()}/></label>
        <label>Replace with<input className="form-control" value={replaceText} onChange={(event) => setReplaceText(event.target.value)}/></label>
        <button type="button" onClick={findNext}>Find next</button>
        <button type="button" onClick={replaceCurrent}>Replace</button>
        <button type="button" onClick={replaceAll}>Replace all</button>
        <button type="button" className={spellCheckEnabled ? 'active' : ''} onClick={() => setSpellCheckEnabled((enabled) => !enabled)}>Spelling {spellCheckEnabled ? 'on' : 'off'}</button>
        <span>{wordCount}{" " + 'words ·' + " "}{plainText.length} characters</span>
      </div>}
    </section>
    <section className="word-workspace">
      <aside className="word-navigation-pane"><h2>Document</h2><button type="button" className="word-page-nav active">Page 1 <span>{wordCount} words</span></button><small>{plainText.length} characters</small></aside>
      <section className="word-document-area"><div className="word-document-caption"><span>Page {pageInfo.current}{" " + 'of' + " "}{pageInfo.total}{pageInfo.total > pageInfo.current ? ` · Page ${pageInfo.current + 1} starts below` : ''}</span><span>{options.pageSize.toUpperCase()} · {options.orientation}</span></div>{wordEditor}</section>
      <aside className="word-info-pane"><h2>Document info</h2><dl><dt>Pages</dt><dd>1 preview</dd><dt>Words</dt><dd>{wordCount}</dd><dt>Characters</dt><dd>{plainText.length}</dd></dl><p>Use the ribbon above to format text and set the page layout. Longer documents continue when opened in Word.</p></aside>
    </section>
    <footer className="word-statusbar"><span>Page {pageInfo.current}{" " + 'of' + " "}{pageInfo.total}</span><span>{wordCount} words</span><span>English (United States)</span><span className="word-status-spacer"/><span>{options.fontSize} pt</span><span>{options.pageSize.toUpperCase()}</span></footer>
    <OperationProgressModal show={busy} title={`PDF Pro Cut is creating your ${outputLabel.toLowerCase()}`} description="Please wait while your document is prepared."/>
    <DownloadResultModal href={result} fileName={downloadName} toolSlug={tool.slug} title={`PDF Pro Cut created your ${outputLabel.toLowerCase()}`} downloadLabel={format === 'docx' ? 'Download Word document' : 'Download PDF'} onClose={() => setResult(null)}/>
  </main>;

  return <main className="container py-5 text-to-pdf-page">
    <Link to="/tools" className="back">All tools</Link>
    <h2>{tool.name}</h2>
    <p className="lead">Type or upload text, format it like a document, and preview the {outputLabel} page as you work.</p>
    {draftStatus && <p className={`small ${draftStatus === 'Autosave unavailable' ? 'text-warning' : 'text-success'}`} role="status">{draftStatus}</p>}

    {showPagePreview && <div className="text-page-preview-backdrop" role="dialog" aria-modal="true" aria-label="Full-screen page preview">
      <header className="text-page-preview-toolbar">
        <div className="text-page-preview-heading"><b>Page preview</b><span>Page {pageInfo.current}{" " + 'of' + " "}{pageInfo.total} · {documentName} · {options.pageSize.toUpperCase()} · {options.orientation}</span></div>
        <div className="text-page-preview-controls">
          <label className="text-page-number-toggle"><input type="checkbox" checked={options.pageNumbers} onChange={(event) => update('pageNumbers', event.target.checked)}/> Page numbers</label>
          <button type="button" aria-label="Zoom out" title="Zoom out" onClick={() => setPreviewZoom((zoom) => Math.max(50, zoom - 10))}>−</button>
          <span className="text-page-preview-zoom">{previewZoom}%</span>
          <button type="button" aria-label="Zoom in" title="Zoom in" onClick={() => setPreviewZoom((zoom) => Math.min(150, zoom + 10))}>+</button>
          <button type="button" className="text-page-preview-close" aria-label="Close preview" title="Close preview" onClick={() => setShowPagePreview(false)}>×</button>
        </div>
      </header>
      <div className="text-page-preview-stage">{officePreviewPdf ? <><div className="office-pdf-preview-banner">Original Word layout · {officePreviewPageCount || '…'} pages</div><OfficePdfDocumentPreview file={officePreviewPdf} zoom={previewZoom} onPageCount={setOfficePreviewPageCount}/></> : officePreviewLoading ? <div className="office-pdf-preview-message">Preparing original Word layout…</div> : <div className="text-page-preview-host" ref={pagePreviewHost}/>}</div>
    </div>}
    <div className="text-to-pdf-workspace" ref={workspaceRef}>
      <section className="text-document-panel">
        <div className="text-document-title"><div className="text-document-actions"><span>Live {outputLabel} page preview</span>{uploadedFileName && <span className="text-uploaded-file-name" title={uploadedFileName} aria-live="polite">Loaded: {uploadedFileName}</span>}<label className="text-page-number-toggle"><input type="checkbox" checked={options.pageNumbers} onChange={(event) => update('pageNumbers', event.target.checked)}/> Page numbers</label><button type="button" className="text-preview-open-button" onClick={() => { setPreviewZoom(110); setShowPagePreview(true); }}>Page preview</button><button type="button" className="text-upload-file-button" onClick={() => textFileRef.current?.click()}>{uploadedFileName ? 'Replace file' : 'Upload file'}</button>{uploadedFileName && <button type="button" className="text-remove-file-button" aria-label={`Remove uploaded file ${uploadedFileName}`} onClick={removeUploadedFile}>Remove file</button>}<button type="button" onClick={() => setShowGuide(true)}>How to use</button><input ref={textFileRef} hidden type="file" accept=".txt,.docx,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={onTextFileChange}/></div></div>
        <div className="text-toolbar" onMouseDown={saveSelection}>
          <select className="form-select text-toolbar-select" aria-label="Paragraph style" defaultValue="P" onChange={(event) => command('formatBlock', event.target.value)}><option value="P">Normal</option><option value="H1">Title</option><option value="H2">Heading 1</option><option value="H3">Heading 2</option><option value="BLOCKQUOTE">Quote</option></select>
          <select className="form-select text-toolbar-select" aria-label="Font family" value={options.font} onChange={(event) => { update('font', event.target.value); command('fontName', event.target.value); }}>{fonts.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
          <select className="form-select text-toolbar-size" aria-label="Font size" value={options.fontSize} onChange={(event) => setFontSize(event.target.value)}>{[8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36].map((size) => <option key={size} value={size}>{size} pt</option>)}</select>
          {toolbarButton('B', 'Bold', () => command('bold'), 'text-toolbar-bold')}
          {toolbarButton('I', 'Italic', () => command('italic'), 'text-toolbar-italic')}
          {toolbarButton('U', 'Underline', () => command('underline'), 'text-toolbar-underline')}
          {toolbarButton('S', 'Strikethrough', () => command('strikeThrough'), 'text-toolbar-strike')}
          {toolbarButton('x^2', 'Superscript', () => command('superscript'))}
          {toolbarButton('x_2', 'Subscript', () => command('subscript'))}
          <label className="text-toolbar-color" title="Text color">A<input type="color" value={options.color} onChange={(event) => chooseColor('color', event.target.value, 'foreColor')}/></label>
          <label className="text-toolbar-color text-highlight" title="Text highlight">H<input type="color" value={options.highlight} onChange={(event) => chooseColor('highlight', event.target.value, 'hiliteColor')}/></label>
          {toolbarButton('Left', 'Align left', () => { update('align', 'left'); command('justifyLeft'); })}
          {toolbarButton('Center', 'Center text', () => { update('align', 'center'); command('justifyCenter'); })}
          {toolbarButton('Right', 'Align right', () => { update('align', 'right'); command('justifyRight'); })}
          {toolbarButton('Justify', 'Justify text', () => { update('align', 'justify'); command('justifyFull'); })}
          {toolbarButton('Bullets', 'Bulleted list', () => command('insertUnorderedList'))}
          {toolbarButton('1. List', 'Numbered list', () => command('insertOrderedList'))}
          {toolbarButton('Outdent', 'Decrease indent', () => command('outdent'))}
          {toolbarButton('Indent', 'Increase indent', () => command('indent'))}
          {toolbarButton('Undo', 'Undo', () => command('undo'))}
          {toolbarButton('Redo', 'Redo', () => command('redo'))}
          {toolbarButton('Clear', 'Clear text formatting', () => command('removeFormat'))}
        </div>
        <div className="text-extended-toolbar" onMouseDown={saveSelection}>
          {toolbarButton('Date & time', 'Insert the current date and time', insertDateTime)}
          {toolbarButton('Horizontal line', 'Insert a horizontal line', insertHorizontalRule)}
          {toolbarButton('Page break', 'Start the next content on a new page', insertPageBreak)}
          <input aria-label="Find text" placeholder="Find" value={findText} onChange={(event) => setFindText(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && findNext()}/>
          <input aria-label="Replace with" placeholder="Replace with" value={replaceText} onChange={(event) => setReplaceText(event.target.value)}/>
          {toolbarButton('Find next', 'Find next match', findNext)}
          {toolbarButton('Replace', 'Replace selected match', replaceCurrent)}
          {toolbarButton('Replace all', 'Replace all matches', replaceAll)}
          <label className="text-spellcheck-toggle"><input type="checkbox" checked={spellCheckEnabled} onChange={(event) => setSpellCheckEnabled(event.target.checked)}/> Spell check</label>
        </div>

        <div className="text-page-preview-wrap">
          <div className="text-page-preview-label">Page {pageInfo.current}{" " + 'of' + " "}{pageInfo.total} <span>{pageInfo.total > pageInfo.current ? `Page ${pageInfo.current + 1} starts below` : `${plainText.length} characters`}</span></div>
          <div ref={editorRef} className="text-document-editor" dir="auto" contentEditable suppressContentEditableWarning role="textbox" aria-label="Text document editor" aria-multiline="true" spellCheck={spellCheckEnabled} data-page-number={options.pageNumbers} data-current-page={pageInfo.current} data-page-count={pageInfo.total} data-placeholder="Type or paste your text here..." style={editorStyle} onInput={syncEditor} onMouseUp={saveSelection} onKeyUp={saveSelection}/>
          <small className="text-preview-note">The editor shows the live first-page layout. Longer documents continue onto more pages.</small>
        </div>
      </section>

      <aside className="text-settings-panel">
        <h2>Page and text settings</h2>
        <label>Paper size<select className="form-select" value={options.pageSize} onChange={(event) => update('pageSize', event.target.value)}><option value="a4">A4</option><option value="letter">US Letter</option><option value="legal">US Legal</option></select></label>
        <label>Orientation<select className="form-select" value={options.orientation} onChange={(event) => update('orientation', event.target.value)}><option value="portrait">Portrait</option><option value="landscape">Landscape</option></select></label>
        <label>Default font size <span>{options.fontSize} pt</span><input className="form-range" type="range" min="8" max="36" step="1" value={options.fontSize} onChange={(event) => update('fontSize', event.target.value)}/></label>
        <label>Paragraph alignment<select className="form-select" value={options.align} onChange={(event) => setDocumentAlignment(event.target.value)}><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option><option value="justify">Justify</option></select></label>
        <label>Line spacing <span>{options.lineSpacing}x</span><select className="form-select" value={options.lineSpacing} onChange={(event) => update('lineSpacing', event.target.value)}><option value="1">Single</option><option value="1.15">1.15</option><option value="1.35">1.35</option><option value="1.5">1.5</option><option value="2">Double</option></select></label>
        <label>Paragraph spacing <span>{options.paragraphSpacing} pt</span><input className="form-range" type="range" min="0" max="24" step="2" value={options.paragraphSpacing} onChange={(event) => update('paragraphSpacing', event.target.value)}/></label>
        <label>Page margin <span>{options.margin} pt</span><input className="form-range" type="range" min="18" max="108" step="2" value={options.margin} onChange={(event) => update('margin', event.target.value)}/></label>
        <label>Page background<span className="text-color-control"><input type="color" value={options.backgroundColor} onChange={(event) => update('backgroundColor', event.target.value)}/><small>{options.backgroundColor.toUpperCase()}</small></span></label>
        <label className="text-page-number-option"><input type="checkbox" checked={options.pageNumbers} onChange={(event) => update('pageNumbers', event.target.checked)}/> Add page numbers</label>
        <p className="text-settings-note">{officeSourceFile ? 'Original Word layout is preserved in preview and export. Editing text or page settings switches to the editable layout.' : 'Font, color, highlights, paragraphs, lists, and headings can also be applied from the editor toolbar.'}</p>
        <button type="button" className="btn btn-primary" onClick={createOutput} disabled={busy || officePreviewLoading || (!plainText.trim() && !officeSourceFile)}>{busy ? `Creating ${outputLabel.toLowerCase()}...` : officePreviewLoading ? 'Preparing original layout...' : `Create ${format === 'docx' ? 'Document' : 'PDF'}`}</button>
    <OperationProgressModal show={busy} title={`PDF Pro Cut is creating your ${outputLabel.toLowerCase()}`} description="Please wait while your document is prepared."/>
    <DownloadResultModal href={result} fileName={downloadName} toolSlug={tool.slug} title={`PDF Pro Cut created your ${outputLabel.toLowerCase()}`} downloadLabel={format === 'docx' ? 'Download Word document' : 'Download PDF'} onClose={() => setResult(null)}/>
      </aside>
    </div>
    {showGuide && <div className="text-guide-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowGuide(false); }}><section className="text-guide-dialog" role="dialog" aria-modal="true" aria-label={`How to use ${tool.name}`}><button className="text-guide-close" type="button" onClick={() => setShowGuide(false)} aria-label="Close guide">×</button><ToolGuide tool={tool}/></section></div>}
  </main>;
}
