import fs from 'fs';

const summary = JSON.parse(fs.readFileSync('./coverage/coverage-summary.json', 'utf-8'));

const { total: { statements: { pct } } } = summary;

const colors = [
  'brightgreen',
  'green',
  'yellowgreen',
  'yellow',
  'orange',
  'red'
];

const color = colors.find((_, index) => pct >= ((colors.length - index) / colors.length * 100) - 10);

const json = {
  schemaVersion: 1,
  label: 'coverage',
  message: `${Math.trunc(pct)}%`,
  color
};

fs.writeFileSync('./coverage/lcov-report/coverage.json', JSON.stringify(json));
