var fc = require('fc');
var center = require('ctx-translate-center')
var iadd = require('interval-add');
var isub = require('interval-subtract');
var imul = require('interval-multiply');
var imin = require('interval-min');

const regl = require('regl')()
const mat4 = require('gl-mat4')

var max = Math.max;
var min = Math.min;
const viewport = [0,0];

const MAX_OPS = (1<<21);
const evaluatorContext = {
  points: [],
  pointBuffer: regl.buffer({
    length: MAX_OPS * 2,
    usage: "dynamic",
    type: "float"
  }),

  reset() {
    this.points.length = 0;
  },

  addPoint(x, y) {
    this.points.push(x, y);
  }
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

var stats = {
  totalLeafOps: 0,
  totalLeaves: 0,
  opsPerLeaf: [],
  reset() {
    this.totalLeaves = 0;
    this.totalLeafOps = 0;
    this.opsPerLeaf.length = 0;
  }
};

function inout(ctx, r, ix, iy, shapes) {
  var size = Math.max(ix[1] - ix[0], iy[1] - iy[0]);
  if (r[0] <= 0 && r[1] >= 0 && size < (1 / mouse.zoom)) {

    stats.totalLeafOps += shapes.length
    stats.totalLeaves++;
    stats.opsPerLeaf.push(shapes.length);
    // ctx.fillRect(ix[0], iy[0], (ix[1] - ix[0]), (iy[1] - iy[0]));
    evaluatorContext.addPoint(ix[0], iy[0]);
  } else {
    // ctx.fillStyle = `hsla(${size}, 100%, 55%, .75)`
  }
  return r;
}

var scratchx = [0, 0];
var scratchy = [0, 0];
function box (inputShapes, translation, lx, ly, ux, uy, ctx, scale, depth, fn) {
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
  r = fn(inputShapes, scratchx, scratchy, translation, upperRightShapes);
  if (crossesZero(r)) { // upper-right
    inout(ctx, r, scratchx, scratchy, upperRightShapes);
    maxDepth = max(maxDepth,
      box(upperRightShapes, translation, midx, midy, ux, uy, ctx, scale, depth + 1, fn)
    );
  }

  iset(scratchx, lx, midx);
  iset(scratchy, midy, uy);
  var upperLeftShapes = []
  r = fn(inputShapes, scratchx, scratchy, translation, upperLeftShapes);
  if (crossesZero(r)) { // upper-left
    inout(ctx, r, scratchx, scratchy, upperLeftShapes);
    maxDepth = max(maxDepth,
      box(upperLeftShapes, translation, lx, midy, midx, uy, ctx, scale, depth + 1, fn)
    );
  }

  iset(scratchx, lx, midx);
  iset(scratchy, ly, midy);
  var lowerRightShapes = [];
  r = fn(inputShapes, scratchx, scratchy, translation, lowerRightShapes);
  if (crossesZero(r)) { // lower-right
    inout(ctx, r, scratchx, scratchy, lowerRightShapes);
    maxDepth = max(maxDepth,
      box(lowerRightShapes, translation, lx, ly, midx, midy, ctx, scale, depth + 1, fn)
    );
  }

  iset(scratchx, midx, ux);
  iset(scratchy, ly, midy);
  var lowerLeftShapes = [];
  r = fn(inputShapes, scratchx, scratchy, translation, lowerLeftShapes);
  if (crossesZero(r)) { // lower-left
    inout(ctx, r, scratchx, scratchy, lowerLeftShapes);
    maxDepth = max(maxDepth,
      box(lowerLeftShapes, translation, midx, ly, ux, midy, ctx, scale, depth + 1, fn)
    );
  }

  return maxDepth;
}

var mouse = { zoom: 1, down: false, translate: [0, 0] }
window.addEventListener('mousewheel', function(e) {
  mouse.zoom += e.wheelDelta / 500;
  if (mouse.zoom < .1) {
    mouse.zoom = .1;
  }
  e.preventDefault();
}, {passive: false})

window.addEventListener('mousedown', function(e) { mouse.down = [e.clientX, e.clientY]; })
window.addEventListener('mouseup', function(e) {
  mouse.down = false;
  var s = [
    (e.clientX - window.innerWidth / 2) / mouse.zoom,
    (e.clientY - window.innerHeight / 2) / mouse.zoom,
    10
  ];

  shapes.push(s);
})
window.addEventListener('mousemove', function(e) {
  if (mouse.down) {
    var s = [
      (e.clientX - viewport[0]) / mouse.zoom,
      (e.clientY - viewport[1]) / mouse.zoom,
      100
    ];

    shapes.push(s);
  }
})

var shapes = [[0, 0, 10]]

var translation = [0, 0]


const drawPoints = regl({
  depth: { enable: false },
  vert: `
  precision mediump float;
  attribute vec2 position;
  uniform mat4 worldToScreen;
  void main() {
    gl_PointSize = 1.0;
    gl_Position = worldToScreen * vec4(position, 0, 1);
  }`,

  frag: `
  precision lowp float;
  void main() {
    gl_FragColor = vec4(1);
  }`,

  attributes: {
    position: {
      buffer: regl.prop("pointBuffer"),
      stride: 4 * 2,
      offset: 0
    },
  },

  uniforms: {
    worldToScreen: regl.prop("worldToScreen")
  },

  count: regl.prop("count"),

  primitive: 'points'
})

regl.frame((ctx) => {
  var w = 0.5 * ctx.viewportWidth / ctx.pixelRatio / mouse.zoom;
  var h = 0.5 * ctx.viewportHeight / ctx.pixelRatio / mouse.zoom;

  viewport[0] = 0.5 * ctx.viewportWidth / ctx.pixelRatio;
  viewport[1] = 0.5 * ctx.viewportHeight / ctx.pixelRatio;

  // rebuild the point buffer
  const start = performance.now();
  {
    evaluatorContext.reset();
    stats.reset();

    const jitteredShapes = shapes.map(shape => [
      shape[0] + Math.random() * 2.5 / mouse.zoom,
      shape[1] + Math.random() * 2.5 / mouse.zoom,
      shape[2]
    ])

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

    var maspect = max(ctx.viewportHeight, ctx.viewportWidth);
    var hw = (maspect / 2) / mouse.zoom;
    var hh = (maspect / 2) / mouse.zoom;

    var cx = mouse.translate[0];
    var cy = mouse.translate[1];

    var lx = -hw;
    var ly = -hh;
    var ux =  hw;
    var uy =  hh;


    box(jitteredShapes, translation, lx, ly, ux, uy, ctx, mouse.zoom, 0, evaluateScene);
  }
  const end = performance.now();

  regl.clear({
    color: [0, 0, 0, 1]
  })

  evaluatorContext.pointBuffer.subdata(evaluatorContext.points)

  drawPoints({
    count: evaluatorContext.points.length / 2,
    pointBuffer: evaluatorContext.pointBuffer,
    worldToScreen: mat4.ortho([], -w, w, h, -h, -1, 1)
  })

  // update stats
  {
    const log = (sel, val) => {
      var el = document.querySelector(sel)
      if (!el) {
        return
      }

      el.innerHTML = val;
    }

    log("#stats .timing", `eval: ${(end-start).toFixed(2)}ms`)
    log("#stats .counts", `ops: ${shapes.length} leaf nodes: ${stats.totalLeaves}`);

    const avg = (stats.totalLeafOps / stats.totalLeaves);
    log("#stats .avg", 'avg ops per leaf: ' + avg.toFixed(4));

    var variance = stats.opsPerLeaf.reduce((p, c) => {
      return Math.pow(c - avg, 2) + p
    }, 0) / stats.opsPerLeaf.length

    log("#stats .stddev", 'stddev: ' + (Math.sqrt(variance)).toFixed(4));
    log("#stats .efficiency", `culling efficiency: ${((1.0 - avg / shapes.length)*100).toFixed(2)}%`);
  }
})
