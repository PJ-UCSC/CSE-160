// Mouse Tracking
let g_dragging = false;
let g_lastX = -1, g_lastY = -1;
let g_globalAngleX = 0;
let g_globalAngleY = 0;

const VSHADER_SOURCE = `
  attribute vec4 a_Position;
  attribute vec4 a_Color;
  uniform mat4 u_ModelMatrix;
  uniform mat4 u_GlobalRotation;
  uniform mat4 u_ProjectionMatrix;
  uniform mat4 u_ViewMatrix;
  varying vec4 v_Color;
  void main() {
    gl_Position = u_ProjectionMatrix * u_ViewMatrix * u_GlobalRotation * u_ModelMatrix * a_Position;
    v_Color = a_Color;
  }`
;

const FSHADER_SOURCE = `
  precision mediump float;
  varying vec4 v_Color;
  void main() { gl_FragColor = v_Color; }`
;

function setupGeometry() {
  const verts = new Float32Array([
    -0.5,0.5,0.5, -0.5,-0.5,0.5, 0.5,-0.5,0.5, -0.5,0.5,0.5, 0.5,-0.5,0.5, 0.5,0.5,0.5, // Front
    -0.5,0.5,-0.5, -0.5,-0.5,-0.5, 0.5,-0.5,-0.5, -0.5,0.5,-0.5, 0.5,-0.5,-0.5, 0.5,0.5,-0.5, // Back
    -0.5,0.5,0.5, 0.5,0.5,0.5, 0.5,0.5,-0.5, -0.5,0.5,0.5, 0.5,0.5,-0.5, -0.5,0.5,-0.5, // Top
    -0.5,-0.5,0.5, 0.5,-0.5,0.5, 0.5,-0.5,-0.5, -0.5,-0.5,0.5, 0.5,-0.5,-0.5, -0.5,-0.5,-0.5, // Bottom
    0.5,0.5,0.5, 0.5,-0.5,0.5, 0.5,-0.5,-0.5, 0.5,0.5,0.5, 0.5,-0.5,-0.5, 0.5,0.5,-0.5, // Right
    -0.5,0.5,0.5, -0.5,-0.5,0.5, -0.5,-0.5,-0.5, -0.5,0.5,0.5, -0.5,-0.5,-0.5, -0.5,0.5,-0.5  // Left
  ]);
  shader_vars.cubeBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, shader_vars.cubeBuf);
  gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);

  const pyr = new Float32Array([
     0,0.5,0, -0.5,-0.5,0.5, 0.5,-0.5,0.5,
     0,0.5,0, 0.5,-0.5,0.5, 0.5,-0.5,-0.5,
     0,0.5,0, 0.5,-0.5,-0.5, -0.5,-0.5,-0.5,
     0,0.5,0, -0.5,-0.5,-0.5, -0.5,-0.5,0.5
  ]);
  shader_vars.pyrBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, shader_vars.pyrBuf);
  gl.bufferData(gl.ARRAY_BUFFER, pyr, gl.STATIC_DRAW);

  // CIRCLE (For Koala Ears)
  let circleVerts = [0, 0, 0]; // Center point
  let segments = 30;
  for (let i = 0; i <= segments; i++) {
    let angle = (i * 2 * Math.PI) / segments;
    circleVerts.push(Math.cos(angle), Math.sin(angle), 0);
  }

  // --- SPHERE GEOMETRY ---
  let sphereVerts = [];
  let d = 10; // Resolution (Higher = smoother, but slower)
  
  for (let lat = 0; lat <= 180; lat += d) {
    for (let lon = 0; lon <= 360; lon += d) {
      // Convert degrees to radians
      let r1 = lat * Math.PI / 180;
      let r2 = (lat + d) * Math.PI / 180;
      let c1 = lon * Math.PI / 180;
      let c2 = (lon + d) * Math.PI / 180;

      // Define 4 points of a quad on the sphere surface
      let p1 = [Math.sin(r1)*Math.cos(c1), Math.sin(r1)*Math.sin(c1), Math.cos(r1)];
      let p2 = [Math.sin(r2)*Math.cos(c1), Math.sin(r2)*Math.sin(c1), Math.cos(r2)];
      let p3 = [Math.sin(r2)*Math.cos(c2), Math.sin(r2)*Math.sin(c2), Math.cos(r2)];
      let p4 = [Math.sin(r1)*Math.cos(c2), Math.sin(r1)*Math.sin(c2), Math.cos(r1)];

      // Triangle 1
      sphereVerts.push(...p1, ...p2, ...p4);
      // Triangle 2
      sphereVerts.push(...p2, ...p3, ...p4);
    }
  }

  shader_vars.sphereBuf = gl.createBuffer();
  shader_vars.sphereVertCount = sphereVerts.length / 3;
  gl.bindBuffer(gl.ARRAY_BUFFER, shader_vars.sphereBuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(sphereVerts), gl.STATIC_DRAW);
  
  shader_vars.circleBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, shader_vars.circleBuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(circleVerts), gl.STATIC_DRAW);
}

function drawCube(matrix, color) {
  gl.uniformMatrix4fv(shader_vars.u_ModelMatrix, false, matrix.elements);
  gl.bindBuffer(gl.ARRAY_BUFFER, shader_vars.cubeBuf);
  gl.vertexAttribPointer(shader_vars.a_Position, 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(shader_vars.a_Position);
  
  // Disable the attribute array so vertexAttrib4f (constant color) works
  gl.disableVertexAttribArray(shader_vars.a_Color); 
  gl.vertexAttrib4f(shader_vars.a_Color, color[0], color[1], color[2], 1.0);
  
  gl.drawArrays(gl.TRIANGLES, 0, 36);
}

function render() {
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  
  // Example: Apply mouse rotation to Global Rotation here
  let globalRotMat = new Matrix4().rotate(g_lastX, 0, 1, 0).rotate(g_lastY, 1, 0, 0);
  gl.uniformMatrix4fv(shader_vars.u_GlobalRotation, false, globalRotMat.elements);

  let bodyMat = new Matrix4();
  bodyMat.scale(1.0, 1.0, 1.0); // Scaled down so it fits in view
  drawCube(bodyMat, [0.6, 0.6, 0.6]);
}

function handleMouseMove(ev) {
  let x = ev.clientX;
  let y = ev.clientY;

  if (g_dragging) {
    // Calculate how much the mouse moved since the last frame
    let factor = 100 / canvas.height; // Sensitivity
    let dx = factor * (x - g_lastX);
    let dy = factor * (y - g_lastY);

    // Update global angles
    g_globalAngleY = g_globalAngleY + dx;
    g_globalAngleX = g_globalAngleX + dy;

    // Redraw the scene with the new angles
    renderAllShapes();
  }

  // Update last positions
  g_lastX = x;
  g_lastY = y;
}

function renderAllShapes() {
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  let globalRotMat = new Matrix4();
  globalRotMat.rotate(g_globalAngleX, 1, 0, 0);
  globalRotMat.rotate(g_globalAngleY, 0, 1, 0);
  
  gl.uniformMatrix4fv(shader_vars.u_GlobalRotation, false, globalRotMat.elements);

  let bodyMat = new Matrix4();
  bodyMat.scale(2.2, 2.5, 1.8);
  drawCube(bodyMat, [0.6, 0.6, 0.6]);
}

function main() {
  canvas = document.getElementById('webgl');
  gl = canvas.getContext('webgl');
  if (!initShaders(gl, VSHADER_SOURCE, FSHADER_SOURCE)) return;

  shader_vars = {
    a_Position: gl.getAttribLocation(gl.program, 'a_Position'),
    a_Color: gl.getAttribLocation(gl.program, 'a_Color'),
    u_ModelMatrix: gl.getUniformLocation(gl.program, 'u_ModelMatrix'),
    u_GlobalRotation: gl.getUniformLocation(gl.program, 'u_GlobalRotation'),
    u_ProjectionMatrix: gl.getUniformLocation(gl.program, 'u_ProjectionMatrix'),
    u_ViewMatrix: gl.getUniformLocation(gl.program, 'u_ViewMatrix')
  };

  let projMat = new Matrix4();
  projMat.setPerspective(30, canvas.width / canvas.height, 1, 100);
  
  let viewMat = new Matrix4();
  viewMat.setLookAt(0, 0, 10, 0, 0, 0, 0, 1, 0); // Camera at (0,0,10) looking at origin

  let globalRotMat = new Matrix4(); // Identity matrix (no rotation yet)

  gl.uniformMatrix4fv(shader_vars.u_ProjectionMatrix, false, projMat.elements);
  gl.uniformMatrix4fv(shader_vars.u_ViewMatrix, false, viewMat.elements);
  gl.uniformMatrix4fv(shader_vars.u_GlobalRotation, false, globalRotMat.elements);

  setupGeometry();
  renderAllShapes();

  canvas.onmousedown = (ev) => { g_dragging = true; g_lastX = ev.clientX; g_lastY = ev.clientY; };
  canvas.onmouseup = () => { g_dragging = false; };
  canvas.onmousemove = (ev) => { if(g_dragging) handleMouseMove(ev); };
  
  canvas.onclick = (ev) => { if(ev.shiftKey) { g_isPoked = true; setTimeout(()=>g_isPoked=false, 1000); }};
  gl.clearColor(0.0, 0.0, 0.0, 1.0);

  gl.enable(gl.DEPTH_TEST);
}