import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";


gsap.registerPlugin(ScrollTrigger);

/* ------------------ SETUP ------------------ */
const container = document.querySelector("#canvas-container") as HTMLElement;
const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  0.1,
  10000
);
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.VSMShadowMap; // Very smooth shadows

renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
// Physical lighting correction

renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
container.appendChild(renderer.domElement);

/* ------------------ ENVIRONMENT & LIGHTS ------------------ */
scene.add(new THREE.AmbientLight(0xffffff, 0.15)); // Lowered ambient slightly for better contrast
const sunLight = new THREE.DirectionalLight(0xffffff, 3);
sunLight.position.set(0, 100, 50);
sunLight.castShadow = true;

// Configure shadow properties for larger model
sunLight.shadow.mapSize.width = 4096;
sunLight.shadow.mapSize.height = 4096;

scene.add(sunLight);

// Setup PMREM to create reflections even without an HDR file
const pmremGenerator = new THREE.PMREMGenerator(renderer);
pmremGenerator.compileEquirectangularShader();
scene.environment = pmremGenerator.fromScene(new THREE.Scene()).texture;

/* ------------------ MODEL GROUPING ------------------ */
const dragWrapper = new THREE.Group();
scene.add(dragWrapper);

const modelWrapper = new THREE.Group();
dragWrapper.add(modelWrapper);

/* ------------------ SOFT BLURRED SHADOW ------------------ */
// Create a very soft, blurred shadow using canvas
const shadowSize = 512;
const shadowCanvas = document.createElement('canvas');
shadowCanvas.width = shadowSize;
shadowCanvas.height = shadowSize;
const ctx = shadowCanvas.getContext('2d')!;

// Create a very soft radial gradient
const gradient = ctx.createRadialGradient(
  shadowSize / 2, shadowSize / 2, 0,
  shadowSize / 2, shadowSize / 2, shadowSize / 2
);
gradient.addColorStop(0, 'rgba(0, 0, 0, 0.35)');
gradient.addColorStop(0.3, 'rgba(0, 0, 0, 0.2)');
gradient.addColorStop(0.6, 'rgba(0, 0, 0, 0.08)');
gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

ctx.fillStyle = gradient;
ctx.fillRect(0, 0, shadowSize, shadowSize);

const shadowTexture = new THREE.CanvasTexture(shadowCanvas);
const shadowMaterial = new THREE.MeshBasicMaterial({
  map: shadowTexture,
  transparent: true,
  depthWrite: false,
  opacity: 1,
});

const shadowGeometry = new THREE.PlaneGeometry(600, 600);
const shadowMesh = new THREE.Mesh(shadowGeometry, shadowMaterial);
shadowMesh.rotation.x = -Math.PI / 2;
shadowMesh.position.y = -180;
modelWrapper.add(shadowMesh);

/* ------------------ RIPPLE EFFECT ------------------ */
const rippleGroup = new THREE.Group();
rippleGroup.rotation.x = -Math.PI / 2;
rippleGroup.position.y = -175;
modelWrapper.add(rippleGroup);

function createRipple() {
  const rippleGeometry = new THREE.RingGeometry(20, 35, 64);
  const rippleMaterial = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.3,
    side: THREE.DoubleSide,
  });
  const ripple = new THREE.Mesh(rippleGeometry, rippleMaterial);
  rippleGroup.add(ripple);

  // Animate the ripple expanding and fading
  gsap.to(ripple.scale, {
    x: 60,
    y: 60,
    duration: 4,
    ease: "power1.out",
    onComplete: () => {
      rippleGroup.remove(ripple);
      rippleGeometry.dispose();
      rippleMaterial.dispose();
      // Start next ripple when this one completes
      createRipple();
    },
  });

  gsap.to(rippleMaterial, {
    opacity: 0,
    duration: 4,
    ease: "power1.out",
  });
}

// Start the first ripple
createRipple();


/* ------------------ MOUSE PARALLAX ------------------ */
const onMouseMove = (event: MouseEvent) => {
  // Normalize mouse position (-1 to 1)
  const x = (event.clientX / window.innerWidth) * 2 - 1;
  const y = -(event.clientY / window.innerHeight) * 2 + 1;

  // Apply subtle rotation based on mouse position
  // Inverted y * 0.1 to -y * 0.1 to fix direction
  const tiltX = -y * 0.1; 
  const tiltY = x * 0.3;

  gsap.to(dragWrapper.rotation, {
    x: tiltX,
    y: tiltY,
    duration: 1,
    ease: "power2.out",
    overwrite: true,
  });
};

window.addEventListener("mousemove", onMouseMove);



/* ------------------ LOADER ------------------ */
const loader = new GLTFLoader();

loader.load("/models/jet1/scene.gltf", (gltf) => {
  const model = gltf.scene;
  modelWrapper.add(model);

  /* ---------- APPLY METALLIC PROPERTIES & ENABLE SHADOWS ---------- */
  model.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      const mesh = child as THREE.Mesh;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      // Ensure we are working with Standard Material for metalness
      if (mesh.material instanceof THREE.MeshStandardMaterial) {
        mesh.material.metalness = 0.7;
        mesh.material.roughness = 0.35;
        mesh.material.needsUpdate = true;
      }
    }
  });

  /* ---------- AUTO-CENTER & AUTO-FRAME ---------- */
  const box = new THREE.Box3().setFromObject(model);
  const boxSize = box.getSize(new THREE.Vector3()).length();
  const boxCenter = box.getCenter(new THREE.Vector3());

  const halfSizeToFitOnScreen = boxSize * 0.4;
  const halfFov = THREE.MathUtils.degToRad(camera.fov * 0.5);
  const distance = halfSizeToFitOnScreen / Math.tan(halfFov);

  const direction = new THREE.Vector3()
    .subVectors(boxCenter, camera.position)
    .normalize();
  camera.position.copy(direction.multiplyScalar(distance).add(boxCenter));
  camera.lookAt(boxCenter.x, boxCenter.y, boxCenter.z);
  camera.updateProjectionMatrix();




  /* ---------- INITIAL STATE & ANIMATION ---------- */
  model.rotation.set(
    THREE.MathUtils.degToRad(-59.04),
    THREE.MathUtils.degToRad(2.88),
    THREE.MathUtils.degToRad(51.48)
  );

  gsap.to(model.rotation, {
    x: "+=0.1",
    z: "+=0.1",
    duration: 3,
    repeat: -1,
    yoyo: true,
    ease: "sine.inOut",
  });

  /* ---------- SCROLL ROTATION ---------- */
  gsap.to(modelWrapper.rotation, {
    y: `-=${Math.PI * 0.2}`,
    scrollTrigger: {
      trigger: "body",
      start: "top top",
      end: "bottom bottom",
      scrub: 1.5,
    },
  });
});

/* ------------------ ANIMATION LOOP ------------------ */
function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
}
animate();
animate();

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
