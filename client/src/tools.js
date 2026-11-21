import { FaObjectGroup,FaCut,FaTrash,FaUndo,FaStamp,FaListOl,FaFileImage,FaFilePdf,FaFileAlt,FaFileWord,FaFileExcel,FaFilePowerpoint,FaCompress,FaLock } from 'react-icons/fa';
import { toolCatalog } from '../../shared/toolCatalog.mjs';

export function getToolCategoryClass(category) {
  return `tool-category-${category.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
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
  'compress-files': FaCompress, 'compress-image': FaFileImage
};

export const tools = toolCatalog.map((tool) => ({ ...tool, icon: iconBySlug[tool.slug] }));
