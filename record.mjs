import fs from 'fs';
import path from 'path';
import BinaryParser from 'binary-buffer-parser';
import { complex, pi, sin, cos, add, multiply, maxTransformDependencies } from 'mathjs';
import Canvas from 'canvas';
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
        var lastSeconds = config.spectrum.last_seconds;
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
            var pace = config.spectrum.simplification_rate;
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
            var fc = config.spike_sorter.fc;
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
        var threshold = Math.abs(config.spike_sorter.threshold);
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

    raster(fpath){
        var data = this.ssData;
        var w = config.raster.width;
        var h = config.raster.height;
        var tw = config.raster.time;
        var th = Math.round((data.length / this.sample_rate) / tw);

        const canvas = Canvas.createCanvas(w, h);
        const ctx = canvas.getContext('2d');
        ctx.fillStyle="black";
        ctx.fillRect(0,0,w,h);
        ctx.fillStyle="blue";

        data.forEach((v,k) => {
            if(v > 0){
                var t = k / this.sample_rate;
                var x = t%tw / tw;
                var y = Math.round(t/tw) / th;
                ctx.fillRect(x * w,y*h,2,20);
            }
        });
        
        const ipath = path.dirname(fpath) + '\\' + path.basename(fpath).split('.')[0] + '-' + this.number + '.png';
        const output = fs.createWriteStream(ipath);
        const stream = canvas.createPNGStream();
        stream.pipe(output);
        output.on('finish', () =>  console.log('[PNG] ' + path.basename(ipath) + ' created'));
    }

    get topFreq() {
        var a = [];
        var topFrequencies = config.spectrum.top_frequencies;
        
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
        this.selected_electrodes = [];
        this._spectrum = [];
        this.map_mea = config.map_mea.split(',').map(x => Number(x));
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

    allElectrodes(){
        const fileParser = new BinaryParser();
        fileParser.open(this.path);
        for(var e = 0; e < this.channels; e++){
            this.electrodes.push(new Electrode(e, this.sample_rate));
        }

        //Data
        fileParser.seek(this.startData);
        while(!fileParser.eof()){
            for (var i = 0; i < this.channels; i++) {
                var v = fileParser.int16();
                v = Math.round(v * this.El * 100) / 100;
                this.electrodes[i].push(v);
                if(fileParser.tell()%1000000 == 0) updateConsole(Math.round(fileParser.tell() / fileParser.size() * 100) + "%");
            }
        }
        process.stdout.write("\n");
        fileParser.close();
    }

    map(e){
        return this.map_mea.indexOf(e);
    }

    compute(fn){
        console.log("# Record",this.filename," - Computing :",fn);
        this.selected_electrodes.forEach((e) => {
            console.log("# Compute",fn,"for electrode #",e);
            if(fn == "spectrum") this.electrode(e).spectrum;
            if(fn == "raster") this.electrode(e).raster(this.path);
        });
        if(fn == "heatmap") this.heatmap();
    }

    heatmap(){
        if(this.electrodes.length < this.channels){
            this.allElectrodes();
        }

        var w = config.raster.width;
        var h = config.raster.height;

        const canvas = Canvas.createCanvas(w, h);
        const ctx = canvas.getContext('2d');
        ctx.fillStyle="black";
        ctx.fillRect(0,0,w,h);
        
        var mins = this.mins.slice();
        mins.shift();
        var supermin = Math.min(...mins);
        console.log(Math.min(...mins));
        this.mins.forEach((v,e) => {
            var k = this.map(e);
            var tx = v / supermin * 255;
            ctx.fillStyle=`rgb(0,0,${tx})`;
            var x = (k-1)%16 / 15;
            var y = Math.floor((k-1)/16)/16;
            ctx.fillRect(x * w,y*h,w/16,h/16);
        });
        canv2PNG(canvas, this.path, 'heatmap-min');

        const canvas2 = Canvas.createCanvas(w, h);
        const ctx2 = canvas2.getContext('2d');
        ctx2.fillStyle="black";
        ctx2.fillRect(0,0,w,h);
        
        var maxs = this.maxs.slice();
        maxs.shift();
        var supermax = Math.max(...maxs);
        console.log(Math.max(...maxs));
        this.maxs.forEach((v,k) => {
            var tx = v / supermax * 255;
            ctx2.fillStyle=`rgb(0,0,${tx})`;
            var x = (k-1)%16 / 15;
            var y = Math.floor((k-1)/16)/16;
            ctx2.fillRect(x * w,y*h,w/16,h/16);
        });
        canv2PNG(canvas2, this.path, 'heatmap-max');
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
    constructor(folderpath, electrodes = []) {
        this.folderpath = folderpath;
        this.electrodes = electrodes;
        this.records = [];
        console.log("Loading folder",folderpath,"with electrodes",electrodes);
        this.loadRecords();
        
    }

    saveFile(fn){
        var js = JSON.stringify(this);
        fs.writeFileSync(this.folderpath+`/spiker-${fn}.json`,js);
    }

    loadFile(fn){
        var electrodes = [];
        var js = JSON.parse(fs.readFileSync(this.folderpath+`/spiker-${fn}.json`,'utf8'));
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
    }

    computeRecords(fn){
        this.records.forEach((r) => {
            r.selected_electrodes = this.electrodes;
            console.log("Selected Electrodes",r.selected_electrodes);
            r.compute(fn);
        });
    }

    compute(fn){
        if(!fs.existsSync(this.folderpath+`/spiker-${fn}.json`) || !config.cache){
            this.computeRecords(fn);
            this.saveFile(fn);
        }
        else{
            console.log(`Load from spiker-${fn}.json`);
            this.loadFile(fn);
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

//Image
function canv2PNG(canvas, fpath, imgname){
    const ipath = path.dirname(fpath) + '\\' + path.basename(fpath).split('.')[0] + '-' + imgname + '.png';
    const output = fs.createWriteStream(ipath);
    const stream = canvas.createPNGStream();
    stream.pipe(output);
    output.on('finish', () =>  console.log('[PNG] ' + path.basename(ipath) + ' created'));
}



export { Electrode, Record, Experiment };