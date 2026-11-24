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
    note: 'Kerala PSC specifies 150 × 200 px, JPG, up to 30 KB, a light background, and the applicant name/date at the bottom.',
    sourceLabel: 'Kerala PSC photo instructions',
    sourceUrl: 'https://www.keralapsc.gov.in/sites/default/files/inline-files/general%20condition.pdf',
    nameDateInsideFrame: true
  },
  keralaPscSignature: {
    width: 150, height: 100, maxKb: 30, defaultTargetKb: 30, format: 'jpeg',
    label: 'Kerala PSC OTR signature', aspectLabel: '3:2', fitMode: 'contain',
    note: 'Kerala PSC specifies 150 × 100 px JPG up to 30 KB. Keep the complete signature clear in the frame.',
    sourceLabel: 'Kerala PSC signature instructions',
    sourceUrl: 'https://www.keralapsc.gov.in/sites/default/files/inline-files/general%20condition.pdf'
  },
  sscLivePhoto: {
    format: 'jpeg',
    label: 'SSC live photo',
    note: 'Current SSC notices use a live photo capture flow and do not specify one universal pixel size. Use the SSC portal camera flow and follow that exam notice.',
    sourceLabel: 'SSC examination notice',
    sourceUrl: 'https://ssc.gov.in/api/attachment/uploads/masterData/NoticeBoards/notice_01122025.pdf'
  },
  sscSignature: {
    width: 709, height: 236, maxKb: 20, minKb: 10, defaultTargetKb: 20, format: 'jpeg', dpi: 300,
    label: 'SSC signature', aspectLabel: '6 × 2 cm at 300 DPI', fitMode: 'contain',
    note: 'SSC specifies a JPEG signature of about 6 × 2 cm at 300 DPI and 10–20 KB. Pixel dimensions here are the 300 DPI conversion.',
    sourceLabel: 'SSC examination notice',
    sourceUrl: 'https://ssc.gov.in/api/attachment/uploads/masterData/NoticeBoards/notice_01122025.pdf'
  },
  upscUpload: {
    maxKb: 300, minKb: 20, defaultTargetKb: 300, format: 'jpeg',
    label: 'UPSC current application image',
    note: 'The current UPSC notice specifies JPG files from 20 KB to 300 KB but does not give one universal pixel size. This preset keeps the source dimensions and targets 300 KB maximum.',
    sourceLabel: 'UPSC Engineering Services Examination 2027 notice',
    sourceUrl: 'https://www.upsc.gov.in/uploads/2026/09/Notif-ESEP-2027-Engl-160926.pdf'
  },
  rrbPhoto: {
    minKb: 50, maxKb: 100, defaultTargetKb: 100, format: 'jpeg',
    label: 'RRB CEN 08/2024 profile photo',
    note: 'RRB CEN 08/2024 FAQ specifies JPEG, 50–100 KB; it says the portal shows the required dimensions. This preset keeps source dimensions.',
    sourceLabel: 'RRB CEN 08/2024 FAQ',
    sourceUrl: 'https://www.rrbcdg.gov.in/uploads/2024/08-LVL1/2024-08%20FAQs.pdf'
  },
  rrbSignature: {
    width: 140, height: 60, minWidth: 140, minHeight: 60, minKb: 30, maxKb: 49, defaultTargetKb: 49,
    format: 'jpeg', dpi: 100, fitMode: 'contain',
    label: 'RRB signature', aspectLabel: 'minimum 140 × 60 px',
    note: 'RRB CEN 02/2025 requires JPEG, at least 140 × 60 px, 100 DPI minimum, and 30–49 KB. Exact requirements can differ by CEN.',
    sourceLabel: 'RRB CEN 02/2025',
    sourceUrl: 'https://www.rrbcdg.gov.in/uploads/2025/02-TECH/022025-CEN_updated.pdf'
  },
  passportIcao: {
    width: 630, height: 810, format: 'jpeg', whiteBackground: true, fitMode: 'cover',
    label: 'Passport Seva ICAO photo', aspectLabel: '7:9',
    note: 'Passport Seva gives 630 × 810 px, white background, and an 80–85% face area. Its guide also says photos should be unaltered by software; resizing here may conflict with that instruction.',
    sourceLabel: 'Passport Seva ICAO photo guide',
    sourceUrl: 'https://mportal.passportindia.gov.in/pdf/Guidelines_for_ICAO_Compliant_Photographs_for_Passport_Applications.pdf'
  },
  aadhaarPhoto: {
    format: 'jpeg',
    label: 'Aadhaar biometric photo',
    note: 'UIDAI photo updates are biometric updates completed at an Aadhaar enrolment centre. UIDAI does not publish a self-upload photo size for this service.',
    sourceLabel: 'UIDAI Aadhaar Seva Kendra',
    sourceUrl: 'https://www.uidai.gov.in/en/aadhaar-seva-kendra'
  },
  panPhoto: {
    width: 413, height: 295, format: 'jpeg', dpi: 300, fitMode: 'cover',
    label: 'PAN paper form photo', aspectLabel: '3.5 × 2.5 cm at 300 DPI',
    note: 'Protean lists a 3.5 × 2.5 cm photo for paper PAN applications. This 300 DPI conversion is 413 × 295 px; online upload requirements may differ.',
    sourceLabel: 'Protean PAN application instructions',
    sourceUrl: 'https://dev.protean-tinpan.com/services/pan/cr-do-donts.html'
  },
  genericPhoto: PHOTO_35_BY_45,
  genericSignature: {
    width: 709, height: 236, format: 'jpeg', dpi: 300,
    label: '6 × 2 cm signature at 300 DPI', aspectLabel: '3:1',
    note: 'A 6 × 2 cm print-size conversion at 300 DPI (709 × 236 px). Treat this as a starting size and use your application notice for the required dimensions.',
    sourceLabel: 'SSC signature example',
    sourceUrl: 'https://ssc.gov.in/api/attachment/uploads/masterData/NoticeBoards/notice_01122025.pdf'
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
  'rrb-photo-resizer': 'rrbPhoto',
  'rrb-signature-resizer': 'rrbSignature',
  'aadhaar-photo-resizer': 'aadhaarPhoto',
  'pan-card-photo-resizer': 'panPhoto',
  'passport-size-photo-maker': 'passportIcao',
  'government-id-photo-maker': 'genericPhoto',
  'police-recruitment-photo-maker': 'genericPhoto',
  'army-recruitment-photo-maker': 'genericPhoto',
  'india-post-photo-resizer': 'genericPhoto',
  'navy-recruitment-photo-maker': 'genericPhoto',
  'air-force-photo-resizer': 'genericPhoto',
  'government-application-signature-maker': 'genericSignature'
};
