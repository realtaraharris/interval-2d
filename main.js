var fc = require('fc');
var glm = require('gl-matrix');
var mat3 = glm.mat3;
var vec2 = glm.vec2;
var drawCircle = require('ctx-circle');
var center = require('ctx-translate-center');
var iadd = require('interval-add');
var isub = require('interval-subtract');
var imul = require('interval-multiply');
var imin = require('interval-min');
var colorLerp = require('color-lerp');

var max = Math.max;
var min = Math.min;

function hsl(h, s, l) {
  var p = (241 - (h * 241)|0) % 360
  var r = 'hsl(' + p + ',' + s + '%,' + l + '%)';
  return r;
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

function sign(a) {
  return typeof a === 'number' ? a ? a < 0 ? -1 : 1 : a === a ? 0 : 0 : 0
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
    return [0, max(-i[0], i[1])];
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

function lerp (l, u, t) {
  return (l + u) * t;
}

function ineg(i) {
  var l = -i[0];
  var u = -i[1];

  return [
    min(l, u),
    max(l, u)
  ];
}

function middle (l, u) {
  return lerp(l, u, 0.5);
}

function circle (x, y, r) {
  return isub(ilen(x, y), r[0]);
}

circle.helper = function circleHelper(ctx) {
  ctx.beginPath()
    drawCircle(ctx, mouse.pos[0] + mouse.translate[0], mouse.pos[1] + mouse.translate[1], keyboard.radius);
    ctx.strokeStyle = "#FF0073"
    ctx.stroke();
}


function rect (x, y, args) {
  return imax(isub(iabs(x), args[0]), isub(iabs(y), args[1]));
}

rect.helper = function rectHelper(ctx) {
  var r = keyboard.radius;
  ctx.strokeStyle = "#FF0073"
  ctx.strokeRect(
    (mouse.pos[0] + mouse.translate[0]) - r,
    (mouse.pos[1] + mouse.translate[1]) - r,
    r*2,
    r*2
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


function inout(ctx, r, ix, iy, work, hit) {
  var maxWork = shapes.length;

  var scale = mouse.zoom;
  ctx.save()
    ctx.lineWidth = 1/scale;
    var size = max(ix[1] - ix[0], iy[1] - iy[0]);

    if (keyboard.debug && r[0] <= 0 && r[1] <= 0) {
      ctx.fillStyle = hsl(work, 100,  50);
      ctx.fillRect(ix[0], iy[0], (ix[1] - ix[0]), (iy[1] - iy[0]));
      ctx.lineWidth = (1/scale) / 4;
      ctx.strokeStyle = "black";
      ctx.strokeRect(ix[0], iy[0], (ix[1] - ix[0]), (iy[1] - iy[0]));

    } else if (r[0] <= 0 && r[1] >= 0 && size < (1 / mouse.zoom)) {
      ctx.fillStyle = 'white'
      ctx.fillRect(ix[0]+1/scale, iy[0]+1/scale, (ix[1] - ix[0])-2/scale, (iy[1] - iy[0])-2/scale);
    }

  ctx.restore();

  return r;
}

function processRect(fn, depth, inputShapes, lx, ly, ux, uy, translation, scale) {
  var tmp = []

  iset(scratchx, lx, ux);
  iset(scratchy, ly, uy);

  var r = fn(depth, inputShapes, scratchx, scratchy, translation, tmp);
  if (crossesZero(r)) {
    box(tmp, translation, lx, ly, ux, uy, ctx, scale, depth + 1, fn)
  }
}

var scratchx = [0, 0];
var scratchy = [0, 0];
function box (inputShapes, translation, lx, ly, ux, uy, ctx, scale, depth, fn) {
  var work = inputShapes.length;

  var midx = middle(lx, ux);
  var midy = middle(ly, uy);
  var r;

  if (max(midx - lx, uy - midy) * scale <= .5) {
    return;
  }

  depth++;

  processRect(fn, depth, inputShapes, midx, midy, ux, uy, translation, scale)
  processRect(fn, depth, inputShapes, lx, midy, midx, uy, translation, scale)
  processRect(fn, depth, inputShapes, lx, ly, midx, midy, translation, scale)
  processRect(fn, depth, inputShapes, midx, ly, ux, midy, translation, scale)
}

var mouse = {
  zoom: 1,
  down: false,
  translate: [0, 0],
  pos: [0, 0],
  debug: false
}

window.addEventListener('mousewheel', function mousewheel (e) {
  ctx.dirty();
  mouse.zoom += e.wheelDelta / 500;
  if (mouse.zoom < .1) {
    mouse.zoom = .1;
  }
  mouse.pos[0] = (e.clientX - ctx.canvas.width / 2) / mouse.zoom - mouse.translate[0];
  mouse.pos[1] = (e.clientY - ctx.canvas.height / 2) / mouse.zoom - mouse.translate[1];
  e.preventDefault();
})

window.addEventListener('mousedown', function mousedown (e) { mouse.down = [e.clientX, e.clientY]; })

var clickedShapeIds = [];
window.addEventListener('mouseup', function mouseup (e) {
  clickedShapeIds.length = 0;
  mouse.down = false;

  var mx = mouse.pos[0].toFixed(2);
  var my = mouse.pos[1].toFixed(2);
  var selRadius = 10;

  var clickedShapes = [];
  evaluateScene(0, shapes, [mx - selRadius, mx + selRadius], [my - selRadius, my + selRadius], translation, clickedShapes);

  for (var i = 0; i < clickedShapes.length; i++) {
    clickedShapeIds.push(clickedShapes[i].id);
  }

  ctx.dirty();
})
window.addEventListener('mousemove', function mousemove (e) {
  mouse.pos[0] = (e.clientX - ctx.canvas.width / 2) / mouse.zoom - mouse.translate[0];
  mouse.pos[1] = (e.clientY - ctx.canvas.height / 2) / mouse.zoom - mouse.translate[1];

  if (mouse.down) {
    var shape = addShape(mouse.pos[0], mouse.pos[1]);
    if (shape) {
      buildGroupings([shape], shapeGroupings);
    }
  }
  ctx.dirty();
})

var keyboard = { shape: circle, radius: 10, debug: true }
window.addEventListener('keydown', function keydown (e) {
  keyboard[e.which] = true;
  ctx.dirty()
  // r
  if (e.which === 82) {
    keyboard.shape = rect;
  // c
  } else if (e.which === 67) {
    keyboard.shape = circle;
  }

  // ]
  if (e.which === 221) {
    keyboard.radius += 1/mouse.zoom;
  // [
  } else if (e.which === 219) {
    keyboard.radius -= 1/mouse.zoom;
  }
})
window.addEventListener('keyup', function keyup (e) {
  keyboard[e.which] = false;

  if (e.which == 68) {
    keyboard.debug = !keyboard.debug
  }

  ctx.dirty()
})

var globalShapeId = 0;
var shapeGroupings = [];
function addShape(cx, cy, radius) {

  var transform = mat3.create();
  mat3.translate(transform, transform, [cx, cy])

  var r = ival(radius || keyboard.radius);

  var solidCoreTests = shapeGroupings.filter(function(g) {
    var res = evaluateScene(
      0,
      g.shapes,
      [cx - r[0], cx + r[0]],
      [cy - r[0], cy + r[0]],
      [0, 0]
    );

    return res[0] <= 0 && res[1] <= 0
  })

  // new shape contributes to the solid core, ignore it.
  if (solidCoreTests.length) {
    return;
  }

  var insert = {
    fn: keyboard.shape,
    args: [r, r],
    transform: transform,
    id: globalShapeId++
  };

  shapes.push(insert)

  ctx && ctx.dirty()

  return insert;
}

var shapes = [];
var groups = [];
var translation = [0, 0];
var inverted = mat3.create();

function checkHit (shapes) {
  for (var i = 0; i < shapes.length; i++) {
    if (clickedShapeIds.indexOf(shapes[i].id) > -1) {
      return true;
    }
  }
}

function evaluateScene (depth, inputShapes, x, y, translation, outFilteredShapes) {
  // if (!groups[depth]) {
  //   groups.push([]);
  // }
  // groups[depth].push(inputShapes.length)

  var l = inputShapes.length;
  var r = ival(1);
  var st = [0, 0];
  for (var i=0; i<l; i++) {
    var c = inputShapes[i];

    mat3.translate(inverted, c.transform, translation);
    mat3.invert(inverted, inverted);

    var vll = [x[0], y[0]];
    var vlu = [x[0], y[1]];
    var vul = [x[1], y[0]];
    var vuu = [x[1], y[1]];

    vec2.transformMat3(vll, vll, inverted);
    vec2.transformMat3(vlu, vlu, inverted);
    vec2.transformMat3(vul, vul, inverted);
    vec2.transformMat3(vuu, vuu, inverted);

    var distanceInterval = c.fn(
      [min(vll[0], vlu[0], vul[0], vuu[0]), max(vll[0], vlu[0], vul[0], vuu[0])],
      [min(vll[1], vlu[1], vul[1], vuu[1]), max(vll[1], vlu[1], vul[1], vuu[1])],
      c.args
    );

    imin(distanceInterval, r, r);
    if (crossesZero(distanceInterval)) {
      outFilteredShapes && outFilteredShapes.push(c)
    } else if (distanceInterval[0] <= 0) {
      break
    }
  }

  inout(ctx, r, x, y, min(inputShapes.length / 10, 1), checkHit(inputShapes));

  return r;
}

function mergeBoundsInto(src, dest) {
  dest[0][0] = min(src[0][0], dest[0][0]);
  dest[0][1] = min(src[0][1], dest[0][1]);
  dest[1][0] = max(src[1][0], dest[1][0]);
  dest[1][1] = max(src[1][1], dest[1][1]);
}

function buildGroupings(shapes, shapeGroupings) {
  var lgs = shapeGroupings;

  var l = shapes.length;

  for (var i=0; i<l; i++) {
    var shape = shapes[i];

    var pos = [0, 0];
    vec2.transformMat3(pos, pos, shape.transform);

    // TODO: bake this into each shape, not just circles
    var rx = shape.args[0][0];
    var ry = shape.args[0][0];
    var x = [pos[0] - rx, pos[0] + rx]
    var y = [pos[1] - ry, pos[1] + ry]

    ctx.strokeStyle = "limegreen"
    ctx.strokeRect(x[0], y[0], x[1]-x[0], y[1]-y[0]);

    // figure out if this shape is apart of a group
    var contrib = lgs.filter(function(g) {
      var r = evaluateScene(0, g.shapes, x, y, [0, 0])

      if (r[0] <= 0) {
        g.shapes.push(shape);

        mergeBoundsInto([
          [x[0], y[0]],
          [x[1], y[1]]
        ], g.bounds)
        return true
      } else {
        return false;
      }
    });

    if (!contrib.length) {
      lgs.push({
        shapes: [shape],
        bounds: [
          [x[0], y[0]],
          [x[1], y[1]]
        ]
      });
    } else if (contrib.length > 1) {
      var nc = contrib.shift();
      contrib.forEach(function(g) {
        Array.prototype.push.apply(nc.shapes, g.shapes);
        mergeBoundsInto(g.bounds, nc.bounds)
        lgs.splice(lgs.indexOf(g), 1);
      })
    }
  }

  return lgs;
}

var ctx = fc(function tick (dt) {
  groups = [];
  var renderStart = Date.now();
  ctx.save()
  var hw = (ctx.canvas.width / 2) / mouse.zoom;
  var hh = (ctx.canvas.height / 2) / mouse.zoom;



  if (keyboard[39]) {
    mouse.translate[0] += 50 / mouse.zoom;
  }

  if (keyboard[37]) {
    mouse.translate[0] -= 50 / mouse.zoom;
  }

  if (keyboard[40]) {
    mouse.translate[1] += 50 / mouse.zoom;
  }

  if (keyboard[38]) {
    mouse.translate[1] -= 50 / mouse.zoom;
  }

  translation[0] = mouse.translate[0];
  translation[1] = mouse.translate[1];

  ctx.clear('black');

  ctx.strokeStyle = 'rgba(255,5,5, 0.25)';
  center(ctx);
  // ctx.translate(mouse.translate[0], mouse.translate[1]);
  ctx.scale(mouse.zoom, mouse.zoom)
  ctx.lineWidth = 1/mouse.zoom

  var results = shapeGroupings.map(function(g) {
    var lx = min(g.bounds[0][0], g.bounds[1][0]) + translation[0]
    var ly = min(g.bounds[0][1], g.bounds[1][1]) + translation[1]
    var ux = max(g.bounds[0][0], g.bounds[1][0]) + translation[0]
    var uy = max(g.bounds[0][1], g.bounds[1][1]) + translation[1]

    if (keyboard.debug) {
      ctx.strokeStyle = "#666"
      ctx.strokeRect(lx, ly, ux - lx, uy - ly);
    }

    lx = max(-hw, lx);
    ly = max(-hh, ly);
    ux = min( hw, ux);
    uy = min( hh, uy);

    var localShapes = []
    evaluateScene(0, g.shapes, [lx, ux], [ly, uy], translation, localShapes)

    box(
      localShapes,
      translation,
      lx,
      ly,
      ux,
      uy,
      ctx,
      mouse.zoom,
      0,
      evaluateScene
    );

    return [localShapes.length, g.shapes.length];
  })
  // groups.forEach(function(group, i) {
  //   var sum = group.reduce(function(p, c) {
  //     return p + c
  //   }, 0)

  //   var avg = sum / group.length
  //   console.log('depth: %s; cells: %s; avg work: %s; total work: %s', i, group.length, (avg).toFixed(2), sum)
  // })

  keyboard.shape.helper(ctx);
  ctx.restore()

  ctx.fillStyle = "rgba(0, 0, 0, .7)";
  ctx.fillRect(0, 0, 200, 60 + results.length * 20)

  ctx.fillStyle = "white";
  ctx.font = "12px monospace"
  ctx.fillText('ms: ' + (Date.now() - renderStart), 10, 20);
  results.forEach(function(r, i) {
      ctx.fillText('shapes: ' + r[0] + '/' + r[1], 10, 40 + i*20);
  })

}, false);

// for (var x = -500; x<=500; x+=10) {
//   for (var y = -200; y<=200; y+=10) {
//     addShape(x, y, 10, 10);//shapes.push([x, y, 10])
//   }
// }

for (var x=-200; x<200; x+=30) {
  for (var y=-200; y<200; y += 125) {
    addShape(x, y+0, 50)
    addShape(x+50, y+0, 10, 10)
    addShape(x, y+50, 10, 10)
    addShape(x, y-50, 10, 10)
    addShape(x-50, y+0, 10, 10)
  }
}

  // addShape(0, 0, 50)
  // addShape(+50, 0, 10, 10)
  // addShape(0, 50, 10, 10)
  // addShape(20, 20, 10, 10)
  // addShape(0, -50, 10, 10)
  // addShape(-50, 0, 10, 10)
//

// build groups to be processed by the box evaluator
buildGroupings(shapes, shapeGroupings);
