import { createRequire } from 'module';

const require = createRequire(import.meta.url);

const coreWebVitals = require('eslint-config-next/core-web-vitals');
const typescript = require('eslint-config-next/typescript');

/** @type {import('eslint').Linter.FlatConfig[]} */
const eslintConfig = [
  // Throwaway diagnostic scripts (CLAUDE.md: __*, scratch_*, test_* dosyaları
  // atılabilir; kalite gate'ini kirletmesinler). code-templates/ aktif kod değil.
  {
    ignores: [
      '**/__*.js',
      '**/__*.mjs',
      '**/scratch_*.mjs',
      '**/test_*.{js,mjs}',
      'code-templates/**',
    ],
  },
  ...coreWebVitals,
  ...typescript,
];

export default eslintConfig;
