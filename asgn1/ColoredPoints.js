// ColoredPoint.js
// Vertex shader program
var VSHADER_SOURCE =`
  attribute vec4 pos;
  uniform mat4 u_ModelMatrix;
  void main(void) {
    gl_Position = u_ModelMatrix * pos;
  }
`;

// Fragment shader program
var FSHADER_SOURCE =`
  precision mediump float;
  uniform vec4 u_FragColor;
  void main() {
    gl_FragColor = u_FragColor;
  }
`;

// --- GLOBAL VARIABLES ---
const g_shapes = [];
let g_isDrawing = false;
let g_backgroundColor = [0.0, 0.0, 0.0, 1.0];

// Global Brush Settings (so main and click handlers can share them)
let g_selectedType = "square";
let g_selectedSize = 20;
let g_selectedColor = {red: 25, green: 25, blue: 25};
let g_selectedSegments = 10;
let g_selectedRotation = 0;

function setupWebGL() {
  const canvas = document.getElementById('canvas');
  const gl = WebGLUtils.setupWebGL(canvas);
  return { canvas, gl };
}

function connectVariablesToGLSL(gl) {
  // 1. Initialize shaders FIRST
  if (!initShaders(gl, VSHADER_SOURCE, FSHADER_SOURCE)) {
    console.error('Failed to intialize shaders.');
    return null;
  }

  // 2. NOW get the storage locations
  var a_Position = gl.getAttribLocation(gl.program, 'pos');
  var u_FragColor = gl.getUniformLocation(gl.program, 'u_FragColor');
  var u_ModelMatrix = gl.getUniformLocation(gl.program, 'u_ModelMatrix');
  
  var vertexBuffer = gl.createBuffer();
  
  return { u_FragColor, a_Position, vertexBuffer, u_ModelMatrix };
}

function click(ev, gl, canvas, shader_vars) {
  const [x, y] = convertEventToCoords(ev, canvas);

  // Snapshot the current settings into the shape's own state
  const stateCopy = { 
    drawing_mode: g_selectedType,
    drawing_size: g_selectedSize,
    color: { ...g_selectedColor },
    segments: g_selectedSegments,
    rotation: g_selectedRotation 
  };

  const newShape = { x, y, drawing_state: stateCopy };
  g_shapes.push(newShape);

  renderAllShapes(gl, shader_vars);
}

function convertEventToCoords(ev, canvas) {
  var x = ev.clientX;
  var y = ev.clientY;
  var rect = ev.target.getBoundingClientRect();
  x = ((x - rect.left) - canvas.width / 2) / (canvas.width / 2);
  y = (canvas.height / 2 - (y - rect.top)) / (canvas.height / 2);
  return [x, y];
}

function renderAllShapes(gl, shader_vars) {
  // Set background and clear
  gl.clearColor(g_backgroundColor[0], g_backgroundColor[1], g_backgroundColor[2], g_backgroundColor[3]);
  gl.clear(gl.COLOR_BUFFER_BIT);

  var modelMatrix = new Matrix4();

  for (const shape of g_shapes) {
    const { x, y, drawing_state } = shape;
    const { color, drawing_size, drawing_mode, segments, rotation } = drawing_state;

    // Pass Color (0-255 converted to 0.0-1.0)
    gl.uniform4f(shader_vars.u_FragColor, color.red/255, color.green/255, color.blue/255, 1.0);

    const d = drawing_size / 200.0;

    // --- MATRIX MATH ---
    // Rule: We define the shape at (0,0), then Translate to mouse, then Rotate
    modelMatrix.setTranslate(x, y, 0); 
    modelMatrix.rotate(rotation, 0, 0, 1);
    gl.uniformMatrix4fv(shader_vars.u_ModelMatrix, false, modelMatrix.elements);

    let vertices;
    let n;
    let drawMode = gl.TRIANGLE_FAN;

    // --- YOUR SWITCH STATEMENT ---
    switch(drawing_mode) {
      case 'square':
        vertices = new Float32Array([
          -d,  d,   // Top Left
          -d, -d,   // Bottom Left
           d, -d,   // Bottom Right
           d,  d    // Top Right
        ]);
        n = 4;
        break;
      case 'triangle':
        vertices = new Float32Array([
           0,  d,   // Top
          -d, -d,   // Bottom Left
           d, -d    // Bottom Right
        ]);
        n = 3;
        drawMode = gl.TRIANGLES;
        break;
      case 'circle':
        const coords = [0, 0]; // Center point at (0,0)
        for (let i = 0; i <= segments; i++) {
          let angle = (i * 2 * Math.PI) / segments;
          coords.push(Math.cos(angle) * d, Math.sin(angle) * d);
        }
        vertices = new Float32Array(coords);
        n = segments + 2;
        break;
      default:
        break;
    }

    // Bind buffer and Draw
    gl.bindBuffer(gl.ARRAY_BUFFER, shader_vars.vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.DYNAMIC_DRAW);
    gl.vertexAttribPointer(shader_vars.a_Position, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(shader_vars.a_Position);
    gl.drawArrays(drawMode, 0, n);
  }
}

function main() {
  const { canvas, gl } = setupWebGL();
  const shader_vars = connectVariablesToGLSL(gl);

  // Buttons Logic
  const square_btn = document.getElementById('Squares');
  const triangle_btn = document.getElementById('Triangles');
  const circle_btn = document.getElementById('Circles');
  
  function updateUI() {
    [square_btn, triangle_btn, circle_btn].forEach(b => b.classList.remove('selected'));
    if(g_selectedType === "square") square_btn.classList.add('selected');
    if(g_selectedType === "triangle") triangle_btn.classList.add('selected');
    if(g_selectedType === "circle") circle_btn.classList.add('selected');
  }

  square_btn.onclick = () => { g_selectedType = "square"; updateUI(); };
  triangle_btn.onclick = () => { g_selectedType = "triangle"; updateUI(); };
  circle_btn.onclick = () => { g_selectedType = "circle"; updateUI(); };
  updateUI();

  // Slider Listeners
  document.getElementById('Red').oninput = function() { g_selectedColor.red = this.value; };
  document.getElementById('Green').oninput = function() { g_selectedColor.green = this.value; };
  document.getElementById('Blue').oninput = function() { g_selectedColor.blue = this.value; };
  document.getElementById('Shape Size').oninput = function() { g_selectedSize = this.value; };
  document.getElementById('Segment Size').oninput = function() { g_selectedSegments = parseInt(this.value); };
  
  // Special rotation data
  const rotation_slider = document.getElementById('Rotation');
  const rotation_display = document.getElementById('RotationDegree');
  rotation_slider.addEventListener('input', function() {
    g_selectedRotation = this.value; // This is a value from 0-360
    rotation_display.innerText = this.value + "°"; // Update the visual label
  });

  // Background Slider Listeners
  document.getElementById('BGRed').oninput = function() { g_backgroundColor[0] = this.value/255; renderAllShapes(gl, shader_vars); };
  document.getElementById('BGGreen').oninput = function() { g_backgroundColor[1] = this.value/255; renderAllShapes(gl, shader_vars); };
  document.getElementById('BGBlue').oninput = function() { g_backgroundColor[2] = this.value/255; renderAllShapes(gl, shader_vars); };

  // Mouse Handlers
  canvas.onmousedown = (ev) => { g_isDrawing = true; click(ev, gl, canvas, shader_vars); };
  canvas.onmousemove = (ev) => { if (g_isDrawing) click(ev, gl, canvas, shader_vars); };
  window.onmouseup = () => { g_isDrawing = false; };

  document.getElementById('Clear').onclick = () => { g_shapes.length = 0; renderAllShapes(gl, shader_vars); };

  renderAllShapes(gl, shader_vars);
}