import { Experiment } from './record.mjs';

var datapath = process.argv[2] || "data";

var exp = new Experiment(datapath);
exp.compute("heatmap");