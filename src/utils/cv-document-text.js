import mammoth from 'mammoth';
import WordExtractor from 'word-extractor';
import pdfParse from 'pdf-parse';

function normaliseText(text) {
  return (text ?? '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
}

export async function extractDocumentText(cv) {
  const buffer = cv?.data;
  if (!Buffer.isBuffer(buffer)) return null;

  if (
    cv.contentType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    return normaliseText((await mammoth.extractRawText({ buffer })).value);
  }
  if (cv.contentType === 'application/msword') {
    return normaliseText((await new WordExtractor().extract(buffer)).getBody());
  }
  if (cv.contentType === 'application/pdf') {
    const pdfData = await pdfParse(buffer);
    return normaliseText(pdfData.text);
  }
  return null;
}
