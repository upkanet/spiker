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
        this.filtered = false;
        this.spiked = false;
        this.data = [];
        this.truncated_data = [];
        this.simplified_data = [];
        this.spectrum_data = [];
        this.filtered_data = [];
        this.spike_data = [];
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

    get fData(){
        this.filter();
        return this.filtered_data;
    }

    get ssData(){
        this.spikeSorter();
        return this.spike_data;
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

    filter(){
        if(!this.filtered){
            var fc = config.fc;
            console.log("High Pass Filtering at ",fc,"Hz");
            var rc = 1/(2*Math.PI*fc);
            var dt = 1/this.sample_rate;
            var alpha = rc / (rc + dt);
            var yk,ykm1,xkm1;
            
            this.data.forEach((x,k)=>{
                if(k==0){
                    this.filtered_data.push(0);
                }
                else{
                    ykm1 = this.filtered_data[k-1];
                    xkm1 = this.data[k-1];
                    yk = alpha * ( ykm1 + x - xkm1);
                    this.filtered_data.push(yk);
                }
            });
    
            this.filtered = true;
        }
    }

    spikeSorter(){
        var threshold = Math.abs(config.threshold);
        var avg = average(this.fData);
        var stddev = standardDeviation(this.fData);

        console.log("Spiker Sorter",avg,stddev);

        this.fData.forEach((y,i)=>{
            if(i>0){
                var ym1 = this.fData[i-1];
                if((ym1 <= (avg+stddev*threshold)) && (y > (avg+stddev*threshold))){
                    //Asc front
                    this.spike_data.push(1)
                }
                else if((ym1 >= (avg-stddev*threshold)) && (y < (avg-stddev*threshold))){
                    //Desc front
                    this.spike_data.push(1)
                }
                else{
                    this.spike_data.push(0)
                }
            }
            else{
                this.spike_data.push(0)
            }
        });
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
            updateConsole(k+" / "+Math.round(N/2));
            process.stdout.write("\n");
            this.spectrumed = true;
        }
    }

    get topFreq() {
        var a = [];
        var topFrequencies = config.top_frequencies;
        
        while(a.length < topFrequencies){
            if(config.compute.includes("spectrum")){
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
            else{
                a.push(0);
            }
        }
    
            a = a.map(k => Math.round(k  * this.indexFreqRatio * 100) / 100);
            
        return a;
    }

    get indexFreqRatio(){
        var N = this.sData.length;
        return this.s_sample_rate / N;
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
        try{
            const fileParser = new BinaryParser();
            fileParser.open(this.path);
    
            //Header
            console.log("Analyzing header from",this.filename);
            var header = fileParser.string0();
            this.startData = header.search('EOH') + 5;
            header = header.split('\n');
            this.sample_rate = Number(header[3].substr(14));
            this.ADC_zero = Number(header[4].substr(11));
            this.El = Number(header[5].substr(5, 6));
            this.channels = header[6].split(';').length;
        }
        catch(e){
            console.log("No header");
        }
    }

    electrode(electrode = 1) {
        const fileParser = new BinaryParser();
        fileParser.open(this.path);

        if (this.electrodes[electrode] === undefined) {
            //Data
            console.log("# Electrode", electrode);
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
        console.log("Loading folder",folderpath,"with electrodes",electrodes);
        if(!fs.existsSync(this.folderpath+'/spiker.json') || !config.cache){
            this.loadRecords();
            this.saveFile();
        }
        else{
            console.log("Load from spiker.json");
            this.loadFile();
        }
    }

    saveFile(){
        var js = JSON.stringify(this);
        fs.writeFileSync(this.folderpath+'/spiker.json',js);
    }

    loadFile(){
        var electrodes = [];
        var js = JSON.parse(fs.readFileSync(this.folderpath+'/spiker.json','utf8'));
        js.records.forEach((r)=>{
            electrodes = [];
            r.electrodes.forEach((e,n) => {
                if(e !== null) electrodes[n] = Object.assign(new Electrode, e);
            });
            r.electrodes = electrodes;
            this.records.push(Object.assign(new Record, r));
        });
    }

    loadRecords(){
        var empty = true;
        fs.readdirSync(this.folderpath).forEach((f) => {
            if(path.extname(f) == '.raw'){
                var fpath = path.join(this.folderpath,f);
                var r = new Record(fpath);
                this.records.push(r);
                empty = false;
            }
        });
        if(empty) console.log('!! No .raw file found.');
        this.loadElectrodes();
    }

    loadElectrodes(){
        for(var k in this.records){
            var r = this.records[k];
            console.log("# Record",r.filename);
            this.electrodes.forEach((e) => {
                if(config.compute.includes("spectrum")) r.electrode(e).spectrum;
                if(config.compute.includes("raster")) r.electrode(e).ssData;
            });
        }
    }

    get results(){
        var a = [];
        for(var k in this.records){
            var r = this.records[k];
            r.electrodes.forEach((e) => {
                a.push([k,r.filename,e.number,e.min,e.max,e.topFreq || 0]);
            });
        }
        return a;
    }

    get resultsCSV(){
        var r = this.results;
        var s = "Filename;Elec;Vmin;Vmax;Frequencies\n";
        r.forEach((l)=>{
            s+=`${l[1]};${l[2]};${l[3]};${l[4]};${l[5]}\n`;
        });
        return s;

    }
}

function updateConsole(txt){
    process.stdout.clearLine();
    process.stdout.cursorTo(0);
    process.stdout.write('\x1b[36m'+txt+'\x1b[0m');
}

//Stat fonctions
function standardDeviation(values){
    var avg = average(values);
    
    var squareDiffs = values.map(function(value){
      var diff = value - avg;
      var sqrDiff = diff * diff;
      return sqrDiff;
    });
    
    var avgSquareDiff = average(squareDiffs);
  
    var stdDev = Math.sqrt(avgSquareDiff);
    return stdDev;
  }
  
  function average(data){
    var sum = data.reduce(function(sum, value){
      return sum + value;
    }, 0);
  
    var avg = sum / data.length;
    return avg;
  }



export { Electrode, Record, Experiment };