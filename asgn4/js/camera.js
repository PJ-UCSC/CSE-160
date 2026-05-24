class Camera {
    constructor(canvas) {
        this.fov = 60;
        this.eye = new Vector3([16, 0.6, 16]);
        this.at = new Vector3([16, 0.6, 15]);
        this.up = new Vector3([0, 1, 0]);
        this.canvas = canvas;
        this.speed = 0.15;
        this.hp = 100;
        this.isDead = false;
        this.speed = 0.1;
    }

    #checkCollision(newPos) {
        let x = Math.round(newPos.elements[0]);
        let z = Math.round(newPos.elements[2]);
        if (x < 0 || x >= 32 || z < 0 || z >= 32) return true;
        if (MAP[x][z] >= 1) return true; // Collision with block height >= 1
        return false;
    }

    #tryMove(dir) {
        if (this.isDead) return;
        let nextPos = new Vector3();
        nextPos.set(this.eye);
        nextPos.add(dir);
        if (!this.#checkCollision(nextPos)) {
            this.eye.add(dir);
            this.at.add(dir);
        }
    }

    get viewMatrix() {
        let v = new Matrix4();
        v.setLookAt(this.eye.elements[0], this.eye.elements[1], this.eye.elements[2],
                    this.at.elements[0], this.at.elements[1], this.at.elements[2],
                    this.up.elements[0], this.up.elements[1], this.up.elements[2]);
        return v;
    }

    get projectionMatrix() {
        let p = new Matrix4();
        p.setPerspective(this.fov, this.canvas.width/this.canvas.height, 0.1, 1000);
        return p;
    }

    moveForward() { let f = new Vector3(); f.set(this.at); f.sub(this.eye); f.normalize(); f.mul(this.speed); this.#tryMove(f); }
    moveBackward() { let f = new Vector3(); f.set(this.at); f.sub(this.eye); f.normalize(); f.mul(-this.speed); this.#tryMove(f); }
    moveLeft() { let f = new Vector3(); f.set(this.at); f.sub(this.eye); let s = Vector3.cross(this.up, f); s.normalize(); s.mul(this.speed); this.#tryMove(s); }
    moveRight() { let f = new Vector3(); f.set(this.at); f.sub(this.eye); let s = Vector3.cross(f, this.up); s.normalize(); s.mul(this.speed); this.#tryMove(s); }
    
    panUp(alpha = 4) {
        // 1. Get the current forward direction
        let f = new Vector3(); 
        f.set(this.at); 
        f.sub(this.eye);
        
        // 2. Get the "Right" vector using Cross Product
        // We use a temporary Vector3 for the cross product to be safe
        let r = Vector3.cross(f, this.up);
        r.normalize();

        // 3. Rotate the forward vector around the Right vector
        let rotMatrix = new Matrix4();
        rotMatrix.setRotate(alpha, r.elements[0], r.elements[1], r.elements[2]);
        
        // 4. Calculate the new direction
        let f_prime = rotMatrix.multiplyVector3(f);

        // 5. SAFETY GUARD: Prevent flipping upside down
        // We check the Y component. If it's too high/low, we stop the rotation.
        // Normalized Y should stay between -0.98 and 0.98
        let tempF = new Vector3(f_prime.elements);
        tempF.normalize();
        if (Math.abs(tempF.elements[1]) < 0.98) {
            this.at.set(this.eye);
            this.at.add(f_prime);
        }
    }
    panDown(alpha = 4) {
        this.panUp(-alpha);
    }
    panLeft(alpha = 4) {
        let f = new Vector3(); f.set(this.at); f.sub(this.eye);
        let rotMatrix = new Matrix4(); rotMatrix.setRotate(alpha, 0, 1, 0);
        let f_prime = rotMatrix.multiplyVector3(f);
        this.at.set(this.eye); this.at.add(f_prime);
    }
    panRight(alpha = 4) { this.panLeft(-alpha); }
}