var fc = require('fc');
var center = require('ctx-translate-center')
var iadd = require('interval-add');
var isub = require('interval-subtract');
var imul = require('interval-multiply');
var imin = require('interval-min');

var max = Math.max;
var min = Math.min;

var evaluate = require('./evaluator')

const evaluatorContext = {
  shapeMode: 0,
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

function addQuad(r, ix, iy, input) {
  var size = Math.max(ix[1] - ix[0], iy[1] - iy[0]);
  if (r[0] <= 0 && r[1] >= 0 && size < (1 / mouse.zoom)) {

    stats.totalLeafOps += input.indices.length
    stats.totalLeaves++;
    stats.opsPerLeaf.push(input.indices.length);
    ctx.fillStyle = "white"
    ctx.fillRect(ix[0], iy[0], (ix[1] - ix[0]), (iy[1] - iy[0]));
  } else {
    ctx.fillStyle = `hsla(${size}, 100%, 55%, .75)`
    ctx.fillRect(ix[0], iy[0], (ix[1] - ix[0]), (iy[1] - iy[0]));
  }
  return r;
}

var keys = {};
document.addEventListener("keydown", (e) => {
  keys[e.code] = true
})
document.addEventListener("keyup", (e) => {
  delete keys[e.code]
})

var mouse = { zoom: 1, down: false, translate: [0, 0], pos: [-10000, 0]  }
window.addEventListener('wheel', function(e) {
  ctx.dirty();
  mouse.zoom += e.wheelDelta / 500;
  if (mouse.zoom < .1) {
    mouse.zoom = .1;
  }
  e.preventDefault();
})

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
  // [0, 200, 100, 2],
]

var translation = [0, 0]
var viewport = [window.innerWidth * 0.5, window.innerHeight * 0.5]
var ctx = fc(function (dt) {
  viewport[0] = ctx.canvas.width / 2;
  viewport[1] = ctx.canvas.height /2 ;
  // const inputShapes = shapes.map(shape => [
  //   shape[0], // + Math.random() * 5.5 / mouse.zoom,
  //   shape[1], // + Math.random() * 5.5 / mouse.zoom,
  //   shape[2],
  //   shape[3]
  // ])

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

  const inputShapes = shapes.map(shape => shape.slice())
  // add preview of the current op under the mouse cursor
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

  stats.reset();

  ctx.clear('black');


  ctx.save();
console.clear()
  console.log('rendering', shapes.length, 'shapes')
  console.time('render')
  ctx.strokeStyle = 'rgba(255,5,5, 0.25)';
  center(ctx);
  // ctx.translate(mouse.translate[0], mouse.translate[1]);
  ctx.scale(mouse.zoom, mouse.zoom)
  ctx.lineWidth = 1/mouse.zoom

  translation[0] = mouse.translate[0];
  translation[1] = mouse.translate[1];

  var maspect = max(ctx.canvas.height, ctx.canvas.width);
  var hw = (maspect / 2) / mouse.zoom;
  var hh = (maspect / 2) / mouse.zoom;

  var cx = mouse.translate[0];
  var cy = mouse.translate[1];

  var lx = -hw;
  var ly = -hh;
  var ux =  hw;
  var uy =  hh;

  ctx.fillStyle = 'white'

  const start = performance.now();
  evaluate(
    evaluatorInput,
    translation,
    lx,
    ly,
    ux,
    uy,
    addQuad,
    mouse.zoom,
    0
  );
  const end = performance.now();
  ctx.restore();
  ctx.fillStyle = "#"
  ctx.fillRect(0, 0, 275, 115)

  ctx.fillStyle = "white";
  ctx.font = "12px monospace"
  ctx.fillText(`shapes: ${shapes.length} leaves: ${stats.totalLeaves} `, 10, 20);

  const avg = (stats.totalLeafOps / (stats.totalLeaves || 1));
  ctx.fillText('avg ops per leaf: ' + avg.toFixed(4), 10, 40);

  var variance = stats.opsPerLeaf.reduce((p, c) => {
    return Math.pow(c - avg, 2) + p
  }, 0) / (stats.opsPerLeaf.length || 1)

  ctx.fillText('stddev: ' + (Math.sqrt(variance)).toFixed(4), 10, 60);
  ctx.fillText(`culling efficiency: ${((1.0 - avg / shapes.length)*100).toFixed(2)}%`, 10, 80);

  ctx.fillText(`${((end-start)).toFixed(2)}ms`, 10, 100);
  console.timeEnd('render')
}, true);
