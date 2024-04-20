import { defineConfig } from 'stylelint-define-config';

export default defineConfig({
  extends: [
    'stylelint-config-standard-scss',
    'stylelint-stylus/recommended',
  ],
  reportDescriptionlessDisables: true,
  reportInvalidScopeDisables: true,
  reportNeedlessDisables: true,
});
