import { MEARecord } from './mearecord.mjs';
import http from 'http';
import fs from 'fs';
import path from 'path';

var bigfilepath = process.argv[2];
var mear = new MEARecord(bigfilepath);

async function main() {
    await mear.load();
    console.log('Server available');
    http.createServer(function (req, res) {
        console.log(req.url);
        try {
            if (req.url == '/') {
                var d = fs.readFileSync('index.htm', 'utf-8');
                res.write(d);
            }
            else if (req.url == '/favicon.ico') {
                var d = fs.readFileSync(req.url.substr(1));
                res.write(d);
            }
            else if (req.url.match(/^\/electrodes\/(?:([^\/]+?))\/?$/i)) {
                var eid = req.url.match(/^\/electrodes\/(?:([^\/]+?))\/?$/i)[1];
                res.write(JSON.stringify(mear.electrodes[eid]));
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

