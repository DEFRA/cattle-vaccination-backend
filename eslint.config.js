import neostandard from 'neostandard'

export default [
  ...neostandard({
    env: ['node', 'vitest'],
    ignores: [...neostandard.resolveIgnoresFromGitignore()],
    noJsx: true,
    noStyle: true
  }),
  {
    files: ['**/*.test.js'],
    languageOptions: {
      globals: {
        fetchMock: 'readonly'
      }
    }
  }
]
