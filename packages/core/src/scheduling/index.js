/**
 * Djadwal Core: Scheduling Module (CommonJS runtime entry point)
 */

const constraints = require('./constraints.js');
const detector = require('./explainable-conflict-detector.js');
const solver = require('./solver.js');
const versioning = require('./versioning.js');
const impact = require('./impact-simulator.js');
const metrics = require('./metrics.js');
const benchmark = require('./benchmark.js');

module.exports = {
  ...constraints,
  ...detector,
  ...solver,
  ...versioning,
  ...impact,
  ...metrics,
  ...benchmark
};
