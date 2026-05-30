/**
 * @file First-person camera: WASD movement, terrain height, mouse look, scroll zoom.
 *
 * The controller owns the THREE.Camera — set pose via `setSpawn` / `setSpawnView`,
 * not `camera.position` directly (see main.js).
 *
 * Pointer chords:
 * - Left drag — look
 * - Left + right buttons — move forward (same as W)
 */
import * as THREE from "three";
import { sampleHeightAt } from "./terrain.js";

// ---------------------------------------------------------------------------
// Tuning constants
// ---------------------------------------------------------------------------

const DEFAULT_EYE_HEIGHT = 2.8;
const EYE_HEIGHT_MIN = 1.0;
const EYE_HEIGHT_MAX = 50.0;
const MOVE_ACCEL_BASE = 34;
const VERTICAL_SPEED_BASE = 12;
const MOVE_FRICTION = 16;
const TURN_SPEED = 2.0;
const MOUSE_SENS = 0.0022;
const PITCH_MIN = -0.45;
const PITCH_MAX = Math.PI / 2 - 0.04;
const LOOK_DIST = 14;
const FOV_MIN = 30;
const FOV_MAX = 155;

// ---------------------------------------------------------------------------
// CameraController
// ---------------------------------------------------------------------------

export class CameraController {
  constructor(camera, terrainData, canvas) {
    this.camera = camera;
    this.terrainData = terrainData;
    this.canvas = canvas;

    this.eyeHeight = DEFAULT_EYE_HEIGHT;
    this.verticalOffset = 0;
    this.verticalSpeed = VERTICAL_SPEED_BASE;
    this.eyeHeightDirty = false;

    this.player = {
      x: 0,
      z: 0,
      y: DEFAULT_EYE_HEIGHT,
      yaw: 0,
      pitch: 0.42,
      velX: 0,
      velZ: 0,
    };

    this.moveAccel = MOVE_ACCEL_BASE;
    this.lookAtYOffset = 0;
    this.dragging = false;
    this.buttonsDown = { left: false, right: false };
    this.lastX = 0;
    this.lastY = 0;

    this.target = new THREE.Vector3();
    this.lookDir = new THREE.Vector3();
    this.moveForward = new THREE.Vector3();
    this.moveRight = new THREE.Vector3();
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

  setMoveSpeed(multiplier) {
    this.moveAccel =
      MOVE_ACCEL_BASE * THREE.MathUtils.clamp(multiplier, 0.25, 2.5);
  }

  setEyeHeight(height) {
    this.eyeHeight = THREE.MathUtils.clamp(height, EYE_HEIGHT_MIN, EYE_HEIGHT_MAX);
    this.verticalOffset = 0;
  }

  setVerticalSpeed(multiplier) {
    this.verticalSpeed =
      VERTICAL_SPEED_BASE * THREE.MathUtils.clamp(multiplier, 0.25, 2.5);
  }

  setLookAtYOffset(offsetY) {
    this.lookAtYOffset = THREE.MathUtils.clamp(offsetY, -12, 12);
  }

  // --- Spawn / initial view ---

  setSpawn(x, z, yaw = 0) {
    this.player.x = x;
    this.player.z = z;
    this.player.yaw = yaw;
    this.player.velX = 0;
    this.player.velZ = 0;
    this.verticalOffset = 0;
    const ground = sampleHeightAt(
      x,
      z,
      this.terrainData.heights,
      this.terrainData.size
    );
    this.player.y = ground + this.eyeHeight;
    this.applyToCamera();
  }

  /**
   * Set start position and look-at target. Use this instead of camera.position / lookAt —
   * CameraController owns the camera and applies player state every frame.
   */
  setSpawnView(position, lookAt) {
    this.player.x = position.x;
    this.player.z = position.z;
    this.player.velX = 0;
    this.player.velZ = 0;

    const ground = sampleHeightAt(
      this.player.x,
      this.player.z,
      this.terrainData.heights,
      this.terrainData.size
    );
    this.verticalOffset = position.y - ground - this.eyeHeight;
    this.player.y = position.y;

    const dir = this.lookDir
      .subVectors(lookAt, position)
      .normalize();
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

  // --- Movement & orientation ---

  /** Same heading the camera uses — projected onto XZ for walking. */
  updateMoveBasis() {
    const cp = Math.cos(this.player.pitch);
    const hx = -Math.sin(this.player.yaw);
    const hz = -Math.cos(this.player.yaw);

    this.lookDir.set(hx * cp, -Math.sin(this.player.pitch), hz * cp);

    this.moveForward.set(this.lookDir.x, 0, this.lookDir.z);
    if (this.moveForward.lengthSq() < 1e-8) {
      this.moveForward.set(hx, 0, hz);
    }
    this.moveForward.normalize();

    this.moveRight.set(-this.moveForward.z, 0, this.moveForward.x);
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
    this.target.y += this.lookAtYOffset;
    this.camera.lookAt(this.target);
  }

  update(dt, keys) {
    if (keys.KeyA) this.player.yaw += TURN_SPEED * dt;
    if (keys.KeyD) this.player.yaw -= TURN_SPEED * dt;

    this.updateMoveBasis();

    this.wishVel.set(0, 0, 0);
    if (keys.KeyW || this.isBothMouseButtonsDown()) {
      this.wishVel.add(this.moveForward);
    }
    if (keys.KeyS) this.wishVel.sub(this.moveForward);
    if (keys.KeyQ) this.wishVel.sub(this.moveRight);
    if (keys.KeyE) this.wishVel.add(this.moveRight);

    if (this.wishVel.lengthSq() > 0) {
      this.wishVel.normalize().multiplyScalar(this.moveAccel);
      this.player.velX += this.wishVel.x * dt;
      this.player.velZ += this.wishVel.z * dt;
    }

    const friction = Math.exp(-MOVE_FRICTION * dt);
    this.player.velX *= friction;
    this.player.velZ *= friction;

    this.player.x += this.player.velX * dt;
    this.player.z += this.player.velZ * dt;

    this.eyeHeightDirty = false;
    const verticalKey =
      keys.Space || keys.ShiftLeft || keys.ShiftRight;
    if (verticalKey) {
      if (this.verticalOffset !== 0) {
        this.eyeHeight = THREE.MathUtils.clamp(
          this.eyeHeight + this.verticalOffset,
          EYE_HEIGHT_MIN,
          EYE_HEIGHT_MAX
        );
        this.verticalOffset = 0;
      }
      if (keys.Space) {
        this.eyeHeight += this.verticalSpeed * dt;
      }
      if (keys.ShiftLeft || keys.ShiftRight) {
        this.eyeHeight -= this.verticalSpeed * dt;
      }
      this.eyeHeight = THREE.MathUtils.clamp(
        this.eyeHeight,
        EYE_HEIGHT_MIN,
        EYE_HEIGHT_MAX
      );
      this.eyeHeightDirty = true;
    }

    const ground = sampleHeightAt(
      this.player.x,
      this.player.z,
      this.terrainData.heights,
      this.terrainData.size
    );
    const desiredY = ground + this.eyeHeight + this.verticalOffset;
    const yBlend = 1 - Math.exp(-10 * dt);
    this.player.y += (desiredY - this.player.y) * yBlend;

    this.applyToCamera();
    return this.target;
  }

  isBothMouseButtonsDown() {
    return this.buttonsDown.left && this.buttonsDown.right;
  }

  /** Write camera position, look-at target, and FOV to HUD elements (any may be omitted). */
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

  // --- Cleanup ---

  dispose() {
    this.canvas.removeEventListener("pointerdown", this._onPointerDown);
    this.canvas.removeEventListener("pointerup", this._onPointerUp);
    this.canvas.removeEventListener("pointercancel", this._onPointerCancel);
    this.canvas.removeEventListener("pointermove", this._onPointerMove);
    this.canvas.removeEventListener("contextmenu", this._onContextMenu);
    window.removeEventListener("wheel", this._onWheel);
    window.removeEventListener("pointerdown", this._onWindowPointer);
    window.removeEventListener("pointerup", this._onWindowPointer);
    window.removeEventListener("blur", this._onWindowBlur);
  }

  // --- Pointer input (canvas + window for reliable two-button chord) ---

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

  /** Use e.buttons so chord clicks (both at once) register reliably. */
  _syncPointerButtons(e) {
    if (e.pointerType !== "mouse") return;
    this.buttonsDown.left = (e.buttons & 1) !== 0;
    this.buttonsDown.right = (e.buttons & 2) !== 0;
  }

  _onWindowPointer(e) {
    if (e.pointerType !== "mouse" || !this._isCanvasPointerTarget(e.target)) return;
    this._syncPointerButtons(e);
    if (e.type === "pointerdown" && e.button === 2) {
      e.preventDefault();
    }
  }

  _onWindowBlur() {
    this.buttonsDown.left = false;
    this.buttonsDown.right = false;
    this.dragging = false;
  }

  _onPointerDown(e) {
    if (e.pointerType !== "mouse") return;
    this._syncPointerButtons(e);
    if (e.button === 0) {
      this.dragging = true;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
      this.canvas.setPointerCapture(e.pointerId);
    }
    if (e.button === 2) {
      e.preventDefault();
    }
  }

  _onPointerUp(e) {
    if (e.pointerType !== "mouse") return;
    if (e.button === 0) {
      this.dragging = false;
      if (this.canvas.hasPointerCapture(e.pointerId)) {
        this.canvas.releasePointerCapture(e.pointerId);
      }
    }
    if (e.button === 2) {
      e.preventDefault();
    }
    this._syncPointerButtons(e);
  }

  _onPointerCancel(e) {
    if (e.button === 0) this.dragging = false;
    if (this.canvas.hasPointerCapture(e.pointerId)) {
      this.canvas.releasePointerCapture(e.pointerId);
    }
    this._syncPointerButtons(e);
  }

  _onPointerMove(e) {
    this._syncPointerButtons(e);
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
