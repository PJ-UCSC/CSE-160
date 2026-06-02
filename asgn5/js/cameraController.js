import * as THREE from "three";
import { sampleHeightAt } from "./terrain.js";

const EYE_H = 2.8;
const EYE_MIN = 1;
const EYE_MAX = 50;
const MOVE_ACCEL = 34;
const VERT_SPEED = 12;
const FRICTION = 16;
const TURN = 2;
const MOUSE_SENS = 0.0022;
const PITCH_MIN = -0.45;
const PITCH_MAX = Math.PI / 2 - 0.04;
const LOOK_DIST = 14;
const FOV_MIN = 30;
const FOV_MAX = 155;

export class CameraController {
  constructor(camera, terrain, canvas) {
    this.camera = camera;
    this.terrain = terrain;
    this.canvas = canvas;

    this.eyeHeight = EYE_H;
    this.vertOff = 0;
    this.vertSpeed = VERT_SPEED;
    this.eyeDirty = false;

    this.player = {
      x: 0,
      z: 0,
      y: EYE_H,
      yaw: 0,
      pitch: 0.42,
      velX: 0,
      velZ: 0,
    };

    this.moveAccel = MOVE_ACCEL;
    this.lookAtY = 0;
    this.dragging = false;
    this.btns = { left: false, right: false };
    this.lastX = 0;
    this.lastY = 0;

    this.target = new THREE.Vector3();
    this.lookDir = new THREE.Vector3();
    this.fwd = new THREE.Vector3();
    this.right = new THREE.Vector3();
    this.wishVel = new THREE.Vector3();

    this._onPointerDown = this._onPointerDown.bind(this);
    this._onPointerUp = this._onPointerUp.bind(this);
    this._onPointerCancel = this._onPointerCancel.bind(this);
    this._onPointerMove = this._onPointerMove.bind(this);
    this._onWheel = this._onWheel.bind(this);
    this._onWindowPointer = this._onWindowPointer.bind(this);
    this._onWindowBlur = this._onWindowBlur.bind(this);
    this._onContextMenu = (e) => e.preventDefault();

    this._bindEvents();
  }

  setMoveSpeed(mul) {
    this.moveAccel = MOVE_ACCEL * THREE.MathUtils.clamp(mul, 0.25, 2.5);
  }

  setEyeHeight(h) {
    this.eyeHeight = THREE.MathUtils.clamp(h, EYE_MIN, EYE_MAX);
    this.vertOff = 0;
  }

  setVertSpeed(mul) {
    this.vertSpeed = VERT_SPEED * THREE.MathUtils.clamp(mul, 0.25, 2.5);
  }

  setLookAtYOffset(y) {
    this.lookAtY = THREE.MathUtils.clamp(y, -12, 12);
  }

  setSpawn(x, z, yaw = 0) {
    this.player.x = x;
    this.player.z = z;
    this.player.yaw = yaw;
    this.player.velX = 0;
    this.player.velZ = 0;
    this.vertOff = 0;
    const ground = sampleHeightAt(x, z, this.terrain.heights, this.terrain.size);
    this.player.y = ground + this.eyeHeight;
    this.applyToCamera();
  }

  // set start pose from world position + look target (don't use camera.position directly)
  setSpawnView(pos, lookAt) {
    this.player.x = pos.x;
    this.player.z = pos.z;
    this.player.velX = 0;
    this.player.velZ = 0;

    const ground = sampleHeightAt(
      this.player.x,
      this.player.z,
      this.terrain.heights,
      this.terrain.size
    );
    this.vertOff = pos.y - ground - this.eyeHeight;
    this.player.y = pos.y;

    const dir = this.lookDir.subVectors(lookAt, pos).normalize();
    this.player.pitch = THREE.MathUtils.clamp(
      Math.asin(-dir.y),
      PITCH_MIN,
      PITCH_MAX
    );
    const cp = Math.cos(this.player.pitch);
    if (Math.abs(cp) > 1e-6) {
      this.player.yaw = Math.atan2(-dir.x / cp, -dir.z / cp);
    }

    this.applyToCamera();
  }

  updateMoveBasis() {
    const cp = Math.cos(this.player.pitch);
    const hx = -Math.sin(this.player.yaw);
    const hz = -Math.cos(this.player.yaw);

    this.lookDir.set(hx * cp, -Math.sin(this.player.pitch), hz * cp);

    this.fwd.set(this.lookDir.x, 0, this.lookDir.z);
    if (this.fwd.lengthSq() < 1e-8) {
      this.fwd.set(hx, 0, hz);
    }
    this.fwd.normalize();

    this.right.set(-this.fwd.z, 0, this.fwd.x);
  }

  applyLookDelta(dx, dy) {
    this.player.yaw -= dx * MOUSE_SENS;
    this.player.pitch = THREE.MathUtils.clamp(
      this.player.pitch + dy * MOUSE_SENS,
      PITCH_MIN,
      PITCH_MAX
    );
  }

  applyToCamera() {
    this.updateMoveBasis();
    this.camera.position.set(this.player.x, this.player.y, this.player.z);
    this.target
      .copy(this.camera.position)
      .addScaledVector(this.lookDir, LOOK_DIST);
    this.target.y += this.lookAtY;
    this.camera.lookAt(this.target);
  }

  update(dt, keys) {
    if (keys.KeyA) this.player.yaw += TURN * dt;
    if (keys.KeyD) this.player.yaw -= TURN * dt;

    this.updateMoveBasis();

    this.wishVel.set(0, 0, 0);
    if (keys.KeyW || this.bothBtns()) {
      this.wishVel.add(this.fwd);
    }
    if (keys.KeyS) this.wishVel.sub(this.fwd);
    if (keys.KeyQ) this.wishVel.sub(this.right);
    if (keys.KeyE) this.wishVel.add(this.right);

    if (this.wishVel.lengthSq() > 0) {
      this.wishVel.normalize().multiplyScalar(this.moveAccel);
      this.player.velX += this.wishVel.x * dt;
      this.player.velZ += this.wishVel.z * dt;
    }

    const friction = Math.exp(-FRICTION * dt);
    this.player.velX *= friction;
    this.player.velZ *= friction;

    this.player.x += this.player.velX * dt;
    this.player.z += this.player.velZ * dt;

    this.eyeDirty = false;
    if (keys.Space || keys.ShiftLeft || keys.ShiftRight) {
      if (this.vertOff !== 0) {
        this.eyeHeight = THREE.MathUtils.clamp(
          this.eyeHeight + this.vertOff,
          EYE_MIN,
          EYE_MAX
        );
        this.vertOff = 0;
      }
      if (keys.Space) this.eyeHeight += this.vertSpeed * dt;
      if (keys.ShiftLeft || keys.ShiftRight) {
        this.eyeHeight -= this.vertSpeed * dt;
      }
      this.eyeHeight = THREE.MathUtils.clamp(this.eyeHeight, EYE_MIN, EYE_MAX);
      this.eyeDirty = true;
    }

    const ground = sampleHeightAt(
      this.player.x,
      this.player.z,
      this.terrain.heights,
      this.terrain.size
    );
    const wantY = ground + this.eyeHeight + this.vertOff;
    const blend = 1 - Math.exp(-10 * dt);
    this.player.y += (wantY - this.player.y) * blend;

    this.applyToCamera();
    return this.target;
  }

  bothBtns() {
    return this.btns.left && this.btns.right;
  }

  updateHud(posEl, lookEl, fovEl) {
    const fmt = (n) => n.toFixed(2);
    if (posEl) {
      const p = this.camera.position;
      posEl.textContent = `(${fmt(p.x)}, ${fmt(p.y)}, ${fmt(p.z)})`;
    }
    if (lookEl) {
      const t = this.target;
      lookEl.textContent = `(${fmt(t.x)}, ${fmt(t.y)}, ${fmt(t.z)})`;
    }
    if (fovEl) {
      fovEl.textContent = `${this.camera.fov.toFixed(1)}°`;
    }
  }

  _bindEvents() {
    this.canvas.addEventListener("pointerdown", this._onPointerDown);
    this.canvas.addEventListener("pointerup", this._onPointerUp);
    this.canvas.addEventListener("pointercancel", this._onPointerCancel);
    this.canvas.addEventListener("pointermove", this._onPointerMove);
    this.canvas.addEventListener("contextmenu", this._onContextMenu);
    window.addEventListener("wheel", this._onWheel, { passive: false });
    window.addEventListener("pointerdown", this._onWindowPointer);
    window.addEventListener("pointerup", this._onWindowPointer);
    window.addEventListener("blur", this._onWindowBlur);
  }

  _isCanvasPointerTarget(target) {
    return target === this.canvas || this.canvas.contains(target);
  }

  // e.buttons works when both mouse buttons pressed at once
  _syncBtns(e) {
    if (e.pointerType !== "mouse") return;
    this.btns.left = (e.buttons & 1) !== 0;
    this.btns.right = (e.buttons & 2) !== 0;
  }

  _onWindowPointer(e) {
    if (e.pointerType !== "mouse" || !this._isCanvasPointerTarget(e.target)) return;
    this._syncBtns(e);
    if (e.type === "pointerdown" && e.button === 2) {
      e.preventDefault();
    }
  }

  _onWindowBlur() {
    this.btns.left = false;
    this.btns.right = false;
    this.dragging = false;
  }

  _onPointerDown(e) {
    if (e.pointerType !== "mouse") return;
    this._syncBtns(e);
    if (e.button === 0) {
      this.dragging = true;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
      this.canvas.setPointerCapture(e.pointerId);
    }
    if (e.button === 2) e.preventDefault();
  }

  _onPointerUp(e) {
    if (e.pointerType !== "mouse") return;
    if (e.button === 0) {
      this.dragging = false;
      if (this.canvas.hasPointerCapture(e.pointerId)) {
        this.canvas.releasePointerCapture(e.pointerId);
      }
    }
    if (e.button === 2) e.preventDefault();
    this._syncBtns(e);
  }

  _onPointerCancel(e) {
    if (e.button === 0) this.dragging = false;
    if (this.canvas.hasPointerCapture(e.pointerId)) {
      this.canvas.releasePointerCapture(e.pointerId);
    }
    this._syncBtns(e);
  }

  _onPointerMove(e) {
    this._syncBtns(e);
    if (!this.dragging) return;
    const dx = e.clientX - this.lastX;
    const dy = e.clientY - this.lastY;
    this.lastX = e.clientX;
    this.lastY = e.clientY;
    this.applyLookDelta(dx, dy);
  }

  _onWheel(e) {
    if (e.target.closest?.("#lights-panel")) return;
    e.preventDefault();
    this.camera.fov = THREE.MathUtils.clamp(
      this.camera.fov + e.deltaY * 0.05,
      FOV_MIN,
      FOV_MAX
    );
    this.camera.updateProjectionMatrix();
  }
}
