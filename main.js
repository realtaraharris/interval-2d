var fc = require('fc');
var center = require('ctx-translate-center')
var iadd = require('interval-add');
var isub = require('interval-subtract');
var imul = require('interval-multiply');

var circleRadius = [5000, 5000];
var side = 500;
var max = Math.max;

var scratch0 = [0, 0];
var scratch1 = [0, 0];
var scratchx = [0, 0];
var scratchy = [0, 0];
var circleOut = [0, 0];
function circle (x, y) {
  return isub(iadd(imul(x, x, scratch0), imul(y, y, scratch1), scratch0), circleRadius, circleOut);
}

function crossesZero (interval) {
  return (
    interval[0] === 0 ||
    interval[1] === 0 ||
    Math.sign(interval[0]) !== Math.sign(interval[1])
  );
}

function middle (l, u) {
  return (l + u) * 0.5;
}

function iset(out, l, u) {
  out[0] = l;
  out[1] = u;
}

function box (lx, ly, ux, uy, ctx, scale, depth) {
  var maxDepth = depth;
  var size = Math.max(ux - lx, uy - ly) * scale
  if (size < 1) return maxDepth;


  iset(scratchx, lx, ux);
  iset(scratchy, ly, uy);

  if (crossesZero(circle(scratchx, scratchy))) {
    var midx = middle(lx, ux);
    var midy = middle(ly, uy);

    ctx.strokeRect(lx, ly, (ux - lx), (uy - ly));

    iset(scratchx, midx, ux);
    iset(scratchy, midy, uy);
    if (crossesZero(circle(scratchx, scratchy))) { // upper-right
      maxDepth = max(maxDepth, box(midx, midy, ux, uy, ctx, scale, depth + 1));
    }

    iset(scratchx, lx, midx);
    iset(scratchy, midy, uy);
    if (crossesZero(circle(scratchx, scratchy))) { // upper-left
      maxDepth = max(maxDepth, box(lx, midy, midx, uy, ctx, scale, depth + 1));
    }

    iset(scratchx, lx, midx);
    iset(scratchy, ly, midy);
    if (crossesZero(circle(scratchx, scratchy))) { // lower-right
      maxDepth = max(maxDepth, box(lx, ly, midx, midy, ctx, scale, depth + 1));
    }

    iset(scratchx, midx, ux);
    iset(scratchy, ly, midy);
    if (crossesZero(circle(scratchx, scratchy))) { // lower-left
      maxDepth = max(maxDepth, box(midx, ly, ux, midy, ctx, scale, depth + 1));
    }
  }

  return maxDepth;
}

var mouse = { zoom: 1 }
window.addEventListener('mousewheel', function(e) {
  ctx.dirty();
  mouse.zoom += e.wheelDelta / 500;
  if (mouse.zoom < .1) {
    mouse.zoom = .1;
  }
  e.preventDefault();
})

var ctx = fc(function (dt) {
  ctx.clear('white');
  ctx.strokeStyle = 'rgba(45,100,200, 0.5)';
  center(ctx);
  ctx.scale(mouse.zoom, mouse.zoom)
  ctx.lineWidth = 1/mouse.zoom
  var sside = side / mouse.zoom;

  console.log('maxDepth:', box(-sside, -sside, sside, sside, ctx, mouse.zoom, 0));
}, false);
