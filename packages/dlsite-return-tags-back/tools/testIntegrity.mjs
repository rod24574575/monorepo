// @ts-check
import { listLocales, readGenreReplacementJson } from './utils.mjs';

/**
 * @typedef {object} ModalLists
 * @property {any} genre_lists
 * @property {any} other_lists
 */

/**
 * @typedef {object} GenreItem
 * @property {string} value
 * @property {string} name
 */

/**
 * @param {ModalLists} modalLists
 * @returns {GenreItem[]}
 */
function parseGenreItems(modalLists) {
  let lists = modalLists.genre_lists;
  if (!Array.isArray(lists)) {
    /** @type {any[]} */
    const newLists = [];
    for (let i = 1;; ++i) {
      const list = lists[i];
      if (!list) {
        break;
      }
      newLists.push(list);
    }
    lists = newLists;
  }

  /** @type {GenreItem[]} */
  const genreItems = [];
  for (const { values } of lists) {
    genreItems.push(...values);
  }
  genreItems.sort((a, b) => (parseInt(a.value) - parseInt(b.value)));

  return genreItems;
}

/**
 * @param {string} [locale]
 * @returns {Promise<GenreItem[]>}
 */
async function fetchGenreItems(locale) {
  const resp = await fetch('https://www.dlsite.com/maniax/fsr/modal/lists' + (locale ? `?locale=${locale}` : ''));
  const modalList = /** @type {ModalLists} */ (await resp.json());
  return parseGenreItems(modalList);
}

async function main() {
  const locales = await listLocales();
  const results = await Promise.allSettled(locales.map(async (locale) => {
    return Promise.all([
      readGenreReplacementJson(locale),
      fetchGenreItems(locale),
    ]);
  }));

  for (let i = 0; i < locales.length; ++i) {
    console.log(`${locales[i]}:`);

    const result = results[i];
    if (result.status === 'fulfilled') {
      const [genreMap, genreItems] = result.value;

      for (const { name } of genreItems) {
        if (!(name in genreMap)) {
          console.log(`"${name}" is missing`);
        }
      }
    } else {
      console.error(result.reason);
    }
    console.log('');
  }
}

main();
