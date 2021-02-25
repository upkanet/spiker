import { Experiment } from './record.mjs';
import express from 'express';
import open from 'open';
import fs from 'fs';
const app = express();
var config = JSON.parse(fs.readFileSync('config.json', 'utf-8'));

var datapath = process.argv[2] || "data";
var electrodes = process.argv[3] || "1";
electrodes = electrodes.split(',');

var t0 = new Date();
var exp = new Experiment(datapath, electrodes);
exp.compute("spectrum");

app.get('/', function (req, res) {
    res.sendFile('spiker.htm', {root : 'public'});
});

app.get('/favicon.ico', function (req, res) {
    res.sendFile('favicon.ico', {root : '.'});
});

app.get('/records', (req, res) => {
    res.json(Object.keys(exp.records));
});

app.get('/electrodes', (req, res) => {
    res.json(exp.electrodes);
});

app.get('/results', (req, res) => {
    res.json(exp.results);
});

app.get('/results/dl', (req, res) => {
    res.status(200)
        .attachment(`spiker-results.csv`)
        .send(exp.resultsCSV);
});

app.get('/js/:js', function (req, res) {
    res.sendFile(req.params.js, {root : 'js'});
});

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
console.log('Server ready on port 3000 after', Math.round((new Date() - t0)/1000), 'sec');
if(config.open) open('http://localhost:3000');

