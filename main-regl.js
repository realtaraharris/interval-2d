const regl = require('regl')()
const mat4 = require('gl-mat4')

const evaluate = require('./evaluator')
const viewport = [0,0];

const MAX_OPS = (1<<21);
const evaluatorContext = {
  shapeMode: 0,
  pointLoc: 0,
  points: new Float32Array(MAX_OPS * 3),
  pointBuffer: regl.buffer({
    length: MAX_OPS * 3,
    usage: "dynamic",
    type: "float"
  }),

  reset() {
    this.pointLoc = 0;
  },

  addPoint(x, y, r) {
    this.points[this.pointLoc++] = x
    this.points[this.pointLoc++] = y
    this.points[this.pointLoc++] = r
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

for (var i=0; i<20000; i++) {
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
  attribute vec3 position;
  uniform mat4 worldToScreen;
  void main() {
    gl_PointSize = position.z;
    gl_Position = worldToScreen * vec4(position.xy, 0, 1);
  }`,

  frag: `
  precision lowp float;
  void main() {
    gl_FragColor = vec4(1);
  }`,

  attributes: {
    position: {
      buffer: regl.prop("pointBuffer"),
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
      (x, y, w, h, input, depth) => {
        var size = Math.max(w, h);
        if (size < (1 / mouse.zoom)) {
          stats.totalLeafOps += input.indices.length
          stats.totalLeaves++;
          stats.opsPerLeaf.push(input.indices.length);
          evaluatorContext.addPoint(x, y, 1);
        } else {
          // evaluatorContext.addPoint(x, y, size);
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

  drawPoints({
    count: evaluatorContext.pointLoc / 3,
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
