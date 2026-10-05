const { createHash } = require('node:crypto');
const { readFileSync } = require('node:fs');
const upstream = require('@expo/metro-config/babel-transformer');
const { prepareLabeledSvg } = require('./src/map/prepareLabeledSvg.cjs');

// Metro otherwise reuses the previous transformed SVG when only the adapter
// changes (the SVG file itself is unchanged). That produces stale exports such
// as `map.layers` instead of `map.labels`, crashing at `map.labels.areas`.
module.exports.getCacheKey = (options) => createHash('sha256')
  .update(upstream.getCacheKey(options))
  .update(readFileSync(__filename))
  .update(readFileSync(require.resolve('./src/map/prepareLabeledSvg.cjs')))
  .update(readFileSync(require.resolve('./src/map/sourceAnnotations.cjs')))
  .digest('hex');

module.exports.transform = (args) => {
  if (!args.filename.endsWith('.svg')) return upstream.transform(args);
  // The labeled file is the only map source. Geometry is extracted at bundle
  // time, not parsed/rebuilt on every zoom frame or copied into another map.
  if (!args.filename.endsWith('2026-10-04_floor2-labeled.svg')) {
    throw new Error('Only the labeled sample map is supported by this transformer.');
  }
  return upstream.transform({
    ...args,
    src: `module.exports = ${JSON.stringify(prepareLabeledSvg(args.src))};`,
  });
};
