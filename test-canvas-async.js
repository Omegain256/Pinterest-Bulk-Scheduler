import { createCanvas } from '@napi-rs/canvas';
const canvas = createCanvas(100, 100);
const ctx = canvas.getContext('2d');
ctx.fillStyle = 'red';
ctx.fillRect(0, 0, 100, 100);
const buf = canvas.toBuffer('image/png');
console.log("Type of buf:", toString.call(buf));
console.log("Is Promise?", buf instanceof Promise);
console.log("Is Buffer?", Buffer.isBuffer(buf));
