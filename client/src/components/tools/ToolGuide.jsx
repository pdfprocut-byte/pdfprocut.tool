import { Link } from 'react-router-dom';
import { toolGuides } from '../../content/toolGuides.js';
import { toolCatalog } from '../../../../shared/toolCatalog.mjs';
import { governmentImagePresets, governmentPresetByTool, governmentToolGuidanceByTool } from '../../../../shared/imagePresets.mjs';
import '../../styles/contentPages.css';

export default function ToolGuide({ tool }) {
  const guide = toolGuides[tool.slug] || (tool.gov ? governmentGuide(tool) : null);
  if (!guide) return null;
  const sources = guide.sources || [];
  const relatedTools = toolCatalog.filter((candidate) => candidate.gov && candidate.category === tool.category && candidate.slug !== tool.slug).slice(0, 5);
  const faqSchema = guide.faqs?.length ? {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: guide.faqs.map(({ question, answer }) => ({ '@type': 'Question', name: question, acceptedAnswer: { '@type': 'Answer', text: answer } }))
  } : null;

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
    {faqSchema && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema).replaceAll('<', '\\u003c') }}/>}
    {relatedTools.length > 0 && <section className="tool-guide-related" aria-labelledby="tool-guide-related-title">
      <h3 id="tool-guide-related-title">Related tools</h3>
      <ul>{relatedTools.map((related) => <li key={related.slug}><Link to={`/tools/${related.slug}`}>{related.name}</Link></li>)}</ul>
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
  const aiBackgroundTool = tool.gov.kind === 'ai-background';
  const pixelEditingTool = removeBackground || whiteBackgroundTool || Boolean(tool.gov.crop);
  const pair = tool.gov.kind === 'pair';
  const photoNameDateFooter = tool.category === 'Kerala PSC Tools' && (tool.gov.subject === 'photo' || pair);
  return {
    overview: aiBackgroundTool
      ? 'Remove a photo background with AI, then keep the transparent cutout or replace it with a solid color.'
      : serverProcessed
        ? `Compress a ${tool.gov.subject} to fit under the selected maximum when the file and format allow it, then inspect the copy before uploading it to an application.`
        : `Prepare a ${tool.gov.subject} image in your browser with editable dimensions and a live preview before downloading it.${photoNameDateFooter ? ' Kerala PSC OTR requires the applicant name and photo date at the bottom.' : ''}`,
    bestFor: aiBackgroundTool
      ? 'Removing or replacing a plain photo background while preserving fine subject edges such as hair and clothing.'
      : `Preparing a ${tool.gov.subject} for an application workflow when you already know the dimensions, format, resolution, and file-size limit from its current official instructions.`,
    steps: aiBackgroundTool
      ? ['Choose a JPG, PNG, or WebP photo.', 'Choose a transparent PNG or a solid background color.', 'Confirm the PhotoRoom processing notice, process the image, inspect the preview, and download the result.']
      : serverProcessed
        ? ['Check the current application notice for the accepted file type and maximum size.', 'Choose the PDF or modern Office file and set a maximum no greater than that limit.', 'Download the result and confirm its size, legibility, and that it still opens.']
      : [
        'Read the current official notice and note the required image dimensions, file type, file-size limit, background, and any other rules.',
        pair ? 'Choose the photo and signature, then set their dimensions. You can preview and download each one separately.' : 'Choose a JPG, PNG, or WebP image. Set the output width and height, background, crop, format, or DPI options available for this tool.',
        ...(photoNameDateFooter ? ['Enter the applicant name and photo date; the Kerala PSC photo output includes both in its bottom band. Check the preview.'] : []),
        'Review the live preview and download the result. Check its properties and appearance against the official instructions before submitting it.'
      ],
    example: aiBackgroundTool
      ? 'Remove the background as a transparent PNG, or select a solid white, gray, or other color for the new background.'
      : serverProcessed
        ? 'If the notice allows a 200 KB PDF, select Custom size, choose KB, enter 200, compress a copy, and check the resulting file.'
        : dpiTool
        ? 'Set the DPI metadata requested by a print workflow, then confirm the pixel dimensions remain unchanged.'
        : removeBackground
          ? 'Remove the paper shade from a scanned signature, trim blank borders, inspect thin strokes, and download the transparent PNG.'
          : whiteBackgroundTool
            ? 'Replace a plain background with white using the local corner-color option, or select PhotoRoom AI for subject separation; inspect the hair and clothing edges in the preview.'
          : photoNameDateFooter
            ? 'Add the required applicant name and date to the Kerala PSC photo, then review the white footer before downloading.'
          : 'Enter the width and height stated by the notice, inspect the resized preview, and download the image.',
    limits: aiBackgroundTool
      ? 'After you opt in, the selected photo is sent through the PDF Pro Cut server to PhotoRoom in the United States for processing. PhotoRoom says it discards API images after processing and does not use them for training. Do not use this tool for signatures or photos you are not authorized to send.'
      : whiteBackgroundTool
        ? 'The corner-color option runs locally. If you check the PhotoRoom AI option, the selected photo is sent through the PDF Pro Cut server to PhotoRoom in the United States. PhotoRoom says it discards API images after processing and does not use them for training.'
      : serverProcessed
        ? 'The compressor tries to fit the file under the selected maximum at the chosen quality. By default it keeps PDF text and page dimensions, so scanned PDFs may not shrink enough. Optional image-based compression is limited to verified image-only scans and may reduce fine detail. Signed and XFA PDFs that need rewriting are rejected. This document tool sends the selected file to the PDF Pro Cut server for processing; review the Privacy Policy before using it with sensitive identity documents.'
        : `Image processing runs in your browser and does not upload the source image. ${pixelEditingTool ? 'Background editing and automatic signature trimming support source images up to 12 megapixels. ' : ''}${dpiTool ? 'Changing DPI metadata does not add image detail or change pixel dimensions. ' : ''}${removeBackground ? 'Signature cleanup estimates the paper shade from the image corners and fades matching pixels to transparency. Very pale ink can be lightened; inspect the result closely. ' : ''}${whiteBackgroundTool ? 'The local background replacement samples corner colors and works best with a plain, even background; PhotoRoom AI is optional for stronger subject separation. ' : ''}${tool.gov.kind === 'compress' ? 'The tool keeps the output within the requested KB maximum while preserving the selected dimensions and clarity as much as possible. If it cannot fit, it reports an error instead of returning a larger file. ' : ''}${photoNameDateFooter ? 'The white name/date band is fitted within the selected output dimensions; the date is printed DD/MM/YYYY. ' : ''}${officialNote ? `${officialNote} ` : ''}Requirements can change by agency, post, and recruitment cycle. The current notice takes priority over these presets.`,
    sources,
    faqs: [
      { question: 'Does this guarantee the image meets the current application rules?', answer: 'No. Requirements can differ by agency, post, and recruitment cycle. Use the values in the current official notice and check the downloaded file before submitting.' },
      { question: aiBackgroundTool ? 'Where is the photo processed?' : whiteBackgroundTool ? 'Does this photo leave my browser?' : serverProcessed ? 'Is this document processed in my browser?' : 'Is my source image uploaded?', answer: aiBackgroundTool ? 'Only after you check the consent box and start processing. The file goes through the PDF Pro Cut server to PhotoRoom. PhotoRoom states that API images are not stored or used for model training; its API servers are in the United States.' : whiteBackgroundTool ? 'No for the local corner-color option. If you select PhotoRoom AI and then process the image, a copy is sent through PDF Pro Cut to PhotoRoom in the United States.' : serverProcessed ? 'No. PDF and Office compression uses the PDF Pro Cut server. Review the Privacy Policy and avoid uploading sensitive identity documents if server processing does not meet your needs.' : 'No. The source image stays in your browser while this image tool prepares the output.' }
    ]
  };
}
