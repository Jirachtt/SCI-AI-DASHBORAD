import assert from 'node:assert/strict';
import { mergeDatasetAndReportFallback } from '../src/utils/datasetFallback.js';

const fallback = {
    total: 173,
    zeroIsReal: 9,
    scienceFaculty: {
        byDepartment: [{ dept: 'เคมี', academic: 21 }],
        trend: [{ year: '2569', academic: 113 }],
        byGender: { male: 64, female: 109 },
    },
};

const livePartial = {
    total: 180,
    zeroIsReal: 0,
    scienceFaculty: {
        byDepartment: [],
        trend: null,
        byGender: { male: null },
    },
};

const result = mergeDatasetAndReportFallback(fallback, livePartial);

assert.equal(result.data.total, 180, 'live scalar must win');
assert.equal(result.data.zeroIsReal, 0, 'a real numeric zero must not be replaced');
assert.deepEqual(result.data.scienceFaculty.byDepartment, fallback.scienceFaculty.byDepartment, 'empty live arrays must use coverage data');
assert.deepEqual(result.data.scienceFaculty.trend, fallback.scienceFaculty.trend, 'null live values must use coverage data');
assert.equal(result.data.scienceFaculty.byGender.male, 64, 'null nested fields must use coverage data');
assert.equal(result.data.scienceFaculty.byGender.female, 109, 'missing nested fields must use coverage data');
assert(result.fallbackFields.includes('scienceFaculty.byDepartment'));
assert(result.fallbackFields.includes('scienceFaculty.trend'));

console.log('Dataset fallback merge audit passed.');
