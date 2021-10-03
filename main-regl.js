const regl = require('regl')()
const mat4 = require('gl-mat4')

const evaluate = require('./evaluator')
const viewport = [0,0];

const MAX_OPS = (1<<21);
const evaluatorContext = {
  shapeMode: 0,
  pointLoc: 0,
  colorLoc: 0,
  points: new Float32Array(MAX_OPS * 3),
  colors: new Float32Array(MAX_OPS * 3),
  pointBuffer: regl.buffer({
    length: MAX_OPS * 3,
    usage: "dynamic",
    type: "float"
  }),
  colorBuffer: regl.buffer({
    length: MAX_OPS * 3,
    usage: "dynamic",
    type: "float"
  }),

  reset() {
    this.pointLoc = 0
    this.colorLoc = 0
  },

  addPoint(x, y, radius, r, g, b) {
    this.points[this.pointLoc++] = x
    this.points[this.pointLoc++] = y
    this.points[this.pointLoc++] = radius

    this.colors[this.colorLoc++] = r
    this.colors[this.colorLoc++] = g
    this.colors[this.colorLoc++] = b
  }
}


var keys = {};
document.addEventListener("keydown", (e) => {
  keys[e.code] = true
})
document.addEventListener("keyup", (e) => {
  delete keys[e.code]
})

var mouse = { zoom: 1, down: false, translate: [0, 0], pos: [-10000, 0] }
window.addEventListener('wheel', function(e) {
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
    mouse.pos[0] / mouse.zoom,
    mouse.pos[1] / mouse.zoom,
    100,
    evaluatorContext.shapeMode
  ];

  shapes.push(s);
})
window.addEventListener('mousemove', function(e) {
  mouse.pos[0] = (e.clientX - viewport[0])
  mouse.pos[1] = (e.clientY - viewport[1])

  if (mouse.down) {
    var s = [
      mouse.pos[0] / mouse.zoom,
      mouse.pos[1] / mouse.zoom,
      100,
      evaluatorContext.shapeMode
    ];

    shapes.push(s);
  }
})
var shapes = [
  [0, 0, 100, 0],
  [0, 90, 100, 1],
]

for (var i=0; i<200; i++) {
  // shapes.push([
  //   (Math.random() * 2.0 - 1.0) * 1000,
  //   (Math.random() * 2.0 - 1.0) * 1000,
  //   100,
  //   0
  // ])
  shapes.push([
    Math.sin(i) * i * 0.0125,
    Math.cos(i * i) * i * 0.0125,
    10,
    0
  ])



}

var translation = [0, 0]

const drawPoints = regl({
  depth: { enable: false },
  vert: `
  precision mediump float;
  attribute vec3 aPosition;
  attribute vec3 aColor;
  uniform mat4 worldToScreen;

  varying vec4 color;

  void main() {
    gl_PointSize = aPosition.z;
    gl_Position = worldToScreen * vec4(aPosition.xy, 0, 1);
    color = vec4(aColor, 1.0);
  }`,

  frag: `
  precision lowp float;
  varying vec4 color;
  void main() {
    gl_FragColor = color;
  }`,

  attributes: {
    aPosition: {
      buffer: regl.prop("pointBuffer"),
      stride: 4 * 3,
      offset: 0
    },
    aColor: {
      buffer: regl.prop("colorBuffer"),
      stride: 4 * 3,
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

  var debug = {
    jitter:  (document.querySelector("#stats .jitter input") || {}).checked,
    quadtree:  (document.querySelector("#stats .quadtree input") || {}).checked,
    leaves:  (document.querySelector("#stats .leaves input") || {}).checked,
  }

  // rebuild the point buffer
  const start = performance.now();
  {
    evaluatorContext.reset();
    stats.reset();

    var inputShapes;
    if (debug.jitter) {
      inputShapes = shapes.map(shape => [
        shape[0] + (Math.random() - 0.5) * 2.5 / mouse.zoom,
        shape[1] + (Math.random() - 0.5) * 2.5 / mouse.zoom,
        shape[2],
        shape[3]
      ])
    } else {
      inputShapes = shapes.slice();
    }

    // update shape mode
    {
      // default to union
      evaluatorContext.shapeMode = 0
      if (keys.KeyD) {
        evaluatorContext.shapeMode = 1
      }

      if (keys.KeyS) {
        evaluatorContext.shapeMode = 2
      }
    }

    inputShapes.push([
      mouse.pos[0] / mouse.zoom,
      mouse.pos[1] / mouse.zoom,
      100,
      evaluatorContext.shapeMode
    ])

    const evaluatorInput = {
      ops: inputShapes,
      indices: inputShapes.map((_, i) => i)
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
      evaluatorInput,
      translation,
      lx,
      ly,
      ux,
      uy,
      (x, y, w, h, input, scale, depth) => {
        var size = Math.max(w, h);
        var radius = size * 0.5
        var cx = x + radius
        var cy = y + radius


        if (size < (1 / mouse.zoom)) {
          if (!debug.leaves) {
            return;
          }
          stats.totalLeafOps += input.indices.length
          stats.totalLeaves++;
          stats.opsPerLeaf.push(input.indices.length);
          evaluatorContext.addPoint(cx, cy, 1, 1, 1, 1);
        } else if (debug.quadtree){

          // extracted from https://gist.github.com/mjackson/5311256
          var h = depth / 10.0
          var s = 1.0
          var v = .75
          var r, g, b;

          var i = Math.floor(h * 6);
          var f = h * 6 - i;
          var p = v * (1 - s);
          var q = v * (1 - f * s);
          var t = v * (1 - (1 - f) * s);

          switch (i % 6) {
            case 0: r = v, g = t, b = p; break;
            case 1: r = q, g = v, b = p; break;
            case 2: r = p, g = v, b = t; break;
            case 3: r = p, g = q, b = v; break;
            case 4: r = t, g = p, b = v; break;
            case 5: r = v, g = p, b = q; break;
          }

          evaluatorContext.addPoint(cx, cy, size * mouse.zoom, r, g, b);
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

  evaluatorContext.pointBuffer.subdata(
    new Float32Array(evaluatorContext.points.buffer, 0, evaluatorContext.pointLoc)
  )
  evaluatorContext.colorBuffer.subdata(
    new Float32Array(evaluatorContext.colors.buffer, 0, evaluatorContext.colorLoc)
  )

  drawPoints({
    count: evaluatorContext.pointLoc / 3,
    pointBuffer: evaluatorContext.pointBuffer,
    colorBuffer: evaluatorContext.colorBuffer,
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
