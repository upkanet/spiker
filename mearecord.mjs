import fs from 'fs';
import readline from 'readline';
import stream from 'stream';
import { config } from './config.mjs';
var outstream = new stream;

class MEARecord {
    constructor(bigfilepath) {
        this.bigfile = {
            path: bigfilepath,
            length: 0
        };
        this.max = 0;
        this.artelines = [];
        this.electrodes = [];
        this.maxthreshold = config.threshold;
        this.t0 = new Date().getTime();
    }

    async load() {
        console.log('Loading ' + this.bigfile.path);
        console.log('Pass#1 - Extracting maximum and file length');
        [this.bigfile.length, this.max] = await this.lengthandmax();
        console.log(this.timer);
        console.log('Pass#2 - Identifing artefacts');
        this.artelines = await this.getArtelines();
        console.log(this.timer);
        console.log('Pass#3 - Loading electrodes\' values around artefacts');
        this.electrodes = await this.getElectrodes();
        console.log(this.timer);
    }

    async lengthandmax() {
        var instream = fs.createReadStream(this.bigfile.path);
        var rl = readline.createInterface(instream, outstream);
        var fileheader = true;
        var count = 0;
        var max = 0;

        rl.on('line', function (line) {
            if (!fileheader || line.charAt(0) == '0') {
                fileheader = false;
                var v = getFirstElectrode(line);
                max = Math.max(max, v);
            }
            count++;
        });

        return new Promise(resolve => {
            rl.on('close', function () {
                resolve([count, max]);
            });
        });
    }

    async getArtelines() {
        var instream = fs.createReadStream(this.bigfile.path);
        var rl = readline.createInterface(instream, outstream);
        var fileheader = true;
        var artelines = [];
        var count = 0;
        var [maxthreshold, max] = [this.maxthreshold, this.max];

        rl.on('line', function (line) {
            if (!fileheader || line.charAt(0) == '0') {
                fileheader = false;

                var v = getFirstElectrode(line);
                if (v > maxthreshold * max) {
                    artelines.push(count);
                }
                count++;
            }
        });

        return new Promise(resolve => {
            rl.on('close', function () {
                resolve(compactArte(artelines));
            });
        });
    }

    async getElectrodes(){
        var instream = fs.createReadStream(this.bigfile.path);
        var rl = readline.createInterface(instream, outstream);
        var fileheader = true;
        var count = 0;
        var electrodes = [];
        var mear = this;

        rl.on('line', function (line) {
            if (!fileheader || line.charAt(0) == '0') {
                fileheader = false;
                if(mear.artelinesCdt(count)){
                    electrodes = mear.appendLine(line);
                }
                count++;
            }
        });

        return new Promise(resolve => {
            rl.on('close', function () {
                resolve(electrodes);
            });
        });
    }

    get timer(){
        return (new Date().getTime() - this.t0) / 1000 + ' sec.';
    }

    appendLine(l){
        var arr = l.split(',');
        var e = this.electrodes;
        arr.forEach(function(v,i){
            if(i>0){
                var j = i - 1;
                if(e[j]){
                    e[j].push(Number(v));
                }
                else{
                    e[j] = [Number(v)];
                }
            }
        });
        this.electrodes = e;
        return e;
    }
    
    artelinesCdt(x){
        var r = false;
        var range = config.range * config.sampling;
        this.artelines.forEach(function(v){
            r = r || (x >= v - range && x <= v + range);
        });
        return r;
    }
}

function getFirstElectrode(line) {
    var s = line.substr(line.indexOf(',') + 1);
    s = s.substr(0, s.indexOf(','));
    return Number(s);
}

function compactArte(artelines){
    artelines.forEach(function(v,i){
        if(artelines.includes(v+1)){
            artelines.splice(i,1);
        }
    });
    return artelines;
}


export { MEARecord };