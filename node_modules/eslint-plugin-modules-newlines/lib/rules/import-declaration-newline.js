const { IMPORT } = require('../constants');
const { lintModuleVariablesNewline } = require('./utils');

module.exports = {
  meta: {
    fixable: "whitespace",
  },
  create: function (context) {
    return {
      ImportDeclaration(node) {
        lintModuleVariablesNewline(node, context, IMPORT)
      },
    }
  },
};
