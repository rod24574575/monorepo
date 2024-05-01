// @ts-check
import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * @param {Record<string, string>} json
 */
function dumpDiff(json) {
  for (const [key, value] of Object.entries(json)) {
    if (key !== value) {
      console.log(`"${key}" => "${value}"`);
    }
  }
  console.log('');
}

async function main() {
  const dirName = path.resolve(import.meta.dirname, '../maps/');

  const fileNames = (await fs.readdir(dirName)).sort();
  const results = await Promise.allSettled(fileNames.map(async (name) => {
    const file = await fs.readFile(path.resolve(dirName, name), {
      encoding: 'utf8',
      flag: 'r',
    });

    const json = JSON.parse(file);
    if (typeof json !== 'object') {
      throw new Error(`Invalid JSON object file: ${name}`);
    }
    return /** @type {Record<string, string>} */ (json);
  }));

  for (let i = 0; i < fileNames.length; ++i) {
    console.log(`${fileNames[i]}:`);

    const result = results[i];
    if (result.status === 'fulfilled') {
      dumpDiff(result.value);
    } else {
      console.error(result.reason);
    }
  }
}

main();
