import fs from 'node:fs';
import { scienceStudentList } from '../src/data/studentListData.js';

const header = 'รหัสนักศึกษา,คำนำหน้า,ชื่อ-นามสกุล,สาขาวิชา,ระดับการศึกษา,ชั้นปี,สถานะ,เกรดเฉลี่ย';
const rows = scienceStudentList.map(s =>
    [s.id, s.prefix, s.name, s.major, s.level, s.year, s.status, s.gpa.toFixed(2)].join(',')
);
// UTF-8 BOM helps Excel detect Thai correctly
const csv = '﻿' + header + '\n' + rows.join('\n') + '\n';
fs.writeFileSync('students_sample.csv', csv);
console.log('written', scienceStudentList.length, 'sample rows to students_sample.csv');
