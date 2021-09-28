var iadd = require('interval-add');
var isub = require('interval-subtract');
var imul = require('interval-multiply');
var imin = require('interval-min');

module.exports = evaluate

var max = Math.max;
var min = Math.min;
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

function iabs (i) {
  if (i[0] >= 0.0) {
    return i;
  } else if (i[1] <= 0.0) {
    return [-i[1], -i[0]];
  } else {
    return [0, Math.max(-i[0], i[1])];
  }
}

function imax (a, b) {
  if (a[1] <= b[0]) {
    return b;
  }

  if (a[0] <= b[0]) {
    if (b[0] <= a[1]) {
      if (a[1] <= b[1]) {
        return b;
      } else {
        return [b[0], a[1]];
      }
    }
  }

  if (b[1] <= a[0]) {
    return a;
  }

  if (b[0] <= a[0]) {
    if (a[0] <= b[1]) {
      if (b[1] <= a[1]) {
        return a;
      } else {
        return [a[0], b[1]];
      }
    }
  }
}

function iset(out, l, u) {
  out[0] = l;
  out[1] = u;
}

function ival(v) {
  return [v, v]
}

function ipowsmooth(a, b, k) {
  k = k || ival(8);
  a = ipow(a, k);
  b = ipow(b, k);
  return ipow(
    idiv(imul(a, b), iadd(a, b)),
    idiv(ival(1.0), k)
  );
}

function idiv(a, b) {
  var l = a[0] / b[0];
  var u = a[1] / b[1];
  return [min(l, u), max(l, u)]
}

function crossesZero (interval) {
  return 0 >= interval[0] && 0 <= interval[1];
}

function middle (l, u) {
  return (l + u) * 0.5;
}

function circle (x, y, r, translation) {
  var lx = [x[0] - translation[0], x[1] - translation[0]];
  var ly = [y[0] - translation[1], y[1] - translation[1]];

  return isub(ilen(lx, ly), r);
}

function rect (x, y, rx, ry, p) {
  return imax(
    isub(iabs(isub(x, ival(p[0]))), rx),
    isub(iabs(isub(y, ival(p[1]))), ry)
  );
}

function triangle (x, y, w, h, translation) {
  return imax(
    isub(
      imul(isub(x, h), isub(h, h)),
      imul(isub(y, h), isub(w, h))
    ),
    imax(
      isub(
        imul(isub(x, w), isub(w, h)),
        imul(isub(y, h), isub(h, w))
      ),
      isub(
        imul(isub(x, h), isub(h, w)),
        imul(isub(y, w), isub(h, h))
      )
    )
  );
}

function opicut(a, b) {
  var la = -a[0];
  var ua = -a[1];
  return imax(
    [min(la, ua), max(la, ua)],
    b
  )
}

function evaluateScene (inputShapes, x, y, translation, outFilteredShapes) {
  var l = inputShapes.length;
  var r = ival(1);
  for (var i=0; i<l; i++) {
    var c = inputShapes[i];
    var distanceInterval = circle(x, y, ival(c[2]), [
      translation[0] + c[0],
      translation[1] + c[1]
    ]);

    if (crossesZero(distanceInterval)) {
      outFilteredShapes.push(c)
    }

    imin(distanceInterval, r, r);
  }
  return r;
}

var scratchx = [0, 0];
var scratchy = [0, 0];
function evaluate(inputShapes, translation, lx, ly, ux, uy, addQuad, scale, depth) {
  var maxDepth = depth;
  var size = Math.max(ux - lx, uy - ly) * scale

  if (size < 1) {
    return maxDepth;
  }

  var midx = middle(lx, ux);
  var midy = middle(ly, uy);
  var r;

  iset(scratchx, midx, ux);
  iset(scratchy, midy, uy);

  var upperRightShapes = []
  r = evaluateScene(inputShapes, scratchx, scratchy, translation, upperRightShapes);
  if (crossesZero(r)) { // upper-right
    addQuad(r, scratchx, scratchy, upperRightShapes, scale);
    maxDepth = max(maxDepth,
      evaluate(upperRightShapes, translation, midx, midy, ux, uy, addQuad, scale, depth + 1, evaluateScene)
    );
  }

  iset(scratchx, lx, midx);
  iset(scratchy, midy, uy);
  var upperLeftShapes = []
  r = evaluateScene(inputShapes, scratchx, scratchy, translation, upperLeftShapes);
  if (crossesZero(r)) { // upper-left
    addQuad(r, scratchx, scratchy, upperLeftShapes, scale);
    maxDepth = max(maxDepth,
      evaluate(upperLeftShapes, translation, lx, midy, midx, uy, addQuad, scale, depth + 1, evaluateScene)
    );
  }
  iset(scratchx, lx, midx);
  iset(scratchy, ly, midy);
  var lowerRightShapes = [];
  r = evaluateScene(inputShapes, scratchx, scratchy, translation, lowerRightShapes);
  if (crossesZero(r)) { // lower-right
    addQuad(r, scratchx, scratchy, lowerRightShapes, scale);
    maxDepth = max(maxDepth,
      evaluate(lowerRightShapes, translation, lx, ly, midx, midy, addQuad, scale, depth + 1, evaluateScene)
    );
  }

  iset(scratchx, midx, ux);
  iset(scratchy, ly, midy);
  var lowerLeftShapes = [];
  r = evaluateScene(inputShapes, scratchx, scratchy, translation, lowerLeftShapes);
  if (crossesZero(r)) { // lower-left
    addQuad(r, scratchx, scratchy, lowerLeftShapes, scale);
    maxDepth = max(maxDepth,
      evaluate(lowerLeftShapes, translation, midx, ly, ux, midy, addQuad, scale, depth + 1, evaluateScene)
    );
  }

  return maxDepth;
}
