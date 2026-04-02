import { defineConfig, configDefaults } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    env: {
      COGNITO_CLIENT_ID: 'test-client-id',
      COGNITO_CLIENT_SECRET: 'test-client-secret',
      APHA_COGNITO_URL: 'http://localhost/oauth2/token',
      APHA_API_BASE_URL: 'http://localhost/api',
      LIVESTOCK_API_BASE_URL: 'http://localhost/livestock',
      LIVESTOCK_API_TOKEN: 'test-livestock-token'
    },
    clearMocks: true,
    fileParallelism: false,
    coverage: {
      provider: 'v8',
      reportsDirectory: './coverage',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.js'],
      exclude: [...configDefaults.exclude, 'coverage']
    },
    setupFiles: ['.vite/setup-files.js']
  }
})
