import BinaryParser from 'binary-buffer-parser';

class Record {
    constructor(path) {
        this.path = path;
        this.sample_rate;
        this.ADC_zero;
        this.El;
        this.channels = 0;
        this.data = [];
        this.header();
    }

    header(){
        const start = Date.now();
        const fileParser = new BinaryParser();
        fileParser.open(this.path);
    
        //Header
        console.log("Header");
        var header = fileParser.string0();
        header = header.split('\n');
        this.sample_rate = Number(header[3].substr(14));
        this.ADC_zero = Number(header[4].substr(11));
        this.El = Number(header[5].substr(5, 6));
        this.channels = header[6].split(';').length;
        console.log(Date.now() - start, "ms");
    }

    electrode(electrode = 1, lastSeconds = -1){
        const start = Date.now();
        const fileParser = new BinaryParser();
        fileParser.open(this.path);

        //Data
        console.log("Electrode",electrode);
        fileParser.seek(1875);
        var a = [];
        while(!fileParser.eof()){
            for (var i = 0; i < this.channels; i++) {
                if(i == electrode - 1){
                    var v = fileParser.int16();
                    v = Math.round(v * this.El * 100) / 100;
                    a.push(v);
                }
                else{
                    fileParser.skip(2);
                }
            }
        }
        fileParser.close();
        console.log(Date.now() - start, "ms");

        //Keep lastSeconds
        if(lastSeconds > 0){
            var lastSamples = lastSeconds * this.sample_rate;
            var firstKeep = a.length - lastSamples;
            var b = [];
            a.forEach((e,i) => {
                if(i>=firstKeep){
                    b.push(e);
                }
            });
            a = b;
        }

        return a;
    }

    electrodes(eArr = [1]){
        eArr.forEach((e) => {
            this.data[e] = electrode(e);
        });
    }

    load(){
        const start = Date.now();
        const fileParser = new BinaryParser();
        fileParser.open(this.path);

        //Data
        fileParser.seek(1875);
        var k = 0;
        while(!fileParser.eof()){
            var a = [];
            for (var i = 0; i < this.channels; i++) {
                var v = fileParser.int16();
                v = Math.round(v * this.El * 100) / 100;
                a.push(v);
            }
            if(k == 20000) console.log(k/this.sample_rate, "sec in ", Date.now() - start, "ms");
            this.data.push(a);
            k++;
        }
        fileParser.close();
    }

    maxElectrode(electrode = 1){
        var max = 0;
        this.electrode(electrode).forEach((v) => {
            if(v > max) max = v;
        });
        return max;
    }

    minElectrode(electrode = 1){
        var min = 0;
        this.electrode(electrode).forEach((v) => {
            if(v < min) min = v;
        });
        return min;
    }

}

export { Record };