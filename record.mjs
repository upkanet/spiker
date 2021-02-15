import fs from 'fs';
import path from 'path';
import BinaryParser from 'binary-buffer-parser';
import { complex, pi, sin, cos, add, multiply } from 'mathjs';
var config = JSON.parse(fs.readFileSync('config.json', 'utf-8'));

class Electrode {
    constructor(number, sample_rate) {
        this.number = number;
        this.sample_rate = sample_rate;
        this.truncated = -1;
        this.simplified = false;
        this.spectrumed = false;
        this.data = [];
        this.truncated_data = [];
        this.simplified_data = [];
        this.spectrum_data = [];
    }

    get tData(){
        this.truncate();
        return this.truncated_data;
    }

    get sData(){
        this.simplify();
        return this.simplified_data;
    }

    get spectrum(){
        this.FT();
        return this.spectrum_data;
    }

    truncate() {
        var lastSeconds = config.last_seconds;
        if(this.truncated != lastSeconds){
            console.log("Keeping last ", lastSeconds, "sec. of Electrode", this.number);
            var lastSamples = lastSeconds * this.sample_rate;
            var firstKeep = this.data.length - lastSamples;
            this.data.forEach((e, i) => {
                if (i >= firstKeep) {
                    this.truncated_data.push(e);
                }
            });
            this.truncated = lastSeconds;
        }
        return this.truncated_data;
    }

    simplify(){
        if(!this.simplified){
            var pace = config.simplification_rate;
            this.s_sample_rate = this.sample_rate / pace;
            if (pace > 1) {
                var s = 0;
                this.tData.forEach((e, i) => {
                    s += e;
                    if (i % pace == 0) {
                        this.simplified_data.push(Math.round(s / pace * 100) / 100);
                        s = 0;
                    }
                });
            }
            else {
                this.simplified_data = this.tData;
            }

            this.simplified = true;
        }
    }

    push(v) {
        this.data.push(v);
    }

    get max() {
        return Math.max(...this.tData);
    }

    get min() {
        return Math.min(...this.tData);
    }

    Xk(k) {
        var N = this.sData.length;
        var s = complex(0, 0);
        for (var n = 0; n < N; n++) {
            var bn = -2 * pi * k * n / N;
            var xn = this.sData[n];
            var sn = multiply(xn, complex(cos(bn), sin(bn)));
            s = add(s, sn);
        }
        return s;
    }

    FT() {
        if (!this.spectrumed) {
            var N = this.sData.length;
            console.log("Spectrum Analysis on", Math.round(N / 2), "values");
            for (var k = 0; k < N / 2; k++) {
                if(k%100 == 0) updateConsole(k+" / "+Math.round(N/2));
                var magk = this.Xk(k).abs();
                this.spectrum_data.push(magk);
            }
            process.stdout.write("\n");
            this.spectrumed = true;
        }
    }

    get topFreq() {
        var a = [];
        var topFrequencies = config.top_frequencies;

        while(a.length < topFrequencies){
            var max = 0;
            var kmax = 0;
            this.spectrum.forEach((v,k) => {
                if(v>max && !a.includes(k)){
                    max = v;
                    kmax = k;
                }
            });
            a.push(kmax);
        }

        var N = this.sData.length;
        a = a.map(k => Math.round(k  / (2 * N / this.s_sample_rate) * 100) / 100);

        return a;
    }
}


class Record {
    constructor(fpath) {
        this.path = fpath;
        this.sample_rate;
        this.ADC_zero;
        this.El;
        this.channels = 0;
        this.electrodes = [];
        this._spectrum = [];
        this.header();
    }

    header() {
        const fileParser = new BinaryParser();
        fileParser.open(this.path);

        //Header
        console.log("Analyzing header");
        var header = fileParser.string0();
        this.startData = header.search('EOH') + 5;
        header = header.split('\n');
        this.sample_rate = Number(header[3].substr(14));
        this.ADC_zero = Number(header[4].substr(11));
        this.El = Number(header[5].substr(5, 6));
        this.channels = header[6].split(';').length;
    }

    electrode(electrode = 1) {
        const fileParser = new BinaryParser();
        fileParser.open(this.path);

        if (this.electrodes[electrode] === undefined) {
            //Data
            console.log("Electrode", electrode);
            fileParser.seek(this.startData);
            var el = new Electrode(electrode, this.sample_rate);
            while(!fileParser.eof()){
                for (var i = 0; i < this.channels; i++) {
                    if (i == electrode - 1) {
                        var v = fileParser.int16();
                        v = Math.round(v * this.El * 100) / 100;
                        el.push(v);
                    }
                    else {
                        fileParser.skip(2);
                    }
                }
            }
            fileParser.close();

            this.electrodes[electrode] = el;
        }
        return this.electrodes[electrode];
    }

    get mins(){
        var mins = [];
        this.electrodes.forEach((el) => {
            mins[el.number] = el.min;
        });
        return mins;
    }

    get maxs(){
        var maxs = [];
        this.electrodes.forEach((el) => {
            maxs[el.number] = el.max;
        });
        return maxs;
    }

    get filename(){
        return path.basename(this.path);
    }
}

class Experiment {
    constructor(folderpath, electrodes) {
        this.folderpath = folderpath;
        this.electrodes = electrodes;
        this.records = [];
        this.loadRecords();
    }

    loadRecords(){
        console.log("Folder",this.folderpath);
        fs.readdirSync(this.folderpath).forEach((f) => {
            if(path.extname(f) == '.raw'){
                var fpath = path.join(this.folderpath,f);
                var r = new Record(fpath);
                this.records[r.filename] = r;
            }
        });
        this.loadElectrodes();
    }

    loadElectrodes(){
        for(var k in this.records){
            var r = this.records[k];
            console.log(r.filename);
            this.electrodes.forEach((e) => {
                r.electrode(e).spectrum;
            });
        }
    }

    get results(){
        var a = [];
        console.log("Results");
        console.log("Filename\tElec\tVmin\tVmax\tFrequencies");
        for(var k in this.records){
            var r = this.records[k];
            r.electrodes.forEach((e) => {
                console.log(`${r.filename}\tE${e.number}\t${e.min}\t${e.max}\t${e.topFreq.join(',')}`);
                a.push([r.filename,e.number,e.min,e.max,e.topFreq]);
            });
        }
        return a;
    }
}

function updateConsole(txt){
    process.stdout.clearLine();
    process.stdout.cursorTo(0);
    process.stdout.write('\x1b[36m'+txt+'\x1b[0m');
}

export { Electrode, Record, Experiment };