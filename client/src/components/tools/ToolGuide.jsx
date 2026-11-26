import { Link } from 'react-router-dom';
import { toolGuides } from '../../content/toolGuides.js';
import { governmentImagePresets, governmentPresetByTool, governmentToolGuidanceByTool } from '../../../../shared/imagePresets.mjs';
import '../../styles/contentPages.css';

export default function ToolGuide({ tool }) {
  const guide = toolGuides[tool.slug] || (tool.gov ? governmentGuide(tool) : null);
  if (!guide) return null;
  const sources = guide.sources || [];

  return <article className="tool-guide" id="guide" aria-labelledby="tool-guide-title">
    <div className="tool-guide-heading">
      <span className="pdfpro-info-eyebrow">{tool.category} GUIDE</span>
      <h2 id="tool-guide-title">How to use {tool.name}</h2>
      <p>{guide.overview}</p>
    </div>
    <div className="tool-guide-grid">
      <section><h3>When to use it</h3><p>{guide.bestFor}</p></section>
      <section><h3>Steps</h3><ol>{guide.steps.map((step) => <li key={step}>{step}</li>)}</ol></section>
      <section><h3>Example</h3><p>{guide.example}</p></section>
      <section><h3>Limits and things to check</h3><p>{guide.limits}</p></section>
    </div>
    {sources.length > 0 && <section className="tool-guide-sources" aria-label="Official application instructions">{sources.map((source) => <a key={source.url} href={source.url} target="_blank" rel="noreferrer">{source.label} ↗</a>)}</section>}
    {guide.faqs?.length > 0 && <section className="tool-guide-faq" aria-labelledby="tool-guide-faq-title">
      <h3 id="tool-guide-faq-title">{tool.name} FAQ</h3>
      {guide.faqs.map(({ question, answer }) => <details key={question}><summary>{question}</summary><p>{answer}</p></details>)}
    </section>}
    <Link className="tool-guide-directory-link" to="/guides">Browse all tool guides</Link>
  </article>;
}

function governmentGuide(tool) {
  const preset = governmentImagePresets[governmentPresetByTool[tool.slug]];
  const officialGuidance = governmentToolGuidanceByTool[tool.slug];
  const officialNote = officialGuidance?.note || preset?.note;
  const sources = officialGuidance?.sources || preset?.sources || (preset?.sourceUrl ? [{ label: preset.sourceLabel || 'Official application instructions', url: preset.sourceUrl }] : []);
  const serverProcessed = tool.gov.kind === 'pdf-compress';
  const dpiTool = tool.gov.kind === 'dpi';
  const removeBackground = tool.gov.kind === 'remove-background';
  const whiteBackgroundTool = tool.gov.kind === 'white-background';
  const pixelEditingTool = removeBackground || whiteBackgroundTool || Boolean(tool.gov.crop);
  const pair = tool.gov.kind === 'pair';
  const photoNameDateFooter = tool.category === 'Kerala PSC Tools' && (tool.gov.subject === 'photo' || pair);
  return {
    overview: serverProcessed
      ? `Reduce a ${tool.gov.subject} toward a chosen maximum file size, then inspect the compressed copy before uploading it to an application.`
      : `Prepare a ${tool.gov.subject} image in your browser with editable dimensions and a live preview before downloading it.${photoNameDateFooter ? ' Kerala PSC OTR requires the applicant name and photo date at the bottom.' : ''}`,
    bestFor: `Preparing a ${tool.gov.subject} for an application workflow when you already know the dimensions, format, resolution, and file-size limit from its current official instructions.`,
    steps: serverProcessed
      ? ['Check the current application notice for the accepted file type and maximum size.', 'Choose the PDF or modern Office file and set a target size.', 'Download the compressed result and confirm it still opens, is legible, and meets the stated limit.']
      : [
        'Read the current official notice and note the required image dimensions, file type, file-size limit, background, and any other rules.',
        pair ? 'Choose the photo and signature, then set their dimensions. You can preview and download each one separately.' : 'Choose a JPG or PNG image. Set the output width and height, background, crop, format, or DPI options available for this tool.',
        ...(photoNameDateFooter ? ['Enter the applicant name and photo date; the Kerala PSC photo output includes both in its bottom band. Check the preview.'] : []),
        'Review the live preview and download the result. Check its properties and appearance against the official instructions before submitting it.'
      ],
    example: serverProcessed
      ? 'If the notice allows a 200 KB PDF, select Custom size, choose KB, enter 200, compress a copy, and check the resulting file.'
      : dpiTool
        ? 'Set the DPI metadata requested by a print workflow, then confirm the pixel dimensions remain unchanged.'
        : removeBackground
          ? 'Remove a plain white background from a scanned signature, inspect thin strokes, and download the transparent PNG.'
          : whiteBackgroundTool
            ? 'Replace a plain background sampled from the image corners with white, then inspect the hair and clothing edges in the preview.'
          : photoNameDateFooter
            ? 'Add the required applicant name and date to the Kerala PSC photo, then review the white footer before downloading.'
          : 'Enter the width and height stated by the notice, inspect the resized preview, and download the image.',
    limits: serverProcessed
      ? 'The target is a maximum that may not be achievable without stronger quality loss. PDF compression may rasterize pages, removing searchable text. This document tool sends the selected file to the PDF Pro Cut server for processing; avoid using it for sensitive identity documents if that does not suit your privacy needs.'
      : `Image processing runs in your browser and does not upload the source image. ${pixelEditingTool ? 'Background editing and automatic signature trimming support source images up to 12 megapixels. ' : ''}${dpiTool ? 'Changing DPI metadata does not add image detail or change pixel dimensions. ' : ''}${removeBackground ? 'Background removal targets near-white pixels and can affect pale ink; inspect the result closely. ' : ''}${whiteBackgroundTool ? 'Background replacement samples corner colors and works best with a plain, even background; it may alter similar-colored edges. ' : ''}${tool.gov.kind === 'compress' ? 'The requested KB limit is best-effort; very small targets may not be achievable at readable quality. ' : ''}${photoNameDateFooter ? 'The white name/date band is fitted within the selected output dimensions; the date is printed DD/MM/YYYY. ' : ''}${officialNote ? `${officialNote} ` : ''}Requirements can change by agency, post, and recruitment cycle. The current notice takes priority over these presets.`,
    sources,
    faqs: [
      { question: 'Does this guarantee the image meets the current application rules?', answer: 'No. Requirements can differ by agency, post, and recruitment cycle. Use the values in the current official notice and check the downloaded file before submitting.' },
      { question: serverProcessed ? 'Is this document processed in my browser?' : 'Is my source image uploaded?', answer: serverProcessed ? 'No. PDF and Office compression uses the PDF Pro Cut server. Review the Privacy Policy and avoid uploading sensitive identity documents if server processing does not meet your needs.' : 'No. The source image stays in your browser while this image tool prepares the output.' }
    ]
  };
}
