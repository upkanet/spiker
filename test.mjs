import {Record} from './record.mjs';

var r = new Record('data/20007.raw');

var x;

x = r.electrode(1);
console.log(x.length);
x = r.electrode(1,1);
console.log(x.length);
x = r.electrode(1,2);
console.log(x.length);

