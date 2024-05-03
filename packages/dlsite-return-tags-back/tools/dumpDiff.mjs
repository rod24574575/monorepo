// @ts-check
import { listLocales, readGenreReplacementJson } from './utils.mjs';

/**
 * @param {Record<string, string>} genreMap
 */
function dumpDiff(genreMap) {
  for (const [key, value] of Object.entries(genreMap)) {
    if (key !== value) {
      console.log(`"${key}" => "${value}"`);
    }
  }
}

async function main() {
  const locales = await listLocales();
  const results = await Promise.allSettled(locales.map(async (locale) => {
    return readGenreReplacementJson(locale);
  }));

  for (let i = 0; i < locales.length; ++i) {
    console.log(`${locales[i]}:`);

    const result = results[i];
    if (result.status === 'fulfilled') {
      dumpDiff(result.value);
    } else {
      console.error(result.reason);
    }
    console.log('');
  }
}

main();
