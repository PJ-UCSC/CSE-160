// ColoredPoint.js (c) 2012 matsuda
// Vertex shader program
var VSHADER_SOURCE =`
  attribute vec2 pos;
  void main(void) {
    gl_Position = vec4(pos, 0, 1);
  }
`;

// Fragment shader program
var FSHADER_SOURCE =`
  precision mediump float;
  uniform vec4 u_FragColor;  // uniform変数
  void main() {
    gl_FragColor = u_FragColor;
  }
`;

const g_shapes = [];;  // The array to store the shapes

function setupWebGL() {
  // Retrieve <canvas> element
  const canvas = document.getElementById('canvas');

  //const opt_attribs = {};
  //const opt_onError = () => console.log("error");

  const gl = WebGLUtils.setupWebGL(canvas);
  return { canvas, gl };
}

function connectVariablesToGLSL(gl) {
  // Initialize shaders
  if (!initShaders(gl, VSHADER_SOURCE, FSHADER_SOURCE)) {
    console.error('Failed to intialize shaders.');
    throw { err: 'Failed to intialize shaders.' };
  }

  // Get the storage location of u_FragColor
  var u_FragColor = gl.getUniformLocation(gl.program, 'u_FragColor');
  if (!u_FragColor) {
    console.error('Failed to get the storage location of u_FragColor');
    throw { err: 'Failed to get the storage location of u_FragColor' };
  }

  return { u_FragColor };
}

function renderAllShapes(gl, shader_vars) {

  // Clear <canvas>
  gl.clear(gl.COLOR_BUFFER_BIT);

  const squareVerticies = new Float32Array([
    0.5, 0.5,
    -0.5, 0.5,
    -0.5, -0.5,
    0.5, -0.5
  ]);

  const triangleVerticies = new Float32Array([
    0, 0.5,
    -0.5, -0.5,
    0.5, -0.5
  ]);

  // loop over the shapes array and render each shape
  for (const shape of g_shapes) {
    switch(shape.drawing_state.drawing_mode) {
      case 'triangle':
        break;
      case 'square':
        break;
      case 'circle':
        break;
      default:
    }
  }
}

function click(ev, gl, canvas, shader_vars, drawing_state) {
        
  var x = ev.clientX; // x coordinate of a mouse pointer
  var y = ev.clientY; // y coordinate of a mouse pointer
  var rect = ev.target.getBoundingClientRect();

  x = ((x - rect.left) - canvas.width / 2) / (canvas.width / 2);
  y = (canvas.height / 2 - (y - rect.top)) / (canvas.height / 2);

  const newShape = {x, y, drawing_state};
  g_shapes.push(newShape);

  renderAllShapes(gl, shader_vars);
}

function main() {

  let drawing_mode = "";
  let drawing_size = 20;
  let color = {red: 0, green: 0, blue: 0};
  let segments = 5;

  const square_btn = document.getElementById('Squares');
  const triangle_btn = document.getElementById('Triangles');
  const circle_btn = document.getElementById('Circles');
  
  function selectSquareMode() {
    drawing_mode = "square";
    circle_btn.classList.remove("selected");
    square_btn.classList.add("selected");
    triangle_btn.classList.remove("selected");
  }

  function selectTriangleMode() {
    drawing_mode = "triangle";
    circle_btn.classList.remove("selected");
    square_btn.classList.remove("selected");
    triangle_btn.classList.add("selected");
  }

  function selectCircleMode() {
    drawing_mode = "circle";
    circle_btn.classList.add("selected");
    square_btn.classList.remove("selected");
    triangle_btn.classList.remove("selected");
  }

  square_btn.addEventListener('click', selectSquareMode);

  triangle_btn.addEventListener('click', selectTriangleMode);

  circle_btn.addEventListener('click', selectCircleMode);

  selectSquareMode();

  const red_slider = document.getElementById('Red');
  red_slider.addEventListener("input", function() {
    color.red = this.value;
  });

  const green_slider = document.getElementById('Green');
  green_slider.addEventListener("input", function() {
    color.green = this.value;
  });

  const blue_slider = document.getElementById('Blue');
  blue_slider.addEventListener("input", function() {
    color.blue = this.value;
  });

  try {
    // Get the rendering context for WebGL
    const { canvas, gl } = setupWebGL();
    if (!gl) {
      console.error('Failed to get the rendering context for WebGL');
      return;
    }

    const shader_vars = connectVariablesToGLSL(gl);

    // Register function (event handler) to be called on a mouse press
    canvas.addEventListener('mousedown', (ev) => click(ev, gl, canvas,
      shader_vars,
      { drawing_mode, drawing_size, color, segments },
    ));

    // Specify the color for clearing <canvas>
    gl.clearColor(0.0, 0.0, 0.0, 1.0);

    renderAllShapes(gl, shader_vars);
  } catch (error) { 
    console.error('Could not run due to error', {error})
  }
}