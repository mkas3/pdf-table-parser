const { eslint } = require('@mkas3/eslint');

module.exports = {
  ...eslint.node,
  rules: {
    ...eslint.node.rules,
    'no-bitwise': 'off',
    'no-param-reassign': 'off',
    'no-continue': 'off'
  }
};
