// Browser-side exam PDF loading. pdf.js is heavy, so it loads lazily —
// nothing is fetched until someone actually hands the app a PDF.
import { extractExams } from './examPdf.js';

export async function parseExamPdf(file) {
  const [{ getDocument, GlobalWorkerOptions }, worker] = await Promise.all([
    import('pdfjs-dist'),
    import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
  ]);
  GlobalWorkerOptions.workerSrc = worker.default;

  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await getDocument({ data }).promise;
  const exams = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const tc = await page.getTextContent();
    exams.push(
      ...extractExams(tc.items.map((i) => ({ s: i.str, x: i.transform[4], y: i.transform[5] })))
    );
  }
  return exams;
}
