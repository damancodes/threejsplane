import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import GUI from "lil-gui";

gsap.registerPlugin(ScrollTrigger);

// FIX: Normalize scroll for mobile to prevent jittery/laggy scrubbing
if (window.innerWidth < 768) {
  ScrollTrigger.normalizeScroll(true);
  ScrollTrigger.config({ ignoreMobileResize: true });
}

/* ------------------ LOADER LOGIC ------------------ */
const loaderEl = document.getElementById("loader") as HTMLElement;
const loaderText = document.getElementById("loader-text") as HTMLElement;
let displayedProgress = 0;
const isMobile = window.innerWidth < 768;

const loadingManager = new THREE.LoadingManager(
  () => {
    gsap.to(loaderEl, {
      opacity: 0,
      duration: 0.8,
      ease: "power2.out",
      onComplete: () => {
        loaderEl.style.display = "none";
      },
    });
  },
  (_, loaded, total) => {
    const target = (loaded / total) * 100;
    gsap.to(
      { v: displayedProgress },
      {
        v: target,
        duration: 0.25,
        ease: "power1.out",
        onUpdate() {
          displayedProgress = Math.round((this as any).targets()[0].v);
          loaderText.textContent = `${displayedProgress}%`;
        },
      }
    );
  }
);

/* ------------------ SCENE SETUP ------------------ */
const container = document.querySelector("#canvas-container") as HTMLElement;
const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);

const renderer = new THREE.WebGLRenderer({
  antialias: !isMobile, // Optimization: Disable AA on mobile for significant FPS boost
  alpha: true,
  powerPreference: "high-performance",
});

renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;

container.appendChild(renderer.domElement);

/* ------------------ CAMERA GUI ------------------ */
const gui = new GUI({ width: 300 });
gui.hide();
gui.close();

const lookAtParams = { followModel: true };
gui.add(lookAtParams, "followModel").name("Look At Model");

/* ------------------ LIGHTING ------------------ */
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);

const spotLight = new THREE.SpotLight(0xffffff, 150, 100, 0.3);
spotLight.position.set(5, 10, 10);
spotLight.castShadow = true;
scene.add(spotLight);

// NEW: Top Spotlight (Specifically for the model)
const topSpotLight = new THREE.SpotLight(0xffffff, 100, 50, 0.45, 0.5, 1);
topSpotLight.castShadow = true;
topSpotLight.shadow.bias = -0.00005;
topSpotLight.shadow.radius = 4;

// FIX: 5000 is too high for mobile. 1024 is plenty for small screens.
const shadowRes = isMobile ? 1024 : 2048;
topSpotLight.shadow.mapSize.set(shadowRes, shadowRes);

scene.add(topSpotLight);

/* ------------------ PARTICLES ------------------ */
const particleCount = isMobile ? 300 : 800; // Lowered slightly for mobile
const particlesGeometry = new THREE.BufferGeometry();
const particlesPositions = new Float32Array(particleCount * 3);

for (let i = 0; i < particleCount * 3; i++) {
  particlesPositions[i] = (Math.random() - 0.5) * 60;
}

particlesGeometry.setAttribute(
  "position",
  new THREE.BufferAttribute(particlesPositions, 3)
);

const particlesMaterial = new THREE.PointsMaterial({
  color: 0x88ccff,
  size: isMobile ? 0.12 : 0.08, // Slightly larger particles so we can use fewer
  transparent: true,
  opacity: 0.4,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
});

const particleSystem = new THREE.Points(particlesGeometry, particlesMaterial);
scene.add(particleSystem);

/* ------------------ MODEL GROUPS ------------------ */
const dragWrapper = new THREE.Group();
const modelWrapper = new THREE.Group();
scene.add(dragWrapper);
dragWrapper.add(modelWrapper);

/* ------------------ RIPPLE EFFECT ------------------ */
const rippleGroup = new THREE.Group();
scene.add(rippleGroup);

const ringGeo = new THREE.RingGeometry(4, 4.2, 32);
const ringMatBase = new THREE.MeshBasicMaterial({
  color: 0xffffff,
  transparent: true,
  opacity: 0.3,
  side: THREE.DoubleSide,
});

function createRipple() {
  const mesh = new THREE.Mesh(ringGeo, ringMatBase.clone());
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = -2;
  mesh.scale.set(0, 0, 0);
  rippleGroup.add(mesh);

  gsap.to(mesh.scale, { x: 4, y: 4, z: 4, duration: 4, ease: "none" });
  gsap.to(mesh.material, {
    opacity: 0,
    duration: 4,
    ease: "none",
    onComplete: () => {
      rippleGroup.remove(mesh);
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    },
  });
}

// Optimization: Increase interval on mobile
setInterval(createRipple, isMobile ? 3000 : 2000);

/* ------------------ MODEL LOADING ------------------ */
const loader = new GLTFLoader(loadingManager);

loader.load("/models/jet3/blue.glb", (glb) => {
  const model = glb.scene;
  modelWrapper.add(model);

  model.traverse((child) => {
    if ((child as any).isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });

  const box = new THREE.Box3().setFromObject(model);
  const boxSize = box.getSize(new THREE.Vector3()).length();
  const boxCenter = box.getCenter(new THREE.Vector3());

  topSpotLight.position.set(boxCenter.x, boxCenter.y + 20, boxCenter.z);
  topSpotLight.target = model;

  const halfSizeToFitOnScreen = boxSize * 1.2 * 0.5;
  const halfFovY = THREE.MathUtils.degToRad(camera.fov * 0.5);
  let distance = halfSizeToFitOnScreen / Math.tan(halfFovY);
  if (isMobile) distance *= 1.5;
  const direction = new THREE.Vector3()
    .subVectors(camera.position, boxCenter)
    .multiply(new THREE.Vector3(1, 0, 1))
    .normalize();

  const cameraPosition = direction.multiplyScalar(distance).add(boxCenter);

  camera.position.set(
    cameraPosition.x + 15,
    cameraPosition.y + 5,
    -1 * cameraPosition.z + 15
  );

  camera.near = boxSize / 100;
  camera.far = boxSize * 100;
  camera.updateProjectionMatrix();
  camera.lookAt(boxCenter);

  model.rotation.set(0, 0, -THREE.MathUtils.degToRad(10));

  gsap.to(model.rotation, {
    z: THREE.MathUtils.degToRad(15),
    duration: 2,
    repeat: -1,
    yoyo: true,
    ease: "sine.inOut",
  });

  gsap.to(modelWrapper.rotation, {
    y: THREE.MathUtils.degToRad(-45),
    z: THREE.MathUtils.degToRad(-10),
    scrollTrigger: {
      trigger: "body",
      start: "top top",
      end: "bottom bottom",
      scrub: isMobile ? 0.5 : 1.2, // FIX: Lower scrub on mobile feels more responsive
    },
  });
});

/* ------------------ INTERACTION ------------------ */
const handleMove = (x: number, y: number) => {
  gsap.to(dragWrapper.rotation, {
    y: x * 0.1,
    x: y * 0.1,
    duration: 0.5, // Increased slightly for smoothness
    ease: "power2.out",
  });

  gsap.to(".cloud", {
    x: x * 40,
    y: y * 40,
    duration: 2,
    stagger: 0.05,
    force3D: true, // GPU acceleration for DOM elements
  });
};

window.addEventListener("mousemove", (e) => {
  const x = e.clientX / window.innerWidth - 0.5;
  const y = e.clientY / window.innerHeight - 0.5;
  handleMove(x, y);
});

// Added Touch support for the "look around" effect
window.addEventListener(
  "touchmove",
  (e) => {
    const x = e.touches[0].clientX / window.innerWidth - 0.5;
    const y = e.touches[0].clientY / window.innerHeight - 0.5;
    handleMove(x, y);
  },
  { passive: true }
);

/* ------------------ RENDER LOOP ------------------ */
function animate() {
  requestAnimationFrame(animate);

  if (lookAtParams.followModel) {
    camera.lookAt(modelWrapper.position);
  }

  particleSystem.rotation.y += 0.0005;
  particleSystem.rotation.x += 0.0002;

  renderer.render(scene, camera);
}
animate();

/* ------------------ RESIZE ------------------ */
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
