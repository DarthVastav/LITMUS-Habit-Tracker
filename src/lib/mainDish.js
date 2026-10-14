// Which menu items are the mains? Rules worked out against the real
// sheets (see README notes): explicit prefixes first, then staples, then
// keyword sides. Verified over all 40 meals of both current menus.

/** Explicitly labelled mains on the regular mess sheet. */
const MAIN_PREFIX = /^(gravy|dry)\s*[-–:]/i;
/** Explicitly labelled sides. */
const SIDE_PREFIX = /^(sweet dish|dessert|drink|beverage)\s*[-–:]/i;

/**
 * A staple ANYWHERE in the cell makes the whole cell an accompaniment:
 * "Jeera Rice, Toor Dal, Plain Paratha" is the staple combo, not a main.
 */
const STAPLE = [
  'rice', 'pulao', 'dal', 'noodles', 'pasta', 'chapati', 'roti', 'naan',
  'bread', 'toast', 'fries',
];

/**
 * These only make a cell a side if EVERY comma/slash part matches, so
 * "Aloo Paratha, Dahi, Coriander Chutney" stays a main despite two side
 * words — the paratha carries it.
 */
const SIDE_WORDS = [
  // drinks
  'tea', 'coffee', 'milk', 'juice', 'drink', 'lassi', 'buttermilk', 'shake',
  'boost', 'bournvita', 'horlicks', 'water', 'nimbu paani',
  // breakfast filler
  'cornflakes', 'cereal', 'muesli', 'oats', 'porridge', 'banana', 'fruit',
  'singdana', 'sprouts', 'boiled',
  // starters & accompaniments
  'soup', 'shorba', 'broth', 'salad', 'raita', 'kachumber', 'chutney',
  'papad', 'pickle', 'achar', 'curd', 'dahi', 'fryums',
  // desserts
  'sweet dish', 'kheer', 'halwa', 'ice cream', 'gulab jamun', 'custard',
  'dessert', 'ladoo', 'jalebi', 'sheera', 'rabdi', 'peda', 'rasmalai',
];

const hits = (list, text) => list.some((w) => new RegExp(`\\b${w}`).test(text));

export function isSideDish(item) {
  if (SIDE_PREFIX.test(item)) return true;
  if (MAIN_PREFIX.test(item)) return false;
  // Split only on comma and slash — " and " belongs to dish names like
  // "Cucumber and Potato Salad".
  const parts = item
    .split(/[,/]/)
    .map((p) => p.toLowerCase().trim())
    .filter(Boolean);
  if (parts.some((p) => hits(STAPLE, p))) return true;
  return parts.every((p) => hits(SIDE_WORDS, p));
}

/**
 * Partition a meal's items into mains and sides.
 * A meal is never left with nothing emphasised: if every item reads as a
 * side (Sunday snacks is all pasta/tea/boiled), the first item leads.
 */
export function splitMeal(items) {
  const mains = items.filter((i) => !isSideDish(i));
  if (mains.length) return { mains, sides: items.filter((i) => isSideDish(i)) };
  return { mains: items.slice(0, 1), sides: items.slice(1) };
}
