const VSHADER_SOURCE = `attribute vec4 a_Position; attribute vec2 a_TextureCoordinate; uniform mat4 u_ModelMatrix; uniform mat4 u_ProjectionMatrix; uniform mat4 u_ViewMatrix; varying vec2 v_TextureCoordinate; void main() { gl_Position = u_ProjectionMatrix * u_ViewMatrix * u_ModelMatrix * a_Position; v_TextureCoordinate = a_TextureCoordinate; }`;
const FSHADER_SOURCE = `precision mediump float; varying vec2 v_TextureCoordinate; uniform sampler2D u_Sampler; uniform vec4 u_Color; uniform float u_texColorWeight; void main() { vec4 texColor = texture2D(u_Sampler, v_TextureCoordinate); gl_FragColor = (1.0 - u_texColorWeight) * u_Color + u_texColorWeight * texColor; }`;

let canvas, gl, camera;
let shader_vars = {};
let g_dragging = false, g_lastX = -1;
let MAP = []; 

// Initialize 32x32 height map
for(let i=0; i<32; i++) {
    MAP[i] = new Array(32).fill(0);
    MAP[i][0] = 4; MAP[i][31] = 4;
}
MAP[0] = new Array(32).fill(4); MAP[31] = new Array(32).fill(4);

let zombie = { pos: [10, 0, 10], hp: 3, speed: 0.03, dead: false };

function setupGL() {
    canvas = document.getElementById('webgl');
    gl = canvas.getContext('webgl');
    initShaders(gl, VSHADER_SOURCE, FSHADER_SOURCE);
    shader_vars = {
        a_Position: gl.getAttribLocation(gl.program, 'a_Position'),
        a_TextureCoordinate: gl.getAttribLocation(gl.program, 'a_TextureCoordinate'),
        u_ModelMatrix: gl.getUniformLocation(gl.program, 'u_ModelMatrix'),
        u_ProjectionMatrix: gl.getUniformLocation(gl.program, 'u_ProjectionMatrix'),
        u_ViewMatrix: gl.getUniformLocation(gl.program, 'u_ViewMatrix'),
        u_Sampler: gl.getUniformLocation(gl.program, "u_Sampler"),
        u_Color: gl.getUniformLocation(gl.program, "u_Color"),
        u_texColorWeight: gl.getUniformLocation(gl.program, "u_texColorWeight")
    };
}

function updateZombie() {
    if (zombie.dead || camera.isDead) return;

    let dx = camera.eye.elements[0] - zombie.pos[0];
    let dz = camera.eye.elements[2] - zombie.pos[2];
    let dist = Math.sqrt(dx*dx + dz*dz);
    
    if (dist > 0.5) {
        zombie.pos[0] += (dx/dist) * zombie.speed;
        zombie.pos[2] += (dz/dist) * zombie.speed;
    } else {
        camera.hp -= 1;
        document.getElementById('hp-bar').style.width = camera.hp + "%";
        if (camera.hp <= 0) {
            camera.isDead = true;
            document.getElementById('game-over').style.display = 'flex';
        }
    }
}

function handleAttack() {
    if (zombie.dead || camera.isDead) return;
    let dx = camera.eye.elements[0] - zombie.pos[0];
    let dz = camera.eye.elements[2] - zombie.pos[2];
    if (Math.sqrt(dx*dx + dz*dz) < 2.0) {
        zombie.hp--;
        if (zombie.hp <= 0) zombie.dead = true;
    }
}

function drawCube(matrix, texture, color, weight) {
    gl.uniformMatrix4fv(shader_vars.u_ModelMatrix, false, matrix.elements);
    gl.uniform4f(shader_vars.u_Color, color[0], color[1], color[2], color[3]);
    gl.uniform1f(shader_vars.u_texColorWeight, weight);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.uniform1i(shader_vars.u_Sampler, 0);
    gl.drawElements(gl.TRIANGLES, 36, gl.UNSIGNED_SHORT, 0);
}

function render() {
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.uniformMatrix4fv(shader_vars.u_ProjectionMatrix, false, camera.projectionMatrix.elements);
    gl.uniformMatrix4fv(shader_vars.u_ViewMatrix, false, camera.viewMatrix.elements);

    // --- Environment ---
    drawCube(new Matrix4().scale(-500, -500, -500), shader_vars.whiteTex, [0.4, 0.6, 1, 1], 0.0);
    drawCube(new Matrix4().translate(16, -0.5, 16).scale(32, 0.1, 32), shader_vars.whiteTex, [0.2, 0.5, 0.2, 1], 0.0);

    // --- Walls ---
    for(let x=0; x<32; x++) for(let z=0; z<32; z++) for(let y=0; y<MAP[x][z]; y++)
        drawCube(new Matrix4().translate(x, y, z), shader_vars.wallTex, [1,1,1,1], 1.0);

    // --- The Designed Zombie ---
    if (!zombie.dead) {
        // Calculate angle to face camera
        let dx = camera.eye.elements[0] - zombie.pos[0];
        let dz = camera.eye.elements[2] - zombie.pos[2];
        let angle = Math.atan2(dx, dz) * 180 / Math.PI;

        drawZombie(zombie.pos[0], 0, zombie.pos[2], angle);
    }
}

function drawZombie(x, y, z, angle) {
    // Set to color-only mode for the zombie
    gl.uniform1f(shader_vars.u_texColorWeight, 0.0);

    // Create a base matrix for the whole zombie
    let baseMat = new Matrix4().translate(x, y, z).rotate(angle, 0, 1, 0);

    // 1. Legs (Blue pants)
    let leftLeg = new Matrix4(baseMat).translate(-0.12, 0.2, 0).scale(0.2, 0.4, 0.2);
    drawCube(leftLeg, shader_vars.whiteTex, [0, 0, 0.5, 1], 0.0);
    
    let rightLeg = new Matrix4(baseMat).translate(0.12, 0.2, 0).scale(0.2, 0.4, 0.2);
    drawCube(rightLeg, shader_vars.whiteTex, [0, 0, 0.5, 1], 0.0);

    // 2. Body (Teal shirt)
    let body = new Matrix4(baseMat).translate(0, 0.6, 0).scale(0.45, 0.5, 0.2);
    drawCube(body, shader_vars.whiteTex, [0, 0.5, 0.5, 1], 0.0);

    // 3. Head (Green skin)
    let head = new Matrix4(baseMat).translate(0, 0.95, 0).scale(0.35, 0.35, 0.35);
    drawCube(head, shader_vars.whiteTex, [0, 0.7, 0, 1], 0.0);

    // 4. Arms (Green skin, pointing forward like a zombie)
    // Left Arm
    let leftArm = new Matrix4(baseMat).translate(-0.3, 0.7, 0.2).scale(0.15, 0.15, 0.5);
    drawCube(leftArm, shader_vars.whiteTex, [0, 0.7, 0, 1], 0.0);

    // Right Arm
    let rightArm = new Matrix4(baseMat).translate(0.3, 0.7, 0.2).scale(0.15, 0.15, 0.5);
    drawCube(rightArm, shader_vars.whiteTex, [0, 0.7, 0, 1], 0.0);
}

function tick() {
    updateZombie();
    render();
    requestAnimationFrame(tick);
}

function main() {
    setupGL();
    camera = new Camera(canvas);
    
    // Geometry Setup
    const vertices = new Float32Array([-0.5,-0.5,0.5, 0,0, 0.5,-0.5,0.5, 1,0, 0.5,0.5,0.5, 1,1, -0.5,0.5,0.5, 0,1, -0.5,-0.5,-0.5, 1,0, -0.5,0.5,-0.5, 1,1, 0.5,0.5,-0.5, 0,1, 0.5,-0.5,-0.5, 0,0, -0.5,0.5,-0.5, 0,1, -0.5,0.5,0.5, 0,0, 0.5,0.5,0.5, 1,0, 0.5,0.5,-0.5, 1,1, -0.5,-0.5,-0.5, 1,1, 0.5,-0.5,-0.5, 0,1, 0.5,-0.5,0.5, 0,0, -0.5,-0.5,0.5, 1,0, 0.5,-0.5,-0.5, 1,0, 0.5,0.5,-0.5, 1,1, 0.5,0.5,0.5, 0,1, 0.5,-0.5,0.5, 0,0, -0.5,-0.5,-0.5, 0,0, -0.5,-0.5,0.5, 1,0, -0.5,0.5,0.5, 1,1, -0.5,0.5,-0.5, 0,1]);
    const indices = new Uint16Array([0,1,2,0,2,3,4,5,6,4,6,7,8,9,10,8,10,11,12,13,14,12,14,15,16,17,18,16,18,19,20,21,22,20,22,23]);
    let vBuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vBuf); gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
    gl.vertexAttribPointer(shader_vars.a_Position, 3, gl.FLOAT, false, 20, 0); gl.enableVertexAttribArray(shader_vars.a_Position);
    gl.vertexAttribPointer(shader_vars.a_TextureCoordinate, 2, gl.FLOAT, false, 20, 12); gl.enableVertexAttribArray(shader_vars.a_TextureCoordinate);
    let iBuf = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, iBuf); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);

    // Textures
    shader_vars.whiteTex = (function(){ let t=gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([255,255,255,255])); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); return t; })();
    shader_vars.wallTex = (function(){ let c=document.createElement('canvas'); c.width=64; c.height=64; let x=c.getContext('2d'); x.fillStyle="#8d6b4a"; x.fillRect(0,0,64,64); x.fillStyle="#6b4e32"; for(let i=0;i<8;i++)for(let j=0;j<8;j++)if((i+j)%2==0)x.fillRect(i*8,j*8,8,8); let t=gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D,t); gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,c); gl.generateMipmap(gl.TEXTURE_2D); return t; })();

    // Input
    canvas.onmousedown = (e) => { if (e.button === 0) handleAttack(); g_dragging = true; g_lastX = e.clientX; };
    canvas.onmouseup = () => g_dragging = false;
    canvas.onmousemove = (e) => { if(g_dragging) { camera.panRight((e.clientX - g_lastX) * -0.2); g_lastX = e.clientX; }};

    document.addEventListener('keydown', (e) => {
        if(e.key === 'w') camera.moveForward();
        if(e.key === 's') camera.moveBackward();
        if(e.key === 'a') camera.moveLeft();
        if(e.key === 'd') camera.moveRight();
        if(e.key === 'q') camera.panLeft();
        if(e.key === 'e') camera.panRight();
        // 1. Calculate the forward direction vector
    let f = new Vector3();
    f.set(camera.at);
    f.sub(camera.eye);
    f.normalize();

    // 2. Project 1.2 units ahead to find the target grid cell
    // (Using 1.2 ensures we aren't placing it inside our own collision box)
    let targetX = Math.round(camera.eye.elements[0] + f.elements[0] * 1.2);
    let targetZ = Math.round(camera.eye.elements[2] + f.elements[2] * 1.2);

    // 3. Bound check and modify map
    if (targetX >= 0 && targetX < 32 && targetZ >= 0 && targetZ < 32) {
        if (e.key === 'z') { // Add Block
            if (MAP[targetX][targetZ] < 4) {
                MAP[targetX][targetZ]++;
            }
        }
        if (e.key === 'x') { // Delete Block
            if (MAP[targetX][targetZ] > 0) {
                MAP[targetX][targetZ]--;
            }
        }
    }
    
    render();
    });

    gl.enable(gl.DEPTH_TEST);
    tick();
}