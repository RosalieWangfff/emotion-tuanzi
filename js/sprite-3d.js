/**
 * sprite-3d.js — Three.js 3D 精灵渲染
 *
 * 所有精灵类型都加载用户提供的 GLB 模型：
 *   preset1 团子    → character/团子.glb
 *   preset2 小可    → character/character1.glb
 *   cat    小猫    → character/cat.glb
 *   dog    小狗    → character/dog.glb
 *   radish 小萝卜  → character/carrot.glb
 *   cloud  小云朵  → character/cloud.glb
 *
 * GLB 模型自带表情/五官/外表，代码不再贴任何 mesh、不程序化建模。
 * 颜色：保留模型自带的材质（GLB 通常内嵌贴图，不覆盖），让外观完全呈现用户的设计。
 *
 * 动画：保留呼吸/浮动/旋转/拖拽交互。如果 GLB 自带动画，会播放第一个 AnimationClip。
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

// ---- GLB 模型路径映射 ----
const GLB_PATHS = {
  preset1: 'character/团子.glb',
  preset2: 'character/character1.glb',
  cat:     'character/cat.glb',
  dog:     'character/dog.glb',
  radish:  'character/carrot.glb',
  cloud:   'character/cloud.glb',
};

/**
 * 在容器中创建 3D 精灵
 * @param {HTMLElement} container
 * @param {object} options
 * @param {string} options.spriteType - preset1/preset2/cat/dog/radish/cloud
 * @param {number} options.size - canvas 尺寸（正方形，默认 220）
 * @param {string} options.initialEmotion
 * @param {function} options.onClick
 * @returns {{setEmotion, getEmotion, resize, dispose}}
 */
export function createSprite3D(container, options = {}) {
  const {
    spriteType = 'preset1',
    size = 220,
    initialEmotion = 'calm',
    onClick,
  } = options;

  // ---- 场景 ----
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  camera.position.set(0, 0, 3.6);  // 相机拉近，让模型在画面里占比更大

  // ---- 渲染器 ----
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(size, size);
  renderer.setClearColor(0x000000, 0);
  // glTF 标准要求 sRGB 输出 + 颜色空间设置，否则颜色会偏
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);

  // ---- 灯光（全白光，提高强度让模型更亮，保证颜色保真）----
  scene.add(new THREE.AmbientLight(0xffffff, 1.4));
  const keyLight = new THREE.DirectionalLight(0xffffff, 1.0);
  keyLight.position.set(2, 4, 3);
  scene.add(keyLight);
  const fillLight = new THREE.DirectionalLight(0xffffff, 0.6);
  fillLight.position.set(-3, -1, 2);
  scene.add(fillLight);

  // ---- 精灵根节点 ----
  const spriteRoot = new THREE.Group();
  scene.add(spriteRoot);

  // 模型容器
  const modelGroup = new THREE.Group();
  spriteRoot.add(modelGroup);

  // ---- 清空工具 ----
  function clearGroup(group) {
    while (group.children.length > 0) {
      const c = group.children[0];
      group.remove(c);
      c.traverse?.(child => {
        child.geometry?.dispose?.();
        if (Array.isArray(child.material)) {
          child.material.forEach(m => m.dispose?.());
        } else {
          child.material?.dispose?.();
        }
      });
    }
  }

  // ---- 加载 GLB 模型 ----
  let gltfRoot = null;
  let mixer = null;       // 动画混合器（GLB 自带动画时启用）
  let placeholderMesh = null;
  const glbPath = GLB_PATHS[spriteType];

  function loadGLB() {
    clearGroup(modelGroup);
    gltfRoot = null;
    if (mixer) { mixer.stopAllAction(); mixer = null; }

    if (!glbPath) {
      console.warn(`[sprite-3d] 未知精灵类型：${spriteType}`);
      return;
    }

    // 占位球：加载期间显示
    placeholderMesh = new THREE.Mesh(
      new THREE.SphereGeometry(1, 32, 24),
      new THREE.MeshBasicMaterial({
        color: 0xd9c7bd,
        transparent: true,
        opacity: 0.4,
      })
    );
    modelGroup.add(placeholderMesh);

    const loader = new GLTFLoader();
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
    loader.setDRACOLoader(dracoLoader);
    loader.load(
      glbPath,
      (gltf) => {
        const object = gltf.scene;

        // 移除占位
        if (placeholderMesh) {
          modelGroup.remove(placeholderMesh);
          placeholderMesh.geometry.dispose();
          placeholderMesh.material.dispose();
          placeholderMesh = null;
        }

        // 居中 + 缩放：把模型放到原点，缩放到 2.0 单位
        const box = new THREE.Box3().setFromObject(object);
        const sizeVec = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        const maxDim = Math.max(sizeVec.x, sizeVec.y, sizeVec.z) || 1;
        const scale = 2.0 / maxDim;
        object.position.sub(center.multiplyScalar(scale));
        object.scale.setScalar(scale);

        // 保留模型自带的材质和贴图（不覆盖颜色），让用户设计的外观完全呈现
        gltfRoot = object;
        modelGroup.add(object);

        // 如果 GLB 自带动画，播放第一个
        if (gltf.animations && gltf.animations.length > 0) {
          mixer = new THREE.AnimationMixer(object);
          const action = mixer.clipAction(gltf.animations[0]);
          action.play();
        }
      },
      undefined,
      (err) => {
        console.warn(`[sprite-3d] GLB 加载失败：${glbPath}`, err);
        // 占位变红色提示加载失败
        if (placeholderMesh) {
          placeholderMesh.material.color.setHex(0xcc6666);
          placeholderMesh.material.opacity = 0.6;
        }
      }
    );
  }

  loadGLB();

  // ---- 动画状态 ----
  let lastTs = performance.now();
  let elapsed = 0;
  let currentEmotion = initialEmotion;

  // ---- 拖拽旋转状态 ----
  let isDragging = false;
  let lastX = 0, lastY = 0;
  let rotY = 0, rotX = 0;
  let rotYTarget = 0, rotXTarget = 0;
  let releaseAt = 0;
  let hovering = false;
  let hoverTargetX = 0;

  // ---- 事件 ----
  const dom = renderer.domElement;
  dom.style.cursor = 'grab';
  dom.style.touchAction = 'none';

  let pointerDownTs = 0;
  let pointerDownX = 0, pointerDownY = 0;

  const onPointerDown = (e) => {
    isDragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    pointerDownTs = performance.now();
    pointerDownX = e.clientX;
    pointerDownY = e.clientY;
    dom.style.cursor = 'grabbing';
    dom.setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e) => {
    if (!isDragging) {
      const rect = dom.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      hoverTargetX = x * 0.3;
      hovering = (e.clientX >= rect.left && e.clientX <= rect.right);
    }
    if (!isDragging) return;
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    rotYTarget += dx * 0.012;
    rotXTarget = Math.max(-0.5, Math.min(0.5, rotXTarget + dy * 0.008));
    lastX = e.clientX;
    lastY = e.clientY;
  };
  const onPointerUp = (e) => {
    if (!isDragging) return;
    isDragging = false;
    dom.style.cursor = 'grab';
    releaseAt = performance.now();
    const dt = performance.now() - pointerDownTs;
    const dx = Math.abs(e.clientX - pointerDownX);
    const dy = Math.abs(e.clientY - pointerDownY);
    if (dt < 250 && dx < 5 && dy < 5 && onClick) onClick();
  };
  const onPointerLeave = () => {
    hovering = false;
    hoverTargetX = 0;
  };

  dom.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  dom.addEventListener('pointerleave', onPointerLeave);

  // ---- 主循环 ----
  let rafId = null;
  const clock = new THREE.Clock();
  function animate() {
    rafId = requestAnimationFrame(animate);
    const now = performance.now();
    const dt = Math.min(0.05, (now - lastTs) / 1000);
    lastTs = now;
    elapsed += dt;

    // 呼吸缩放
    const breathe = Math.sin(elapsed * 1.4) * 0.025 + 1;
    spriteRoot.scale.set(breathe, breathe, breathe);

    // 浮动
    spriteRoot.position.y = Math.sin(elapsed * 0.9) * 0.05;

    // 旋转：只保留拖拽 + 释放后回弹 + 悬停跟随，不要自动旋转
    if (isDragging) {
      // 拖拽中
    } else if (now - releaseAt < 900) {
      // 释放后惯性衰减
      rotYTarget *= 0.92;
      rotXTarget *= 0.9;
    }
    // 静止状态：不自动旋转，模型保持当前角度
    const hoverX = hovering ? hoverTargetX : 0;
    rotY += (rotYTarget + hoverX - rotY) * 0.12;
    rotX += (rotXTarget - rotX) * 0.12;
    spriteRoot.rotation.y = rotY;
    spriteRoot.rotation.x = rotX;

    // 更新 GLB 自带动画
    if (mixer) {
      mixer.update(clock.getDelta());
    }

    renderer.render(scene, camera);
  }
  animate();

  // ---- 暴露接口 ----
  return {
    setEmotion(emotion) {
      // GLB 模型自带表情，不随情绪变色或变表情
      // 这里保留接口供 app.js 调用，但实际不做任何事
      currentEmotion = emotion;
    },
    getEmotion() { return currentEmotion; },
    resize(newSize) {
      renderer.setSize(newSize, newSize);
    },
    dispose() {
      if (rafId) cancelAnimationFrame(rafId);
      dom.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      dom.removeEventListener('pointerleave', onPointerLeave);
      if (mixer) mixer.stopAllAction();
      clearGroup(modelGroup);
      renderer.dispose();
      if (dom.parentElement === container) {
        container.removeChild(dom);
      }
    },
  };
}
