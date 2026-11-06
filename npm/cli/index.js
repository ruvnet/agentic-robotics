'use strict';

// Programmatic entry point. The package is primarily a CLI (see bin/cli.js);
// requiring it does not run the CLI.
const path = require('path');
const { version } = require('./package.json');

module.exports = {
  version,
  binPath: path.join(__dirname, 'bin', 'cli.js'),
};
