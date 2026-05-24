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
    uniform float u_ShowLighting;
    uniform float u_Unlit;
    uniform vec3 u_LightPosition;
    uniform vec3 u_CameraPosition;
    uniform vec3 u_LightColor;
    uniform float u_PointLightOn;
    uniform vec3 u_SpotPosition;
    uniform vec3 u_SpotDirection;
    uniform vec3 u_SpotColor;
    uniform float u_SpotLightOn;
    uniform float u_SpotCutoffCos;
    uniform float u_SpotOuterCutoffCos;
    uniform float u_Shininess;

    void main() {
        if (u_ShowNormals > 0.5) {
            gl_FragColor = vec4(v_WorldNormal * 0.5 + 0.5, 1.0);
        } else {
            vec4 texColor = texture2D(u_Sampler, v_TextureCoordinate);
            vec4 baseColor = (1.0 - u_texColorWeight) * u_Color + u_texColorWeight * texColor;

            if (u_Unlit > 0.5) {
                gl_FragColor = baseColor;
            } else if (u_ShowLighting > 0.5) {
                vec3 normal = normalize(v_WorldNormal);
                vec3 viewDir = normalize(u_CameraPosition - v_WorldPosition);

                vec3 pointDiffuse = vec3(0.0);
                vec3 pointSpecular = vec3(0.0);
                if (u_PointLightOn > 0.5) {
                    vec3 pointLightDir = normalize(u_LightPosition - v_WorldPosition);
                    vec3 pointReflectDir = reflect(-pointLightDir, normal);
                    pointDiffuse = max(0.0, dot(normal, pointLightDir)) * u_LightColor;
                    pointSpecular = pow(max(0.0, dot(viewDir, pointReflectDir)), u_Shininess) * u_LightColor;
                }

                vec3 spotDiffuse = vec3(0.0);
                vec3 spotSpecular = vec3(0.0);
                if (u_SpotLightOn > 0.5) {
                    vec3 spotLightDir = normalize(u_SpotPosition - v_WorldPosition);
                    vec3 lightToFrag = normalize(v_WorldPosition - u_SpotPosition);
                    vec3 spotAxis = normalize(u_SpotDirection);
                    float spotTheta = dot(spotAxis, lightToFrag);
                    float spotFactor = smoothstep(u_SpotOuterCutoffCos, u_SpotCutoffCos, spotTheta);

                    vec3 spotReflectDir = reflect(-spotLightDir, normal);
                    spotDiffuse = max(0.0, dot(normal, spotLightDir)) * u_SpotColor * spotFactor;
                    spotSpecular = pow(max(0.0, dot(viewDir, spotReflectDir)), u_Shininess) * u_SpotColor * spotFactor;
                }

                vec3 albedo = baseColor.rgb;
                vec3 ambient = 0.15 * albedo;
                vec3 diffuseColor = pointDiffuse * albedo + spotDiffuse * albedo;
                vec3 specularColor = 0.4 * (pointSpecular + spotSpecular);

                gl_FragColor = vec4(ambient + diffuseColor + specularColor, baseColor.a);
            } else {
                gl_FragColor = baseColor;
            }
        }
    }
`;

let canvas;
let gl;
let camera;
let shader_vars = {};
let g_dragging = false;
let g_lastX = -1;
var MAP = [];
let zombies = [];
let g_keys = {};
let currentWave = 1;
let waveActive = true;
let freeBuildMode = false;
let gameStarted = false;
let g_lastFrameTime = performance.now();
let g_dirtTex;
let g_grassTex;

let g_showNormals = false;
let g_showLighting = true;

let g_lightColor = [0.5, 0.5, 0.5];
let g_lightCenterPosition = [0, 0, 0];

let g_customModel = new Model();

const g_normalMatrix = new Float32Array(9);


let g_pointLightOn = true;
let g_spotLightOn = true;
let g_spotPos = [16.0, 16.0, 16.0];
let g_spotDir = [0.0, -1.0, 0.0];
let g_spotColor = [0.85, 0.92, 1.0];
let g_spotCutoffCos = Math.cos(12 * Math.PI / 180);
let g_spotOuterCutoffCos = Math.cos(20 * Math.PI / 180);
let g_animateLightPosition = true;

function updateLightPositionX(value) {
    g_lightCenterPosition[0] = parseFloat(value);
    document.getElementById('lightX-input').value = value;
    document.getElementById('lightX').value = value;
}
function updateLightPositionY(value) {
    g_lightCenterPosition[1] = parseFloat(value);
    document.getElementById('lightY-input').value = value;
    document.getElementById('lightY').value = value;
}

function updateLightPositionZ(value) {
    g_lightCenterPosition[2] = parseFloat(value);
    document.getElementById('lightZ-input').value = value;
    document.getElementById('lightZ').value = value;
}

function toggleAnimateLightPosition() {
    const checkbox = document.getElementById('light-position-checkbox');
    g_animateLightPosition = checkbox ? checkbox.checked : false;
}

function togglePointLight() {
    const checkbox = document.getElementById('point-light-checkbox');
    g_pointLightOn = checkbox ? checkbox.checked : false;
}

function toggleSpotLight() {
    const checkbox = document.getElementById('spotlight-checkbox');
    g_spotLightOn = checkbox ? checkbox.checked : false;
}

function setGameUiVisible(visible) {
    const gameUi = document.getElementById('game-ui');
    if (gameUi) {
        gameUi.style.display = visible ? 'block' : 'none';
    }
}

function toggleGameUiMinimized() {
    const gameUi = document.getElementById('game-ui');
    const btn = document.getElementById('game-ui-minimize-btn');
    if (!gameUi) {
        return;
    }
    const minimized = gameUi.classList.toggle('minimized');
    if (btn) {
        btn.textContent = minimized ? '+' : '−';
        btn.title = minimized ? 'Restore' : 'Minimize';
    }
}

function updateSpotLightDirection() {
    if (!camera) {
        return;
    }
    const ex = camera.eye.elements[0];
    const ey = camera.eye.elements[1];
    const ez = camera.eye.elements[2];
    let dx = ex - g_spotPos[0];
    let dy = ey - g_spotPos[1];
    let dz = ez - g_spotPos[2];
    let len = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (len > 0.0001) {
        g_spotDir[0] = dx / len;
        g_spotDir[1] = dy / len;
        g_spotDir[2] = dz / len;
    }
}

function clampColorByte(value) {
    const n = Math.round(parseFloat(value));
    if (Number.isNaN(n)) {
        return 0;
    }
    return Math.min(255, Math.max(0, n));
}

function lightColorByte(channelIndex) {
    return Math.round(g_lightColor[channelIndex] * 255);
}

function rgbToHex(r, g, b) {
    const ri = clampColorByte(r);
    const gi = clampColorByte(g);
    const bi = clampColorByte(b);
    return '#' + [ri, gi, bi].map((c) => c.toString(16).padStart(2, '0')).join('');
}

function updateLightColorFromRGB(r, g, b) {
    const ri = clampColorByte(r);
    const gi = clampColorByte(g);
    const bi = clampColorByte(b);
    g_lightColor[0] = ri / 255;
    g_lightColor[1] = gi / 255;
    g_lightColor[2] = bi / 255;

    const lr = document.getElementById('lightR');
    const lg = document.getElementById('lightG');
    const lb = document.getElementById('lightB');
    const lrInput = document.getElementById('lightR-input');
    const lgInput = document.getElementById('lightG-input');
    const lbInput = document.getElementById('lightB-input');
    const picker = document.getElementById('light-color-picker');

    if (lr) {
        lr.value = ri;
    }
    if (lg) {
        lg.value = gi;
    }
    if (lb) {
        lb.value = bi;
    }
    if (lrInput) {
        lrInput.value = ri;
    }
    if (lgInput) {
        lgInput.value = gi;
    }
    if (lbInput) {
        lbInput.value = bi;
    }
    if (picker) {
        picker.value = rgbToHex(ri, gi, bi);
    }
}

function updateLightColorR(value) {
    updateLightColorFromRGB(value, lightColorByte(1), lightColorByte(2));
}

function updateLightColorG(value) {
    updateLightColorFromRGB(lightColorByte(0), value, lightColorByte(2));
}

function updateLightColorB(value) {
    updateLightColorFromRGB(lightColorByte(0), lightColorByte(1), value);
}

function updateLightColor(hexValue) {
    const color = hexValue.replace('#', '');
    const r = parseInt(color.substring(0, 2), 16);
    const g = parseInt(color.substring(2, 4), 16);
    const b = parseInt(color.substring(4, 6), 16);
    updateLightColorFromRGB(r, g, b);
}

function toggleShowNormals() {
    g_showNormals = !g_showNormals;
    const btn = document.getElementById('toggle-normals-btn');
    if (btn) {
        btn.textContent = g_showNormals ? 'Normals: ON' : 'Normals: OFF';
    }
    render();
}

function toggleShowLighting() {
    g_showLighting = !g_showLighting;
    const btn = document.getElementById('toggle-lighting-btn');
    if (btn) {
        btn.textContent = g_showLighting ? 'Lighting: ON' : 'Lighting: OFF';
    }
    render();
}

function startGame() {
    gameStarted = true;
    document.getElementById('main-menu').style.display = 'none';
    setGameUiVisible(true);
}

function spawnZombies(count) {
    zombies = [];
    for (let i = 0; i < count; i++) {
        let side = Math.floor(Math.random() * 4);
        let rx = 16;
        let rz = 16;
        if (side === 0) {
            rx = 2;
            rz = Math.random() * 28 + 2;
        } else if (side === 1) {
            rx = 29;
            rz = Math.random() * 28 + 2;
        } else if (side === 2) {
            rz = 2;
            rx = Math.random() * 28 + 2;
        } else {
            rz = 29;
            rx = Math.random() * 28 + 2;
        }
        zombies.push({ pos: [rx, 0, rz], hp: 3, speed: 0.001 + (Math.random() * 0.005), dead: false });
    }
}

function startNextWave() {
    if (freeBuildMode) {
        return;
    }
    currentWave++;
    if (currentWave > 3) {
        document.getElementById('congrats').style.display = 'flex';
        waveActive = false;
        setGameUiVisible(false);
        return;
    }
    document.getElementById('wave-display').innerText = "WAVE: " + currentWave;
    spawnZombies(currentWave === 2 ? 3 : 5);
}

function restartWaves() {
    currentWave = 1;
    camera.hp = 100;
    document.getElementById('hp-bar').style.width = "100%";
    document.getElementById('congrats').style.display = 'none';
    document.getElementById('wave-display').innerText = "WAVE: 1";
    freeBuildMode = false;
    waveActive = true;
    spawnZombies(1);
    setGameUiVisible(true);
}

function stayInWorld() {
    document.getElementById('congrats').style.display = 'none';
    document.getElementById('wave-display').innerText = "BUILD MODE";
    freeBuildMode = true;
    setGameUiVisible(true);
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

function drawCube(matrix, texture, color, weight, shininess, unlit = false) {
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
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.uniform1i(shader_vars.u_Sampler, 0);

    gl.uniform1f(shader_vars.u_Unlit, unlit ? 1.0 : 0.0);
    gl.uniform1f(shader_vars.u_Shininess, shininess);

    gl.drawElements(gl.TRIANGLES, 36, gl.UNSIGNED_SHORT, 0);
}

function drawSphere(matrix, texture, color, weight, shininess, unlit = false) {
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
    gl.uniformMatrix3fv(shader_vars.u_NormalMatrix, false, getNormalMatrix(matrix));
    gl.uniform4f(shader_vars.u_Color, color[0], color[1], color[2], color[3]);
    gl.uniform1f(shader_vars.u_texColorWeight, weight);
    gl.activeTexture(gl.TEXTURE0); 
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.uniform1i(shader_vars.u_Sampler, 0);

    gl.uniform1f(shader_vars.u_Unlit, unlit ? 1.0 : 0.0);
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

    // 0. Update light position — animate along X axis
    if (gameStarted && g_animateLightPosition) {
        g_lightCenterPosition[0] += 0.01;
        if (g_lightCenterPosition[0] > 40) {
            g_lightCenterPosition[0] = -10;
        }
        updateLightPositionX(g_lightCenterPosition[0]);
    }

    // 1. Always render
    render();

    // 2. If dead or menu is open, stop here
    if (!gameStarted || camera.isDead) {
        requestAnimationFrame(tick);
        return;
    }

    // 3. MOVEMENT (This must be OUTSIDE the wave check)
    if (g_keys['w']) {
        camera.moveForward();
    }
    if (g_keys['s']) {
        camera.moveBackward();
    }
    if (g_keys['a']) {
        camera.moveLeft();
    }
    if (g_keys['d']) {
        camera.moveRight();
    }
    if (g_keys['q']) {
        camera.panLeft();
    }
    if (g_keys['e']) {
        camera.panRight();
    }

    // 4. WAVE & ZOMBIE LOGIC (Only run this if a wave is actually active)
    if (waveActive) {
        let allDead = true;
        for (let z of zombies) {
            if (z.dead) {
                continue;
            }
            allDead = false;
            
            // Zombie movement and damage logic...
            let dx = camera.eye.elements[0] - z.pos[0];
            let dz = camera.eye.elements[2] - z.pos[2];
            let dist = Math.sqrt(dx*dx + dz*dz);
            if (dist > 0.5) { 
                z.pos[0] += (dx/dist)*z.speed; 
                z.pos[2] += (dz/dist)*z.speed; 
            } else { 
                camera.hp -= 0.4; 
                document.getElementById('hp-bar').style.width = Math.max(0, camera.hp) + "%"; 
            }
        }

        if (camera.hp <= 0) {
            camera.isDead = true;
            document.getElementById('game-over').style.display = 'flex';
            setGameUiVisible(false);
        }
        
        if (allDead && !freeBuildMode) {
            startNextWave();
        }
    }

    requestAnimationFrame(tick);
}

function initTextures(gl, callback) {
    let imagesLoaded = 0;
    const totalImages = 2;

    function onImageLoad(img, texVar) {
        let tex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, tex);
        // Use NEAREST for that blocky Minecraft look
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        
        // Use REPEAT so the ground texture doesn't stretch
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);

        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
        
        if (texVar === 'dirt') {
            g_dirtTex = tex;
        }
        if (texVar === 'grass') {
            g_grassTex = tex;
        }

        imagesLoaded++;
        if (imagesLoaded === totalImages) {
            callback();
        }
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
    window.MAP = MAP;
}

function render() {
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    
    // --- 1. Set Global Uniforms ---
    gl.uniformMatrix4fv(shader_vars.u_ProjectionMatrix, false, camera.projectionMatrix.elements);
    gl.uniformMatrix4fv(shader_vars.u_ViewMatrix, false, camera.viewMatrix.elements);
    gl.uniform3f(shader_vars.u_CameraPosition, camera.eye.elements[0], camera.eye.elements[1], camera.eye.elements[2]);

    // Lighting Uniforms
    gl.uniform3f(shader_vars.u_LightPosition, g_lightCenterPosition[0], g_lightCenterPosition[1], g_lightCenterPosition[2]);
    gl.uniform3f(shader_vars.u_LightColor, g_lightColor[0], g_lightColor[1], g_lightColor[2]);
    gl.uniform1f(shader_vars.u_PointLightOn, g_pointLightOn ? 1.0 : 0.0);

    updateSpotLightDirection();
    gl.uniform3f(shader_vars.u_SpotPosition, g_spotPos[0], g_spotPos[1], g_spotPos[2]);
    gl.uniform3f(shader_vars.u_SpotDirection, g_spotDir[0], g_spotDir[1], g_spotDir[2]);
    gl.uniform3f(shader_vars.u_SpotColor, g_spotColor[0], g_spotColor[1], g_spotColor[2]);
    gl.uniform1f(shader_vars.u_SpotLightOn, g_spotLightOn ? 1.0 : 0.0);
    gl.uniform1f(shader_vars.u_SpotCutoffCos, g_spotCutoffCos);
    gl.uniform1f(shader_vars.u_SpotOuterCutoffCos, g_spotOuterCutoffCos);

    gl.uniform1f(shader_vars.u_ShowNormals, g_showNormals ? 1.0 : 0.0);
    gl.uniform1f(shader_vars.u_ShowLighting, g_showLighting ? 1.0 : 0.0);

    // --- 2. Render OBJ Model ---
    // Make sure g_customModel.render handles u_ShowLighting and u_ShowNormals!
    let modelMat = new Matrix4().translate(16, 0, 16).scale(0.5, 0.5, 0.5);
    g_customModel.render(modelMat, [0.1, 0.4, 0.1, 1.0]);

    // --- 3. Render Skybox & Ground ---
    drawCube(new Matrix4().scale(-500, -500, -500), shader_vars.whiteTex, [0.4, 0.6, 1, 1], 0.0, 0, true);
    drawCube(new Matrix4().translate(16, -0.5, 16).scale(32, 0.1, 32), g_grassTex, [1, 1, 1, 1], 1.0, 100);

    // --- 4. Render Walls (Optimized Matrix usage) ---
    let wallMat = new Matrix4(); 
    for(let x=0; x<32; x++) {
        for(let z=0; z<32; z++) {
            for(let y=0; y<MAP[x][z]; y++) {
                wallMat.setTranslate(x, y, z); // Reuse the same matrix object
                drawCube(wallMat, g_dirtTex, [1,1,1,1], 1.0, 40);
            }
        }
    }

    // --- 5. Zombies ---
    for (let z of zombies) {
        if (!z.dead) {
            let angle = Math.atan2(camera.eye.elements[0] - z.pos[0], camera.eye.elements[2] - z.pos[2]) * 180 / Math.PI;
            drawZombie(z.pos[0], 0, z.pos[2], angle);
        }
    }

    // --- 6. Static Decorations ---
    let coloredCubeMat = new Matrix4().translate(16, 0, 11).scale(1, 1, 1);
    drawCube(coloredCubeMat, g_dirtTex, [1,.5,1, 1], 0.5, 25);

    let sphereMat = new Matrix4().translate(14, 0, 12).scale(1, 1, 1);
    drawSphere(sphereMat, g_dirtTex, [0,.5,1,1], 0.5, 50);

    // --- 7. Light Markers ---
    if (g_pointLightOn) {
        let lightMat = new Matrix4().translate(g_lightCenterPosition[0], g_lightCenterPosition[1], g_lightCenterPosition[2]).scale(0.2, 0.2, 0.2);
        drawSphere(lightMat, shader_vars.whiteTex, [1, 1, 0, 1], 0.0, 1, true);
    }

    if (g_spotLightOn) {
        let spotMat = new Matrix4().translate(g_spotPos[0], g_spotPos[1], g_spotPos[2]).scale(0.25, 0.25, 0.25);
        drawSphere(spotMat, shader_vars.whiteTex, [g_spotColor[0], g_spotColor[1], g_spotColor[2], 1], 0.0, 1, true);
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

    const sphereIndicesArray = [];
    for (let iy = 0; iy < nLat; iy++) {
        for (let ix = 0; ix < nLon; ix++) {
            const a = iy * nCols + ix;
            const b = a + nCols;
            sphereIndicesArray.push(a, b, a + 1);
            sphereIndicesArray.push(b, b + 1, a + 1);
        }
    }
    const sphereGeometry = new Float32Array(sphereGeometryArray);
    const sphereIndices = new Uint16Array(sphereIndicesArray);

    shader_vars.sphereIndexCnt = sphereIndices.length;

    
    shader_vars.sphereGeomBuf = gl.createBuffer();
    shader_vars.sphereGeomSizeOf = sphereGeometry.BYTES_PER_ELEMENT;
    gl.bindBuffer(gl.ARRAY_BUFFER, shader_vars.sphereGeomBuf); 
    gl.bufferData(gl.ARRAY_BUFFER, sphereGeometry, gl.STATIC_DRAW);
    shader_vars.sphereIndexBuf = gl.createBuffer(); 
    shader_vars.sphereIndexSizeOf = sphereIndices.BYTES_PER_ELEMENT;
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, shader_vars.sphereIndexBuf);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, sphereIndices, gl.STATIC_DRAW); 
}

function setupGeometry() {
    setupCubeGeometry();
    setupSphereGeometry(16, 16);
}

// Sync the canvas drawing-buffer size to its CSS size (with HiDPI support).
// Returns true if the size actually changed.
function resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const displayWidth = Math.max(1, Math.round(canvas.clientWidth * dpr));
    const displayHeight = Math.max(1, Math.round(canvas.clientHeight * dpr));

    if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
        canvas.width = displayWidth;
        canvas.height = displayHeight;
        if (gl) {
            gl.viewport(0, 0, canvas.width, canvas.height);
        }
        return true;
    }
    return false;
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
        u_ShowLighting: gl.getUniformLocation(gl.program, "u_ShowLighting"),
        u_Unlit: gl.getUniformLocation(gl.program, "u_Unlit"),
        u_CameraPosition: gl.getUniformLocation(gl.program, "u_CameraPosition"),
        u_LightColor: gl.getUniformLocation(gl.program, "u_LightColor"),
        u_LightPosition: gl.getUniformLocation(gl.program, "u_LightPosition"),
        u_PointLightOn: gl.getUniformLocation(gl.program, "u_PointLightOn"),
        u_SpotPosition: gl.getUniformLocation(gl.program, "u_SpotPosition"),
        u_SpotDirection: gl.getUniformLocation(gl.program, "u_SpotDirection"),
        u_SpotColor: gl.getUniformLocation(gl.program, "u_SpotColor"),
        u_SpotLightOn: gl.getUniformLocation(gl.program, "u_SpotLightOn"),
        u_SpotCutoffCos: gl.getUniformLocation(gl.program, "u_SpotCutoffCos"),
        u_SpotOuterCutoffCos: gl.getUniformLocation(gl.program, "u_SpotOuterCutoffCos"),
        u_Shininess: gl.getUniformLocation(gl.program, "u_Shininess"),
    };

    g_customModel.load('images/House_Plant.obj');

    setupGeometry();
    
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    // Textures
    shader_vars.whiteTex = (function() {
        let t = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, t);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([255, 255, 255, 255]));
        return t;
    })();
    updateLightPositionX(0);
    updateLightPositionY(2);
    updateLightPositionZ(12);
    updateLightColorFromRGB(128, 128, 128);

    initMap();
    camera = new Camera(canvas);
    spawnZombies(1);

    initTextures(gl, () => {
        gl.enable(gl.DEPTH_TEST);
        tick(); // THE ONLY TICK CALL
    });

    canvas.onmousedown = (e) => {
        if (e.button === 0) {
            for (let z of zombies) {
                let dx = camera.eye.elements[0] - z.pos[0];
                let dz = camera.eye.elements[2] - z.pos[2];
                if (!z.dead && Math.sqrt(dx * dx + dz * dz) < 2.2) {
                    z.hp--;
                    if (z.hp <= 0) {
                        z.dead = true;
                    }
                    break;
                }
            }
        }
        g_dragging = true;
        g_lastX = e.clientX;
    };
    canvas.onmouseup = () => {
        g_dragging = false;
    };
    canvas.onmousemove = (e) => {
        if (g_dragging) {
            camera.panRight((e.clientX - g_lastX) * -0.2);
            g_lastX = e.clientX;
        }
    };

    document.addEventListener('keydown', (e) => {
        let key = e.key.toLowerCase();
        g_keys[key] = true;

        // BUILDING LOGIC (Fixed for Build Mode)
        if (key === 'z' || key === 'x') {
            let f = new Vector3();
            f.set(camera.at);
            f.sub(camera.eye);
            f.normalize();
            let tx = Math.round(camera.eye.elements[0] + f.elements[0] * 1.5);
            let tz = Math.round(camera.eye.elements[2] + f.elements[2] * 1.5);
            if (tx >= 0 && tx < 32 && tz >= 0 && tz < 32) {
                if (key === 'z' && MAP[tx][tz] < 4) {
                    MAP[tx][tz]++;
                }
                if (key === 'x' && MAP[tx][tz] > 0) {
                    MAP[tx][tz]--;
                }
                window.MAP = MAP;
            }
        }
    });
    document.addEventListener('keyup', (e) => {
        g_keys[e.key.toLowerCase()] = false;
    });
}