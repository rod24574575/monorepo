import { defineFlatConfig } from 'eslint-define-config';
import js from '@eslint/js';
import userscripts from 'eslint-plugin-userscripts';
import globals from 'globals';

export default defineFlatConfig([
  js.configs.recommended,
  {
    rules: {
      'no-unused-vars': 'off',
    },
    languageOptions: {
      ecmaVersion: 2022,
    },
  },
  {
    ...userscripts.configs.recommended,
    files: ['**/*.user.js'],
    plugins: {
      userscripts,
    },
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.greasemonkey,
      },
    },
  },
]);
