import mammoth from 'mammoth';
import WordExtractor from 'word-extractor';

export async function extractDocumentText(cv) {
  if (
    cv.contentType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    return (await mammoth.extractRawText({ buffer: cv.data })).value;
  }
  if (cv.contentType === 'application/msword') {
    return (await new WordExtractor().extract(cv.data)).getBody();
  }
  return null;
}
