const VSHADER_SOURCE = `
    attribute vec4 a_Position;
    attribute vec2 a_TextureCoordinate;
    attribute vec3 a_Normal;

    uniform mat4 u_ModelMatrix;
    uniform mat4 u_ProjectionMatrix;
    uniform mat4 u_ViewMatrix;

    varying vec2 v_TextureCoordinate;
    varying vec3 v_Normal;

    void main() {
        gl_Position = u_ProjectionMatrix * u_ViewMatrix * u_ModelMatrix * a_Position;
        v_TextureCoordinate = a_TextureCoordinate;
        v_Normal = a_Normal;
    }
`;

const FSHADER_SOURCE = `
    precision mediump float;

    varying vec2 v_TextureCoordinate;
    varying vec3 v_Normal;

    uniform sampler2D u_Sampler;
    uniform vec4 u_Color;
    uniform float u_texColorWeight;
    uniform float u_ShowNormals;

    void main() {
        if (u_ShowNormals > 0.5){
            gl_FragColor = vec4(v_Normal, 1.0);
        } else {
            vec4 texColor = texture2D(u_Sampler, v_TextureCoordinate);
            gl_FragColor = (1.0 - u_texColorWeight) * u_Color + u_texColorWeight * texColor;
        }
    }
`;

let canvas, gl, camera, shader_vars = {};
let g_dragging = false, g_lastX = -1;
let MAP = []; 
let zombies = [];
let g_keys = {};
let currentWave = 1;
let waveActive = true;
let freeBuildMode = false;
let gameStarted = false;
let g_lastFrameTime = performance.now();
let g_dirtTex, g_grassTex;
let g_showNormals = false;

// Initialize 32x32 height map with borders
for(let i=0; i<32; i++) {
    MAP[i] = new Array(32).fill(0);
    MAP[i][0] = 4; MAP[i][31] = 4;
}
MAP[0] = new Array(32).fill(4); MAP[31] = new Array(32).fill(4);

function startGame() {
    gameStarted = true;
    document.getElementById('main-menu').style.display = 'none';
}

function spawnZombies(count) {
    zombies = [];
    for (let i = 0; i < count; i++) {
        let side = Math.floor(Math.random() * 4);
        let rx = 16, rz = 16;
        if (side == 0) { rx = 2; rz = Math.random() * 28 + 2; }
        else if (side == 1) { rx = 29; rz = Math.random() * 28 + 2; }
        else if (side == 2) { rz = 2; rx = Math.random() * 28 + 2; }
        else { rz = 29; rx = Math.random() * 28 + 2; }
        zombies.push({ pos: [rx, 0, rz], hp: 3, speed: 0.025 + (Math.random() * 0.015), dead: false });
    }
}

function startNextWave() {
    if (freeBuildMode) return;
    currentWave++;
    if (currentWave > 3) {
        document.getElementById('congrats').style.display = 'flex';
        waveActive = false;
        return;
    }
    document.getElementById('wave-display').innerText = "WAVE: " + currentWave;
    spawnZombies(currentWave == 2 ? 3 : 5);
}

function restartWaves() {
    currentWave = 1; camera.hp = 100;
    document.getElementById('hp-bar').style.width = "100%";
    document.getElementById('congrats').style.display = 'none';
    document.getElementById('wave-display').innerText = "WAVE: 1";
    freeBuildMode = false; waveActive = true;
    spawnZombies(1);
}

function stayInWorld() {
    document.getElementById('congrats').style.display = 'none';
    document.getElementById('wave-display').innerText = "BUILD MODE";
    freeBuildMode = true;
}

function drawCube(matrix, texture, color, weight) {
    const geomSizeOf = shader_vars.cubeGeomSizeOf;
    const geomBufStride = geomSizeOf * 8;
    
    gl.bindBuffer(gl.ARRAY_BUFFER, shader_vars.cubeGeomBuf);
    gl.vertexAttribPointer(shader_vars.a_Position, 3, gl.FLOAT, false, geomBufStride, 0); 
    gl.enableVertexAttribArray(shader_vars.a_Position);
    gl.vertexAttribPointer(shader_vars.a_TextureCoordinate, 2, gl.FLOAT, false, geomBufStride, geomSizeOf * 3); 
    gl.enableVertexAttribArray(shader_vars.a_TextureCoordinate);
    gl.vertexAttribPointer(shader_vars.a_Normal, 3, gl.FLOAT, false, geomBufStride, geomSizeOf * 5); 
    gl.enableVertexAttribArray(shader_vars.a_Normal);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, shader_vars.cubeIndexBuf);

    gl.uniformMatrix4fv(shader_vars.u_ModelMatrix, false, matrix.elements);
    gl.uniform4f(shader_vars.u_Color, color[0], color[1], color[2], color[3]);
    gl.uniform1f(shader_vars.u_texColorWeight, weight);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.uniform1i(shader_vars.u_Sampler, 0);

    gl.uniform1f(shader_vars.u_ShowNormals, g_showNormals ? 1.0 : 0.0);

    gl.drawElements(gl.TRIANGLES, 36, gl.UNSIGNED_SHORT, 0);
}

function drawSphere(matrix, texture, color, weight) {
    const geomSizeOf = shader_vars.sphereGeomSizeOf;
    const geomBufStride = geomSizeOf * 8;
    
    gl.bindBuffer(gl.ARRAY_BUFFER, shader_vars.sphereGeomBuf);
    gl.vertexAttribPointer(shader_vars.a_Position, 3, gl.FLOAT, false, geomBufStride, 0); 
    gl.enableVertexAttribArray(shader_vars.a_Position);
    gl.vertexAttribPointer(shader_vars.a_TextureCoordinate, 2, gl.FLOAT, false, geomBufStride, geomSizeOf * 3); 
    gl.enableVertexAttribArray(shader_vars.a_TextureCoordinate);
    gl.vertexAttribPointer(shader_vars.a_Normal, 3, gl.FLOAT, false, geomBufStride, geomSizeOf * 5); 
    gl.enableVertexAttribArray(shader_vars.a_Normal);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, shader_vars.sphereIndexBuf);
    gl.uniformMatrix4fv(shader_vars.u_ModelMatrix, false, matrix.elements);
    gl.uniform4f(shader_vars.u_Color, color[0], color[1], color[2], color[3]);
    gl.uniform1f(shader_vars.u_texColorWeight, weight);
    gl.activeTexture(gl.TEXTURE0); 
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.uniform1i(shader_vars.u_Sampler, 0);

    gl.uniform1f(shader_vars.u_ShowNormals, g_showNormals ? 1.0 : 0.0);

    gl.drawElements(gl.TRIANGLES, shader_vars.sphereIndexCnt, gl.UNSIGNED_SHORT, 0);
}

function drawZombie(x, y, z, angle) {
    let baseMat = new Matrix4().translate(x, y, z).rotate(angle, 0, 1, 0);
    drawCube(new Matrix4(baseMat).translate(0, 0.95, 0).scale(0.35, 0.35, 0.35), shader_vars.whiteTex, [0, 0.7, 0, 1], 0.0); // Head
    drawCube(new Matrix4(baseMat).translate(0, 0.6, 0).scale(0.45, 0.5, 0.2), shader_vars.whiteTex, [0, 0.5, 0.5, 1], 0.0); // Body
    drawCube(new Matrix4(baseMat).translate(-0.12, 0.2, 0).scale(0.2, 0.4, 0.2), shader_vars.whiteTex, [0, 0, 0.5, 1], 0.0); // Leg L
    drawCube(new Matrix4(baseMat).translate(0.12, 0.2, 0).scale(0.2, 0.4, 0.2), shader_vars.whiteTex, [0, 0, 0.5, 1], 0.0); // Leg R
    drawCube(new Matrix4(baseMat).translate(-0.3, 0.7, 0.2).scale(0.15, 0.15, 0.5), shader_vars.whiteTex, [0, 0.7, 0, 1], 0.0); // Arm L
    drawCube(new Matrix4(baseMat).translate(0.3, 0.7, 0.2).scale(0.15, 0.15, 0.5), shader_vars.whiteTex, [0, 0.7, 0, 1], 0.0); // Arm R
}

function tick() {
    // --- FPS CALCULATION ---
    let now = performance.now();
    let duration = now - g_lastFrameTime;
    g_lastFrameTime = now;
    if (duration > 0) {
        let fps = Math.round(1000 / duration);
        document.getElementById('fps-counter').innerText = "FPS: " + fps;
    }

    // 1. Always render
    render();

    // 2. If dead or menu is open, stop here
    if (!gameStarted || camera.isDead) {
        requestAnimationFrame(tick);
        return;
    }

    // 3. MOVEMENT (This must be OUTSIDE the wave check)
    if (g_keys['w']) camera.moveForward();
    if (g_keys['s']) camera.moveBackward();
    if (g_keys['a']) camera.moveLeft();
    if (g_keys['d']) camera.moveRight();
    if (g_keys['q']) camera.panLeft();
    if (g_keys['e']) camera.panRight();

    // 4. WAVE & ZOMBIE LOGIC (Only run this if a wave is actually active)
    if (waveActive) {
        let allDead = true;
        for (let z of zombies) {
            if (z.dead) continue;
            allDead = false;
            
            // Zombie movement and damage logic...
            let dx = camera.eye.elements[0] - z.pos[0], dz = camera.eye.elements[2] - z.pos[2];
            let dist = Math.sqrt(dx*dx + dz*dz);
            if (dist > 0.5) { 
                // z.pos[0] += (dx/dist)*z.speed; 
                // z.pos[2] += (dz/dist)*z.speed; 
            } else { 
                camera.hp -= 0.4; 
                document.getElementById('hp-bar').style.width = Math.max(0, camera.hp) + "%"; 
            }
        }

        if (camera.hp <= 0) {
            camera.isDead = true;
            document.getElementById('game-over').style.display = 'flex';
        }
        
        if (allDead && !freeBuildMode) startNextWave();
    }

    requestAnimationFrame(tick);
}

function initTextures(gl, callback) {
    let imagesLoaded = 0;
    const totalImages = 2;

    function onImageLoad(img, texVar, isAtlas) {
        let tex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, tex);
        // Use NEAREST for that blocky Minecraft look
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        
        // Use REPEAT so the ground texture doesn't stretch
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);

        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
        
        if (texVar === 'dirt') g_dirtTex = tex;
        if (texVar === 'grass') g_grassTex = tex;

        imagesLoaded++;
        if (imagesLoaded === totalImages) callback();
    }

    let imgDirt = new Image();
    imgDirt.onload = () => onImageLoad(imgDirt, 'dirt');
    imgDirt.src = 'images/dirt.png'; // Make sure this path is correct

    let imgGrass = new Image();
    imgGrass.onload = () => onImageLoad(imgGrass, 'grass');
    imgGrass.src = 'images/atlas.png'; // Using the atlas for the ground
}

function initMap() {
    for(let i=0; i<32; i++) {
        MAP[i] = new Array(32).fill(0);
    }

    for(let i=0; i<32; i++) {
        // Left and Right walls
        MAP[i][0] = Math.floor(Math.random() * 4) + 1; 
        MAP[i][31] = Math.floor(Math.random() * 4) + 1;
        // Top and Bottom walls
        MAP[0][i] = Math.floor(Math.random() * 4) + 1;
        MAP[31][i] = Math.floor(Math.random() * 4) + 1;
    }
    
    for(let i=0; i<15; i++) {
        let rx = Math.floor(Math.random() * 28) + 2;
        let rz = Math.floor(Math.random() * 28) + 2;
        MAP[rx][rz] = Math.floor(Math.random() * 3) + 1;
    }
}

function render() {
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.uniformMatrix4fv(shader_vars.u_ProjectionMatrix, false, camera.projectionMatrix.elements);
    gl.uniformMatrix4fv(shader_vars.u_ViewMatrix, false, camera.viewMatrix.elements);

    // 1. Sky
    drawCube(new Matrix4().scale(-500, -500, -500), shader_vars.whiteTex, [0.4, 0.6, 1, 1], 0.0);

    // 2. Ground
    let groundMat = new Matrix4().translate(16, -0.5, 16).scale(32, 0.1, 32);
    drawCube(groundMat, g_grassTex, [1, 1, 1, 1], 1.0);

    // 3. Walls (Using Dirt Texture)
    for(let x=0; x<32; x++) {
        for(let z=0; z<32; z++) {
            for(let y=0; y<MAP[x][z]; y++) {
                drawSphere(new Matrix4().translate(x, y, z), g_dirtTex, [1,1,1,1], 1.0);
            }
        }
    }

    // 4. Zombies
    for (let z of zombies) {
        if (!z.dead) drawZombie(z.pos[0], 0, z.pos[2], Math.atan2(camera.eye.elements[0]-z.pos[0], camera.eye.elements[2]-z.pos[2])*180/Math.PI);
    }

    // 5. Random sphere
    let sphereMat = new Matrix4().translate(14, 1, 12).scale(1, 1, 1);
    drawSphere(sphereMat, g_dirtTex, [1,.5,1,1], 1.0)
}

function setupCubeGeometry() {
    // Geometry Data
    // 24 vertices: x, y, z, u, v, nx, ny, nz — Phase 1 uses fake normal (1,1,0) everywhere
    const cubeGeometry = new Float32Array([
      -0.5, -0.5,  0.5, 0.0, 0.0,  0, 0, 1,   0.5, -0.5,  0.5, 1.0, 0.0,  0, 0, 1,
      0.5,  0.5,  0.5, 1.0, 1.0,  0, 0, 1,  -0.5,  0.5,  0.5, 0.0, 1.0,  0, 0, 1,
      -0.5, -0.5, -0.5, 1.0, 0.0,  0, 0, -1,  -0.5,  0.5, -0.5, 1.0, 1.0,  0, 0, -1,
      0.5,  0.5, -0.5, 0.0, 1.0,  0, 0, -1,   0.5, -0.5, -0.5, 0.0, 0.0,  0, 0, -1,
      -0.5,  0.5, -0.5, 0.0, 1.0,  0, 1, 0,  -0.5,  0.5,  0.5, 0.0, 0.0,  0, 1, 0,
      0.5,  0.5,  0.5, 1.0, 0.0,  0, 1, 0,   0.5,  0.5, -0.5, 1.0, 1.0,  0, 1, 0,
      -0.5, -0.5, -0.5, 1.0, 1.0,  0, -1, 0,   0.5, -0.5, -0.5, 0.0, 1.0,  0, -1, 0,
      0.5, -0.5,  0.5, 0.0, 0.0,  0, -1, 0,  -0.5, -0.5,  0.5, 1.0, 0.0,  0, -1, 0,
      0.5, -0.5, -0.5, 1.0, 0.0,  1, 0, 0,   0.5,  0.5, -0.5, 1.0, 1.0,  1, 0, 0,
      0.5,  0.5,  0.5, 0.0, 1.0,  1, 0, 0,   0.5, -0.5,  0.5, 0.0, 0.0,  1, 0, 0,
      -0.5, -0.5, -0.5, 0.0, 0.0,  -1, 0, 0,  -0.5, -0.5,  0.5, 1.0, 0.0,  -1, 0, 0,
      -0.5,  0.5,  0.5, 1.0, 1.0,  -1, 0, 0,  -0.5,  0.5, -0.5, 0.0, 1.0,  -1, 0, 0
  ]);
    // 12 triangles (6 faces * 2 triangles) defined by 36 indices
    const cubeIndices = new Uint16Array([
        0,  1,  2,      0,  2,  3,    // front
        4,  5,  6,      4,  6,  7,    // back
        8,  9,  10,     8,  10, 11,   // top
        12, 13, 14,     12, 14, 15,   // bottom
        16, 17, 18,     16, 18, 19,   // right
        20, 21, 22,     20, 22, 23    // left
    ]);

    shader_vars.cubeGeomBuf = gl.createBuffer();
    shader_vars.cubeGeomSizeOf = cubeGeometry.BYTES_PER_ELEMENT;
    gl.bindBuffer(gl.ARRAY_BUFFER, shader_vars.cubeGeomBuf); 
    gl.bufferData(gl.ARRAY_BUFFER, cubeGeometry, gl.STATIC_DRAW);
    shader_vars.cubeIndexBuf = gl.createBuffer(); 
    shader_vars.cubeIndexSizeOf = cubeIndices.BYTES_PER_ELEMENT;
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, shader_vars.cubeIndexBuf);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, cubeIndices, gl.STATIC_DRAW); 
}

function setupSphereGeometry(nLat, nLon){
    const nRows = nLon + 1;
    const nCols = nLat + 1;

    const sphereGeometryArray = [];
    for (let iy = 0; iy < nRows; iy++) {
        const v = iy / nLat;
        const theta = v * Math.PI;
        for (let ix = 0; ix < nCols; ix++) {
            const u = iy/nLon;
            const phi = 2 * Math.PI * u;

            const x = Math.sin(theta) * Math.cos(phi);
            const y = Math.cos(theta);
            const z = Math.sin(theta) * Math.sin(phi);

            sphereGeometryArray.push(0.5 * x, 0.5 * y, 0.5 * z, u, v, x, y, z);
        }
    }

    const sphereIndiciesArray = [];
    for (let iy = 0; iy < nLon; iy++) {
        for (let ix = 0; ix < nLat; ix ++) {
            const a = iy * nRows + ix;
            const b = a + nRows;
            sphereIndiciesArray.push(a, b, a + 1);
            sphereIndiciesArray.push(b, b + 1, a + 1);
        }
    } 
    const sphereGeometry = new Float32Array(sphereGeometryArray);
    const sphereIndicies = new Uint16Array(sphereIndiciesArray);

    shader_vars.sphereIndexCnt = sphereIndicies.length;

    
    shader_vars.sphereGeomBuf = gl.createBuffer();
    shader_vars.sphereGeomSizeOf = sphereGeometry.BYTES_PER_ELEMENT;
    gl.bindBuffer(gl.ARRAY_BUFFER, shader_vars.sphereGeomBuf); 
    gl.bufferData(gl.ARRAY_BUFFER, sphereGeometry, gl.STATIC_DRAW);
    shader_vars.sphereIndexBuf = gl.createBuffer(); 
    shader_vars.sphereIndexSizeOf = sphereIndicies.BYTES_PER_ELEMENT;
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, shader_vars.sphereIndexBuf);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, sphereIndicies, gl.STATIC_DRAW); 
}

function setupGeometry() {
    setupCubeGeometry();
    setupSphereGeometry(16, 16);
}

function main() {
    canvas = document.getElementById('webgl');
    gl = canvas.getContext('webgl');
    initShaders(gl, VSHADER_SOURCE, FSHADER_SOURCE);
    shader_vars = { 
        a_Position: gl.getAttribLocation(gl.program, 'a_Position'), 
        a_TextureCoordinate: gl.getAttribLocation(gl.program, 'a_TextureCoordinate'), 
        a_Normal:  gl.getAttribLocation(gl.program, 'a_Normal'), 
        u_ModelMatrix: gl.getUniformLocation(gl.program, 'u_ModelMatrix'), 
        u_ProjectionMatrix: gl.getUniformLocation(gl.program, 'u_ProjectionMatrix'), 
        u_ViewMatrix: gl.getUniformLocation(gl.program, 'u_ViewMatrix'), 
        u_Sampler: gl.getUniformLocation(gl.program, "u_Sampler"), 
        u_Color: gl.getUniformLocation(gl.program, "u_Color"), 
        u_texColorWeight: gl.getUniformLocation(gl.program, "u_texColorWeight"),
        u_ShowNormals: gl.getUniformLocation(gl.program, "u_ShowNormals")
    };

    setupGeometry();
    
    // Textures
    shader_vars.whiteTex = (function(){ 
        let t=gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); 
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([255,255,255,255])); 
        return t; 
    })();

    initMap();
    camera = new Camera(canvas);
    spawnZombies(1);

    initTextures(gl, () => {
        gl.enable(gl.DEPTH_TEST);
        tick(); // THE ONLY TICK CALL
    });
    
    canvas.onmousedown = (e) => { 
        if (e.button === 0) { 
            for(let z of zombies) { let dx=camera.eye.elements[0]-z.pos[0], dz=camera.eye.elements[2]-z.pos[2]; if(!z.dead && Math.sqrt(dx*dx+dz*dz)<2.2){ z.hp--; if(z.hp<=0)z.dead=true; break; } }
        }
        g_dragging = true; g_lastX = e.clientX; 
    };
    canvas.onmouseup = () => g_dragging = false;
    canvas.onmousemove = (e) => { if(g_dragging) { camera.panRight((e.clientX - g_lastX) * -0.2); g_lastX = e.clientX; }};

    document.addEventListener('keydown', (e) => { 
        let key = e.key.toLowerCase();
        g_keys[key] = true; 

        // BUILDING LOGIC (Fixed for Build Mode)
        if(key === 'z' || key === 'x') {
            let f = new Vector3(); f.set(camera.at); f.sub(camera.eye); f.normalize();
            let tx = Math.round(camera.eye.elements[0] + f.elements[0] * 1.5);
            let tz = Math.round(camera.eye.elements[2] + f.elements[2] * 1.5);
            if(tx >= 0 && tx < 32 && tz >= 0 && tz < 32) {
                if(key === 'z' && MAP[tx][tz] < 4) MAP[tx][tz]++;
                if(key === 'x' && MAP[tx][tz] > 0) MAP[tx][tz]--;
            }
        }
    });
    document.addEventListener('keyup', (e) => { g_keys[e.key.toLowerCase()] = false; });
}