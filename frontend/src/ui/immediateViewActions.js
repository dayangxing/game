import { buildDailyActionsRequest } from '../ai/llmContracts.js';

export function createImmediateViewActions(game, view) {
  const llmRequest = buildDailyActionsRequest(game, view);

  return view.cards.map((card, index) => ({
    id: `${view.id}-immediate-${index}`,
    title: card.title,
    icon: card.icon,
    command: card.command,
    meta: card.meta,
    source: 'immediate',
    storyHook: buildStoryHook(card, view),
    llmRequest
  }));
}

function buildStoryHook(card, view) {
  return [
    `当前界面：${view.label}`,
    `界面目标：${view.description}`,
    `行动名称：${card.title}`,
    `行动指令：${card.command}`,
    `生成要求：结合角色状态、NPC记忆和世界事件，生成本日剧情。`
  ].join('\n');
}
