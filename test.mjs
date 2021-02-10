import {Record} from './record.mjs';

var r = new Record('data/10007.raw');

var x = r.electrode(2);
console.log(x);

