/**
 * Term V course catalog — the authoritative reference for course names and
 * faculty, keyed by code. Week sheets often carry abbreviated or mangled
 * names and rarely carry faculty; for any code found here, the catalog's
 * name and faculty win. Codes not listed fall back to whatever the sheet
 * said, so nothing breaks when a new elective appears.
 */
export const TERM_CATALOG = {
  BEHFIN: { name: 'Behavioral Finance', faculty: 'Prof. Manas Mayur', credits: 2.5 },
  BRANDM: {
    name: 'Brand Management',
    faculty: 'Prof. Ajit Parulekar · Ms. Sucheta Jha (Sec. A & B) · Ms. Umang Maheshwari',
    credits: 3,
  },
  CORPBAN: {
    name: 'Corporate Banking',
    faculty: 'Mr. Rahul Sah · Mr. D Bhaskar · Mr. Sunil Kumar · Mr. Deepak Kumar · Mr. Krishnan Diwakaran · Mr. Vishnu Venkat Shivaraju',
    credits: 3,
  },
  CORPTAX: { name: 'Corporate Taxation', faculty: 'Prof. Neetant D. Sinai Shirodkar', credits: 3 },
  CWTV: {
    name: 'Creative Writing Through Visitor Experience of Goan Islands and Kayaking',
    faculty: 'Prof. Andy Silveira and Prof. Muneeb Ul Lateef Banday',
    credits: 2.5,
  },
  DHRM: { name: 'Digital Human Resource Management', faculty: 'Prof. Anamika Sinha', credits: 3 },
  DTS: { name: 'Digital Transformation Strategy', faculty: 'Mr. Atanu Ghosh', credits: 3 },
  'EE&EB': { name: 'Employee Experience and Employer Branding', faculty: 'Prof. Venkatesh Naga', credits: 3 },
  FINMOD: { name: 'Financial Modelling Using Spreadsheets', faculty: 'Prof. Neeraj Amarnani', credits: 3 },
  FRM: { name: 'Financial Risk Management', faculty: 'Mr. Anurag Singal', credits: 3 },
  HRA: { name: 'HR Analytics', faculty: 'Prof. Anshul Mandliya', credits: 3 },
  IAPM: { name: 'Investment Analysis & Portfolio Management', faculty: 'Prof. Avinash Galkhe', credits: 3 },
  NEURO: { name: 'Neuro Marketing', faculty: 'Prof. Diya Guha Roy', credits: 3 },
  PERMGT: { name: 'Performance Management', faculty: 'Prof. Venkatesh Naga', credits: 3 },
  PRICING: { name: 'Pricing', faculty: 'Prof. Vikram Choudhary', credits: 2 },
  PROJECT: { name: 'Project Management', faculty: 'Prof. Vishnu T.', credits: 3 },
  QELSS: { name: 'Quality Engineering and Lean Six Sigma', faculty: 'Dr. Gijo E V', credits: 2.5 },
  RURAL: { name: 'Rural Marketing', faculty: 'Prof. Pravat Kar', credits: 2 },
  SERMKTG: { name: 'Services Marketing', faculty: 'Prof. Mauli Soni', credits: 2.5 },
  SMAA: { name: 'Strategic Marketing: an Applied Approach', faculty: 'Prof. Vishwas Raichur', credits: 3 },
  STRIMP: { name: 'Strategy Implementation', faculty: 'Prof. Rathish Bhatt', credits: 2 },
  SCC: { name: 'Supply Chain Consulting', faculty: 'Mr. Milind Kanetkar', credits: 3 },
  TOP: { name: 'Thriving at Office Politics', faculty: 'Prof. Rahul Sukumaran', credits: 3 },
};
