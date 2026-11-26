import { FaObjectGroup,FaCut,FaTrash,FaUndo,FaStamp,FaListOl,FaFileImage,FaFilePdf,FaFileAlt,FaFileWord,FaFileExcel,FaFilePowerpoint,FaCompress,FaLock,FaUserCircle,FaCamera,FaIdCard,FaImages,FaVideo } from 'react-icons/fa';
import { toolCatalog } from '../../shared/toolCatalog.mjs';

export function getToolCategoryClass(category) {
  return `tool-category-${category.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
}

const toolCategoryLabels = {
  'Other Government Recruitment Tools': 'Other Recruitment Tools',
  'Common Government Document Tools': 'Common Document Tools'
};

export function getToolCategoryLabel(category) {
  return toolCategoryLabels[category] || category;
}

const iconBySlug = {
  'merge-pdf': FaObjectGroup, 'organize-pdf': FaObjectGroup, 'split-pdf': FaCut,
  'remove-pages': FaTrash, 'extract-pages': FaCut, 'repair-pdf': FaFilePdf,
  'pdf-to-jpg': FaFileImage, 'pdf-to-png': FaFileImage, 'extract-images-pdf': FaFileImage, 'pdf-to-powerpoint': FaFilePowerpoint, 'pdf-to-pdfa': FaFilePdf,
  'pdf-to-excel': FaFileAlt, 'pdf-to-markdown': FaFileAlt, 'summarize-pdf': FaListOl,
  'rotate-pdf': FaUndo, 'crop-pdf': FaFileImage, 'edit-pdf': FaFileAlt, 'flatten-pdf': FaFilePdf,
  'add-watermark': FaStamp, 'add-image-to-pdf': FaFileImage, 'add-page-numbers': FaListOl,
  'sign-pdf': FaStamp, 'redact-pdf': FaLock, 'pdf-forms': FaFileAlt, 'unlock-pdf': FaLock,
  'compare-pdf': FaObjectGroup, 'pdf-metadata-cleaner': FaFilePdf, 'html-to-pdf': FaFileAlt, 'word-to-pdf': FaFileWord,
  'powerpoint-to-pdf': FaFilePowerpoint, 'excel-to-pdf': FaFileExcel, 'scan-to-pdf': FaFileImage,
  'convert-to-pdf': FaFileImage, 'text-to-pdf': FaFileAlt, 'text-to-document': FaFileAlt,
  'pdf-to-document': FaFileWord, 'protect-pdf': FaLock, 'ocr-pdf': FaFilePdf,
  'compress-files': FaCompress, 'compress-image': FaFileImage,
  'social-media-profile-resizer': FaUserCircle,
  'social-media-post-resizer': FaImages,
  'social-media-story-resizer': FaVideo,
  'kerala-psc-photo-resizer': FaCamera,
  'kerala-psc-signature-resizer': FaStamp,
  'psc-photo-kb-compressor': FaCompress,
  'psc-signature-kb-compressor': FaCompress,
  'psc-photo-background-changer': FaFileImage,
  'psc-photo-signature-maker': FaImages,
  'psc-thumb-impression-resizer': FaIdCard,
  'ssc-photo-resizer': FaCamera,
  'ssc-signature-resizer': FaStamp,
  'ssc-photo-compressor': FaCompress,
  'ssc-signature-compressor': FaCompress,
  'upsc-photo-resizer': FaCamera,
  'upsc-signature-resizer': FaStamp,
  'upsc-document-resizer': FaIdCard,
  'upsc-photo-compressor': FaCompress,
  'rrb-photo-resizer': FaCamera,
  'rrb-signature-resizer': FaStamp,
  'rrb-thumb-impression-resizer': FaIdCard,
  'aadhaar-photo-resizer': FaIdCard,
  'pan-card-photo-resizer': FaIdCard,
  'government-application-signature-maker': FaStamp,
  'government-id-photo-maker': FaIdCard,
  'passport-size-photo-maker': FaCamera,
  'certificate-photo-resizer': FaFileImage,
  'police-recruitment-photo-maker': FaCamera,
  'army-recruitment-photo-maker': FaCamera,
  'india-post-photo-resizer': FaCamera,
  'navy-recruitment-photo-maker': FaCamera,
  'air-force-photo-resizer': FaCamera
};

export const tools = toolCatalog.map((tool) => ({
  ...tool,
  section: tool.section || (tool.category === 'Social Media' ? 'Social Media' : tool.gov ? 'Public Service' : 'Documents'),
  icon: iconBySlug[tool.slug] || (tool.gov?.kind === 'pdf-compress' ? FaCompress : FaFileImage)
}));
