var fc = require('fc');
var center = require('ctx-translate-center')
var iadd = require('interval-add');
var isub = require('interval-subtract');
var imul = require('interval-multiply');
var imax = require('interval-max');

var circleRadius = [500, 500];
var side = 500;
var max = Math.max;

var scratch0 = [0, 0];
var scratch1 = [0, 0];
var scratchx = [0, 0];
var scratchy = [0, 0];
var circleOut = [0, 0];
function circle (x, y, translation) {
  var lx = [x[0] - translation[0], x[1] - translation[0]];
  var ly = [y[0] - translation[1], y[1] - translation[1]];

  return isub(iadd(imul(lx, lx, scratch0), imul(ly, ly, scratch1), scratch0), circleRadius, circleOut);
}

var scsq = [0, 0];
function square (x, y) {
  imax(iabs(x), iabs(y), scsq);

  //return isub(scsq, [500, 500]);
  return isub(scsq, circleRadius, circleOut);
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

function iabs (interval) {
  return [ Math.abs(interval[0]), Math.abs(interval[1]) ];
}

function box (translation, lx, ly, ux, uy, ctx, scale, depth, fn) {
  var maxDepth = depth;
  var size = Math.max(ux - lx, uy - ly) * scale
  if (size < 1) return maxDepth;

  iset(scratchx, lx, ux);
  iset(scratchy, ly, uy);

  if (crossesZero(fn(scratchx, scratchy, translation))) {
    var midx = middle(lx, ux);
    var midy = middle(ly, uy);

    ctx.strokeRect(lx, ly, (ux - lx), (uy - ly));

    iset(scratchx, midx, ux);
    iset(scratchy, midy, uy);
    if (crossesZero(fn(scratchx, scratchy, translation))) { // upper-right
      maxDepth = max(maxDepth, box(translation, midx, midy, ux, uy, ctx, scale, depth + 1, fn));
    }

    iset(scratchx, lx, midx);
    iset(scratchy, midy, uy);
    if (crossesZero(fn(scratchx, scratchy, translation))) { // upper-left
      maxDepth = max(maxDepth, box(translation, lx, midy, midx, uy, ctx, scale, depth + 1, fn));
    }

    iset(scratchx, lx, midx);
    iset(scratchy, ly, midy);
    if (crossesZero(fn(scratchx, scratchy, translation))) { // lower-right
      maxDepth = max(maxDepth, box(translation, lx, ly, midx, midy, ctx, scale, depth + 1, fn));
    }

    iset(scratchx, midx, ux);
    iset(scratchy, ly, midy);
    if (crossesZero(fn(scratchx, scratchy, translation))) { // lower-left
      maxDepth = max(maxDepth, box(translation, midx, ly, ux, midy, ctx, scale, depth + 1, fn));
    }
  }

  return maxDepth;
}

var mouse = { zoom: 1, down: false, translate: [0, 0] }
window.addEventListener('mousewheel', function(e) {
  ctx.dirty();
  mouse.zoom += e.wheelDelta / 500;
  if (mouse.zoom < .1) {
    mouse.zoom = .1;
  }
  e.preventDefault();
})

window.addEventListener('mousedown', function(e) { mouse.down = [e.clientX, e.clientY]; })
window.addEventListener('mouseup', function(e) { mouse.down = false; })
window.addEventListener('mousemove', function(e) {
  if (mouse.down) {
    mouse.translate[0] += (e.clientX - mouse.down[0])
    mouse.translate[1] += (e.clientY - mouse.down[1])
    mouse.down[0] = e.clientX;
    mouse.down[1] = e.clientY;
    ctx.dirty()
  }
})

var translation = [0, 0]
var ctx = fc(function (dt) {
  ctx.clear('white');
  ctx.strokeStyle = 'rgba(45,100,200, 0.5)';
  center(ctx);
  // ctx.translate(mouse.translate[0], mouse.translate[1]);
  ctx.scale(mouse.zoom, mouse.zoom)
  ctx.lineWidth = 1/mouse.zoom

  translation[0] = mouse.translate[0] / mouse.zoom;
  translation[1] = mouse.translate[1] / mouse.zoom;

  var maspect = max(ctx.canvas.height, ctx.canvas.width);
  var hw = (maspect / 2) / mouse.zoom;
  var hh = (maspect / 2) / mouse.zoom;

  var cx = mouse.translate[0];
  var cy = mouse.translate[1];

  var lx = -hw;
  var ly = -hh;
  var ux =  hw;
  var uy =  hh;

  console.log('maxDepth:', box(translation, lx, ly, ux, uy, ctx, mouse.zoom, 0, circle));

  ctx.strokeStyle = "#f0f"
  ctx.strokeRect(lx, ly, ux - lx, uy - ly);
}, false);
