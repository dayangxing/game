export const GUIDE_STORAGE_KEY = 'wendao-fusheng-guide-v1';

export const guideSteps = [
  {
    id: 'tabs',
    title: '先选修行场景',
    body: '顶部五个入口代表不同玩法：洞府、修炼、功法、秘境、行囊。切换入口后，每日行动会随场景变化。'
  },
  {
    id: 'actions',
    title: '每日只选行动',
    body: '页面没有自由输入框。点击“每日行动”卡牌即可推进一回合，后续这些选项会由后端和 AI 生成。'
  },
  {
    id: 'story',
    title: '读取天机札记',
    body: '行动结果会写入天机札记。数值由规则系统结算，剧情由 LLM 润色，二者解耦。'
  },
  {
    id: 'state',
    title: '观察状态变化',
    body: '左侧是角色与关系，右侧是资源、事件和伏笔。它们都是后端权威状态，前端只负责展示。'
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
