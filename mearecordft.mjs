import fs from 'fs';
import readline from 'readline';
import stream from 'stream';
import { complex, pi, sin, cos, add, multiply, rightArithShift } from 'mathjs';
var outstream = new stream;
var config = JSON.parse(fs.readFileSync('config.json','utf-8'));

class MEARecordFT {
    constructor(bigfilepath, electrodeNumber) {
        this.bigfile = {
            path: bigfilepath,
            length: 0
        };
        this.electrodeNumber = electrodeNumber;
        this.t0 = new Date().getTime();
        this.linecount = 0;
        this.electrodeData = [];
        this.electrodeSimplifiedData = [];
        this.electrodeWorkingData = [];
        this.electrodeSpectrum = [];
        this.period = 0;
        this.speriod = 0;
        this.unitsTab = {'s': 0, 'ms': -3, 'µs': -6};
        this.units = config.units;
    }

    async load() {
        console.log("Axorus MEARecord Fourrier Transform");
        console.log("File :",this.bigfile.path);
        //Extract electrode data, vector size and period
        [this.linecount, this.period, this.electrodeData] = await this.electrodeDataGen();
        this.timer();
        console.log("Vector",this.linecount,"points","| Sampling",Math.round(1/this.period),"Hz");
        //Cut threshold
        this.cut(config.threshold.value);
        //Simplify data
        this.simplify();
        this.electrodeWorkingData = this.electrodeSimplifiedData;
        this.timer();
        //Analyze spectrum
        this.spectrum();
        this.timer();
        //Get top frequencies
        this.topfrequencies();
        this.timer();
    }

    async electrodeDataGen(){
        console.log("Electrode",this.electrodeNumber);
        var instream = fs.createReadStream(this.bigfile.path);
        var rl = readline.createInterface(instream, outstream);
        var linecount = 0;
        var period = 0;
        var eData = [];
        var eNumber = this.electrodeNumber;
        
        rl.on('line', function (line) {
            if(linecount > 3){
                var mline = line.split("\t");
                eData.push(Number(mline[eNumber]));
                //period
                if(linecount == 4){
                    period = Number(mline[0]);
                }
                if(linecount == 5){
                    period = Math.round((Number(mline[0]) - period)*100000)/100000;
                }
            }
            linecount++;
        });

        return new Promise(resolve => {
            rl.on('close', function () {
                resolve([linecount, period, eData]);
            });
        });
    }

    simplify(){
        var pace = config.simplification_rate;
        this.speriod = this.period * pace;
        console.log("Simplification : one every",pace,"values");
        if(pace>1){
            var i = 0;
            var s = 0;
            while(this.electrodeData.length){
                s += this.electrodeData.shift();
                i++
                if(i==pace){
                    this.electrodeSimplifiedData.push(Math.round(s/pace*100)/100);
                    s = 0;
                    i = 0;
                }
            }
        }
        else{
            this.electrodeSimplifiedData = this.electrodeData;
        }
    }

    cut(){
        if(config.threshold.active){
            var threshold = config.threshold.value;
            console.log("Cut at",threshold);
    
            var comparator = {
                '>': function(x,y) {return x > y},
                '<': function(x,y) {return x < y}
            }
    
            for(var i = 0; i < this.electrodeData.length; i++){
                var v = this.electrodeData[i];
                if(comparator[config.threshold.direction](v,threshold)){
                    this.electrodeData[i] = 0;
                }
            }
        }
    }

    timer(verbose = true){
        var t = (new Date().getTime() - this.t0) / 1000;
        if(verbose && config.timer){
            console.log(t, ' sec.');
        }
        else{
            return t + ' sec.';
        }
    }

    get timeperiod(){
        return this.speriod * Math.pow(10,this.unitsTab[this.units]);
    }

    Xk(k){
        var N = this.electrodeWorkingData.length;
        var s = complex(0,0);
        for(var n=0; n < N; n++){
            var bn = -2*pi*k*n/N;
            var xn = this.electrodeWorkingData[n];
            //console.log("b"+n,bn);
            //console.log("x"+n,xn);
            var sn = multiply(xn,complex(cos(bn),sin(bn)));
            //console.log("s"+n,sn);
            s = add(s,sn);
        }
        return s;
    }

    spectrum(){
        var N = this.electrodeWorkingData.length;
        console.log("Spectrum Analysis on",Math.round(N/2), "values");
        for(var k=0;k<N/2;k++){
            if(k%100 == 0){
                updateConsole(k+" / "+Math.round(N/2)+" - "+this.timer(false));
            }
            var magk = this.Xk(k).abs();
            this.electrodeSpectrum.push(magk);
        }
        process.stdout.write("\n");
    }

    topfrequencies(verbose = true){
        var eS = this.electrodeSpectrum.slice();
        var top_size = config.top_frequencies;
        var top_values = [];
        for(var i = 0; i < top_size;i++){
            var m = getMaxArray(eS);
            var p = eS.indexOf(m);
            eS.splice(p,1);
            top_values.push(this.electrodeSpectrum.indexOf(m));
        }
        var N = this.electrodeSpectrum.length;
        var period = this.timeperiod;
        console.log("Top Frequencies",top_values.map(k => Math.round(k  / (2 * N * period) * 100) / 100 + "Hz"));
        return top_values;
    }

}

function updateConsole(txt){
    process.stdout.clearLine();
    process.stdout.cursorTo(0);
    process.stdout.write('\x1b[36m'+txt+'\x1b[0m');
}

function getMaxArray(a) {
    return Math.max.apply(null, a);
}

export { MEARecordFT };