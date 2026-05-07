class Camera {
    #fov;
    #eye;
    #at;
    #up;
    #canvas;
    #speed = 1;
    #walls = [];
    #collisionRadius = 0.2;

    constructor(eye, at, up, fov, canvas, speed) {
        this.#eye = new Vector3(eye);
        this.#at = new Vector3(at);
        this.#up = new Vector3(up);
        this.#fov = fov;
        this.#canvas = canvas;

        if(speed) {
            this.#speed = speed;
        }
    }

    setWalls(walls) {
        this.#walls = walls;
    }

    // Returns true if the proposed eye position would be inside any wall AABB
    // (with a small buffer so the camera can't graze the surface).
    #collidesWithWalls(newEye) {
        const e = newEye.elements;
        const px = e[0];
        const py = e[1];
        const pz = e[2];
        const r = this.#collisionRadius;

        for (let i = 0; i < this.#walls.length; i++) {
            const wall = this.#walls[i];
            const wx = wall.position[0];
            const wz = wall.position[2];
            const wh = wall.size[1];

            // Wall occupies x:[wx-0.5, wx+0.5], z:[wz-0.5, wz+0.5], y:[0, wh].
            if (px > wx - 0.5 - r && px < wx + 0.5 + r &&
                pz > wz - 0.5 - r && pz < wz + 0.5 + r &&
                py > 0 && py < wh) {
                return true;
            }
        }
        return false;
    }

    // Apply a translation to eye/at only if the new eye position is collision-free.
    #tryMove(s) {
        const candidate = new Vector3();
        candidate.set(this.#eye);
        candidate.add(s);

        if (this.#collidesWithWalls(candidate)) {
            return;
        }

        this.#eye.add(s);
        this.#at.add(s);
    }

    // Apply a translation to eye/at only if the new eye position is collision-free.
    #trySetAt(s, t) {
        const candidate = new Vector3();
        candidate.set(s);
        candidate.add(t);

        if (this.#collidesWithWalls(candidate)) {
           //return;
        }

        this.#at.set(candidate);
    }

    get viewMatrix() {
        const viewMatrix = new Matrix4();
        const eyeElems = this.#eye.elements;
        const atElems = this.#at.elements;
        const upElems = this.#up.elements;

        viewMatrix.setLookAt(
            eyeElems[0], eyeElems[1], eyeElems[2],
            atElems[0], atElems[1], atElems[2],
            upElems[0], upElems[1], upElems[2]
        );

        return viewMatrix;
    }

    get projectionMatrix() {
        const projectionMatrix = new Matrix4();
        projectionMatrix.setPerspective(this.#fov, 
            this.#canvas.width/this.#canvas.height, 0.1, 5000
        );

        return projectionMatrix;
    }

    moveForward() {
        let f = new Vector3();
        f.set(this.#at);
        f.sub(this.#eye);
        const s = f.normalize();
        s.mul(this.#speed);

        this.#tryMove(s);
    }

    moveBackward() {
        let f = new Vector3();
        f.set(this.#at);
        f.sub(this.#eye);
        const s = f.normalize();
        s.mul(-this.#speed);

        this.#tryMove(s);
    }

    moveLeft() {
        let f = new Vector3();
        f.set(this.#at);
        f.sub(this.#eye);
        const s = Vector3.cross(this.#up, f);
        s.normalize();
        s.mul(this.#speed);

        this.#tryMove(s);
    }

    moveRight() {
        let f = new Vector3();
        f.set(this.#at);
        f.sub(this.#eye);
        const s = Vector3.cross(f, this.#up);
        s.normalize();
        s.mul(this.#speed);

        this.#tryMove(s);
    }

    panLeft() {
        const upElems = this.#up.elements;
        
        const f = new Vector3();
        f.set(this.#at);
        f.sub(this.#eye);
        const rotMatrix = new Matrix4();
        const alpha = (this.#speed);
        rotMatrix.setRotate(alpha, 
            upElems[0], upElems[1], upElems[2]
        );

        const f_prime = rotMatrix.multiplyVector3(f);

        this.#trySetAt(this.#eye, f_prime);
    }

    panRight() {
        const upElems = this.#up.elements;
        
        const f = new Vector3();
        f.set(this.#at);
        f.sub(this.#eye);
        const rotMatrix = new Matrix4();
        const alpha = (this.#speed);
        rotMatrix.setRotate(-alpha, 
            upElems[0], upElems[1], upElems[2]
        );

        const f_prime = rotMatrix.multiplyVector3(f);

        this.#trySetAt(this.#eye, f_prime);
    }

    
}