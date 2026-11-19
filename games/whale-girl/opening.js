import * as THREE from 'three';
import harbor from './moonrise-harbor.jpg';
import { welcomeDialogue } from './greeting.js';

export function storyOpening(canvas, actor) {
  const overlay = document.querySelector('#opening');
  const skip = document.querySelector('#skip-opening');
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const shot = new THREE.PerspectiveCamera();
  const windowEye = new THREE.Vector3(0.45, 2.63, 0.45);
  const windowLook = new THREE.Vector3(-1.05, 2.67, -4.35);
  const speakerEye = new THREE.Vector3();
  const speakerLook = new THREE.Vector3();
  const look = new THREE.Vector3();
  const restingYaw = actor.rotation.y;
  const dialogue = welcomeDialogue(leaveDialogue);
  let elapsed = 0;
  let phase = 'film';

  function changePhase(next) {
    phase = next;
    elapsed = 0;
    document.body.dataset.opening = next;
  }
  function finish() {
    if (phase === 'done') return;
    const focusWasInStory = !!document.activeElement?.closest('#opening, #greeting');
    phase = 'done';
    actor.rotation.y = restingYaw;
    dialogue.hide();
    document.body.removeAttribute('data-opening');
    canvas.inert = false;
    if (focusWasInStory || document.activeElement === document.body) canvas.focus({ preventScroll: true });
    window.removeEventListener('keydown', onKey);
    motion.removeEventListener('change', motionChanged);
  }
  function skipFilm() {
    if (phase === 'film') changePhase('waiting');
  }
  function leaveDialogue() {
    if (phase !== 'greeting') return;
    if (motion.matches) finish();
    else {
      dialogue.hide();
      changePhase('return');
    }
  }
  function onKey(event) {
    if (event.key !== 'Escape' || event.repeat) return;
    event.preventDefault();
    if (phase === 'film') skipFilm();
    else if (phase === 'greeting') leaveDialogue();
  }
  function motionChanged(event) {
    if (!event.matches) return;
    if (phase === 'return') finish();
    else skipFilm();
  }

  canvas.inert = true;
  skip.addEventListener('click', skipFilm, { once: true });
  window.addEventListener('keydown', onKey);
  motion.addEventListener('change', motionChanged);
  overlay.querySelector('img').src = harbor;
  if (motion.matches) skipFilm();

  return {
    get active() { return phase !== 'done'; },
    finish,
    frame(dt, gameCamera, gameTarget) {
      if (phase === 'done') return gameCamera;
      elapsed += dt;
      // Wait for the first frame with the actor loaded, even if the film was skipped during loading.
      if (phase === 'waiting' || (phase === 'film' && elapsed >= 6.4)) {
        changePhase('greeting');
        actor.rotation.y = restingYaw;
        dialogue.show(motion.matches);
      }
      speakerEye.set(actor.position.x + 0.4, 1.46, actor.position.z + 3.05);
      speakerLook.set(actor.position.x, 0.86, actor.position.z);
      const portrait = THREE.MathUtils.smoothstep(gameCamera.aspect, 0.45, 0.86);
      const speakerFov = THREE.MathUtils.lerp(48, 36, portrait);
      const smooth = THREE.MathUtils.smoothstep;
      shot.copy(gameCamera, false);
      shot.fov = speakerFov;
      if (phase === 'film') {
        overlay.style.setProperty('--type', 1 - smooth(elapsed, 1.8, 2.7));
        overlay.style.setProperty('--cover', 1 - smooth(elapsed, 2.15, 3.25));
        overlay.style.setProperty('--bars', 1 - smooth(elapsed, 5.45, 6.4));
        const travel = smooth(elapsed, 2.25, 6.4);
        actor.rotation.y = restingYaw - 1.7 * (1 - smooth(elapsed, 4.4, 5.95));
        shot.position.lerpVectors(windowEye, speakerEye, travel);
        look.lerpVectors(windowLook, speakerLook, travel);
      } else if (phase === 'greeting') {
        dialogue.update(dt, motion.matches);
        shot.position.copy(speakerEye);
        look.copy(speakerLook);
      } else {
        const travel = smooth(elapsed, 0, 0.72);
        if (travel === 1) {
          finish();
          return gameCamera;
        }
        shot.fov = THREE.MathUtils.lerp(speakerFov, gameCamera.fov, travel);
        shot.position.lerpVectors(speakerEye, gameCamera.position, travel);
        look.lerpVectors(speakerLook, gameTarget, travel);
      }
      shot.updateProjectionMatrix();
      shot.lookAt(look);
      return shot;
    },
  };
}
