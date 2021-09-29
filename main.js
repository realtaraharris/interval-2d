var fc = require('fc');
var center = require('ctx-translate-center')
var iadd = require('interval-add');
var isub = require('interval-subtract');
var imul = require('interval-multiply');
var imin = require('interval-min');

var max = Math.max;
var min = Math.min;

var evaluate = require('./evaluator')

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

function addQuad(r, ix, iy, ops) {
  var size = Math.max(ix[1] - ix[0], iy[1] - iy[0]);
  if (r[0] <= 0 && r[1] >= 0 && size < (1 / mouse.zoom)) {

    stats.totalLeafOps += ops.length
    stats.totalLeaves++;
    stats.opsPerLeaf.push(ops.length);
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

var mouse = { zoom: 1, down: false, translate: [0, 0] }
window.addEventListener('wheel', function(e) {
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
    var s = [
      (e.clientX - ctx.canvas.width / 2) / mouse.zoom,
      (e.clientY - ctx.canvas.height / 2) / mouse.zoom,
      100,
      !!keys.KeyD // delete
    ];

    shapes.push(s);
    ctx.dirty()
  }
})

var shapes = [
  [0, 0, 100, false],
  [0, 90, 100, true],
]

var translation = [0, 0]
var ctx = fc(function (dt) {

  const jitteredShapes = shapes.map(shape => [
    shape[0], // + Math.random() * 5.5 / mouse.zoom,
    shape[1], // + Math.random() * 5.5 / mouse.zoom,
    shape[2],
    shape[3]
  ])

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

  const start = performance.now();
  evaluate(
    jitteredShapes,
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
