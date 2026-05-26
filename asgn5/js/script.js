import * as THREE from 'three';

function addGround(scene) {
    // A large flat plane gives the student a horizon and makes object positions
    // easier to understand. It is rotated because PlaneGeometry starts vertical in
    // the XY plane; the assignment world needs it flat on the XZ ground.
    const groundGeometry = new THREE.PlaneGeometry(30, 30);
    const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x2f5d3a });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);
 }

 function addCrate(scene) {
    const crate = new THREE.Mesh(
        new THREE.BoxGeometry(1, 1, 1),
        new THREE.MeshBasicMaterial({color: 0x8b5a2b})
    );

    crate.position.set(-2, 0.5, 0);
    scene.add(crate);
 }

function main() {

// Phase 1 builds directly on Phase 0:
// - The scene is no longer empty.
// - We add several primary shapes.
// - We add the first required light source.
// - We animate one object so the render loop has visible purpose.

const canvas = document.querySelector('canvas#main-scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111827);

const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  100
);
camera.position.set(0, 3, 8);
camera.lookAt(0, 1, 0);

addGround(scene);
addCrate(scene);

const sunLight = new THREE.DirectionalLight(0xffffff, 2);
sunLight.position.set(5, 8, 4);
scene.add(sunLight);

function animate() {

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

animate();

}

document.addEventListener("DOMContentLoaded", main);