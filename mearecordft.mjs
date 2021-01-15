import fs from 'fs';
import readline from 'readline';
import stream from 'stream';
import { complex, pi, sin, cos, add, multiply, rightArithShift } from 'mathjs';
import { config } from './config.mjs';
var outstream = new stream;

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
        this.units = 's';
        this.simp = true;
    }

    async load(threshold = null) {
        console.log("MEARecord Fourrier Transform");
        console.log(this.bigfile.path);
        console.log("Electrode #"+this.electrodeNumber);
        [this.linecount, this.period, this.electrodeData] = await this.electrodeDataGen();
        console.log(this.timer);
        console.log(this.linecount+" points","Sampling "+Math.round(1/this.timeperiod)+"Hz");
        if(threshold){
            this.cut(threshold);
        }
        if(this.simp){
            console.log("Simplification");
            this.simplify();
            this.electrodeWorkingData = this.electrodeSimplifiedData;
        }
        else{
            this.electrodeWorkingData = this.electrodeData;
        }
        console.log(this.timer);
        console.log("DFT");
        this.spectrum();
        console.log(this.timer);
    }

    async electrodeDataGen(){
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
        var pace = 4;
        this.speriod = this.period * pace;
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

    cut(threshold){
        console.log("Cut at "+threshold);
        for(var i = 0; i < this.electrodeData.length; i++){
            var v = this.electrodeData[i];
            if(v>threshold){
                this.electrodeData[i] = 0;
            }
        }
    }

    get timer(){
        return (new Date().getTime() - this.t0) / 1000 + ' sec.';
    }

    get timeperiod(){
        if(this.simp){
            return this.speriod * Math.pow(10,this.unitsTab[this.units]);
        }
        else{
            return this.period * Math.pow(10,this.unitsTab[this.units]);
        }
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
        console.log(N, "values");
        for(var k=0;k<N/2;k++){
            if(k%100 == 0){
                console.log(k, this.timer);
            }
            var magk = this.Xk(k).abs();
            this.electrodeSpectrum.push(magk);
        }
    }

}

export { MEARecordFT };