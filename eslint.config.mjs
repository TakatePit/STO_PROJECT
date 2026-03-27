import js from '@eslint/js';
import jestPlugin from 'eslint-plugin-jest';
import eslintPluginJsdoc from 'eslint-plugin-jsdoc';
import globals from 'globals';

/** Файли з повним JSDoc для лабораторної з документації. */
const documentedSources = ['logic.js', 'db.js', 'server.js', 'seed.js', 'tests/logic.js'];

export default [
    {
        ignores: [
            'node_modules/**',
            'coverage/**',
            'public/**',
            'docs/jsdoc/**',
            'load_test.js',
        ],
    },
    js.configs.recommended,
    {
        files: ['**/*.js'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'commonjs',
            globals: { ...globals.node },
        },
        rules: {
            'no-unused-vars': [
                'warn',
                { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' },
            ],
            eqeqeq: ['error', 'smart'],
            'no-console': 'off',
        },
    },
    {
        files: ['tests/**/*.test.js'],
        ...jestPlugin.configs['flat/recommended'],
    },
    ...[eslintPluginJsdoc.configs['flat/recommended-typescript-flavor']].flat().map((cfg) => ({
        ...cfg,
        files: documentedSources,
        rules: {
            ...cfg.rules,
            'jsdoc/no-undefined-types': 'off',
            'jsdoc/check-tag-names': [
                'warn',
                { definedTags: ['route'] },
            ],
        },
    })),
];
