import { MEARecordFT } from './mearecordft.mjs';
import http from 'http';
import fs from 'fs';

var bigfilepath = process.argv[2];
var electrodeNumber = Number(process.argv[3] || 1);
var mear = new MEARecordFT(bigfilepath,electrodeNumber);

async function main() {
    await mear.load(-10);
    console.log('Server available http://localhost:8080/');
    http.createServer(function (req, res) {
        console.log(req.url);
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