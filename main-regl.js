const regl = require('regl')()
const mat4 = require('gl-mat4')

const evaluate = require('./evaluator')
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


var keys = {};
document.addEventListener("keydown", (e) => {
  keys[e.code] = true
})
document.addEventListener("keyup", (e) => {
  delete keys[e.code]
})

var mouse = { zoom: 1, down: false, translate: [0, 0] }
window.addEventListener('wheel', function(e) {
  mouse.zoom += e.wheelDelta / 500;
  if (mouse.zoom < .1) {
    mouse.zoom = .1;
  }
  e.preventDefault();
}, {passive: false})

window.addEventListener('mousedown', function(e) { mouse.down = [e.clientX, e.clientY]; })
window.addEventListener('mouseup', function(e) { mouse.down = false; })
window.addEventListener('mousemove', function(e) {
  if (mouse.down) {
    var s = [
      (e.clientX - viewport[0]) / mouse.zoom,
      (e.clientY - viewport[1]) / mouse.zoom,
      100,
      !!keys.KeyD // delete
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

    var inputShapes;
    if (document.querySelector("#stats .jitter input").checked) {
      inputShapes = shapes.map(shape => [
        shape[0] + (Math.random() - 0.5) * 2.5 / mouse.zoom,
        shape[1] + (Math.random() - 0.5) * 2.5 / mouse.zoom,
        shape[2],
        shape[3]
      ])
    } else {
      inputShapes = shapes;
    }

    var maspect = Math.max(ctx.viewportHeight, ctx.viewportWidth);
    var hw = (maspect / 2) / mouse.zoom;
    var hh = (maspect / 2) / mouse.zoom;

    var cx = mouse.translate[0];
    var cy = mouse.translate[1];

    var lx = -hw;
    var ly = -hh;
    var ux =  hw;
    var uy =  hh;

    evaluate(
      inputShapes,
      translation,
      lx,
      ly,
      ux,
      uy,
      (r, ix, iy, ops) => {
        var size = Math.max(ix[1] - ix[0], iy[1] - iy[0]);
        if (r[0] <= 0 && r[1] >= 0 && size < (1 / mouse.zoom)) {
          stats.totalLeafOps += ops.length
          stats.totalLeaves++;
          stats.opsPerLeaf.push(ops.length);
          evaluatorContext.addPoint(ix[0], iy[0]);
        } else {
          //  TODO: add a colored quad
          // addQuad.fillStyle = `hsla(${size}, 100%, 55%, .75)`
        }
      },
      mouse.zoom,
      0
    );
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

    const avg = (stats.totalLeafOps / (stats.totalLeaves || 1));
    log("#stats .avg", 'avg ops per leaf: ' + avg.toFixed(4));

    var variance = stats.opsPerLeaf.reduce((p, c) => {
      return Math.pow(c - avg, 2) + p
    }, 0) / (stats.opsPerLeaf.length || 1)

    log("#stats .stddev", 'stddev: ' + (Math.sqrt(variance)).toFixed(4));
    log("#stats .efficiency", `culling efficiency: ${((1.0 - avg / shapes.length)*100).toFixed(2)}%`);
  }
})
