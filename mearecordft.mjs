import fs from 'fs';
import readline from 'readline';
import stream from 'stream';
import { complex, pi, sin, cos, add, multiply } from 'mathjs'
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
        this.electrodeSpectrum = [];
        this.period = 0;
        this.unitsTab = {'ms': -3, 'µs': -6};
        this.units = 'µs';
    }

    async load() {
        console.log("MEARecord Fourrier Transform");
        console.log(this.bigfile.path);
        console.log("Electrode #"+this.electrodeNumber);
        [this.linecount, this.period, this.electrodeData] = await this.electrodeDataGen();
        console.log(this.timer);
        console.log(this.linecount+" points","period "+this.timeperiod);
        console.log("Simplification");
        this.simplify();
        console.log(this.timer);
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
                    period = Math.round((Number(mline[0]) - period)*100)/100;
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
        var pace = Math.round(this.linecount/10000);
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

    get timer(){
        return (new Date().getTime() - this.t0) / 1000 + ' sec.';
    }

    get timeperiod(){
        return this.period * Math.pow(10,this.unitsTab[this.units]);
    }

    Xk(k){
        var N = this.electrodeSimplifiedData.length;
        var s = complex(0,0);
        for(var n=0; n < N; n++){
            var bn = -2*pi*k*n/N;
            var xn = this.electrodeSimplifiedData[n];
            //console.log("b"+n,bn);
            //console.log("x"+n,xn);
            var sn = multiply(xn,complex(cos(bn),sin(bn)));
            //console.log("s"+n,sn);
            s = add(s,sn);
        }
        return s;
    }

    spectrum(){
        var N = this.electrodeSimplifiedData.length;
        console.log(N);
        for(var k=0;k<N/10;k++){
            //console.log(k, this.timer);
            var magk = this.Xk(k).abs();
            this.electrodeSpectrum.push(magk);
        }
    }

}

export { MEARecordFT };