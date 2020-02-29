module.exports = {
    parser: '@typescript-eslint/parser',  // Specifies the ESLint parser
    extends: [
        'airbnb-typescript/base',
    ],
    plugins: ['@typescript-eslint'],
    parserOptions: {
        ecmaVersion: 2018,  // Allows for the parsing of modern ECMAScript features
        sourceType: 'module',  // Allows for the use of imports
    },
    rules: {
        // Place to specify ESLint rules. Can be used to overwrite rules specified from the extended configs
        // e.g. "@typescript-eslint/explicit-function-return-apiType": "off",
        'max-len': ['error', 120],
        'no-console': 'off',
        'no-underscore-dangle': 'off',
        'import/prefer-default-export': 'off',
        '@typescript-eslint/indent': ['error', 2, {
            'FunctionDeclaration': {'parameters': 'first'},
            'FunctionExpression': {'parameters': 'first'}
        }],
    },
};
