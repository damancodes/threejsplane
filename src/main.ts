import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

gsap.registerPlugin(ScrollTrigger);

/* ------------------ SETUP ------------------ */
const container = document.querySelector("#canvas-container") as HTMLElement;

const camera = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  0.1,
  10000
);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

controls.minDistance = 5;
controls.maxDistance = 20;
controls.minPolarAngle = 0.5;
controls.maxPolarAngle = 1.5;
controls.autoRotate = false;
controls.target = new THREE.Vector3(0, 1, 0);
controls.enabled = false;
controls.update();

renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);

container.appendChild(renderer.domElement);
const scene = new THREE.Scene();
const axesHelper = new THREE.AxesHelper(500);
scene.add(axesHelper);
scene.receiveShadow = true;

// Ground mesh
const groundGeometry = new THREE.PlaneGeometry(2100, 2100, 32, 32);
groundGeometry.rotateX(-Math.PI / 2);
const groundMaterial = new THREE.ShadowMaterial({
  opacity: 0.006,
});
const groundMesh = new THREE.Mesh(groundGeometry, groundMaterial);
groundMesh.castShadow = false;
groundMesh.receiveShadow = true;

scene.add(groundMesh);
scene.add(new THREE.AmbientLight(0xffffff, 0.5));

/* ------------------ PARTICLE SYSTEM ------------------ */
const particleCount = 1000;
const particlesGeometry = new THREE.BufferGeometry();
const particlesPositions = new Float32Array(particleCount * 3);
const particlesVelocities = new Float32Array(particleCount * 3);

for (let i = 0; i < particleCount * 3; i += 3) {
  particlesPositions[i] = (Math.random() - 0.5) * 100;
  particlesPositions[i + 1] = Math.random() * 50;
  particlesPositions[i + 2] = (Math.random() - 0.5) * 100;

  particlesVelocities[i] = (Math.random() - 0.5) * 0.02;
  particlesVelocities[i + 1] = Math.random() * 0.01;
  particlesVelocities[i + 2] = (Math.random() - 0.5) * 0.02;
}

particlesGeometry.setAttribute(
  "position",
  new THREE.BufferAttribute(particlesPositions, 3)
);

const particlesMaterial = new THREE.PointsMaterial({
  color: 0x88ccff,
  size: 0.15,
  transparent: true,
  opacity: 0.6,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
});

const particleSystem = new THREE.Points(particlesGeometry, particlesMaterial);
scene.add(particleSystem);

/* ------------------ MODEL GROUPING ------------------ */
const dragWrapper = new THREE.Group();
scene.add(dragWrapper);

const modelWrapper = new THREE.Group();
dragWrapper.add(modelWrapper);

/* ------------------ RIPPLE EFFECT ------------------ */
const rippleGroup = new THREE.Group();
// Placed slightly above the ground to avoid flickering
rippleGroup.position.y = 0.5;
scene.add(rippleGroup);

const ringGeo = new THREE.RingGeometry(4, 4.5, 64);
const ringMatBase = new THREE.MeshBasicMaterial({
  color: 0xffffff,
  transparent: true,
  opacity: 0.5,
  side: THREE.DoubleSide,
});

function createRipple() {
  const mesh = new THREE.Mesh(ringGeo, ringMatBase.clone());
  mesh.rotation.x = -Math.PI / 2;
  mesh.scale.set(0, 0, 0);
  rippleGroup.add(mesh);

  const tl = gsap.timeline({
    onComplete: () => {
      rippleGroup.remove(mesh);
      (mesh.material as THREE.Material).dispose();
    },
  });

  tl.to(mesh.scale, { x: 3, y: 3, z: 3, duration: 5, ease: "power1.out" });
  tl.to(mesh.material, { opacity: 0, duration: 5, ease: "power1.out" }, "<");

  // Loops the ripple creation
  gsap.delayedCall(5, createRipple);
}

/* ------------------ MOUSE PARALLAX ------------------ */
const onMouseMove = (event: MouseEvent) => {
  const x = (event.clientX / window.innerWidth) * 2 - 1;
  const y = -(event.clientY / window.innerHeight) * 2 + 1;

  const tiltX = -y * 0.1;
  const tiltY = x * 0.3;

  gsap.to(dragWrapper.rotation, {
    x: tiltX * 0.25,
    y: tiltY * 0.25,
    duration: 1,
    ease: "power2.out",
    overwrite: true,
  });

  const cloudsContainer = document.querySelector("#clouds-container");
  if (cloudsContainer) {
    gsap.to(cloudsContainer, {
      x: x * 30,
      y: -y * 30,
      duration: 1.5,
      ease: "power2.out",
      overwrite: true,
    });
  }
};

window.addEventListener("mousemove", onMouseMove);

/* ------------------ LOADER ------------------ */
const loader = new GLTFLoader();

loader.load("/models/jet3/blue.glb", (glb) => {
  const model = glb.scene;
  model.castShadow = true;
  modelWrapper.add(model);

  model.traverse((child) => {
    if ((child as any).isObject3D) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });

  const boxHelper = new THREE.BoxHelper(model, 0xffff00);
  modelWrapper.add(boxHelper);

  // const gui = new GUI();

  const flag = 0;
  const planeSettings = {
    rotateX: flag ? 0 : 0,
    rotateY: flag ? 0 : 56.16,
    rotateZ: flag ? 0 : 8.76,
  };

  const updateRotation = () => {
    modelWrapper.rotation.set(
      THREE.MathUtils.degToRad(planeSettings.rotateX),
      THREE.MathUtils.degToRad(planeSettings.rotateY),
      THREE.MathUtils.degToRad(planeSettings.rotateZ)
    );
  };
  updateRotation();

  /* ---------- AUTO-CENTER & LIGHTING ---------- */
  const box = new THREE.Box3().setFromObject(model);
  const boxSize = box.getSize(new THREE.Vector3()).length();
  const boxCenter = box.getCenter(new THREE.Vector3());

  const spotLight = new THREE.SpotLight(
    0xffffff,
    150,
    boxSize * 10,
    Math.PI / 5,
    0.4,
    1
  );
  spotLight.position.set(
    boxCenter.x + 2,
    boxCenter.y + boxSize * 2,
    boxCenter.z + boxSize * 1.5
  );
  spotLight.target.position.copy(boxCenter);
  spotLight.castShadow = true;
  spotLight.shadow.bias = -0.00005;
  spotLight.shadow.radius = 4;

  spotLight.shadow.mapSize.set(5000, 5000);

  modelWrapper.add(spotLight);

  // Original Camera Positioning
  const halfFov = THREE.MathUtils.degToRad(camera.fov * 0.5);
  const distance = (boxSize * 0.5) / Math.tan(halfFov);
  const direction = new THREE.Vector3()
    .subVectors(boxCenter, camera.position)
    .normalize();
  camera.position.copy(direction.multiplyScalar(distance).add(boxCenter));
  camera.updateProjectionMatrix();

  /* ---------- ANIMATIONS ---------- */
  gsap.to(model.rotation, {
    z: -1 * THREE.MathUtils.degToRad(planeSettings.rotateZ),
    duration: 2.5,
    repeat: -1,
    yoyo: true,
    ease: "sine.inOut",
  });

  gsap.to(modelWrapper.rotation, {
    x: "-=0.1",
    y: "-=0.8",
    scrollTrigger: {
      trigger: "body",
      start: "top top",
      end: "bottom bottom",
      scrub: 1.5,
    },
  });

  // Start Ripples
  createRipple();
});

/* ------------------ ANIMATION LOOP ------------------ */
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}
animate();

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
