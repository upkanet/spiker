import { MEARecordFT } from './mearecordft.mjs';
import http from 'http';
import fs from 'fs';
import open from 'open';

var config = JSON.parse(fs.readFileSync('config.json','utf-8'));

var bigfilepath = (process.argv[2] || "data-test/sin.txt");
var mear = new MEARecordFT(bigfilepath,config.electrode_number);

async function main() {
    await mear.load();
    console.log('Server available','http://localhost:8080/');
    open('http://localhost:8080/');
    http.createServer(function (req, res) {
        if(config.verbose_server){
            console.log('\x1b[36m%s\x1b[0m',req.url);
        }
        try {
            if (req.url == '/') {
                var d = fs.readFileSync('ft.htm', 'utf-8');
                res.write(d);
            }
            else if (req.url == '/favicon.ico') {
                var d = fs.readFileSync(req.url.substr(1));
                res.write(d);
            }
            else if (req.url == '/data') {
                res.write(JSON.stringify(mear.electrodeWorkingData));
            }
            else if (req.url == '/spectrum') {
                res.write(JSON.stringify(mear.electrodeSpectrum));
            }
            else if (req.url == '/period') {
                res.write(JSON.stringify(mear.timeperiod));
            }
            else {
                var d = fs.readFileSync(req.url.substr(1), 'utf-8');
                res.write(d);
            }
        } catch (err) {
            res.write('error');
        }
        res.end();
    }).listen(8080);
}

main();