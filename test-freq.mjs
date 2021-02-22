import fs from 'fs';
import { Experiment } from './record.mjs';
import express from 'express';
const app = express();

var datapath = process.argv[2] || "data";
var electrodes = process.argv[3] || "1";
electrodes = electrodes.split(',');

var exp = new Experiment(datapath, electrodes);
var el = exp.records[Object.keys(exp.records)[0]].electrodes[1];

console.log(el.data);

//Populate data with file
el.data = [];
el.truncated_data = [];
el.simplified_data = [];
el.spectrum_data = [];

var s = fs.readFileSync('data-test/compo2.txt','utf-8');

s = s.split('\r\n');
var period = s[1].split('\t')[0] - s[0].split('\t')[0];
var sample_rate = 1 / period;
console.log("Period", period);
console.log("Sampling", sample_rate);
s.forEach(l => {
    l = l.split('\t');
    el.push(Number(l[1]));
});

console.log(el);

//Reset calculations
el.sample_rate = sample_rate;
el.truncated = -1;
el.simplified = false;
el.spectrumed = false;

el.spectrum;

console.log(el);

app.get('/:record/:electrode', (req, res) => {
    var r = req.params.record;
    var e = req.params.electrode;
    var el = exp.records[r].electrode(e);
    res.json(el);
});

app.get('/:record/:electrode/indexFreqRatio', (req, res) => {
    var r = req.params.record;
    var e = req.params.electrode;
    var el = exp.records[r].electrode(e);
    res.json(el.indexFreqRatio);
});

app.listen(3000)



