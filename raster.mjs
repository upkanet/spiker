import { Experiment } from './record.mjs';
import fs from 'fs';
var config = JSON.parse(fs.readFileSync('config.json', 'utf-8'));

var datapath = process.argv[2] || "data";
var electrodes = process.argv[3] || "1";
electrodes = electrodes.split(',');

var exp = new Experiment(datapath, electrodes);
exp.compute("raster");