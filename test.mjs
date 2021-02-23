import { Experiment } from './record.mjs';

var datapath = process.argv[2] || "data";
var electrodes = process.argv[3] || "1";
electrodes = electrodes.split(',');

var t0 = new Date();
var exp = new Experiment("data/20210129", [1]);

exp.save();