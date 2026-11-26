const PHOTO_35_BY_45 = Object.freeze({
  width: 413,
  height: 531,
  label: '35 × 45 mm portrait at 300 DPI',
  note: 'This is a 35 × 45 mm print-size conversion at 300 DPI (413 × 531 px). Use the exact dimensions and limits in your application notice.',
  format: 'jpeg',
  dpi: 300,
  fitMode: 'cover'
});

export const socialProfilePresets = [
  {
    id: 'instagram', label: 'Instagram', width: 320, height: 320, shape: 'Circle crop',
    guidance: 'Square working size; Instagram does not publish a required profile-photo pixel size.',
    sourceUrl: 'https://help.instagram.com/557544397610546'
  },
  {
    id: 'facebook', label: 'Facebook', width: 320, height: 320, shape: 'Circle crop',
    guidance: 'Square working size; Facebook may crop profile photos to a circle.',
    sourceUrl: 'https://www.facebook.com/help/125379114252045'
  },
  {
    id: 'whatsapp', label: 'WhatsApp', width: 640, height: 640, shape: 'Circle crop',
    guidance: 'WhatsApp recommends at least 192 × 192 px; this preset exports a 640 × 640 px square.',
    sourceUrl: 'https://faq.whatsapp.com/453914586839706/'
  },
  {
    id: 'x', label: 'X', width: 400, height: 400, shape: 'Circle crop', maxKb: 2048,
    guidance: 'X recommends 400 × 400 px and allows profile photos up to 2 MB.',
    sourceUrl: 'https://help.x.com/en/managing-your-account/common-issues-when-uploading-profile-photo'
  },
  {
    id: 'linkedin', label: 'LinkedIn', width: 400, height: 400, shape: 'Circle crop', maxKb: 8192,
    guidance: 'LinkedIn accepts profile photos from 400 × 400 px; JPG and PNG are supported, up to 8 MB.',
    sourceUrl: 'https://www.linkedin.com/help/linkedin/answer/a549049/photo-won-t-upload?lang=en'
  },
  {
    id: 'tiktok', label: 'TikTok', width: 320, height: 320, shape: 'Circle crop',
    guidance: 'Square working size; TikTok does not publish a required profile-photo pixel size.',
  },
  {
    id: 'youtube', label: 'YouTube', width: 800, height: 800, shape: 'Circle crop', maxKb: 15360,
    guidance: 'YouTube profile images render at 98 × 98 px and may be up to 15 MB; this preset exports an 800 × 800 px square.',
    sourceUrl: 'https://support.google.com/youtube/answer/10456525'
  },
  {
    id: 'telegram', label: 'Telegram', width: 640, height: 640, shape: 'Circle crop',
    guidance: 'Square working size; Telegram may crop profile photos to a circle.',
  }
];

export const socialPostPresets = [
  {
    id: 'square', label: 'Square feed image', width: 1080, height: 1080, shape: 'Square', aspectLabel: '1:1 aspect ratio',
    guidance: 'A common square canvas for feed posts. Platform upload limits can vary; edit the output dimensions to match your destination.'
  },
  {
    id: 'portrait', label: 'Portrait feed image', width: 1080, height: 1350, shape: 'Portrait', aspectLabel: '4:5 aspect ratio',
    guidance: 'A common portrait canvas for feed posts. Platform upload limits can vary; edit the output dimensions to match your destination.'
  },
  {
    id: 'landscape', label: 'LinkedIn link image', width: 1200, height: 627, shape: 'Landscape', aspectLabel: '1.91:1 aspect ratio',
    guidance: 'LinkedIn recommends a 1.91:1 image with a minimum size of 1200 x 627 px for link previews.',
    sourceLabel: 'LinkedIn image specifications',
    sourceUrl: 'https://www.linkedin.com/help/linkedin/answer/a521928/image-specifications-for-your-linkedin-pages-and-career-page'
  }
];

export const socialStoryPresets = [
  {
    id: 'instagram', label: 'Instagram Story / Reel', width: 1080, height: 1920, shape: 'Vertical', aspectLabel: '9:16 aspect ratio',
    guidance: 'A 9:16 working canvas for full-screen vertical content. Check the current upload rules for your platform before posting.'
  },
  {
    id: 'facebook', label: 'Facebook Story', width: 1080, height: 1920, shape: 'Vertical', aspectLabel: '9:16 aspect ratio',
    guidance: 'A 9:16 working canvas for full-screen vertical content. Check the current upload rules for your platform before posting.'
  },
  {
    id: 'tiktok', label: 'TikTok vertical image', width: 1080, height: 1920, shape: 'Vertical', aspectLabel: '9:16 aspect ratio',
    guidance: 'A 9:16 working canvas for full-screen vertical content. Check the current upload rules for your platform before posting.'
  },
  {
    id: 'youtube-shorts', label: 'YouTube Shorts thumbnail', width: 1080, height: 1920, shape: 'Vertical', aspectLabel: '9:16 aspect ratio',
    guidance: 'YouTube recommends a 9:16 aspect ratio for Shorts thumbnails. Increase the dimensions if you need a higher-resolution source.',
    sourceLabel: 'YouTube thumbnail guidance',
    sourceUrl: 'https://support.google.com/youtube/answer/72431?hl=en'
  },
  {
    id: 'whatsapp', label: 'WhatsApp Status', width: 1080, height: 1920, shape: 'Vertical', aspectLabel: '9:16 aspect ratio',
    guidance: 'A 9:16 working canvas for full-screen vertical content. Check the current upload rules for your platform before posting.'
  }
];

export const governmentImagePresets = {
  keralaPscPhoto: {
    width: 150, height: 200, maxKb: 30, defaultTargetKb: 30, format: 'jpeg',
    label: 'Kerala PSC OTR photo', aspectLabel: '3:4', fitMode: 'cover',
    note: 'Kerala PSC OTR specifies 150 × 200 px, JPG, up to 30 KB, a white or light background, and the applicant name and photo date printed at the bottom. The name/date are required.',
    sourceLabel: 'Kerala PSC photo instructions',
    sourceUrl: 'https://www.keralapsc.gov.in/sites/default/files/inline-files/general_condition_revised.pdf',
    nameDateInsideFrame: true
  },
  keralaPscSignature: {
    width: 150, height: 100, maxKb: 30, defaultTargetKb: 30, format: 'jpeg',
    label: 'Kerala PSC OTR signature', aspectLabel: '3:2', fitMode: 'contain',
    note: 'Kerala PSC OTR specifies 150 × 100 px JPG up to 30 KB. Keep the complete signature clear in the frame. The instructions allow a thumb impression instead of a signature for blind candidates.',
    sourceLabel: 'Kerala PSC signature instructions',
    sourceUrl: 'https://www.keralapsc.gov.in/sites/default/files/inline-files/general_condition_revised.pdf'
  },
  sscLivePhoto: {
    format: 'jpeg',
    label: 'SSC live photo',
    note: 'SSC Stenographer 2026 requires a fresh live photo captured in the application module and publishes no universal pixel size. Do not capture an existing print or submit a processed download. The notice has an Aadhaar-based authentication exception; follow the instructions shown for your application route.',
    sourceLabel: 'SSC Stenographer 2026 notice',
    sourceUrl: 'https://ssc.gov.in/api/attachment/uploads/masterData/NoticeBoards/Notice_of_adv_steno_2026.pdf'
  },
  sscSignature: {
    width: 709, height: 236, maxKb: 20, minKb: 10, defaultTargetKb: 20, format: 'jpeg', dpi: 300,
    label: 'SSC signature', aspectLabel: '6 × 2 cm print size', fitMode: 'contain',
    note: 'SSC Stenographer 2026 specifies a horizontal JPG signature of about 6 × 2 cm and 10–20 KB. The 709 × 236 px canvas is a 300 DPI print-size conversion; the notice does not prescribe fixed pixel dimensions.',
    sourceLabel: 'SSC Stenographer 2026 notice',
    sourceUrl: 'https://ssc.gov.in/api/attachment/uploads/masterData/Notice_of_adv_steno_2026.pdf'
  },
  upscUpload: {
    maxKb: 300, minKb: 20, defaultTargetKb: 300, format: 'jpeg',
    label: 'UPSC ESE 2027 photo or signature',
    note: 'The UPSC Engineering Services Examination 2027 notice requires each JPG photo and signature to be 20–300 KB. It gives no universal pixel dimensions; this preset keeps the source dimensions and targets 300 KB maximum.',
    sourceLabel: 'UPSC Engineering Services Examination 2027 notice',
    sourceUrl: 'https://www.upsc.gov.in/uploads/2026/09/Notif-ESEP-2027-Engl-160926.pdf'
  },
  rrbSignature: {
    width: 140, height: 60, minWidth: 140, minHeight: 60, minKb: 30, maxKb: 49, defaultTargetKb: 49,
    format: 'jpeg', dpi: 100, fitMode: 'contain',
    label: 'RRB signature', aspectLabel: 'minimum 140 × 60 px',
    note: 'RRB CEN 09/2025 requires a JPG/JPEG signature, at least 140 × 60 px and 100 DPI, between 30 and 49 KB. Use black ink on white paper and running handwriting. Other CEN notices can differ.',
    sourceLabel: 'RRB CEN 09/2025 notice',
    sourceUrl: 'https://www.rrbcdg.gov.in/uploads/2025/09-LVL1/092025-CEN.pdf'
  },
  passportPrint: {
    width: 413, height: 531, format: 'jpeg', dpi: 300, fitMode: 'cover',
    label: 'India passport photo print size', aspectLabel: '3.5 × 4.5 cm at 300 DPI',
    note: 'For Indian Passport Seva, a photo is generally captured at the PSK/POPSK; children below 4 and some collection-centre applications may need a 4.5 × 3.5 cm print. Overseas Passport Seva uses 630 × 810 px ICAO guidance and says the photo must be unaltered by software. This tool resizes/crops images, so its output is a sizing aid and is not certified for passport submission.',
    sourceLabel: 'Passport Seva photo instructions',
    sourceUrl: 'https://passportindia.gov.in/pdf/ApplicationformInstructionBooklet-V3.0.pdf',
    sources: [
      { label: 'Passport Seva application instructions', url: 'https://passportindia.gov.in/pdf/ApplicationformInstructionBooklet-V3.0.pdf' },
      { label: 'Passport Seva ICAO photo guide', url: 'https://mportal.passportindia.gov.in/pdf/Guidelines_for_ICAO_Compliant_Photographs_for_Passport_Applications.pdf' }
    ]
  },
  aadhaarPhoto: {
    format: 'jpeg',
    label: 'Aadhaar biometric photo',
    note: 'UIDAI photo changes are biometric updates captured at an Aadhaar Enrolment Centre or Aadhaar Seva Kendra. UIDAI does not publish a resident self-upload photo size. This local image tool cannot prepare an Aadhaar photo update for online submission.',
    sourceLabel: 'UIDAI Aadhaar Seva Kendra',
    sourceUrl: 'https://www.uidai.gov.in/en/aadhaar-seva-kendra'
  },
  panPhoto: {
    width: 413, height: 531, format: 'jpeg', dpi: 300, fitMode: 'cover',
    label: 'PAN Form 93 photo', aspectLabel: '3.5 × 4.5 cm at 300 DPI',
    note: 'Protean Form 93 instructions require two recent colour photographs with a white background, 4.5 × 3.5 cm (portrait), for individual applications submitted with physical documents. This 300 DPI conversion is 413 × 531 px. Paperless e-KYC/e-Sign routes may not require physical documents.',
    sourceLabel: 'Protean Form 93 instructions',
    sourceUrl: 'https://tinpan.proteantech.in/downloads/pan/download/Form%2093.pdf',
    sources: [
      { label: 'Protean Form 93 photo instructions', url: 'https://tinpan.proteantech.in/downloads/pan/download/Form%2093.pdf' },
      { label: 'Income Tax Department notified 2026 rules', url: 'https://www.incometax.gov.in/iec/foportal/sites/default/files/2026-03/En-Notified-IT-Rules-2026-20-03-2026.pdf' },
      { label: 'Protean PAN application service', url: 'https://tinpan.proteantech.in/services/pan/pan-index' }
    ]
  },
  genericPhoto: PHOTO_35_BY_45,
  noticeSpecificImage: {
    format: 'jpeg',
    label: 'Dimensions from your current notice',
    note: 'There is no single photo, signature, or document size for every agency or recruitment. The tool keeps the source dimensions until you enter the exact values from the current official notice.'
  },
  genericSignature: {
    width: 709, height: 236, format: 'jpeg', dpi: 300,
    label: '6 × 2 cm signature at 300 DPI', aspectLabel: '3:1',
    note: 'A 6 × 2 cm print-size conversion at 300 DPI (709 × 236 px). Treat it as a starting size only; use the dimensions, file format, and size limit in your current application notice.'
  }
};
export const governmentPresetByTool = {
  'kerala-psc-photo-resizer': 'keralaPscPhoto',
  'psc-photo-kb-compressor': 'keralaPscPhoto',
  'psc-photo-background-changer': 'keralaPscPhoto',
  'kerala-psc-signature-resizer': 'keralaPscSignature',
  'psc-signature-kb-compressor': 'keralaPscSignature',
  'psc-thumb-impression-resizer': 'keralaPscSignature',
  'psc-photo-signature-maker': 'keralaPscPhoto',
  'ssc-live-photo-editor': 'sscLivePhoto',
  'ssc-photo-resizer': 'sscLivePhoto',
  'ssc-photo-compressor': 'sscLivePhoto',
  'ssc-signature-resizer': 'sscSignature',
  'ssc-signature-compressor': 'sscSignature',
  'upsc-photo-resizer': 'upscUpload',
  'upsc-signature-resizer': 'upscUpload',
  'upsc-photo-compressor': 'upscUpload',
  'rrb-photo-resizer': 'noticeSpecificImage',
  'rrb-signature-resizer': 'rrbSignature',
  'rrb-thumb-impression-resizer': 'noticeSpecificImage',
  'aadhaar-photo-resizer': 'aadhaarPhoto',
  'pan-card-photo-resizer': 'panPhoto',
  'passport-size-photo-maker': 'passportPrint',
  'government-id-photo-maker': 'noticeSpecificImage',
  'police-recruitment-photo-maker': 'noticeSpecificImage',
  'army-recruitment-photo-maker': 'noticeSpecificImage',
  'india-post-photo-resizer': 'noticeSpecificImage',
  'navy-recruitment-photo-maker': 'noticeSpecificImage',
  'air-force-photo-resizer': 'noticeSpecificImage',
  'certificate-photo-resizer': 'noticeSpecificImage',
  'government-application-signature-maker': 'noticeSpecificImage'
};

export const governmentToolGuidanceByTool = {
  'rrb-photo-resizer': {
    note: 'RRB CEN 09/2025 requires a live photo captured in the application module and explicitly prohibits uploading a pre-existing photograph. It publishes no universal photo pixel dimensions or file-size limit. Use the RRB portal camera to submit; this tool is only for checking or preparing images when a different CEN allows uploads.',
    sources: [{ label: 'RRB CEN 09/2025 photo instructions', url: 'https://www.rrbcdg.gov.in/uploads/2025/09-LVL1/092025-CEN.pdf' }]
  },
  'rrb-thumb-impression-resizer': {
    note: 'RRB CEN 09/2025 lists a live photo, signature, and a conditional SC/ST travel-pass certificate; it does not list a thumb-impression upload. Use this tool only if the specific CEN or application portal asks for one, and enter that notice’s dimensions.',
    sources: [{ label: 'RRB CEN 09/2025 upload instructions', url: 'https://www.rrbcdg.gov.in/uploads/2025/09-LVL1/092025-CEN.pdf' }]
  },
  'rrb-document-compressor': {
    note: 'RRB CEN 09/2025 requires a legible PDF under 400 KB for the SC/ST certificate used to request a free travel pass. Other documents or CENs may have different rules; use this target only for that certificate requirement.',
    sources: [{ label: 'RRB CEN 09/2025 certificate instructions', url: 'https://www.rrbcdg.gov.in/uploads/2025/09-LVL1/092025-CEN.pdf' }]
  },
  'aadhaar-pdf-compressor': {
    note: 'UIDAI upload rules depend on the specific document-update service and supporting document. This tool can reduce a PDF, but it does not set or certify a universal Aadhaar upload limit. Aadhaar photo updates must be captured at an enrolment centre.',
    sources: [{ label: 'UIDAI Aadhaar update process', url: 'https://uidai.gov.in/en/updating-data-on-aadhaar' }]
  },
  'pan-document-compressor': {
    note: 'PAN document upload limits depend on the application form and channel. Indian citizen applications for new PANs use Form 93 from 1 April 2026; check the current form instructions before choosing a target size.',
    sources: [{ label: 'Protean PAN application service', url: 'https://tinpan.proteantech.in/services/pan/pan-index' }]
  },
  'police-recruitment-photo-maker': {
    note: 'Police recruitment photo requirements vary by state, post, and recruitment notice. This tool starts with the source image dimensions; enter the exact pixel size, format, and file-size limit from the current official notice. For Kerala posts, use the Kerala PSC notice; other states publish separate instructions.',
    sources: [{ label: 'Kerala PSC recruitment notices (Kerala posts)', url: 'https://www.keralapsc.gov.in/' }]
  },
  'army-recruitment-photo-maker': {
    note: 'Army recruitment photo requirements vary by entry and recruitment notice. This tool starts with the source image dimensions; use the current Join Indian Army notice for the required framing, format, and upload rules.',
    sources: [{ label: 'Join Indian Army recruitment portal', url: 'https://joinindianarmy.nic.in/' }]
  },
  'india-post-photo-resizer': {
    note: 'India Post photo requirements vary by recruitment and application notice. This tool starts with the source image dimensions; enter the values shown in the current official notification.',
    sources: [{ label: 'India Post official website', url: 'https://www.indiapost.gov.in/' }]
  },
  'navy-recruitment-photo-maker': {
    note: 'Indian Navy photo requirements vary by entry and recruitment notice. This tool starts with the source image dimensions; use the current Navy application portal for the required framing, format, and upload rules.',
    sources: [{ label: 'Join Indian Navy official portal', url: 'https://www.joinindiannavy.gov.in/' }]
  },
  'air-force-photo-resizer': {
    note: 'Indian Air Force photo requirements vary by entry and recruitment notice. This tool starts with the source image dimensions; use the current application notice for the required framing, format, and upload rules.',
    sources: [{ label: 'Agniveervayu official portal', url: 'https://agnipathvayu.cdac.in/AV/' }]
  },
  'government-application-signature-maker': {
    note: 'Government application signature requirements are not universal. Enter the current notice’s dimensions, format, file-size range, DPI, ink, background, and signature style before downloading.'
  },
  'government-id-photo-maker': {
    note: 'Government ID photo requirements vary by issuing authority and application. This tool starts with the source image dimensions; use the current official form for the required size and background.'
  },
  'certificate-photo-resizer': {
    note: 'Certificate scan requirements vary by issuing authority and application. This tool starts with the source dimensions; enter the current form’s image dimensions and verify that all text remains legible.'
  },
  'aadhaar-photo-resizer': {
    note: 'UIDAI photo changes are captured as biometric updates at an Aadhaar Enrolment Centre or Aadhaar Seva Kendra. There is no resident self-upload photo size for this service; this local image tool cannot prepare an online Aadhaar photo update.',
    sources: [{ label: 'UIDAI Aadhaar Seva Kendra', url: 'https://www.uidai.gov.in/en/aadhaar-seva-kendra' }]
  },
  'passport-size-photo-maker': {
    note: 'Indian Passport Seva generally captures photos at the PSK/POPSK; children below 4 and some collection-centre applications may need a 4.5 × 3.5 cm print. Overseas Passport Seva uses 630 × 810 px ICAO guidance and says photos must be unaltered by software. This tool resizes/crops images, so its output is only a sizing aid and is not certified for passport submission.',
    sources: [
      { label: 'Passport Seva application instructions', url: 'https://passportindia.gov.in/pdf/ApplicationformInstructionBooklet-V3.0.pdf' },
      { label: 'Passport Seva ICAO photo guide', url: 'https://mportal.passportindia.gov.in/pdf/Guidelines_for_ICAO_Compliant_Photographs_for_Passport_Applications.pdf' }
    ]
  },
  'pan-card-photo-resizer': {
    note: 'Protean Form 93 calls for two recent colour photographs with a white background, 4.5 × 3.5 cm (portrait), for individual applications submitted with physical documents. This 300 DPI 413 × 531 px preset is for that photo print; paperless e-KYC/e-Sign routes may not require physical documents.',
    sources: [
      { label: 'Protean Form 93 photo instructions', url: 'https://tinpan.proteantech.in/downloads/pan/download/Form%2093.pdf' },
      { label: 'Income Tax Department notified 2026 rules', url: 'https://www.incometax.gov.in/iec/foportal/sites/default/files/2026-03/En-Notified-IT-Rules-2026-20-03-2026.pdf' },
      { label: 'Protean PAN application service', url: 'https://tinpan.proteantech.in/services/pan/pan-index' }
    ]
  },
  'pan-document-compressor': {
    note: 'PAN document upload limits depend on the current application form and channel. Use the file-size limit printed in your Form 93/94 or PAN correction instructions; there is no single limit for every PAN document.',
    sources: [{ label: 'Protean current PAN application information', url: 'https://tinpan.proteantech.in/' }]
  },
  'document-kb-compressor': {
    note: 'Government document upload limits vary by authority, form, and recruitment notice. Enter the maximum from the current official instructions and check that the compressed file remains readable.'
  },
  'document-dpi-changer': {
    note: 'DPI requirements are set by the receiving application. Changing DPI metadata does not change pixel dimensions or add detail; use the current official form to confirm both.'
  },
  'signature-background-remover': {
    note: 'Use a transparent signature PNG only when the receiving application accepts PNG and transparency. Many government forms require a JPG with a plain white background; follow the current official notice.'
  }
};
