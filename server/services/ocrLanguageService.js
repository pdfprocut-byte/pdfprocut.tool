import { randomUUID } from 'node:crypto';
import { access, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { gunzip } from 'node:zlib';
import { createWorker, OEM } from 'tesseract.js';
import { ApiError } from '../utils/ApiError.js';

// Language models from tesseract-ocr/tessdata_fast 4.1.0.
const languageNames = {
  afr: 'Afrikaans',
  amh: 'Amharic',
  ara: 'Arabic',
  asm: 'Assamese',
  aze: 'Azerbaijani',
  aze_cyrl: 'Azerbaijani (Cyrillic)',
  bel: 'Belarusian',
  ben: 'Bengali',
  bod: 'Tibetan',
  bos: 'Bosnian',
  bre: 'Breton',
  bul: 'Bulgarian',
  cat: 'Catalan',
  ceb: 'Cebuano',
  ces: 'Czech',
  chi_sim: 'Chinese (Simplified)',
  chi_sim_vert: 'Chinese (Simplified, vertical)',
  chi_tra: 'Chinese (Traditional)',
  chi_tra_vert: 'Chinese (Traditional, vertical)',
  chr: 'Cherokee',
  cos: 'Corsican',
  cym: 'Welsh',
  dan: 'Danish',
  deu: 'German',
  div: 'Dhivehi',
  dzo: 'Dzongkha',
  ell: 'Greek',
  eng: 'English',
  enm: 'English (Middle English)',
  epo: 'Esperanto',
  est: 'Estonian',
  eus: 'Basque',
  fao: 'Faroese',
  fas: 'Persian',
  fil: 'Filipino',
  fin: 'Finnish',
  fra: 'French',
  frk: 'German (Fraktur)',
  frm: 'French (Middle French)',
  fry: 'Western Frisian',
  gla: 'Scottish Gaelic',
  gle: 'Irish',
  glg: 'Galician',
  grc: 'Greek (Ancient)',
  guj: 'Gujarati',
  hat: 'Haitian Creole',
  heb: 'Hebrew',
  hin: 'Hindi',
  hrv: 'Croatian',
  hun: 'Hungarian',
  hye: 'Armenian',
  iku: 'Inuktitut',
  ind: 'Indonesian',
  isl: 'Icelandic',
  ita: 'Italian',
  ita_old: 'Italian (Old Italian)',
  jav: 'Javanese',
  jpn: 'Japanese',
  jpn_vert: 'Japanese (Vertical)',
  kan: 'Kannada',
  kat: 'Georgian',
  kat_old: 'Georgian (Old Georgian)',
  kaz: 'Kazakh',
  khm: 'Khmer',
  kir: 'Kyrgyz',
  kmr: 'Kurdish (Kurmanji)',
  kor: 'Korean',
  kor_vert: 'Korean (Vertical)',
  lao: 'Lao',
  lat: 'Latin',
  lav: 'Latvian',
  lit: 'Lithuanian',
  ltz: 'Luxembourgish',
  mal: 'Malayalam',
  mar: 'Marathi',
  mkd: 'Macedonian',
  mlt: 'Maltese',
  mon: 'Mongolian',
  mri: 'Maori',
  msa: 'Malay',
  mya: 'Burmese',
  nep: 'Nepali',
  nld: 'Dutch',
  nor: 'Norwegian',
  oci: 'Occitan',
  ori: 'Odia',
  pan: 'Punjabi',
  pol: 'Polish',
  por: 'Portuguese',
  pus: 'Pashto',
  que: 'Quechua',
  ron: 'Romanian',
  rus: 'Russian',
  san: 'Sanskrit',
  sin: 'Sinhala',
  slk: 'Slovak',
  slv: 'Slovenian',
  snd: 'Sindhi',
  spa: 'Spanish',
  spa_old: 'Spanish (Old Spanish)',
  sqi: 'Albanian',
  srp: 'Serbian',
  srp_latn: 'Serbian (Latin)',
  sun: 'Sundanese',
  swa: 'Swahili',
  swe: 'Swedish',
  syr: 'Syriac',
  tam: 'Tamil',
  tat: 'Tatar',
  tel: 'Telugu',
  tgk: 'Tajik',
  tha: 'Thai',
  tir: 'Tigrinya',
  ton: 'Tongan',
  tur: 'Turkish',
  uig: 'Uyghur',
  ukr: 'Ukrainian',
  urd: 'Urdu',
  uzb: 'Uzbek',
  uzb_cyrl: 'Uzbek (Cyrillic)',
  vie: 'Vietnamese',
  yid: 'Yiddish',
  yor: 'Yoruba'
};

const require = createRequire(import.meta.url);
const decompress = promisify(gunzip);
const bundledModelPaths = new Map(['eng', 'mal'].map((code) => [
  code, join(dirname(require.resolve(`@tesseract.js-data/${code}`)), '4.0.0_best_int', `${code}.traineddata.gz`)
]));
const modelDirectory = fileURLToPath(new URL('../temp/ocr-models/', import.meta.url));
const modelSource = 'https://raw.githubusercontent.com/tesseract-ocr/tessdata_fast/4.1.0/';
const modelDownloads = new Map();
const maxLanguages = 3;

export function getOcrLanguageConfig() {
  const languages = Object.entries(languageNames)
    .map(([code, name]) => ({ code, name }))
    .sort((first, second) => first.name.localeCompare(second.name, 'en'));
  return { languages, maxLanguages };
}

export function parseOcrLanguages(value) {
  if (value === undefined) return ['eng'];
  if (typeof value !== 'string') throw new ApiError(400, 'Choose supported OCR languages.');
  const codes = [...new Set(value.split('+').map((code) => code.trim()))];
  if (codes.length > maxLanguages) throw new ApiError(400, `Choose up to ${maxLanguages} OCR languages.`);
  if (codes.some((code) => !Object.hasOwn(languageNames, code))) throw new ApiError(400, 'Choose supported OCR languages.');
  return codes;
}

async function downloadModel(code, filename) {
  const bundledPath = bundledModelPaths.get(code);
  if (bundledPath) return decompress(await readFile(bundledPath));

  const response = await fetch(new URL(filename, modelSource), { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`Model download returned ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

async function cacheModel(code) {
  const filename = `${code}.traineddata`;
  const path = join(modelDirectory, filename);
  try {
    await access(path);
    return;
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }

  const model = await downloadModel(code, filename);
  await mkdir(modelDirectory, { recursive: true });
  const temporaryPath = join(modelDirectory, `${filename}.${randomUUID()}.tmp`);
  try {
    await writeFile(temporaryPath, model);
    await rename(temporaryPath, path);
  } finally {
    await rm(temporaryPath, { force: true }).catch(() => {});
  }
}

function prepareModel(code) {
  if (!modelDownloads.has(code)) {
    const loading = cacheModel(code)
      .catch(() => { throw new ApiError(503, `The OCR model for ${languageNames[code]} could not be loaded. Try again later.`); })
      .finally(() => modelDownloads.delete(code));
    modelDownloads.set(code, loading);
  }
  return modelDownloads.get(code);
}

export async function createOcrWorker(codes) {
  await Promise.all(codes.map(prepareModel));
  return new Promise((resolve, reject) => {
    const onError = () => reject(new ApiError(503, 'Could not start the OCR engine for the selected languages.'));
    createWorker(codes, OEM.LSTM_ONLY, {
      langPath: modelDirectory,
      cacheMethod: 'none',
      gzip: false,
      errorHandler: onError
    }).then(resolve, onError);
  });
}
