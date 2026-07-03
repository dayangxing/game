export const GUIDE_STORAGE_KEY = 'wendao-fusheng-guide-v1';

export const guideSteps = [
  {
    id: 'layout',
    title: '认识四处入口',
    body: '顶部四个入口对应不同修行重点：洞府看总览与行动，命簿看属性与功法，秘境寻奇遇，行囊管资源。'
  },
  {
    id: 'actions',
    title: '选择每日行动',
    body: '每一回合都在洞府从今日行动中选一件事推进。行动会消耗寿元或资源，也会改变境界、关系和剧情线索。'
  },
  {
    id: 'state',
    title: '观察状态变化',
    body: '个人面板集中展示属性、功法、资源、状态和道友牵绊。每次行动后都要看一眼变化。'
  },
  {
    id: 'lifespan',
    title: '留意寿元压力',
    body: '寿元会影响修行节奏和结局。破境、受伤、机缘与因果都可能改变寿元，不要只盯境界进度。'
  },
  {
    id: 'prologue',
    title: '先经历序章',
    body: '第一次进入会先完成一段序章。序章会介绍青云宗的规矩、雾隐秘境的传闻，以及创建角色前的基本玩法。'
  },
  {
    id: 'save',
    title: '创建角色开局',
    body: '序章结束后可以创建角色。姓名由你决定，出身、灵根、天赋和初始资源会随机生成，之后进入正式单机存档。'
  }
];

export function shouldAutoOpenGuide(storage) {
  return !readStorage(storage, GUIDE_STORAGE_KEY);
}

export function getGuideStep(index) {
  return guideSteps[Math.min(index, guideSteps.length - 1)];
}

export function markGuideCompleted(storage) {
  writeStorage(storage, GUIDE_STORAGE_KEY, 'completed');
}

function readStorage(storage, key) {
  if (typeof storage.getItem === 'function') {
    return storage.getItem(key);
  }

  return storage.get(key);
}

function writeStorage(storage, key, value) {
  if (typeof storage.setItem === 'function') {
    storage.setItem(key, value);
    return;
  }

  storage.set(key, value);
}
