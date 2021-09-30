var iadd = require('interval-add');
var isub = require('interval-subtract');
var imul = require('interval-multiply');
var imin = require('interval-min');
var imax = require('interval-max');
var idiv = require('interval-divide')

module.exports = evaluate

var max = Math.max;
var min = Math.min;
function isqr(a, out) {
  out = out || []
  if (a[0]>=0.0) {
    out[0] = a[0] * a[0]
    out[1] = a[1] * a[1]
  } else if (a[1] < 0.0) {
    out[0] = a[1] * a[1]
    out[1] = a[0] * a[0]
  } else {
    out[0] = 0.0
    out[1] = Math.max(a[0]*a[0], a[1]*a[1])
  }
  return out
}

var ilensq_a = ival(0)
var ilensq_b = ival(0)
function ilensq(a, b, out) {
  var pa = isqr(a, ilensq_a)
  var pb = isqr(b, ilensq_b)

  out[0] = pa[0] + pb[0]
  out[1] = pa[1] + pb[1]
  return out
}

function isqrt(a, out) {
  out[0] = Math.sqrt(a[0])
  out[1] = Math.sqrt(a[1])
  return out
}


var ilen_a = ival(0);
var ilen_b = ival(0);
function ilen(a, b, out) {
  var pa = isqr(a, ilen_a);
  var pb = isqr(b, ilen_b);
  pa[0] += pb[0],
  pa[1] += pb[1]
  return isqrt(pa, pb, out)
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

function crossesZero (interval) {
  return 0 >= interval[0] && 0 <= interval[1];
}

function middle (l, u) {
  return (l + u) * 0.5;
}

var circle_x = ival(0)
var circle_y = ival(0)
var circle_a = ival(0)
function circle (x, y, radius, translation, out) {
  circle_x[0] = x[0] - translation[0]
  circle_x[1] = x[1] - translation[0]
  circle_y[0] = y[0] - translation[1]
  circle_y[1] = y[1] - translation[1]

  return isub(
    ilen(circle_x, circle_y, circle_a),
    radius,
    out
  );
}

function rect (x, y, rx, ry, p) {
  return imax(
    isub(iabs(isub(x, ival(p[0]))), rx),
    isub(iabs(isub(y, ival(p[1]))), ry)
  );
}

function inegate(a, out) {
  out[0] = -a[0]
  out[1] = -a[1]
  return out;
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

var opicut_a =  ival(0)
function opicut(a, b, out) {
  var la = -a[0];
  var ua = -a[1];

  opicut_a[0] = Math.min(la, ua)
  opicut_a[1] = Math.max(la, ua)

  return imax(
    opicut_a,
    b,
    out
  )
}


var soft0 = ival(0);
var softE = ival(0);
var soft1 = ival(0);
var soft2 = ival(0);
var softR = ival(0);
var softZero = ival(0);
var softQuarter = ival(0.25)

function simin(a, b, r, out) {
  iset(softR, r, r)

  // var e = max(r - abs(a - b), 0);
  imax(
    isub(
      softR,
      iabs(
        isub(a, b, soft1),
        soft0
      ),
      soft1
    ),
    softZero,
    softE
  )

  // return min(a, b) - e*e*0.25/r;
  return isub(
    imin(a, b, soft0),
    imul(
      isqr(softE, softE),
      idiv(softQuarter, softR, soft1),
      soft2
    ),
    out
  )
}


function inegate(a, out) {
  var la = -a[0]
  var ua = -a[1]
  out[0] = ua;//Math.min(la, ua)
  out[1] = la//Math.max(la, ua)
  return out
}


var eval_translation = ival(0)
var eval_local_distance = ival(0)
var eval_circle_r = ival(0)
var eval_cut = ival(0)
function evaluateScene (inputOps, x, y, translation, outFilteredOps, outDistance) {
  var l = inputOps.length;
  outDistance[0] = 1000;
  outDistance[1] = 1000;

  for (var i=0; i<l; i++) {
    var c = inputOps[i];
    eval_translation[0] = translation[0] + c[0]
    eval_translation[1] = translation[1] + c[1]

    eval_circle_r[0] = c[2]
    eval_circle_r[1] = c[2]
    circle(x, y, eval_circle_r, eval_translation, eval_local_distance);

    // Note: for cut to work the op must be included if the test interval
    //       is inside (crossing or fully internal)
    if (eval_local_distance[0] < 0) {
      outFilteredOps.push(c)
    }

    if (!c[3]) {
      imin(eval_local_distance, outDistance, outDistance);
    } else {
      imax(
        inegate(eval_local_distance, eval_cut),
        outDistance,
        outDistance
      )
    }
  }
  return outDistance;
}

var scratchx = [0, 0];
var scratchy = [0, 0];
var scrachDistance = [0, 0];
function evaluate(inputShapes, translation, lx, ly, ux, uy, addQuad, scale, depth) {
  var maxDepth = depth;
  var size = Math.max(ux - lx, uy - ly) * scale

  if (size < 1) {
    return maxDepth;
  }

  var midx = middle(lx, ux);
  var midy = middle(ly, uy);


  iset(scratchx, midx, ux);
  iset(scratchy, midy, uy);

  var upperRightShapes = []
  evaluateScene(inputShapes, scratchx, scratchy, translation, upperRightShapes, scrachDistance);
  if (crossesZero(scrachDistance)) { // upper-right
    addQuad(scrachDistance, scratchx, scratchy, upperRightShapes, scale);
    maxDepth = max(maxDepth,
      evaluate(upperRightShapes, translation, midx, midy, ux, uy, addQuad, scale, depth + 1, evaluateScene)
    );
  }

  iset(scratchx, lx, midx);
  iset(scratchy, midy, uy);
  var upperLeftShapes = []
  evaluateScene(inputShapes, scratchx, scratchy, translation, upperLeftShapes, scrachDistance);
  if (crossesZero(scrachDistance)) { // upper-left
    addQuad(scrachDistance, scratchx, scratchy, upperLeftShapes, scale);
    maxDepth = max(maxDepth,
      evaluate(upperLeftShapes, translation, lx, midy, midx, uy, addQuad, scale, depth + 1, evaluateScene)
    );
  }
  iset(scratchx, lx, midx);
  iset(scratchy, ly, midy);
  var lowerRightShapes = [];
  evaluateScene(inputShapes, scratchx, scratchy, translation, lowerRightShapes, scrachDistance);
  if (crossesZero(scrachDistance)) { // lower-right
    addQuad(scrachDistance, scratchx, scratchy, lowerRightShapes, scale);
    maxDepth = max(maxDepth,
      evaluate(lowerRightShapes, translation, lx, ly, midx, midy, addQuad, scale, depth + 1, evaluateScene)
    );
  }

  iset(scratchx, midx, ux);
  iset(scratchy, ly, midy);
  var lowerLeftShapes = [];
  evaluateScene(inputShapes, scratchx, scratchy, translation, lowerLeftShapes, scrachDistance);
  if (crossesZero(scrachDistance)) { // lower-left
    addQuad(scrachDistance, scratchx, scratchy, lowerLeftShapes, scale);
    maxDepth = max(maxDepth,
      evaluate(lowerLeftShapes, translation, midx, ly, ux, midy, addQuad, scale, depth + 1, evaluateScene)
    );
  }

  return maxDepth;
}
