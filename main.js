var fc = require('fc');
var glm = require('gl-matrix');
var mat3 = glm.mat3;
var vec2 = glm.vec2;
var center = require('ctx-translate-center')
var iadd = require('interval-add');
var isub = require('interval-subtract');
var imul = require('interval-multiply');
var imin = require('interval-min');
var colorLerp = require('color-lerp');

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

function rect (x, y, rx, ry) {
  return imax(isub(iabs(x), rx), isub(iabs(y), ry));
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


var depthColors = colorLerp('#00FF00', '#FF0000', 10);
console.log(depthColors)
function inout(ctx, r, ix, iy, depth) {
  var scale = mouse.zoom;
  ctx.save()
    ctx.lineWidth = 1/scale;
    var size = Math.max(ix[1] - ix[0], iy[1] - iy[0]);

    if (r[0] <= 0 && r[1] <= 0) {
      // return r;
      ctx.fillStyle = depthColors[depth];//"hsla(14, 100%, 55%, 1)"
      ctx.fillRect(ix[0], iy[0], (ix[1] - ix[0]), (iy[1] - iy[0]));

      r = [10, 10];

    } else if (r[0] <= 0 && r[1] >= 0 && size < (1 / mouse.zoom)) {
      ctx.fillStyle = 'white'
    ctx.fillRect(ix[0]+1/scale, iy[0]+1/scale, (ix[1] - ix[0])-2/scale, (iy[1] - iy[0])-2/scale);

    } else {

      // return r;
      // ctx.strokeStyle = "yellow"
      ctx.strokeStyle = depthColors[depth];//'rgb(' + Math.floor((depth/10)*255) + ', 0, 0)';
      ctx.strokeRect(ix[0], iy[0], (ix[1] - ix[0]), (iy[1] - iy[0]));
    }

  ctx.restore();

  return r;
}

var scratchx = [0, 0];
var scratchy = [0, 0];
function box (inputShapes, translation, lx, ly, ux, uy, ctx, scale, depth, fn) {
  ctx.fillStyle = "black";
  ctx.fillRect(lx, ly, ux-lx, ux-lx);

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
  r = fn(depth, inputShapes, scratchx, scratchy, translation, upperRightShapes);
  r = inout(ctx, r, scratchx, scratchy, depth);
  if (crossesZero(r)) { // upper-right
    maxDepth = max(maxDepth,
      box(upperRightShapes, translation, midx, midy, ux, uy, ctx, scale, depth + 1, fn)
    );
  }

  iset(scratchx, lx, midx);
  iset(scratchy, midy, uy);
  var upperLeftShapes = []
  r = fn(depth, inputShapes, scratchx, scratchy, translation, upperLeftShapes);
  r = inout(ctx, r, scratchx, scratchy, depth);
  if (crossesZero(r)) { // upper-left
    maxDepth = max(maxDepth,
      box(upperLeftShapes, translation, lx, midy, midx, uy, ctx, scale, depth + 1, fn)
    );
  }

  iset(scratchx, lx, midx);
  iset(scratchy, ly, midy);
  var lowerRightShapes = [];
  r = fn(depth, inputShapes, scratchx, scratchy, translation, lowerRightShapes);
  r = inout(ctx, r, scratchx, scratchy, depth);
  if (crossesZero(r)) { // lower-right
    maxDepth = max(maxDepth,
      box(lowerRightShapes, translation, lx, ly, midx, midy, ctx, scale, depth + 1, fn)
    );
  }

  iset(scratchx, midx, ux);
  iset(scratchy, ly, midy);
  var lowerLeftShapes = [];
  r = fn(depth, inputShapes, scratchx, scratchy, translation, lowerLeftShapes);
  r = inout(ctx, r, scratchx, scratchy, depth);
  if (crossesZero(r)) { // lower-left
    maxDepth = max(maxDepth,
      box(lowerLeftShapes, translation, midx, ly, ux, midy, ctx, scale, depth + 1, fn)
    );
  }

  return maxDepth;
}

var mouse = { zoom: 1, down: false, translate: [0, 0], pos: [0, 0] }
window.addEventListener('mousewheel', function(e) {
  ctx.dirty();
  mouse.zoom += e.wheelDelta / 500;
  if (mouse.zoom < .1) {
    mouse.zoom = .1;
  }
  mouse.pos[0] = (e.clientX - ctx.canvas.width / 2) / mouse.zoom;
  mouse.pos[1] = (e.clientY - ctx.canvas.height / 2) / mouse.zoom;
  e.preventDefault();
})

window.addEventListener('mousedown', function(e) { mouse.down = [e.clientX, e.clientY]; })
window.addEventListener('mouseup', function(e) {
  mouse.down = false;
  addShape(mouse.pos[0], mouse.pos[1], 10, Math.random() * 100);
})
window.addEventListener('mousemove', function(e) {
  mouse.pos[0] = (e.clientX - ctx.canvas.width / 2) / mouse.zoom - mouse.translate[0];
  mouse.pos[1] = (e.clientY - ctx.canvas.height / 2) / mouse.zoom - mouse.translate[1];

  if (mouse.down) {
    addShape(mouse.pos[0], mouse.pos[1], 10, Math.random() * 100);
  }
})


var keyboard = {}
window.addEventListener('keydown', function(e) {
  keyboard[e.which] = true;
  ctx.dirty()
  e.preventDefault();
})
window.addEventListener('keyup', function(e) {
  keyboard[e.which] = false;
  ctx.dirty()
})

function addShape(cx, cy, width, height) {

  var transform = mat3.create();
  mat3.translate(transform, transform, [cx, cy])

  shapes.push({
    fn: rect,
    width: ival(width),
    height: ival(height),
    transform: transform
  })

  ctx && ctx.dirty()

}

var shapes = [];

// addShape(10, 10, 10, 50)
// addShape(100, 100, 10, 50)

// for (var x = -500; x<=500; x+=10) {
//   for (var y = -200; y<=200; y+=10) {
//     addShape(x, y, 10, 10);//shapes.push([x, y, 10])
//   }
// }

// setInterval(function() {
//   mat3.rotate(shapes[0].transform, shapes[0].transform, Math.PI/100)
//   var s = 1 - Math.sin(Date.now() / 1000) / 50;
//   mat3.scale(shapes[0].transform, shapes[0].transform, [s, s])

//   ctx.dirty()
// }, 16);



var translation = [0, 0];
var inverted = mat3.create();

var ctx = fc(function (dt) {
  ctx.save()
  var maspect = max(ctx.canvas.height, ctx.canvas.width);
  var hw = (maspect / 2) / mouse.zoom;
  var hh = (maspect / 2) / mouse.zoom;

  var lx = -hw;
  var ly = -hh;
  var ux =  hw;
  var uy =  hh;

  if (keyboard[39]) {
    mouse.translate[0] += 10 / mouse.zoom;
  }

  if (keyboard[37]) {
    mouse.translate[0] -= 10 / mouse.zoom;
  }

  if (keyboard[40]) {
    mouse.translate[1] -= 10 / mouse.zoom;
  }

  if (keyboard[38]) {
    mouse.translate[1] += 10 / mouse.zoom;
  }

  translation[0] = mouse.translate[0];
  translation[1] = mouse.translate[1];

  ctx.clear('black');

  var localShapes = []
  var groups = [[], [], [], [], [], [], [], [], [], [], []];
  evaluateScene(0, shapes, [lx, ux], [ly, uy], translation, localShapes)

  console.clear()
  console.time('render')
  ctx.strokeStyle = 'rgba(255,5,5, 0.25)';
  center(ctx);
  // ctx.translate(mouse.translate[0], mouse.translate[1]);
  ctx.scale(mouse.zoom, mouse.zoom)
  ctx.lineWidth = 1/mouse.zoom

  function evaluateScene (depth, inputShapes, x, y, translation, outFilteredShapes) {
    groups[depth].push(inputShapes.length)

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
        // TODO: compress these into a generic property that gets passed into every shape
        c.width,
        c.height
      );

      if (crossesZero(distanceInterval)) {
        outFilteredShapes.push(c)
      }

      imin(distanceInterval, r, r);
    }
    return r;
  }

  box(shapes, translation, lx, ly, ux, uy, ctx, mouse.zoom, 0, evaluateScene);

  groups.forEach(function(group, i) {
    var sum = group.reduce(function(p, c) {
      return p + c
    }, 0)

    var avg = sum / group.length
    console.log('depth: %s; cells: %s; avg work: %s; total work: %s', i, group.length, (avg).toFixed(2), sum)
  })

  ctx.strokeStyle = "#f0f"
  ctx.strokeRect(lx, ly, ux - lx, uy - ly);
  console.timeEnd('render')
  ctx.restore()

  ctx.fillStyle = "white";
  ctx.font = "12px monospace"
  ctx.fillText('shapes: ' + localShapes.length + '/' + shapes.length, 10, 20);

}, false);
