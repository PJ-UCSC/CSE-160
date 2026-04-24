// --- GLOBAL VARIABLES ---
let canvas, gl, shader_vars;
let g_startTime = performance.now();
let g_seconds = 0;
let g_lastFrameTime = performance.now();

// Interaction States
let g_animate = false;
let g_isPoked = false;
let g_globalRotationX = 15, g_globalRotationY = -30;

// Joint Angles
let g_neckAngle = 0;
let g_armAngle = 0;   // Front Limbs L1
let g_elbowAngle = 0; // Front Limbs L2
let g_handAngle = 0;  // Front Limbs L3
let g_legAngle = 0;   // Back Limbs L1
let g_kneeAngle = 0;  // Back Limbs L2
let g_footAngle = 0;  // Back Limbs L3

// Mouse Tracking
let g_dragging = false;
let g_lastX = -1, g_lastY = -1;

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
  }`;

const FSHADER_SOURCE = `
  precision mediump float;
  varying vec4 v_Color;
  void main() { gl_FragColor = v_Color; }`;

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

  setupGeometry();
  setupUI();

  canvas.onmousedown = (ev) => { g_dragging = true; g_lastX = ev.clientX; g_lastY = ev.clientY; };
  canvas.onmouseup = () => { g_dragging = false; };
  canvas.onmousemove = (ev) => { if(g_dragging) handleMouseMove(ev); };
  
  canvas.onclick = (ev) => { if(ev.shiftKey) { g_isPoked = true; setTimeout(()=>g_isPoked=false, 1000); }};

  gl.enable(gl.DEPTH_TEST);
  requestAnimationFrame(tick);
}

function tick() {
  g_seconds = (performance.now() - g_startTime) / 1000.0;
  updateAnimation();
  renderScene();
  updateFPS();
  requestAnimationFrame(tick);
}

function updateFPS() {
    let now = performance.now();
    let duration = now - g_lastFrameTime;
    g_lastFrameTime = now;
    if (duration > 0) document.getElementById('fpsCounter').innerText = "FPS: " + Math.round(1000/duration);
}

function updateAnimation() {
  if (g_animate) {
    // Alternating Walk Cycle
    let swing = Math.sin(g_seconds * 5);
    g_legAngle = 25 * swing;
    g_kneeAngle = 15 * swing + 15;
    
    // Arms move opposite to legs for natural look
    g_armAngle = -25 * swing;
    g_elbowAngle = -15 * swing + 15;
  }
  if (g_isPoked) {
    g_neckAngle = 20 * Math.sin(g_seconds * 20);
  }
}

function handleMouseMove(ev) {
  g_globalRotationY += (ev.clientX - g_lastX);
  g_globalRotationX += (ev.clientY - g_lastY);
  g_lastX = ev.clientX; g_lastY = ev.clientY;
}

function renderScene() {
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  let projMat = new Matrix4();
  projMat.setPerspective(35, canvas.width/canvas.height, 0.1, 100);
  gl.uniformMatrix4fv(shader_vars.u_ProjectionMatrix, false, projMat.elements);

  let viewMat = new Matrix4();
  viewMat.setLookAt(0, 0, 15, 0, 0, 0, 0, 1, 0);
  gl.uniformMatrix4fv(shader_vars.u_ViewMatrix, false, viewMat.elements);

  let globalRot = new Matrix4();
  globalRot.rotate(g_globalRotationX, 1, 0, 0);
  globalRot.rotate(g_globalRotationY, 0, 1, 0);
  gl.uniformMatrix4fv(shader_vars.u_GlobalRotation, false, globalRot.elements);

  // --- KOALA BODY ---
  let bodyMat = new Matrix4();
  bodyMat.scale(2.2, 2.5, 1.8);
  drawCube(bodyMat, [0.6, 0.6, 0.6]);

  // --- HEAD HIERARCHY ---
  let neckMat = new Matrix4();
  neckMat.translate(0, 1.3, 0);
  neckMat.rotate(g_neckAngle, 0, 0, 1);
  let headBase = new Matrix4(neckMat); 
  neckMat.scale(0.8, 0.4, 0.8);
  drawCube(neckMat, [0.6, 0.6, 0.6]);

  let headMat = new Matrix4(headBase);
  headMat.translate(0, 0.8, 0);
  headMat.scale(1.6, 1.4, 1.6);
  drawCube(headMat, [0.6, 0.6, 0.6]);

  // EYES (Small black cubes)
  let eyeL = new Matrix4(headBase);
  eyeL.translate(-0.35, 0.9, 0.82);
  eyeL.scale(0.2, 0.2, 0.1);
  drawCube(eyeL, [0, 0, 0]);

  let eyeR = new Matrix4(headBase);
  eyeR.translate(0.35, 0.9, 0.82);
  eyeR.scale(0.2, 0.2, 0.1);
  drawCube(eyeR, [0, 0, 0]);

  // NOSE
  let noseMat = new Matrix4(headBase);
  noseMat.translate(0, 0.6, 0.9);
  noseMat.scale(0.5, 0.6, 0.3);
  drawCube(noseMat, [0.1, 0.1, 0.1]);

  // Left Ear
  let earL = new Matrix4(headBase);
  earL.translate(-0.8, 1.5, 0.2); // Move to side of head
  earL.scale(0.7, 0.7, 1);       // Make it a large circle
  drawCircle(earL, [0.8, 0.8, 0.8]); // Lighter grey for inner ear fur

  // Right Ear
  let earR = new Matrix4(headBase);
  earR.translate(0.8, 1.5, 0.2);
  earR.scale(0.7, 0.7, 1);
  drawCircle(earR, [0.8, 0.8, 0.8]);

  // --- LIMBS (Alternating movement) ---
  // Parameters: (tx, ty, tz, rotL1, rotL2, rotL3)
  // FRONT LIMBS
  renderLimb(1.2, 0.4, 0.5, g_armAngle, g_elbowAngle, g_handAngle);  // FR
  renderLimb(-1.2, 0.4, 0.5, -g_armAngle, g_elbowAngle, g_handAngle); // FL
  
  // BACK LIMBS
  renderLimb(0.8, -1.2, -0.4, g_legAngle, g_kneeAngle, g_footAngle);  // BR
  renderLimb(-0.8, -1.2, -0.4, -g_legAngle, g_kneeAngle, g_footAngle); // BL
}

function renderLimb(tx, ty, tz, r1, r2, r3) {
  let base = new Matrix4();
  base.translate(tx, ty, tz);
  base.rotate(r1, 1, 0, 0);
  
  let L1 = new Matrix4(base);
  L1.scale(0.45, 0.9, 0.45);
  drawCube(L1, [0.5, 0.5, 0.5]);

  base.translate(0, -0.8, 0);
  base.rotate(r2, 1, 0, 0);
  let L2 = new Matrix4(base);
  L2.scale(0.35, 0.8, 0.35);
  drawCube(L2, [0.5, 0.5, 0.5]);

  base.translate(0, -0.5, 0.25);
  base.rotate(r3, 1, 0, 0);
  let L3 = new Matrix4(base);
  L3.scale(0.45, 0.15, 0.7);
  drawCube(L3, [0.3, 0.3, 0.3]);
}

// --- GEOMETRY DATA ---
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
  
  shader_vars.circleBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, shader_vars.circleBuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(circleVerts), gl.STATIC_DRAW);
}

function drawCube(matrix, color) {
  gl.uniformMatrix4fv(shader_vars.u_ModelMatrix, false, matrix.elements);
  gl.bindBuffer(gl.ARRAY_BUFFER, shader_vars.cubeBuf);
  gl.vertexAttribPointer(shader_vars.a_Position, 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(shader_vars.a_Position);
  
  // Use a simplified lighting effect: darken color based on face
  // This is a "fake" lighting trick for 3D look without light shaders
  gl.vertexAttrib4f(shader_vars.a_Color, color[0], color[1], color[2], 1.0);
  gl.drawArrays(gl.TRIANGLES, 0, 36);
}

function drawPyramid(matrix) {
  gl.uniformMatrix4fv(shader_vars.u_ModelMatrix, false, matrix.elements);
  gl.bindBuffer(gl.ARRAY_BUFFER, shader_vars.pyrBuf);
  gl.vertexAttribPointer(shader_vars.a_Position, 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(shader_vars.a_Position);
  gl.vertexAttrib4f(shader_vars.a_Color, 0.45, 0.45, 0.45, 1.0);
  gl.drawArrays(gl.TRIANGLES, 0, 12);
}

function drawCircle(matrix, color) {
  gl.uniformMatrix4fv(shader_vars.u_ModelMatrix, false, matrix.elements);
  gl.bindBuffer(gl.ARRAY_BUFFER, shader_vars.circleBuf);
  gl.vertexAttribPointer(shader_vars.a_Position, 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(shader_vars.a_Position);
  
  gl.disableVertexAttribArray(shader_vars.a_Color);
  gl.vertexAttrib4f(shader_vars.a_Color, color[0], color[1], color[2], 1.0);
  
  // We use TRIANGLE_FAN for circles. 
  // 32 points = 1 center + 30 segments + 1 to close the loop
  gl.drawArrays(gl.TRIANGLE_FAN, 0, 32); 
}

function setupUI() {
  document.getElementById('animOn').onclick = () => g_animate = true;
  document.getElementById('animOff').onclick = () => g_animate = false;
  document.getElementById('neckSlide').oninput = function() { g_neckAngle = this.value; };
  document.getElementById('armSlide').oninput = function() { g_armAngle = this.value; };
  document.getElementById('elbowSlide').oninput = function() { g_elbowAngle = this.value; };
  document.getElementById('handSlide').oninput = function() { g_handAngle = this.value; };
  document.getElementById('legSlide').oninput = function() { g_legAngle = this.value; };
  document.getElementById('kneeSlide').oninput = function() { g_kneeAngle = this.value; };
  document.getElementById('footSlide').oninput = function() { g_footAngle = this.value; };
}