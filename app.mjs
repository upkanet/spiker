import {MEARecord} from './mearecord.mjs';
import http from 'http';
import fs from 'fs';

var bigfilepath = process.argv[2];
var mear = new MEARecord(bigfilepath);

async function main(){
    await mear.load();
    console.log('Server available');
    http.createServer(function(req,res){
        console.log(req.url);
        if(req.url == '/'){
            var d = fs.readFileSync('index.htm', 'utf-8');
            res.write(d);
        }
        else if(req.url == '/favicon.ico'){
            var d = fs.readFileSync('favicon.ico');
            res.write(d);
        }
        else if(req.url.match(/^\/electrodes\/(?:([^\/]+?))\/?$/i)){
            var eid = req.url.match(/^\/electrodes\/(?:([^\/]+?))\/?$/i)[1];
            res.write(JSON.stringify(mear.electrodes[eid]));
        }
        res.end();
    }).listen(8080);
    
}

main();

