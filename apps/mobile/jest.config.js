module.exports = {
  preset: 'jest-expo',

  moduleNameMapper: {
    '^@scout/shared$': '<rootDir>/../../packages/shared/src/index.ts',
  },
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
}
