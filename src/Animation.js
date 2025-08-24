import * as THREE from 'three';
import Logger from './core/Logger.js';

/**
 * AnimationManager
 * Encapsulates THREE.AnimationMixer logic and provides a simple API:
 *   init(root) - attach mixer to root
 *   setClips(clips) - provide clips array
 *   play(index) / pause() / stop()
 *   setLoop(loopBool) / setSpeed(speed)
 *   update(dt) - called from render loop
 *   getTime() / getDuration()
 * @param {Object} opts - Options
 * @param {THREE.Object3D} [opts.root] - Optional root object
 * @param {THREE.AnimationMixer} [opts.mixer] - Optional mixer instance
 */
export class AnimationManager {
  constructor({ root = null, mixer = null, onUpdate = () => {} } = {}) {
    this.mixer = mixer;
    this.clips = [];
    this.activeAction = null;
    this.activeIndex = -1;
    this.loop = false;
    this.speed = 1;
    this.root = root;
    this.onUpdate = onUpdate; // Callback for when animation updates
  }

  init(root) {
    if (!root) return;
    this.root = root;
    this.mixer = new THREE.AnimationMixer(root);
  }

  dispose() {
    if (this.mixer) {
      try {
        this.mixer.stopAllAction();
        if (this.root) {
          this.mixer.uncacheRoot(this.root);
        }
      } catch (e) { Logger.error('[Animation] Error disposing mixer:', e); }
      this.mixer = null;
    }
    this.clips = [];
    this.activeAction = null;
    this.activeIndex = -1;
    this.root = null;
  }

  setClips(clips) {
    this.clips = Array.isArray(clips) ? clips : [];
    // reset active action
    if (this.mixer) {
      this.mixer.stopAllAction();
      this.activeAction = null;
      this.activeIndex = -1;
    }
  }

  hasClips() {
    return this.clips && this.clips.length > 0;
  }

  select(index) {
    if (!this.mixer || !this.hasClips()) return;
    const i = Math.max(0, Math.min(index, this.clips.length - 1));
    this.mixer.stopAllAction();
    this.activeAction = this.mixer.clipAction(this.clips[i]);
    this.activeIndex = i;
    this.applyLoopAndSpeed();
    // default paused — caller may call play()
    this.activeAction.paused = true;
  }

  applyLoopAndSpeed() {
    if (!this.activeAction) return;
    this.activeAction.setLoop(this.loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
    this.activeAction.setEffectiveTimeScale(this.speed || 1);
    this.activeAction.setEffectiveWeight(1);
  }

  play(index = null) {
    if (!this.mixer || !this.hasClips()) return;
    if (index !== null) {
      this.select(index);
    }
    if (!this.activeAction && this.clips.length) {
      this.select(this.activeIndex >= 0 ? this.activeIndex : 0);
    }
    if (this.activeAction) {
      this.activeAction.paused = false;
      this.activeAction.play();
    }
  }

  pause() {
    if (this.activeAction) {
      this.activeAction.paused = true;
    }
  }

  stop() {
    if (this.mixer) {
      this.mixer.stopAllAction();
      if (this.activeAction) {
        this.activeAction.stop();
      }
    }
  }

  setLoop(enabled) {
    this.loop = !!enabled;
    this.applyLoopAndSpeed();
  }

  setSpeed(v) {
    this.speed = Number(v) || 1;
    this.applyLoopAndSpeed();
  }

  update(dt) {
    if (this.mixer) {
      this.mixer.update(dt);
      // If an animation is playing, we need to signal that a render is needed
      if (this.activeAction && !this.activeAction.paused) {
        this.onUpdate();
      }
    }
  }

  getCurrentTime() {
    if (this.activeAction) return this.activeAction.time;
    return 0;
  }

  getCurrentDuration() {
    if (this.activeAction && this.activeAction.getClip) return this.activeAction.getClip().duration || 0;
    if (this.clips && this.clips[this.activeIndex]) return this.clips[this.activeIndex].duration || 0;
    return 0;
  }
}

export default AnimationManager;