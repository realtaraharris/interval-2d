var fc = require('fc');
var center = require('ctx-translate-center')
var iadd = require('interval-add');
var isub = require('interval-subtract');
var imul = require('interval-multiply');
var imax = require('interval-max');
var imin = require('interval-min');

var circleRadius = [500, 500];
var side = 500;
var max = Math.max;
var min = Math.min;

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

function isqr(a) {
  if (a[0]>=0.0) {
    return [a[0] * a[0], a[1] * a[1]]
  } else if (a[1] < 0.0) {
    return [a[1] * a[1], a[0] * a[0]]
  } else {
    return [0.0, max(a[0]*a[0], a[1]*a[1])]
  }
}

function ilensq(a, b) {
  var pa = isqr(a)
  var pb = isqr(b)

  return [pa[0] + pb[0], pa[1] + pb[1]]
}

function isqrt(a) {
  return [Math.sqrt(a[0]), Math.sqrt(a[1])];
}

function ilen(a, b) {
  var pa = isqr(a);
  var pb = isqr(b);
  return isqrt([
    pa[0] + pb[0],
    pa[1] + pb[1]
  ])
}

function circle2 (x, y, r, translation) {
  var radius = [r, r];
  var lx = [x[0] - translation[0], x[1] - translation[0]];
  var ly = [y[0] - translation[1], y[1] - translation[1]];

  return isub(ilensq(lx, ly), radius);
}

function rect (x, y, w, h, translation) {
  var width = [w, w];
  var height = [h, h];

  var lx = [x[0] - translation[0], x[1] - translation[0]];
  var ly = [y[0] - translation[1], y[1] - translation[1]];

  return imax(isub(iabs(lx), width), isub(iabs(ly), height));
}

function rect2 (x, y, w, h, translation) {
  var width = [w, w];
  var height = [h, h];

  var lx = [x[0] - translation[0], x[1] - translation[0]];
  var ly = [y[0] - translation[1], y[1] - translation[1]];

  var f = imax(isub(lx, width), isub(ly, height));
  var g = imin(iadd(lx, width), iadd(ly, height));

  if (f[0] > 0 || f[1] < -(w*2)) { return [1,1] }
  if (g[0] > (h*2) || g[1] < 0) { return [1,1] }

  return imul(f,g);
}

function crossesZero (interval) {
  return 0 >= interval[0] && 0 < interval[1];
}

function middle (l, u) {
  return (l + u) * 0.5;
}

function iset(out, l, u) {
  out[0] = l;
  out[1] = u;
}

function opicut(a, b) {
  var la = -a[0];
  var ua = -a[1];
  return imax(
    [min(la, ua), max(la, ua)],
    b
  )
}

function iabs (interval) {
  var l = Math.abs(interval[0])
  var u = Math.abs(interval[1])

  return [min(l, u), max(l, u)];
}

function box (translation, lx, ly, ux, uy, ctx, scale, depth, fn) {
  var maxDepth = depth;
  var size = Math.max(ux - lx, uy - ly) * scale
  if (size < 1) return maxDepth;

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
  ctx.clear('black');
  ctx.strokeStyle = 'rgba(255,5,5, 0.25)';
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

  console.log('maxDepth:', box(translation, lx, ly, ux, uy, ctx, mouse.zoom, 0, function(x, y, translation) {
    // return rect2(x, y, 75, 50, [translation[0] -25, translation[1] -25])
    return imin(
      imin(
        imax(
          imul(circle2(x, y, 1000, [translation[0] + 50, translation[1] - 10]), [-1, -1]),
          circle2(x, y, 2000, [translation[0] + 50, translation[1] - 10])
        ),
        circle2(x, y, 8000, [translation[0] + 15, translation[1] - 70])
      ),
      rect2(x, y, 200, 10, [translation[0], translation[1]])
    )
  }));

  ctx.strokeStyle = "#f0f"
  ctx.strokeRect(lx, ly, ux - lx, uy - ly);
}, false);
