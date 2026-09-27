const { defineConfig } = require('eslint/config');
const expo = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expo,
  { ignores: ['dist/**', 'coverage/**', 'scripts/local/**', 'android/**', 'ios/**', 'modules/*/android/build/**', '**/.gradle/**'] },
  {
    files: ['src/domain/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          { group: ['react', 'react-native', 'expo', 'expo-*', 'node:*', 'fs', 'path', '../../data/*', '@/data/*'], message: 'Keep domain logic independent of UI, storage, and I/O.' }
        ]
      }],
      'no-restricted-syntax': ['error',
        { selector: "NewExpression[callee.name='Date'][arguments.length=0]", message: 'Pass the date into domain functions.' },
        { selector: "CallExpression[callee.object.name='Date'][callee.property.name='now']", message: 'Pass the time into domain functions.' },
        { selector: "CallExpression[callee.name='fetch']", message: 'Network access belongs in an adapter, not the domain.' }
      ]
    }
  }
]);
