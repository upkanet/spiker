import BinaryParser from 'binary-buffer-parser';

class Record {
    constructor(path) {
        this.path = path;
        this.sample_rate;
        this.ADC_zero;
        this.El;
        this.channels = 0;
    }

    electrode(electrode = 1){
        const start = Date.now();
        const fileParser = new BinaryParser();
        fileParser.open(this.path);

        //Header
        var header = fileParser.string0();
        header = header.split('\n');
        this.sample_rate = Number(header[3].substr(14));
        this.ADC_zero = Number(header[4].substr(11));
        this.El = Number(header[5].substr(5, 6));
        this.channels = header[6].split(';').length;
        console.log(Date.now() - start, "ms");

        //Data
        console.log(electrode);
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
        return a;
    }

}

export { Record };