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
let g_selectedShape = null;
let g_isDrawing = false;

function convertEventToCoords(ev, canvas) {
  var x = ev.clientX;
  var y = ev.clientY;
  var rect = ev.target.getBoundingClientRect();

  x = ((x - rect.left) - canvas.width / 2) / (canvas.width / 2);
  y = (canvas.height / 2 - (y - rect.top)) / (canvas.height / 2);
  return [x, y];
}

function handleMouseDown(ev, gl, canvas, shader_vars, drawing_state) {
  const [x, y] = convertEventToCoords(ev, canvas);

  // 1. Check if we clicked on an existing shape (Picking)
  // We iterate backwards to pick the one on "top"
  for (let i = g_shapes.length - 1; i >= 0; i--) {
    const s = g_shapes[i];
    const d = s.drawing_state.drawing_size / 200.0; // hit area half-width
    
    // Simple AABB (Axis Aligned Bounding Box) check
    if (x > s.x - d && x < s.x + d && y > s.y - d && y < s.y + d) {
      g_selectedShape = s;
      return; // Exit, we found a shape to drag
    }
  }

  // 2. If no shape was clicked, create a new one (your old logic)
  const stateCopy = { 
    drawing_mode: drawing_state.drawing_mode,
    drawing_size: drawing_state.drawing_size,
    color: { ...drawing_state.color },
    segments: drawing_state.segments
  };

  const newShape = { x, y, drawing_state: stateCopy };
  g_shapes.push(newShape);
  g_selectedShape = newShape; // Drag the new shape immediately

  renderAllShapes(gl, shader_vars);
}

function handleMouseMove(ev, gl, canvas, shader_vars) {
  if (g_selectedShape) {
    const [x, y] = convertEventToCoords(ev, canvas);
    
    // Update the position of the selected shape
    g_selectedShape.x = x;
    g_selectedShape.y = y;

    // Redraw the scene
    renderAllShapes(gl, shader_vars);
  }
}

function handleMouseUp() {
  g_selectedShape = null;
}

function addShapeAtMouse(ev, gl, canvas, shader_vars, drawing_state) {
  const [x, y] = convertEventToCoords(ev, canvas);

  // Snapshot the current settings
  const stateCopy = { 
    drawing_mode: drawing_state.drawing_mode,
    drawing_size: drawing_state.drawing_size,
    color: { ...drawing_state.color },
    segments: drawing_state.segments
  };

  const newShape = { x, y, drawing_state: stateCopy };
  g_shapes.push(newShape);

  // Redraw everything
  renderAllShapes(gl, shader_vars);
}

// Helper to convert mouse coordinates
function convertEventToCoords(ev, canvas) {
  var x = ev.clientX;
  var y = ev.clientY;
  var rect = ev.target.getBoundingClientRect();
  x = ((x - rect.left) - canvas.width / 2) / (canvas.width / 2);
  y = (canvas.height / 2 - (y - rect.top)) / (canvas.height / 2);
  return [x, y];
}

function setupWebGL() {
  // Retrieve <canvas> element
  const canvas = document.getElementById('canvas');

  //const opt_attribs = {};
  //const opt_onError = () => console.log("error");

  const gl = WebGLUtils.setupWebGL(canvas);
  return { canvas, gl };
}

function connectVariablesToGLSL(gl) {
  if (!initShaders(gl, VSHADER_SOURCE, FSHADER_SOURCE)) {
    console.error('Failed to intialize shaders.');
    throw { err: 'Failed to intialize shaders.' };
  }

  // Get the storage location of attribute variable 'pos'
  var a_Position = gl.getAttribLocation(gl.program, 'pos');
  if (a_Position < 0) {
    console.error('Failed to get the storage location of pos');
    throw { err: 'Failed to get the storage location of pos' };
  }

  // Get the storage location of u_FragColor
  var u_FragColor = gl.getUniformLocation(gl.program, 'u_FragColor');
  
  // Create a buffer object to reuse for all shapes
  var vertexBuffer = gl.createBuffer();
  if (!vertexBuffer) {
    console.error('Failed to create the buffer object');
    return null;
  }

  return { u_FragColor, a_Position, vertexBuffer };
}

function renderAllShapes(gl, shader_vars) {
  gl.clear(gl.COLOR_BUFFER_BIT);

  for (const shape of g_shapes) {
    const { x, y, drawing_state } = shape;
    const { color, drawing_size, drawing_mode } = drawing_state;

    // 1. Pass the color to the fragment shader
    // (Note: slider values 0-100 converted to 0.0-1.0)
    gl.uniform4f(shader_vars.u_FragColor, color.red/100, color.green/100, color.blue/100, 1.0);

    // 2. Calculate size scaling (normalize pixels/units to WebGL -1 to 1)
    const d = drawing_size / 200.0; 

    let vertices;
    let drawMode;
    let n;

    switch(drawing_mode) {
      case 'square':
        // Create 4 points for a square (using TRIANGLE_FAN)
        vertices = new Float32Array([
          x - d, y + d,  // Top Left
          x - d, y - d,  // Bottom Left
          x + d, y - d,  // Bottom Right
          x + d, y + d   // Top Right
        ]);
        drawMode = gl.TRIANGLE_FAN;
        n = 4;
        break;
      case 'triangle':
        // Create 3 points for a triangle
        vertices = new Float32Array([
          x, y + d,          // Top
          x - d, y - d,      // Bottom Left
          x + d, y - d       // Bottom Right
        ]);
        drawMode = gl.TRIANGLES;
        n = 3;
        break;
      case 'circle':
        drawMode = gl.TRIANGLE_FAN;
        const segs = parseInt(segments);
        // Array size: (Center point + perimeter points + closing point) * 2 coordinates
        vertices = new Float32Array((segs + 2) * 2);
        
        // Center of the circle
        vertices[0] = x;
        vertices[1] = y;

        // Perimeter points
        for (let i = 0; i <= segs; i++) {
          let angle = (i * 2 * Math.PI) / segs;
          let px = x + Math.cos(angle) * d;
          let py = y + Math.sin(angle) * d;
          
          vertices[(i + 1) * 2] = px;
          vertices[(i + 1) * 2 + 1] = py;
        }
        n = segs + 2;
        break;
      default:
        break;
    }

    // 3. Bind buffer and pass vertex data
    gl.bindBuffer(gl.ARRAY_BUFFER, shader_vars.vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.DYNAMIC_DRAW);

    // 4. Assign the buffer to the 'pos' attribute and enable it
    gl.vertexAttribPointer(shader_vars.a_Position, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(shader_vars.a_Position);

    // 5. Draw the shape
    gl.drawArrays(drawMode, 0, n);
  }
}

function click(ev, gl, canvas, shader_vars, drawing_state) {
  var x = ev.clientX;
  var y = ev.clientY;
  var rect = ev.target.getBoundingClientRect();

  x = ((x - rect.left) - canvas.width / 2) / (canvas.width / 2);
  y = (canvas.height / 2 - (y - rect.top)) / (canvas.height / 2);

  // Use Spread operator (...) to create a shallow copy of the state
  // This "freezes" the color and size for this specific shape
  const stateCopy = { 
    drawing_mode: drawing_state.drawing_mode,
    drawing_size: drawing_state.drawing_size,
    color: { ...drawing_state.color },
    segments: drawing_state.segments
  };

  const newShape = { x, y, drawing_state: stateCopy };
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

  const size_slider = document.getElementById('Shape Size'); // Ensure this ID exists in HTML
  size_slider.addEventListener("input", function() {
      drawing_size = this.value;
  });

  const seg_slider = document.getElementById('Segment Size'); 
  if (seg_slider) {
    seg_slider.addEventListener("input", function() {
      segments = this.value;
    });
  }

  const clear_btn = document.getElementById('Clear');
  if (clear_btn) {
    clear_btn.addEventListener('click', () => {
      g_shapes.length = 0; // Empty the array
      renderAllShapes(gl, shader_vars);
    });
  }

  try {
    // Get the rendering context for WebGL
    const { canvas, gl } = setupWebGL();
    if (!gl) {
      console.error('Failed to get the rendering context for WebGL');
      return;
    }

    const shader_vars = connectVariablesToGLSL(gl);

    // 1. When mouse is pressed, start drawing and place the first "dot"
    canvas.addEventListener('mousedown', (ev) => {
      g_isDrawing = true;
      addShapeAtMouse(ev, gl, canvas, shader_vars, { drawing_mode, drawing_size, color, segments });
    });

    // 2. When mouse moves, if we are drawing, keep adding shapes
    canvas.addEventListener('mousemove', (ev) => {
      if (g_isDrawing) {
        addShapeAtMouse(ev, gl, canvas, shader_vars, { drawing_mode, drawing_size, color, segments });
      }
    });

    // 3. When mouse is released, stop drawing
    window.addEventListener('mouseup', () => {
      g_isDrawing = false;
    });

    // Specify the color for clearing <canvas>
    gl.clearColor(0.0, 0.0, 0.0, 1.0);

    renderAllShapes(gl, shader_vars);
  } catch (error) { 
    console.error('Could not run due to error', {error})
  }
}