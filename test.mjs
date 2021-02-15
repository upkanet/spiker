import { fineStructureDependencies } from 'mathjs';
import { Electrode } from './record.mjs';
import fs from 'fs';

var s = fs.readFileSync('data-test/sin.txt','utf-8');

s = s.split('\r\n');
var period = s[1].split('\t')[0] - s[0].split('\t')[0];
var sample_rate = 1 / period;
var e = new Electrode(1,sample_rate);
console.log("Period", period);
console.log("Sampling", sample_rate);
s.forEach(l => {
    l = l.split('\t');
    e.push(Number(l[1]));
});

console.log(e.topFreq);


