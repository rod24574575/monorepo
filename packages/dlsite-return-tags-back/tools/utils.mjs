// @ts-check
import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * @typedef {Record<string, string>} GenreReplacementMap
 */

/**
 * @returns {string}
 */
function getMapsDir() {
  return path.resolve(import.meta.dirname, '../maps/');
}

/**
 * @returns {Promise<string[]>}
 */
export async function listLocales() {
  return (await fs.readdir(getMapsDir()))
    .map((name) => path.basename(name, '.json'))
    .sort();
}

/**
 * @param {string} locale
 * @returns {Promise<GenreReplacementMap>}
 */
export async function readGenreReplacementJson(locale) {
  const fileName = `${locale}.json`;

  const file = await fs.readFile(path.resolve(getMapsDir(), fileName), {
    encoding: 'utf8',
    flag: 'r',
  });

  const json = JSON.parse(file);
  if (typeof json !== 'object') {
    throw new Error(`Invalid JSON object file: ${fileName}`);
  }
  return /** @type {GenreReplacementMap} */ (json);
}
