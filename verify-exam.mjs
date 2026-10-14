import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { readFileSync } from 'fs';
import { extractExams, matchExamsToCourses, examsToQuizRows, normaliseTimeRange } from './src/lib/examPdf.js';
import { parseClassSheet } from './src/lib/excel.js';
let pass=0,fail=0; const ck=(n,o,x='')=>{o?pass++:fail++;console.log(`${o?'PASS':'FAIL'}  ${n}${x?' — '+x:''}`)};

// Usage: node examtest.mjs [path-to-end-term.pdf]
const pdfPath = process.argv[2] || '/mnt/user-data/uploads/PGDM_End_Term_Schedule_-_Term_IV.pdf';
const data = new Uint8Array(readFileSync(pdfPath));
const doc = await getDocument({ data }).promise;
const page = await doc.getPage(1);
const tc = await page.getTextContent();
const items = tc.items.map(i => ({ s: i.str, x: i.transform[4], y: i.transform[5] }));

const exams = extractExams(items);
console.log('exams found:', exams.length);
exams.forEach(e => console.log(` ${e.iso} ${e.day} ${e.start}  ${e.name.padEnd(52).slice(0,52)} ${e.time.padEnd(20)} ${e.venue.slice(0,40)}`));

ck('24 exams extracted', exams.length===24, String(exams.length));
const byName = Object.fromEntries(exams.map(e=>[e.name, e]));
ck('two-line name joined', !!byName['Financial Reporting & Analysis']);
ck('long CMAT name joined', exams.some(e=>e.name.startsWith('Competency Mapping and Assessing Talent')));
ck('Mon 31 Aug is Monday', byName['Supply Chain Management']?.iso==='2026-08-31' && byName['Supply Chain Management']?.day==='Mon');
ck('Sun capstone on 6 Sep', exams.find(e=>e.name.includes('Capstone'))?.iso==='2026-09-06');
ck('capstone multi-venue joined', (exams.find(e=>e.name.includes('Capstone'))?.venue.match(/,/g)||[]).length>=8);
ck('typo time handled', exams.find(e=>e.name.includes('Digital Marketing'))?.time==='4:30 PM – 6:30 PM');
ck('9am starts sort as 09:00', byName['Supply Chain Management']?.start==='09:00');
ck('evening exam 4:30 pm start 16:30', exams.find(e=>e.name.includes('Marketing Research'))?.start==='16:30');
ck('ODCM 9-11 separate from ABA 9-12', byName['Organizational Development & Change Management']?.time==='9:00 AM – 11:00 AM');
ck('BA is Tuesday', byName['Business Analysis']?.iso==='2026-09-01');
ck('FIS is Friday', byName['Fixed Income Securities']?.iso==='2026-09-04');
ck('Competitive Strategy present + Friday', byName['Competitive Strategy']?.iso==='2026-09-04');
ck('PM is Sunday', byName['Product Management']?.iso==='2026-09-06');
ck('BA venue not polluted by MNA labs', !byName['Business Analysis']?.venue.includes('NAB'), byName['Business Analysis']?.venue);
ck('MNA venue restored', byName['Mergers & Acquisition (Global)']?.venue.includes('NAB LAB 1 (65)'));

// ---- match against the REAL course sheet ----
const f=(p,n)=>({name:n,arrayBuffer:async()=>{const b=readFileSync(p);return b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);}});
const sheet = await parseClassSheet(f('/mnt/user-data/uploads/Term_IV_Week_10_17th_Aug_-_23rd_Aug.xlsx','w.xlsx'));
const matched = matchExamsToCourses(exams, sheet.courses);
const misses = matched.filter(e=>!e.code);
console.log('\nunmatched:', misses.map(e=>e.name).join(' | ') || 'none');
ck('at least 22/24 matched to codes', matched.filter(e=>e.code).length>=22, `${matched.filter(e=>e.code).length}/24`);
ck('SCM matched', matched.find(e=>e.name==='Supply Chain Management')?.code==='SCM');
ck('CMAT matched despite length', matched.find(e=>e.name.startsWith('Competency'))?.code==='CMAT');
ck('(Global) suffix matched', matched.find(e=>e.name.includes('Digital Marketing'))?.code==='DIGMKT');

const rows = examsToQuizRows(matched);
ck('rows named CODE End Term', rows.some(r=>r.name==='SCM End Term'));
ck('venue carried as room', rows.find(r=>r.name==='SCM End Term')?.room.includes('NAB LAB'));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
