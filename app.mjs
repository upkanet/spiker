import { Experiment } from './record.mjs';
import express from 'express';
const app = express();

var exp = new Experiment('data/20210129', [251, 97, 247]);
//var exp = new Experiment('data/test', [251]);

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

app.get('/js/:js', function (req, res) {
    res.sendFile(req.params.js, {root : 'js'});
});

app.get('/:record/:electrode', (req, res) => {
    var r = req.params.record;
    var e = req.params.electrode;
    var el = exp.records[r].electrode(e);
    res.json(el);
});

app.listen(3000)
console.log('Server ready on port 3000');

