var fc = require('fc');

var ctx = fc(function (dt) {
  ctx.beginPath();
  ctx.moveTo(0, 1);
  ctx.lineTo(10, 10);
  ctx.closePath();
  ctx.fillStyle = 'rgba(0, 0, 0, .1)';
  ctx.strokeStyle = 'black';
  ctx.stroke();
  ctx.fill();
}, false);
