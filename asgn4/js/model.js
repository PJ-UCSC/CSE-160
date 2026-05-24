class Model {
    constructor() {
        this.vertices = [];
        this.normals = [];
        this.indices = [];
        this.vertexBuffer = null;
        this.normalBuffer = null;
        this.indexBuffer = null;
        this.isLoaded = false;
    }

    async load(url) {
        const response = await fetch(url);
        const text = await response.text();
        const lines = text.split('\n');

        const temp_v = [];
        const temp_vn = [];

        for (let line of lines) {
            line = line.trim();
            if (!line || line.startsWith('#')) continue; // Skip comments/empty lines

            const parts = line.split(/\s+/);
            const type = parts[0];

            if (type === 'v') {
                temp_v.push([parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3])]);
            } else if (type === 'vn') {
                temp_vn.push([parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3])]);
            } else if (type === 'f') {
                // 1. Clean the parts first
                const cleanParts = parts.filter(p => p.length > 0);

                // 2. Loop must use cleanParts.length 
                // 3. Change <= to < to avoid going out of bounds
                for (let i = 1; i < cleanParts.length - 2; i++) {
                    const triIndices = [1, i + 1, i + 2];
                    
                    for (let idx of triIndices) {
                        const subParts = cleanParts[idx].split('/');
                        
                        // 1. Position
                        const vIdx = parseInt(subParts[0]) - 1;
                        if (temp_v[vIdx]) {
                            this.vertices.push(...temp_v[vIdx]);
                        } else { continue; }

                        // 2. Normal
                        let normalAdded = false;
                        if (subParts.length >= 3 && subParts[2] !== "") {
                            const vnIdx = parseInt(subParts[2]) - 1;
                            if (temp_vn[vnIdx]) {
                                this.normals.push(...temp_vn[vnIdx]);
                                normalAdded = true;
                            }
                        }
                        
                        if (!normalAdded) {
                            this.normals.push(0, 1, 0); 
                        }
                        
                        this.indices.push(this.indices.length);
                    }
                }
            }
        }

        this.vertexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this.vertices), gl.STATIC_DRAW);

        this.normalBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.normalBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this.normals), gl.STATIC_DRAW);

        this.indexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(this.indices), gl.STATIC_DRAW);

        this.isLoaded = true;
        console.log("Model loaded:", url);
    }

    render(matrix, color) {
        if (!this.isLoaded) return;

        gl.uniformMatrix4fv(shader_vars.u_ModelMatrix, false, matrix.elements);
        gl.uniformMatrix3fv(shader_vars.u_NormalMatrix, false, getNormalMatrix(matrix));
        gl.uniform4f(shader_vars.u_Color, color[0], color[1], color[2], color[3]);
        gl.uniform1f(shader_vars.u_texColorWeight, 0.0); 
        gl.uniform1f(shader_vars.u_Shininess, 20.0);
        gl.uniform1f(shader_vars.u_ShowNormals, g_showNormals ? 1.0 : 0.0);
        gl.uniform1f(shader_vars.u_showDiffuse, g_showDiffuse ? 1.0 : 0.0);

        // 1. Position
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
        gl.vertexAttribPointer(shader_vars.a_Position, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(shader_vars.a_Position);

        // 2. Normal
        gl.bindBuffer(gl.ARRAY_BUFFER, this.normalBuffer);
        gl.vertexAttribPointer(shader_vars.a_Normal, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(shader_vars.a_Normal);

        // 3. Texture Coordinate (IMPORTANT FIX)
        // We disable the array so it doesn't try to read from a buffer, 
        // and provide a constant default value of (0,0)
        gl.disableVertexAttribArray(shader_vars.a_TextureCoordinate);
        gl.vertexAttrib2f(shader_vars.a_TextureCoordinate, 0.0, 0.0);

        // 4. Draw
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
        gl.drawElements(gl.TRIANGLES, this.indices.length, gl.UNSIGNED_SHORT, 0);
    }
}