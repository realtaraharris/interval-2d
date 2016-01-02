var fc = require('fc');
var iadd = require('interval-add');
var isub = require('interval-subtract');
var imul = require('interval-multiply');

var maxDepth = 9;

function circle (x, y) {
  return isub(iadd(imul(x, x), imul(y, y)), [1000,1000]);
}

function crossesZero (interval) {
  return (
    interval[0] === 0 ||
    interval[1] === 0 ||
    Math.sign(interval[0]) !== Math.sign(interval[1])
  );
}

function middle (interval) {
  return (interval[0] + interval[1]) / 2;
}

function box (lx, ly, ux, uy, ctx, depth) {
  if (depth > maxDepth) return;

  var tmp = circle([lx, ux], [ly, uy]);
  if (crossesZero(tmp)) {
    var midx = middle([lx, ux]);
    var midy = middle([ly, uy]);

    //if (depth > maxDepth - 1) {
    if (depth > 0) {
      ctx.strokeStyle = 'rgba(45,100,200, 0.01);';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.01);';

      ctx.rect(lx, ly, (ux - lx), (uy - ly));
      ctx.stroke();
      ctx.fill();
    }

    if (crossesZero(circle([midx, ux], [midy, uy]))) { // upper-right
      box(midx, midy, ux, uy, ctx, depth + 1);
    }

    if (crossesZero(circle([lx, midx], [midy, uy]))) { // upper-left
      box(lx, midy, midx, uy, ctx, depth + 1);
    }

    if (crossesZero(circle([lx, midx], [ly, midy]))) { // lower-right
      box(lx, ly, midx, midy, ctx, depth + 1);
    }

    if (crossesZero(circle([midx, ux], [ly, midy]))) { // lower-left
      box(midx, ly, ux, midy, ctx, depth + 1);
    }
  }
}

var ctx = fc(function (dt) {
  var side = 500;

  ctx.translate(side, side);
  box(-side, -side, side, side, ctx, 0);
}, false);
