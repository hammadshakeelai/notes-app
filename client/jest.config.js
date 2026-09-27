module.exports = {
  preset: 'jest-expo',
  testMatch: ['<rootDir>/src/**/__tests__/**/*.test.ts?(x)'],
  collectCoverageFrom: ['src/domain/**/*.ts', '!src/domain/**/__tests__/**', '!src/domain/**/types.ts', '!src/domain/**/index.ts'],
  coverageDirectory: 'coverage',
  coverageThreshold: {
    global: { branches: 90, functions: 90, lines: 90, statements: 90 }
  },
  clearMocks: true
};
