/**
 * router.js — 路由与导航模块
 * 职责：视图切换、路由历史栈、智能返回、全局 back 按钮绑定、toast 提示
 *
 * 设计要点：
 *  - pageInits 是一个"挂载点"容器，由各功能模块（app/timeline 等）填充
 *    这样 navigate 可以解耦地调用页面初始化函数，避免循环依赖
 *  - 路由历史栈实现"智能返回"：从哪里来就回哪里去，而不是固定回某页
 */

// ---- 路由表：route 名 → DOM 视图 ID ----
const routes = {
  onboarding: 'view-onboarding',
  home: 'view-home',
  main: 'view-main',
  doodle: 'view-doodle',
  voice: 'view-voice',
  write: 'view-write',
  photo: 'view-photo',
  album: 'view-album',
  review: 'view-review',
  report: 'view-report',
  timeline: 'view-timeline',
  settings: 'view-sprite-settings',
};

// 当前所在路由
let currentRoute = null;

// 路由历史栈（用于智能返回）
let routeHistory = [];

// 标志：本次 navigate 是由 goBack 触发的，避免重复入栈
let isGoingBack = false;

// 页面初始化函数容器（各功能模块会往这里挂函数）
// 例：pageInits.timeline = () => { ... }
const pageInits = {};

// ---- 侧边导航的高亮映射 ----
const NAV_MAP = {
  home: 'home',
  main: 'map',
  timeline: 'timeline',
  report: 'report',
  photo: 'photo',
  album: 'photo',
};

/**
 * 切换到指定路由
 * @param {string} route 路由名（见 routes 表）
 * @param {object} params 传给页面初始化函数的参数
 */
function navigate(route, params = {}) {
  // 记录历史（回退时不入栈，避免死循环）
  if (!isGoingBack && currentRoute && currentRoute !== route) {
    routeHistory.push(currentRoute);
    if (routeHistory.length > 20) routeHistory.shift();
  }
  isGoingBack = false;

  // 隐藏所有视图
  Object.values(routes).forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
  });

  // 显示目标视图
  const target = document.getElementById(routes[route]);
  if (target) {
    target.classList.remove('hidden');
    currentRoute = route;

    // 侧边导航：onboarding 时隐藏，其他页面显示并高亮
    const sideNav = document.getElementById('side-nav');
    if (sideNav) {
      sideNav.classList.toggle('hidden', route === 'onboarding');
      const activeNav = NAV_MAP[route];
      sideNav.querySelectorAll('.side-nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.nav === activeNav);
      });
    }

    // 执行页面初始化
    const init = pageInits[route];
    if (init) init(params);
  }
}

/**
 * 智能返回：从历史栈弹出上一页；栈空时回 defaultRoute
 * @param {string} defaultRoute 栈空时回退的目标
 */
function goBack(defaultRoute = 'home') {
  const prev = routeHistory.pop();
  if (prev) {
    isGoingBack = true;
    navigate(prev);
  } else {
    navigate(defaultRoute);
  }
}

/**
 * 全局绑定所有 [data-back] 按钮
 * 用 onclick 赋值，便于 pageInits 内部覆盖为指定默认页（如 goBack('main')）
 */
function bindBackButtons() {
  document.querySelectorAll('[data-back]').forEach(btn => {
    btn.onclick = () => goBack();
  });
}

// ---- Toast 提示 ----
function toast(message, duration = 2500) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = message;
  el.classList.remove('hidden');
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.add('hidden'), duration);
}

export {
  routes,
  currentRoute,
  routeHistory,
  pageInits,
  navigate,
  goBack,
  bindBackButtons,
  toast,
};
