// Prettier rules are used when formatting but not enforced by ESLint linting
// https://prettier.io/docs/en/options.html

/** @type {import("prettier").Options} */
export default {
  arrowParens: 'avoid',
  printWidth: 100,
  singleQuote: true,
  tabWidth: 2,
  useTabs: false,
  trailingComma: 'all',
  bracketSpacing: true,
  jsxSingleQuote: false,
  jsxBracketSameLine: false,
  quoteProps: 'as-needed',
  semi: true,
  overrides: [
    {
      files: ['*.scss', '*.css', '*.json'],
      options: {
        tabWidth: 4,
      },
    },
  ],
};
