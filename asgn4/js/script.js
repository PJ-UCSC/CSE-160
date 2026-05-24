const VSHADER_SOURCE = `
    attribute vec4 a_Position;
    attribute vec2 a_TextureCoordinate;
    attribute vec3 a_Normal;

    uniform mat4 u_ModelMatrix;
    uniform mat4 u_ProjectionMatrix;
    uniform mat4 u_ViewMatrix;
    uniform mat3 u_NormalMatrix;

    varying vec2 v_TextureCoordinate;
    varying vec3 v_WorldPosition;
    varying vec3 v_WorldNormal;

    void main() {
        vec4 worldPosition = u_ModelMatrix * a_Position;
        v_WorldPosition = worldPosition.xyz;
        v_WorldNormal = normalize(u_NormalMatrix * a_Normal);
        gl_Position = u_ProjectionMatrix * u_ViewMatrix * u_ModelMatrix * a_Position;
        v_TextureCoordinate = a_TextureCoordinate;
    }
`;

const FSHADER_SOURCE = `
    precision mediump float;

    varying vec2 v_TextureCoordinate;
    varying vec3 v_WorldPosition;
    varying vec3 v_WorldNormal;

    uniform sampler2D u_Sampler;
    uniform vec4 u_Color;
    uniform float u_texColorWeight;
    uniform float u_ShowNormals;
    uniform float u_showDiffuse;
    uniform vec3 u_LightPosition;
    uniform vec3 u_CameraPosition;
    uniform vec3 u_LightColor;
    uniform float u_Shininess;

    uniform vec3 u_SpotlightPosition;
    uniform vec3 u_SpotlightDirection;
    uniform float u_SpotlightCutoff; 
    uniform vec3 u_SpotlightColor;
    uniform float u_SpotlightOn; // Changed to float for compatibility

    void main() {
        if (u_ShowNormals > 0.5) {
            gl_FragColor = vec4(v_WorldNormal * 0.5 + 0.5, 1.0);
            return; // Exit early if showing normals
        }

        vec4 texColor = texture2D(u_Sampler, v_TextureCoordinate);
        vec4 baseColor = (1.0 - u_texColorWeight) * u_Color + u_texColorWeight * texColor;
        vec3 albedo = baseColor.rgb;

        // Initialize lighting components to zero/ambient
        vec3 totalDiffuse = vec3(0.0);
        vec3 totalSpecular = vec3(0.0);
        vec3 ambient = 0.15 * albedo;

        vec3 normal = normalize(v_WorldNormal);
        vec3 viewDir = normalize(u_CameraPosition - v_WorldPosition);

        // --- Point Light Calculation ---
        if (u_showDiffuse > 0.5) {
            vec3 lightDir = normalize(u_LightPosition - v_WorldPosition);
            vec3 reflectDir = reflect(-lightDir, normal);

            totalDiffuse += max(0.0, dot(normal, lightDir)) * u_LightColor;
            totalSpecular += 0.4 * pow(max(0.0, dot(viewDir, reflectDir)), u_Shininess) * u_LightColor;
        }

        // --- Spotlight Calculation ---
        if (u_SpotlightOn > 0.5) {
            vec3 sLightDir = normalize(u_SpotlightPosition - v_WorldPosition);
            float dotSpot = dot(sLightDir, normalize(-u_SpotlightDirection));

            if (dotSpot > u_SpotlightCutoff) {
                float falloff = (dotSpot - u_SpotlightCutoff) / (1.0 - u_SpotlightCutoff);
                vec3 sReflectDir = reflect(-sLightDir, normal);
                
                totalDiffuse += max(0.0, dot(normal, sLightDir)) * u_SpotlightColor * falloff;
                totalSpecular += 0.4 * pow(max(0.0, dot(viewDir, sReflectDir)), u_Shininess) * u_SpotlightColor * falloff;
            }
        }

        // Combine all lighting
        vec3 finalColor = ambient + (totalDiffuse * albedo) + totalSpecular;
        gl_FragColor = vec4(finalColor, baseColor.a);
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
let g_showDiffuse = true;

let g_lightColor = [0.5, 0.5, 0.5];
let g_lightCenterPosition = [0, 0, 0];

let g_spotlightOn = true;
let g_spotlightColor = [1, 0, 0];
let g_spotlightPosition = [16, 5, 16]; // High up in the middle
let g_spotlightDirection = [0, -1, 0]; // Pointing straight down
let g_spotlightCutoff = Math.cos(15 * Math.PI / 180); // 15-degree cone

let g_customModel = new Model();

const g_normalMatrix = new Float32Array(9);

// Initialize 32x32 height map with borders
for(let i=0; i<32; i++) {
    MAP[i] = new Array(32).fill(0);
    MAP[i][0] = 4; MAP[i][31] = 4;
}
MAP[0] = new Array(32).fill(4); MAP[31] = new Array(32).fill(4);


function updateLightPositionX( value) {
    g_lightCenterPosition[0] = value;
    document.getElementById('lightX-input').value = value;
    document.getElementById('lightX').value = value;
}
function updateLightPositionY( value) {
    g_lightCenterPosition[1] = value;
    document.getElementById('lightY-input').value = value;
    document.getElementById('lightY').value = value;
}

function updateLightPositionZ( value) {
    g_lightCenterPosition[2] = value;
    document.getElementById('lightZ-input').value = value;
    document.getElementById('lightZ').value = value;
}

function toggleShowNormals() {
    g_showNormals = !g_showNormals;
    const btn = document.getElementById('toggle-normals-btn');
    if (btn) btn.textContent = g_showNormals ? 'Show Normals: ON' : 'Show Normals: OFF';
    render();
}

function toggleShowDiffuse() {
    g_showDiffuse = !g_showDiffuse;
    const btn = document.getElementById('toggle-diffuse-btn');
    if (btn) btn.textContent = g_showDiffuse ? 'Show Diffuse: ON' : 'Show Diffuse: OFF';
    render();
}

function rgbToHex(r, g, b) {
    const toHex = (c) => {
        const hex = Math.round(c * 255).toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    };
    return '#' + toHex(r) + toHex(g) + toHex(b);
}

function startGame() {
    gameStarted = true;
    document.getElementById('main-menu').style.display = 'none';
}

function getNormalMatrix(matrix) {
    let normalMatrix = new Matrix4();
    normalMatrix.setInverseOf(matrix);
    normalMatrix.transpose();
    const elements = normalMatrix.elements;
    g_normalMatrix[0] = elements[0]; 
    g_normalMatrix[1] = elements[1]; 
    g_normalMatrix[2] = elements[2];
    g_normalMatrix[3] = elements[4]; 
    g_normalMatrix[4] = elements[5]; 
    g_normalMatrix[5] = elements[6]; 
    g_normalMatrix[6] = elements[8];
    g_normalMatrix[7] = elements[9]; 
    g_normalMatrix[8] = elements[10];
    return g_normalMatrix;
}

function drawCube(matrix, texture, color, weight, shininess, showDiffuse = g_showDiffuse) {
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
    gl.uniformMatrix3fv(shader_vars.u_NormalMatrix, false, getNormalMatrix(matrix));
    gl.uniform4f(shader_vars.u_Color, color[0], color[1], color[2], color[3]);
    gl.uniform1f(shader_vars.u_texColorWeight, weight);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.uniform1i(shader_vars.u_Sampler, 0);

    gl.uniform1f(shader_vars.u_ShowNormals, g_showNormals ? 1.0 : 0.0);
    gl.uniform1f(shader_vars.u_showDiffuse, showDiffuse ? 1.0 : 0.0);
    gl.uniform1f(shader_vars.u_Shininess, shininess);

    gl.drawElements(gl.TRIANGLES, 36, gl.UNSIGNED_SHORT, 0);
}

function drawSphere(matrix, texture, color, weight, shininess, showDiffuse = g_showDiffuse) {
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
    gl.uniform1f(shader_vars.u_showDiffuse, showDiffuse ? 1.0 : 0.0);
    gl.uniform1f(shader_vars.u_Shininess, shininess);

    gl.drawElements(gl.TRIANGLES, shader_vars.sphereIndexCnt, gl.UNSIGNED_SHORT, 0);
}

function drawZombie(x, y, z, angle, shininess = 5) {
    let baseMat = new Matrix4().translate(x, y, z).rotate(angle, 0, 1, 0);
    drawCube(new Matrix4(baseMat).translate(0, 0.95, 0).scale(0.35, 0.35, 0.35), shader_vars.whiteTex, [0, 0.7, 0, 1], 0.0, shininess); // Head
    drawCube(new Matrix4(baseMat).translate(0, 0.6, 0).scale(0.45, 0.5, 0.2), shader_vars.whiteTex, [0, 0.5, 0.5, 1], 0.0, shininess); // Body
    drawCube(new Matrix4(baseMat).translate(-0.12, 0.2, 0).scale(0.2, 0.4, 0.2), shader_vars.whiteTex, [0, 0, 0.5, 1], 0.0, shininess); // Leg L
    drawCube(new Matrix4(baseMat).translate(0.12, 0.2, 0).scale(0.2, 0.4, 0.2), shader_vars.whiteTex, [0, 0, 0.5, 1], 0.0, shininess); // Leg R
    drawCube(new Matrix4(baseMat).translate(-0.3, 0.7, 0.2).scale(0.15, 0.15, 0.5), shader_vars.whiteTex, [0, 0.7, 0, 1], 0.0, shininess); // Arm L
    drawCube(new Matrix4(baseMat).translate(0.3, 0.7, 0.2).scale(0.15, 0.15, 0.5), shader_vars.whiteTex, [0, 0.7, 0, 1], 0.0, shininess); // Arm R
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

    if (gameStarted) {
        g_lightCenterPosition[1] += 0.01;
        if (g_lightCenterPosition[1] > 40) {
            g_lightCenterPosition[1] = -10;
        }
        updateLightPositionX(g_lightCenterPosition[1]);
    }
    //g_lightCenterPosition[1] = g_lightPosition[1];
    //g_lightCenterPosition[2] = g_lightPosition[2];

    render();

    if (g_keys['w']) camera.moveForward();
    if (g_keys['s']) camera.moveBackward();
    if (g_keys['a']) camera.moveLeft();
    if (g_keys['d']) camera.moveRight();
    if (g_keys['q']) camera.panLeft();
    if (g_keys['e']) camera.panRight();
    if (g_keys['r']) camera.panUp();
    if (g_keys['f']) camera.panDown();

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

function updateSpotlightColor(hex) {
    const r = parseInt(hex.substring(1, 3), 16) / 255;
    const g = parseInt(hex.substring(3, 5), 16) / 255;
    const b = parseInt(hex.substring(5, 7), 16) / 255;
    g_spotlightColor = [r, g, b];
    render();
}

function render() {
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.uniformMatrix4fv(shader_vars.u_ProjectionMatrix, false, camera.projectionMatrix.elements);
    gl.uniformMatrix4fv(shader_vars.u_ViewMatrix, false, camera.viewMatrix.elements);
    gl.uniform3f(shader_vars.u_CameraPosition, camera.eye.elements[0], camera.eye.elements[1], camera.eye.elements[2]);

    // --- LIGHT UNIFORMS (Synchronized) ---
    // Both point and spotlight originate from the moving g_lightCenterPosition
    gl.uniform3f(shader_vars.u_LightPosition, g_lightCenterPosition[0], g_lightCenterPosition[1], g_lightCenterPosition[2]);
    gl.uniform3f(shader_vars.u_LightColor, g_lightColor[0], g_lightColor[1], g_lightColor[2]);

    gl.uniform3f(shader_vars.u_SpotlightPosition, g_lightCenterPosition[0], g_lightCenterPosition[1], g_lightCenterPosition[2]);
    gl.uniform3f(shader_vars.u_SpotlightDirection, g_spotlightDirection[0], g_spotlightDirection[1], g_spotlightDirection[2]);
    gl.uniform1f(shader_vars.u_SpotlightCutoff, g_spotlightCutoff);
    gl.uniform3f(shader_vars.u_SpotlightColor, g_spotlightColor[0], g_spotlightColor[1], g_spotlightColor[2]);
    
    gl.uniform1f(shader_vars.u_SpotlightOn, g_spotlightOn ? 1.0 : 0.0);

    // --- DRAWING WORLD ---
    // 1. Sky
    drawCube(new Matrix4().scale(-500, -500, -500), shader_vars.whiteTex, [0.4, 0.6, 1, 1], 0.0, 0, false);

    // 2. Ground
    let groundMat = new Matrix4().translate(16, -0.5, 16).scale(32, 0.1, 32);
    drawCube(groundMat, g_grassTex, [1, 1, 1, 1], 1.0, 100, true);

    // 3. Walls
    for(let x=0; x<32; x++) {
        for(let z=0; z<32; z++) {
            for(let y=0; y<MAP[x][z]; y++) {
                drawCube(new Matrix4().translate(x, y, z), g_dirtTex, [1,1,1,1], 1.0, 40, true);
            }
        }
    }

    // 4. Zombies
    for (let z of zombies) {
        if (!z.dead) drawZombie(z.pos[0], 0, z.pos[2], Math.atan2(camera.eye.elements[0]-z.pos[0], camera.eye.elements[2]-z.pos[2])*180/Math.PI);
    }

    // 5. Cubes/Spheres
    drawCube(new Matrix4().translate(16, 0, 11), g_dirtTex, [1,.5,1,0], 0.5, 25, true);
    drawSphere(new Matrix4().translate(14, 0, 12), g_dirtTex, [0,.5,1,1], 0.5, 50, true);

    // --- 6. LIGHT MARKER (Visual proof of location) ---
    // Rubric requirement: "A visual marker of light location exists."
    if (g_showDiffuse || g_spotlightOn) {
        let lightMat = new Matrix4()
            .translate(g_lightCenterPosition[0], g_lightCenterPosition[1], g_lightCenterPosition[2])
            .scale(0.8, 0.8, 0.8); // Larger "Lantern" sphere
        
        // Marker visual logic: 
        // Yellow = Both lights on, Red = Only Spotlight, White = Only Point light
        let markerColor = [1, 1, 1, 1];
        if (g_spotlightOn && !g_showDiffuse) {
            // Show the actual chosen spotlight color on the sphere
            markerColor = [g_spotlightColor[0], g_spotlightColor[1], g_spotlightColor[2], 1];
        } else if (g_spotlightOn && g_showDiffuse) {
            markerColor = [1, 1, 0, 1]; // Yellow if both are on
        }

        drawSphere(lightMat, shader_vars.whiteTex, markerColor, 0.0, 1, false);
    }

    if (g_customModel.isLoaded) {
        let modelMat = new Matrix4()
            .translate(18, 0, 14) // Position it near the zombie or cubes
            .scale(1, 1, 1);      // Adjust scale based on your model's size
        
        g_customModel.render(modelMat, [0.7, 0.7, 0.7, 1.0]); // Draw in Grey
    }
}

function setupCubeGeometry() {
    // Geometry Data
    // 24 vertices: x, y, z, u, v, nx, ny, nz — Phase 1 uses fake normal (1,1,0) everywhere
    const cubeGeometry = new Float32Array([
      -0.5, -0.5,  0.5, 0.0, 0.0,  0, 0, 1,
      0.5, -0.5,  0.5, 1.0, 0.0,  0, 0, 1,
      0.5,  0.5,  0.5, 1.0, 1.0,  0, 0, 1,
      -0.5,  0.5,  0.5, 0.0, 1.0,  0, 0, 1,
      -0.5, -0.5, -0.5, 1.0, 0.0,  0, 0, -1,
      -0.5,  0.5, -0.5, 1.0, 1.0,  0, 0, -1,
      0.5,  0.5, -0.5, 0.0, 1.0,  0, 0, -1,
      0.5, -0.5, -0.5, 0.0, 0.0,  0, 0, -1,
      -0.5,  0.5, -0.5, 0.0, 1.0,  0, 1, 0,
      -0.5,  0.5,  0.5, 0.0, 0.0,  0, 1, 0,
      0.5,  0.5,  0.5, 1.0, 0.0,  0, 1, 0,
      0.5,  0.5, -0.5, 1.0, 1.0,  0, 1, 0,
      -0.5, -0.5, -0.5, 1.0, 1.0,  0, -1, 0,
      0.5, -0.5, -0.5, 0.0, 1.0,  0, -1, 0,
      0.5, -0.5,  0.5, 0.0, 0.0,  0, -1, 0,
      -0.5, -0.5,  0.5, 1.0, 0.0,  0, -1, 0,
      0.5, -0.5, -0.5, 1.0, 0.0,  1, 0, 0,
      0.5,  0.5, -0.5, 1.0, 1.0,  1, 0, 0,
      0.5,  0.5,  0.5, 0.0, 1.0,  1, 0, 0,
      0.5, -0.5,  0.5, 0.0, 0.0,  1, 0, 0,
      -0.5, -0.5, -0.5, 0.0, 0.0,  -1, 0, 0,
      -0.5, -0.5,  0.5, 1.0, 0.0,  -1, 0, 0,
      -0.5,  0.5,  0.5, 1.0, 1.0,  -1, 0, 0,
      -0.5,  0.5, -0.5, 0.0, 1.0,  -1, 0, 0
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
    const nRows = nLat + 1;
    const nCols = nLon + 1;

    const sphereGeometryArray = [];
    for (let iy = 0; iy < nRows; iy++) {
        const v = iy / nLat;
        const theta = v * Math.PI;
        for (let ix = 0; ix < nCols; ix++) {
            const u = ix / nLon;
            const phi = 2 * Math.PI * u;

            const x = Math.sin(theta) * Math.cos(phi);
            const y = Math.cos(theta);
            const z = Math.sin(theta) * Math.sin(phi);

            sphereGeometryArray.push(0.5 * x, 0.5 * y, 0.5 * z, u, v, x, y, z);
        }
    }

    const sphereIndiciesArray = [];
    for (let iy = 0; iy < nLat; iy++) {
        for (let ix = 0; ix < nLon; ix++) {
            const a = iy * nCols + ix;
            const b = a + nCols;
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
        u_NormalMatrix: gl.getUniformLocation(gl.program, "u_NormalMatrix"),
        u_Sampler: gl.getUniformLocation(gl.program, "u_Sampler"), 
        u_Color: gl.getUniformLocation(gl.program, "u_Color"), 
        u_texColorWeight: gl.getUniformLocation(gl.program, "u_texColorWeight"),
        u_ShowNormals: gl.getUniformLocation(gl.program, "u_ShowNormals"),
        u_showDiffuse: gl.getUniformLocation(gl.program, "u_showDiffuse"),
        u_CameraPosition: gl.getUniformLocation(gl.program, "u_CameraPosition"),
        u_LightColor: gl.getUniformLocation(gl.program, "u_LightColor"),
        u_LightPosition: gl.getUniformLocation(gl.program, "u_LightPosition"),
        u_Shininess: gl.getUniformLocation(gl.program, "u_Shininess"),
    };

    g_customModel.load('images/House_Plant.obj');

    shader_vars.u_SpotlightPosition = gl.getUniformLocation(gl.program, "u_SpotlightPosition");
    shader_vars.u_SpotlightDirection = gl.getUniformLocation(gl.program, "u_SpotlightDirection");
    shader_vars.u_SpotlightCutoff = gl.getUniformLocation(gl.program, "u_SpotlightCutoff");
    shader_vars.u_SpotlightColor = gl.getUniformLocation(gl.program, "u_SpotlightColor");
    shader_vars.u_SpotlightOn = gl.getUniformLocation(gl.program, "u_SpotlightOn");

    setupGeometry();
    
    // Textures
    shader_vars.whiteTex = (function(){ 
        let t=gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); 
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([255,255,255,255])); 
        return t; 
    })();
    updateLightPositionX(0);
    updateLightPositionY(2);
    updateLightPositionZ(12);

    initMap();
    camera = new Camera(canvas);

    initTextures(gl, () => {
        gl.enable(gl.DEPTH_TEST);
        tick(); // THE ONLY TICK CALL
    });
 
    function bindLightColorSliders() {
        const lr = document.getElementById('lightR');
        const lg = document.getElementById('lightG');
        const lb = document.getElementById('lightB');
        function upd() {
            g_lightColor[0] = lr ? parseFloat(lr.value) : 1;
            g_lightColor[1] = lg ? parseFloat(lg.value) : 1;
            g_lightColor[2] = lb ? parseFloat(lb.value) : 1;

            // Update the color picker value to reflect the sliders
            const lightColorPicker = document.getElementById('light-color-picker');
            if (lightColorPicker) {
                // Corrected: use hex format instead of rgb()
                lightColorPicker.value = rgbToHex(g_lightColor[0], g_lightColor[1], g_lightColor[2]);
            }
        }
        if (lr) lr.addEventListener('input', upd);
        if (lg) lg.addEventListener('input', upd);
        if (lb) lb.addEventListener('input', upd);
        upd();
    }
    bindLightColorSliders();

    function bindLightColorPicker() {
        const lightColorPicker = document.getElementById('light-color-picker');
        if (lightColorPicker) {
            lightColorPicker.addEventListener('input', (e) => {
                const color = e.target.value; 
                const hash =  color.substring(0, 1);
                const r = parseInt(color.substring(1, 3), 16);                 // ff -> 255
                const g = parseInt(color.substring(3, 5), 16);                 // ff -> 255
                const b = parseInt(color.substring(5, 7), 16);  

                g_lightColor[0] = r / 255;
                g_lightColor[1] = g / 255;
                g_lightColor[2] = b / 255;  

                const lr = document.getElementById('lightR');
                const lg = document.getElementById('lightG');
                const lb = document.getElementById('lightB');   
                if (lr) lr.value = g_lightColor[0];
                if (lg) lg.value = g_lightColor[1];
                if (lb) lb.value = g_lightColor[2];
            });
        }
    }    
    bindLightColorPicker();
    
    canvas.onmousedown = (e) => { 
        if (e.button === 0) { 
            for(let z of zombies) { let dx=camera.eye.elements[0]-z.pos[0], dz=camera.eye.elements[2]-z.pos[2]; if(!z.dead && Math.sqrt(dx*dx+dz*dz)<2.2){ z.hp--; if(z.hp<=0)z.dead=true; break; } }
        }
        g_dragging = true; g_lastX = e.clientX; 
    };
    canvas.onmousedown = (e) => { 
        g_dragging = true; 
        g_lastX = e.clientX; 
        g_lastY = e.clientY; // Capture starting Y
    };
    canvas.onmousemove = (e) => { 
        if(g_dragging) { 
            let dx = e.clientX - g_lastX;
            let dy = e.clientY - g_lastY;

            camera.panRight(dx * -0.2); // Horizontal
            camera.panUp(dy * -0.2);    // Vertical

            g_lastX = e.clientX; 
            g_lastY = e.clientY; 
        }
    };

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