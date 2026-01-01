import { gsap } from "gsap";

/* ------------------ FALLING STARS ANIMATION ------------------ */

const starsContainer = document.getElementById("stars-container");
const starCount = 50;

function createStar() {
  const star = document.createElement("div");
  star.classList.add("star");
  if (Math.random() > 0.7) star.classList.add("large");

  // Random horizontal position
  star.style.left = Math.random() * 100 + "%";
  // Start above the viewport
  star.style.top = "-10px";

  starsContainer?.appendChild(star);

  // Animate the star falling
  const duration = 8 + Math.random() * 7; // 8-15 seconds (slower)
  const delay = Math.random() * 5; // Random start delay

  gsap.to(star, {
    top: "110%",
    opacity: 0.8,
    duration: duration,
    delay: delay,
    ease: "none",
    repeat: -1,
    onRepeat: () => {
      // Reset horizontal position on each repeat
      star.style.left = Math.random() * 100 + "%";
    },
  });

  // Fade in at start, fade out at end
  gsap.to(star, {
    opacity: 0.9,
    duration: 0.5,
    delay: delay,
    yoyo: true,
    repeat: -1,
    repeatDelay: duration - 1,
    ease: "power1.inOut",
  });
}

// Create all stars
for (let i = 0; i < starCount; i++) {
  createStar();
}

// Parallax effect - move stars container slowly with cursor
window.addEventListener("mousemove", (event) => {
  const x = (event.clientX / window.innerWidth) * 2 - 1;
  const y = (event.clientY / window.innerHeight) * 2 - 1;

  // Move container slightly for parallax depth
  gsap.to(starsContainer, {
    x: x * 30, // Small movement
    y: y * 20,
    duration: 1.5,
    ease: "power2.out",
  });
});
