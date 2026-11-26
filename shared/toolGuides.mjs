export const toolGuides = {
  'merge-pdf': {
    overview: 'Combine two or more PDF files into one document, then review and arrange the pages before downloading.', bestFor: 'Joining reports, signed forms, or scanned pages that belong in one file.',
    steps: ['Choose the PDFs you want to combine.', 'Drag pages into the final order, rotate them if needed, or remove pages you do not want.', 'Select Merge PDF and download the finished file.'], example: 'Put a cover sheet, a multi-page report, and an appendix into one PDF in reading order.',
    limits: 'Choose at least two PDF files. Uploads are limited to 25 MB per file by default; the server setting can change this. A merge request accepts up to 20 files.', faqs: [{ question: 'Can I change the order of individual pages?', answer: 'Yes. The page preview lets you drag pages into a new order before you create the merged PDF.' }, { question: 'Can I remove a page while merging?', answer: 'Yes. Use the page controls to remove or restore a page before processing.' }]
  },
  'organize-pdf': {
    overview: 'Reorder, rotate, and remove pages from one or more PDFs, then save the organized result as a single PDF.', bestFor: 'Putting a document back into reading order or removing blank and duplicate pages.',
    steps: ['Upload the PDFs to organize.', 'Review the page thumbnails; drag to reorder, rotate pages, and remove pages as needed.', 'Check the page sequence and create the PDF.'], example: 'Reorder scanned pages that were uploaded out of sequence, then remove the blank scan at the end.',
    limits: 'Accepts PDF files only, up to 25 MB per file by default and 20 files per request. Very large or damaged PDFs may fail to preview or process.', faqs: [{ question: 'Does organizing change the page content?', answer: 'It changes page order and orientation and can remove pages; it does not edit text within a page.' }]
  },
  'split-pdf': {
    overview: 'Create a separate PDF containing the page numbers or page ranges you choose.', bestFor: 'Extracting a chapter, a form section, or a short range from a longer document.',
    steps: ['Upload a PDF.', 'Enter page numbers and ranges, such as 1-3,5.', 'Create and download the extracted PDF.'], example: 'Enter 4-8,12 to keep pages 4 through 8 and page 12 in the new document.',
    limits: 'Page numbers must exist in the uploaded PDF. The default upload limit is 25 MB per file.', faqs: [{ question: 'Are page numbers zero-based?', answer: 'No. Enter page numbers as they appear in the document, starting with page 1.' }]
  },
  'remove-pages': {
    overview: 'Select pages to remove and create a new PDF from the remaining pages.', bestFor: 'Removing blank scans, obsolete pages, or pages that should not be included in a shared copy.',
    steps: ['Upload one PDF and wait for the page preview.', 'Select each page to remove, or enter page numbers and ranges.', 'Review the selection and create the new PDF.'], example: 'Select pages 2 and 5-6 to omit those pages from the downloaded copy.',
    limits: 'The original file is not edited in place. Keep a copy of it if you may need the removed pages later. Uploads are 25 MB per file by default.', faqs: [{ question: 'Can I undo a page selection before processing?', answer: 'Yes. Select the page again to restore it, or adjust the page list before creating the output.' }]
  },
  'extract-pages': {
    overview: 'Keep selected page numbers or ranges and save them as a separate PDF.', bestFor: 'Sharing only the pages relevant to a particular person or task.',
    steps: ['Upload a PDF.', 'Enter the page numbers and ranges to keep.', 'Create the new PDF and check the downloaded pages.'], example: 'Enter 1,3-5 to create a PDF containing the first page and pages 3 through 5.',
    limits: 'Page numbers must be within the source document. The original is left unchanged; the default file limit is 25 MB.', faqs: [{ question: 'How is this different from removing pages?', answer: 'Extraction keeps only the pages you list. Removing pages starts with the whole document and omits the selected pages.' }]
  },
  'repair-pdf': {
    overview: 'Try to rebuild a readable PDF that has a damaged or inconsistent document structure.', bestFor: 'A PDF that opens inconsistently or fails a basic parser check even though its pages are still readable.',
    steps: ['Upload the PDF.', 'Choose Repair PDF to rebuild its document structure.', 'Open the result and check its pages, links, and text.'], example: 'Try repairing a file that opens in one viewer but reports a structure error in another.',
    limits: 'Repair cannot recover missing or unreadable page data, and it may not restore forms, links, or metadata. The default upload limit is 25 MB.', faqs: [{ question: 'Will repair recover a deleted or corrupted page?', answer: 'No. It can only rebuild information that remains readable in the uploaded file.' }]
  },
  'pdf-to-jpg': {
    overview: 'Render PDF pages as JPG or PNG images and download them together in a ZIP archive.', bestFor: 'Creating page images for previews or software that accepts JPG and PNG files.',
    steps: ['Upload a PDF.', 'Choose JPG or PNG. Set JPG quality from 50% to 100% when using JPG.', 'Convert the pages and download the ZIP archive.'], example: 'Convert a one-page flyer to JPG for a small preview, or PNG when you want to avoid JPG compression artifacts.',
    limits: 'Each output page is an image, so text is no longer selectable. JPG quality is adjustable from 50% to 100%; PNG is lossless. Large page counts can create a large ZIP file. Uploads are 25 MB per file by default.', faqs: [{ question: 'Does the ZIP contain one image per page?', answer: 'Yes. The converted pages are packaged together so they can be downloaded in one file.' }]
  },
  'pdf-to-png': {
    overview: 'Render PDF pages as PNG images or switch to JPG, then download the pages in a ZIP archive.', bestFor: 'Creating lossless page images for previews, editing, or software that accepts PNG files.',
    steps: ['Upload a PDF.', 'Choose PNG or JPG. JPG also has an adjustable quality setting.', 'Convert the pages and download the ZIP archive.'], example: 'Export a chart-heavy PDF page as PNG to avoid JPG compression artifacts.',
    limits: 'Each output file is a page image, so text is no longer selectable. Large page counts can create a large ZIP file. Uploads are 25 MB per file by default.', faqs: [{ question: 'Can I use JPG from this tool too?', answer: 'Yes. Choose JPG in the image format list and adjust its quality before converting.' }]
  },
  'extract-images-pdf': {
    overview: 'Preview embedded raster images in a PDF, select the ones you want, and download them as PNG files in a ZIP archive.', bestFor: 'Saving selected photos, scans, and other bitmap images placed inside a PDF.',
    steps: ['Upload a PDF that contains embedded raster images.', 'Review the image previews and select the pictures to extract.', 'Download the ZIP containing your selected PNG files.'], example: 'Preview the photos in a brochure PDF and save only the ones you choose.',
    limits: 'Extracted images are decoded as PNG at their available pixel dimensions. Text, vector drawings, and decorative page elements are not extracted. Very large images may exceed the extraction limits.', faqs: [{ question: 'Does this save each PDF page as an image?', answer: 'No. It extracts raster image objects from pages; use PDF to PNG or PDF to JPG to export whole pages.' }]
  },
  'pdf-to-powerpoint': {
    overview: 'Turn each PDF page into a slide in a PowerPoint presentation.', bestFor: 'Presenting or displaying pages from a PDF in slide software.',
    steps: ['Upload the PDF.', 'Convert it to PowerPoint.', 'Open the presentation and review each slide.'], example: 'Place a finished PDF handout into a presentation deck as page-sized slides.',
    limits: 'Slides are page images, not editable text and shapes. The output may not preserve links or searchable text. The default upload limit is 25 MB.', faqs: [{ question: 'Can I edit the words on a converted slide?', answer: 'The page is inserted as an image, so its original text is not available as editable slide text.' }]
  },
  'pdf-to-pdfa': {
    overview: 'Create a rasterized PDF/A-1b copy intended for archival workflows.', bestFor: 'Preparing a visually consistent copy for a workflow that specifically requests PDF/A-1b.',
    steps: ['Upload the PDF.', 'Select PDF to PDF/A.', 'Review the generated file and validate it with the receiving archive if compliance is critical.'], example: 'Create a PDF/A-1b copy of a finalized, page-based report before submitting it to an archive.',
    limits: 'The current output is rasterized: text may not remain selectable or searchable, and this tool is not a substitute for an external PDF/A validation requirement. Uploads are 25 MB by default.', faqs: [{ question: 'Is the output guaranteed to pass every archive validator?', answer: 'No. Validate the output with the exact standards or institution that will receive it.' }]
  },
  'pdf-to-excel': {
    overview: 'Extract selectable PDF text into an Excel workbook organized for review.', bestFor: 'Moving simple text-based tables or page text into a spreadsheet for further cleanup.',
    steps: ['Upload a PDF with selectable text.', 'Choose PDF to Excel.', 'Open the workbook and check the extracted rows and columns.'], example: 'Extract text from a basic statement table, then correct any column breaks in Excel.',
    limits: 'Scanned pages need OCR first. Complex layouts, merged cells, formulas, and exact table structure are not reconstructed. The default upload limit is 25 MB.', faqs: [{ question: 'Will formulas and formatting be preserved?', answer: 'No. The tool exports extracted text; it does not infer spreadsheet formulas or reproduce the original PDF layout.' }]
  },
  'pdf-to-markdown': {
    overview: 'Export selectable PDF text into a Markdown file with page headings.', bestFor: 'Reusing document text in notes, documentation, or Markdown editors.',
    steps: ['Upload a PDF with selectable text.', 'Choose PDF to Markdown.', 'Download the Markdown file and review its headings and line breaks.'], example: 'Move a text-based guide into a Markdown knowledge base for editing.',
    limits: 'Scanned pages need OCR first. Images, complex layouts, and exact formatting are not preserved. The default upload limit is 25 MB.', faqs: [{ question: 'Can it read text from scanned pages?', answer: 'Run OCR PDF first to add selectable text, then export the result to Markdown.' }]
  },
  'summarize-pdf': {
    overview: 'Create a concise extractive summary from the PDF text.', bestFor: 'Getting a quick overview of a text-based report before reading it in full.',
    steps: ['Upload a PDF with selectable text.', 'Choose Summarize PDF.', 'Review the selected sentences alongside the source document.'], example: 'Pull a short overview from a text-based report before reviewing its details.',
    limits: 'This summary selects representative sentences from the document; it does not interpret meaning like a human reader. Scanned pages need OCR first. The default upload limit is 25 MB.', faqs: [{ question: 'Can it summarize a scanned PDF?', answer: 'Run OCR PDF first so the pages contain selectable text.' }]
  },
  'rotate-pdf': {
    overview: 'Rotate all pages or a selected page range to the orientation you need.', bestFor: 'Correcting sideways or upside-down pages in a scanned or exported document.',
    steps: ["Upload a PDF and select pages in the preview or enter page ranges such as 1-3,5.","Choose 90, 180, or 270 degrees of rotation.","Create the rotated PDF and inspect the result."], example: 'Rotate pages 2-4 by 90 degrees when those pages were scanned in landscape orientation.',
    limits: "Select at least one page to rotate. The available angles are 90, 180, and 270 degrees; enter a range such as 1-8 to rotate every page. Uploads are limited to 25 MB by default.", faqs: [{ question: 'Can I rotate only selected pages?', answer: 'Yes. Enter the page numbers or ranges when the page selection control is available.' }]
  },
  'crop-pdf': {
    overview: 'Trim page edges by setting crop margins for a PDF.', bestFor: 'Reducing excess white margins around scanned pages or exported documents.',
    steps: ["Upload a PDF.","Set left, right, top, and bottom crop margins in points, then optionally enter pages such as 1-3,5. Leave the page field empty to crop every page.","Create the cropped file and check that no needed content was cut off."], example: 'Apply a small left and right margin trim to a scan with a wide blank border.',
    limits: "Each margin accepts 0 to 500 pt. Cropping changes the visible page area and can hide content near the edge; it is not secure redaction. Uploads are 25 MB per file by default.", faqs: [{ question: 'Does cropping erase content outside the crop area?', answer: 'The tool adjusts the page view; do not treat cropping as secure redaction of sensitive content.' }]
  },
  'edit-pdf': {
    overview: 'Add a text label to a selected PDF page with controls for position, size, font, and color.', bestFor: 'Adding a short annotation, correction label, or note to a page.',
    steps: ["Upload the PDF.","Enter up to 500 characters, choose a page, X and Y positions in points, a font size from 6 to 72 pt, one of the available fonts, and a text color.","Create the edited PDF and check the placement."], example: 'Add a short “Draft” label to page 1 of a document before internal review.',
    limits: "This adds a new text layer over the page; it does not edit existing PDF text. Check that the added text does not cover important content. Uploads are 25 MB by default.", faqs: [{ question: 'Can I replace a word that is already in the PDF?', answer: 'No. Use a dedicated PDF editor for changing existing text; this tool adds a new text layer.' }]
  },
  'flatten-pdf': {
    overview: 'Render each PDF page, including visible form fields and annotations, into fixed page content.', bestFor: 'Sharing a final visual copy when form fields or comments should no longer be editable.',
    steps: ['Upload the PDF.', 'Choose Flatten PDF.', 'Download the result and check that each page looks correct.'], example: 'Create a fixed visual copy of a completed form before sharing it with someone who should not edit its fields.',
    limits: 'Pages are saved as images, so text is not selectable or searchable. Links and interactive fields are no longer active. The tool has per-page and total rendering limits for large PDFs.', faqs: [{ question: 'Can I edit form fields after flattening?', answer: 'No. Flattening renders their visible appearance into page content; keep the original if you may need to edit fields later.' }]
  },
  'add-watermark': {
    overview: 'Apply a text or image watermark with controls for appearance and placement.', bestFor: 'Marking a document as a draft, sample, or copy for review.',
    steps: ["Upload the PDF.","Enter optional watermark text and/or add a PNG or JPG image, then adjust its design and appearance.","Check the live page preview and create the watermarked PDF."], example: 'Place a light “DRAFT” watermark diagonally across each page of a review copy.',
    limits: "Text can be up to 120 characters. Text size is 8-144 pt; image size is 10-70%; placement can be center, repeated across the page, or bottom right; rotation is -180 to 180 degrees; opacity is 5-100%. Review the preview so the watermark does not cover needed content. Uploads are 25 MB per file by default.", faqs: [{ question: 'Can I preview the watermark?', answer: 'Yes. When a PDF is loaded, the page preview shows how the watermark settings will look.' }]
  },
  'add-page-numbers': {
    overview: 'Add page numbers to a PDF and choose the starting number and available styling options.', bestFor: 'Numbering a report or handout that was exported without page numbers.',
    steps: ["Upload the PDF and check the live preview.","Set the starting number and PDF page, choose one of four number formats and one of six positions, then adjust font, size, color, margins, and opacity.","Save the numbered PDF and review the result."], example: 'Start at 1 to number a complete report, or start at 5 when adding numbers to a later section.',
    limits: "The starting number must be 1 to 1,000,000. Font size is 6-48 pt, margin is 0-120 pt, and opacity is 5-100%. Check margins and existing content so numbers do not overlap. Uploads are 25 MB by default.", faqs: [{ question: 'Can the displayed number start at a value other than 1?', answer: 'Yes. Set the starting number before processing.' }]
  },
  'add-image-to-pdf': {
    overview: 'Place a PNG or JPG image on a selected PDF page, then adjust and preview its position and appearance.', bestFor: 'Adding a logo, photo, stamp, or other image to a PDF page.',
    steps: ['Upload a PDF and choose a PNG or JPG image to place.', 'Select the page, drag the image into position, and adjust its size, rotation, opacity, and optional frame.', 'Preview the result and create the PDF. You can add and position up to 20 text layers as well.'], example: 'Place a company logo in the lower corner of a report and add a short label beside it.',
    limits: 'Image size is 5-60% of page width, rotation is 0-359.9 degrees, opacity is 0-100%, and frame width is 0-20 pt. Each text layer allows up to 250 characters and a 6-72 pt font size. The image is placed on one selected page at a time; review its position before saving.', faqs: [{ question: 'Can I add an image to more than one page at once?', answer: 'Choose a PDF page for each placement, then review the preview. Each image placement is applied to the selected page.' }, { question: 'Can I add text along with the image?', answer: 'Yes. Add text layers in the placement panel, then select and position each one in the preview.' }]
  },
  'sign-pdf': {
    overview: 'Place an image of a signature on a selected page of a PDF.', bestFor: 'Adding a visual signature image to a document when that is appropriate for your workflow.',
    steps: ["Upload the PDF, then upload a PNG or JPG signature or draw one in the page.","Choose the PDF page and use the preview to position and size the signature. Adjust rotation, opacity, and optional frame settings; you can also add text layers.","Create the PDF and verify the placement before sharing."], example: 'Place a transparent PNG signature near the signature line on the final page.',
    limits: "This places a visual signature image; it does not create a certificate-backed digital signature or verify identity. Signature size is 5-60% of page width, opacity 0-100%, and frame width 0-20 pt. Only use a signature you are authorized to use.", faqs: [{ question: 'Is this a legally verified digital signature?', answer: 'No. It places an image on a page and does not provide identity verification or a digital certificate.' }]
  },
  'redact-pdf': {
    overview: 'Create a redacted copy by obscuring matching words or phrases in a PDF.', bestFor: 'Making a review copy with specified text removed from view.',
    steps: ['Upload the PDF and enter the exact words or phrases to redact.', 'Run the tool and review every page in the output.', 'Confirm that the sensitive material is not visible before sharing.'], example: 'Redact a specific account number from a text-based PDF before sending a review copy.',
    limits: 'The current output is rasterized, so text may no longer be selectable. Search for variants and inspect the full output; this tool cannot identify every sensitive item automatically.', faqs: [{ question: 'Will it find text in a scanned image?', answer: 'The redaction matches selectable PDF text. Run OCR first for scanned pages, then carefully review the result.' }]
  },
  'pdf-forms': {
    overview: 'Inspect PDF form fields and fill supported fields before saving a copy.', bestFor: 'Completing an interactive PDF form that already contains fillable fields.',
    steps: ['Upload a PDF form.', 'Review the fields the tool finds and enter the requested values.', 'Save the filled PDF and check the result in a PDF reader.'], example: 'Fill a form’s name, date, and reference fields before downloading it for review.',
    limits: 'Only detected interactive fields can be filled. Scanned forms without form fields need another workflow, and complex field types may not display identically in every reader.', faqs: [{ question: 'Can I type into a scanned paper form?', answer: 'Not with the form-field workflow unless the PDF contains interactive fields. Use a PDF editor to place text on a scanned page.' }]
  },
  'unlock-pdf': {
    overview: 'Create an accessible copy of an encrypted PDF using its password.', bestFor: 'Removing password protection from a document you own or are authorized to modify, when you know its password.',
    steps: ['Upload the encrypted PDF.', 'Enter the correct password.', 'Create the unlocked copy and confirm it opens as expected.'], example: 'Make an authorized working copy of a PDF whose owner has shared its password with you.',
    limits: 'The tool does not recover or guess unknown passwords. Only remove protection when you have permission to do so. Uploads are 25 MB by default.', faqs: [{ question: 'Can it unlock a file without the password?', answer: 'No. Enter the password required to open the source document.' }]
  },
  'pdf-metadata-cleaner': {
    overview: 'Remove document properties and document-level XMP metadata from a PDF, then save a cleaned copy.', bestFor: 'Removing basic document details such as title, author, subject, keywords, and creation or modification dates before sharing.',
    steps: ['Upload one PDF.', 'Choose PDF Metadata Cleaner.', 'Download the cleaned copy and check it in a PDF reader.'], example: 'Remove the author name and title from a report before sending it outside your organization.',
    limits: 'This removes the PDF Info dictionary, document-level XMP metadata, and the document language tag. It does not redact page content or remove metadata embedded in images, comments, or attachments. Password-protected PDFs must be unlocked first.', faqs: [{ question: 'Does this erase text or images from the pages?', answer: 'No. It removes document properties and document-level XMP metadata; use a redaction tool to remove visible page content.' }, { question: 'Does it remove every kind of metadata inside a PDF?', answer: 'No. Metadata embedded in images, comments, attachments, and other page content can remain.' }]
  },
  'compare-pdf': {
    overview: 'Compare selectable text across two PDFs and report pages with differences.', bestFor: 'Finding text changes between two versions of a document.',
    steps: ['Upload both PDFs.', 'Run the comparison.', 'Review the page-level results and inspect changed pages in a PDF viewer.'], example: 'Compare a revised policy with the previous version to identify pages whose text changed.',
    limits: 'The comparison checks extracted text; it may miss visual changes, image-only changes, and differences in scanned pages without OCR. Uploads are 25 MB per file by default.', faqs: [{ question: 'Does the report show exact character-by-character edits?', answer: 'It reports page-level text differences; use a document comparison tool when you need a detailed change markup.' }]
  },
  'html-to-pdf': {
    overview: 'Convert basic HTML text and formatting into a PDF document.', bestFor: 'Turning a small, simple HTML fragment into a printable page.',
    steps: ["Enter or edit up to 500 KB of basic HTML in the content box.","Convert the HTML and inspect the generated PDF.","Download the PDF and check its text and layout."], example: 'Convert a short heading, paragraph, and simple list into a shareable PDF.',
    limits: "The HTML input is limited to 500 KB. This is for basic text formatting, not a full browser renderer; complex CSS, remote assets, and scripts may not be reproduced.", faqs: [{ question: 'Can I render a complete website with scripts?', answer: 'No. The converter supports basic HTML text formatting and does not run page scripts.' }]
  },
  'word-to-pdf': {
    overview: 'Convert a Word document to PDF using the available conversion service.', bestFor: 'Making a DOC or DOCX document easier to share in a fixed-page format.',
    steps: ["Upload a supported DOC or DOCX file.","Choose Word to PDF. PDF Pro Cut uses its available online conversion service or local converter.","Open the PDF and check page breaks, fonts, and images."], example: 'Convert a finalized DOCX report to PDF before sending it to a recipient.',
    limits: "The default upload limit is 25 MB per file. Conversion availability depends on the online service or local converter. Complex layouts or unavailable fonts can change the result.", faqs: [{ question: 'Why might conversion be unavailable?', answer: "Conversion needs the online service or local converter to be available. If neither is ready, try again later or ask the site administrator." }]
  },
  'powerpoint-to-pdf': {
    overview: 'Convert a PowerPoint presentation to PDF using the available conversion service.', bestFor: 'Sharing slides as a document that opens consistently in PDF readers.',
    steps: ["Upload a supported PPT or PPTX presentation.","Run the conversion using the available online service or local converter.","Review slide order, fonts, and any animations or media that may not carry over."], example: 'Create a PDF handout from a finished presentation for recipients who do not use PowerPoint.',
    limits: "Animations and interactive presentation features are not preserved in a static PDF. The default upload limit is 25 MB per file. Conversion availability depends on the online service or local converter.", faqs: [{ question: 'Will slide animations appear in the PDF?', answer: "Animations and transitions are not included in a static PDF. Conversion availability depends on the online service or local converter." }]
  },
  'excel-to-pdf': {
    overview: 'Convert a spreadsheet to PDF using the available conversion service.', bestFor: 'Sharing a fixed-layout view of a workbook or selected print layout.',
    steps: ["Upload a supported XLS or XLSX file.","Run the conversion using the available online service or local converter.","Review page scaling, sheet selection, and print layout in the resulting PDF."], example: 'Create a PDF copy of a workbook’s report sheet for a read-only review.',
    limits: "Spreadsheet print settings, hidden sheets, formulas, and page scaling affect the output; inspect it before sharing. The default upload limit is 25 MB per file. Conversion availability depends on the online service or local converter.", faqs: [{ question: 'Will every sheet fit on one page?', answer: "Whether sheets fit on a page depends on workbook print settings and layout." }]
  },
  'scan-to-pdf': {
    overview: 'Combine JPG or PNG scans into a PDF in the order you choose.', bestFor: 'Turning phone photos or scanned page images into one document.',
    steps: ["Select JPG or PNG page images and arrange them in reading order.","Choose A4, US Letter, US Legal, or original image size; set orientation, fit or fill, margins from 0 to 72 pt, and page background.","Preview the pages and create the PDF. Check that pages are upright, readable, and not cropped."], example: 'Combine three photographed pages of a signed form into one PDF in page order.',
    limits: "The PDF contains image pages and does not automatically recognize text. Fill may crop image edges; Fit keeps the full image and leaves background space when needed. Accepts up to 20 images, with a default upload limit of 25 MB per image.", faqs: [{ question: 'Can I search text in the output?', answer: 'Open the output in OCR PDF and choose the document languages to add searchable text.' }]
  },
  'convert-to-pdf': {
    overview: 'Arrange JPG or PNG images and create a PDF from them.', bestFor: 'Combining image files into one PDF for sharing or printing.',
    steps: ["Choose JPG or PNG images and arrange them in the order you want.","Set paper size, orientation, image fit, margins from 0 to 72 pt, and page background; review the preview.","Create and download the PDF."], example: 'Put several product photos into a single PDF portfolio in a chosen order.',
    limits: "Accepts JPG or PNG images, up to 20 files per request and 25 MB per file by default. Image-only output is not searchable unless OCR is run afterward. Fill may crop image edges; Fit keeps each full image visible.", faqs: [{ question: 'Can I set the page order?', answer: 'Yes. Arrange the image pages before creating the PDF.' }]
  },
  'text-to-pdf': {
    overview: 'Write and format text in the document editor, preview the page, and export it as PDF.', bestFor: 'Creating a simple letter, note, or text-based handout without uploading an existing document.',
    steps: ["Type or paste text, or import a plain-text file, then format it in the editor.","Choose A4, US Letter, or US Legal, portrait or landscape, font size, line and paragraph spacing, margins, page color, and whether to add page numbers.","Preview the pages and download the PDF."], example: 'Format a short project update with a heading and paragraphs, then export it as a PDF.',
    limits: "The editor supports text formatting, color, and highlighting, but does not recreate advanced desktop-publishing layouts. Font size is 8-36 pt, margins are 18-108 pt, and paragraph spacing is 0-24 pt. Review page breaks in the preview.", faqs: [{ question: 'Can I import a text file?', answer: 'Yes. The editor accepts text you type or a plain-text file.' }]
  },
  'text-to-document': {
    overview: 'Create an editable Word document from text using the document editor’s formatting options.', bestFor: 'Starting a simple editable document from notes or plain text.',
    steps: ["Type or paste text, or import a plain-text or DOCX file, then edit it in the document editor.","Choose A4, US Letter, or US Legal, portrait or landscape, font size, line and paragraph spacing, margins, page color, and whether to add page numbers.","Preview the pages and export the editable DOCX."], example: 'Turn meeting notes into a DOCX draft with a title and readable paragraphs.',
    limits: "The exported document follows the available editor options and does not reproduce every advanced Word layout feature. Font size is 8-36 pt, margins are 18-108 pt, and paragraph spacing is 0-24 pt. Review the DOCX in a compatible editor.", faqs: [{ question: 'Can I edit the downloaded file?', answer: 'Yes. The result is an editable DOCX document.' }]
  },
  'pdf-to-document': {
    overview: 'Convert a PDF into an editable Word document while retaining positioned content and boxes where possible.', bestFor: 'Reusing text from a PDF while keeping more of the original page layout.',
    steps: ['Upload a PDF with selectable text, or run OCR PDF first for a scan.', 'Select Open text in editor to read and edit the text. Choose Convert to Word when the online conversion service is available to retain more of the layout.'], example: 'Extract the text of a short report PDF to revise it in a word processor.',
    limits: 'PDFs can contain up to 100 pages. Convert to Word is available when the online conversion service is ready. Review the layout and text in the exported document.', faqs: [{ question: 'Can I open a scanned PDF in the editor?', answer: 'Run OCR PDF with the document languages selected, then open the recognized text in the editor.' }]
  },
  'protect-pdf': {
    overview: 'Encrypt a PDF with a password before sharing it.', bestFor: 'Adding password protection to a copy of a document for an agreed recipient workflow.',
    steps: ["Upload the PDF.","Choose and confirm a password from 8 to 128 characters.","Create the AES-256 encrypted copy and test it with the password before sharing."], example: 'Protect a PDF copy and share the password with the intended recipient through a separate channel.',
    limits: "Keep the password safe; the recipient needs it to open the output. PDF Pro Cut cannot recover a forgotten password. Password protection does not replace secure sharing or access controls.", faqs: [{ question: 'Can PDF Pro Cut recover a forgotten password?', answer: 'No. Keep a secure record of the password because the tool does not provide password recovery.' }]
  },
  'ocr-pdf': {
    overview: 'Recognize text in scanned PDFs and images and add a searchable text layer.', bestFor: 'Making a scan searchable or opening the recognized text for editing.',
    steps: ['Upload a PDF, JPG, or PNG.', 'Select the languages used in the document and run OCR PDF.', 'Download the searchable PDF or select Open text in editor.'], example: 'Select Malayalam and English for a scan that contains both.',
    limits: 'PDFs can contain up to 30 pages. Recognition can be inaccurate on handwriting, low-resolution scans, or unusual fonts.', faqs: [{ question: 'Does OCR guarantee exact text?', answer: 'Review important names, numbers, and passages against the original scan.' }]
  },
  'compress-files': {
    overview: 'Compress supported PDF and modern Office files while keeping them within a selected maximum size.', bestFor: 'Preparing a document for an upload that has a stated maximum file size.',
    steps: ["Upload one supported PDF or modern Office file.","Choose a maximum from 1 KB to 25 MB, no greater than the upload limit, then choose High clarity first, Balanced, or Smallest size.","Download the result and check its size and legibility."], example: 'If an upload limit is 200 KB, select 200 KB, compress a copy, and confirm the downloaded file is no larger than 200 KB and readable.',
    limits: "Supported inputs include PDF and modern Word, Excel, and PowerPoint formats; legacy Office formats are not supported. The compressor keeps the output within the chosen limit or reports that the file cannot fit at the selected quality. PDF pages may become images so text is no longer selectable. The original stays unchanged.", faqs: [{ question: 'Why did compression fail?', answer: 'The file could not be reduced below the selected maximum at the chosen quality. Choose a larger maximum or a stronger compression setting.' }]
  },
  'compress-image': {
    overview: 'Resize a JPG or PNG to chosen pixel dimensions and keep the file within a selected maximum size.', bestFor: 'Preparing images for a website, message, or upload limit.',
    steps: ["Upload one JPG or PNG image.","Set width and height in pixels. Keep Maintain aspect ratio on to adjust the other dimension automatically, or turn it off to enter both dimensions separately.","Choose a maximum from 1 KB to 25 MB, select High clarity, Balanced, or Smallest size, then download and check the output."], example: 'Resize a product photo to 1200 × 800 pixels, select a 1 MB maximum, and confirm the download stays at or below 1 MB while checking fine details.',
    limits: "Output dimensions must be at least 1 px and are limited to 40 megapixels total. The compressor selects the clearest result that fits the maximum. If the image cannot fit at the chosen quality, it reports that instead of returning a larger file. PNG transparency may be lost when a large PNG is converted to JPEG.", faqs: [{ question: 'Will the output always fit the selected maximum?', answer: 'The tool returns a file only when it fits the maximum. If it cannot do so at the chosen clarity, adjust the maximum, dimensions, or quality setting.' }]
  }
};

export const guideFaqs = [
  { question: 'How large can an upload be?', answer: 'The server defaults to 25 MB per file. The operator can change that setting. Tools that accept multiple files also have a per-request file-count limit.' },
  { question: 'Are uploaded documents stored?', answer: "Most standard tools process source uploads in server memory. Government photo, signature, background, and DPI tools process source images locally in your browser and do not upload them. PDF, Office, and the standard Image Compressor upload the selected file to the PDF Pro Cut server for processing in memory; Office-to-PDF and PDF-to-Word may use a third-party conversion service when available. Office-to-PDF can use an isolated local worker otherwise; its temporary files are removed when the conversion job ends. Completed outputs may be saved in encrypted browser storage on this device for 30 minutes, subject to browser storage availability. These files do not sync to another device; download a copy to keep it." },
  { question: 'Can I use a scanned PDF with every tool?', answer: 'Text extraction tools need selectable text. Run OCR PDF with the document languages selected, then review the recognized text.' },
  { question: 'Will converted files keep the exact original formatting?', answer: 'Not in every conversion. Image-based exports, text extraction, compression, and Office conversion can change layout or remove searchable text. Review important output before relying on it.' }
];
