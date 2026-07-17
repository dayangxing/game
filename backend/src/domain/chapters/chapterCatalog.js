export const CHAPTER_CATALOG = [
  {
    id: 'prologue', index: 0, title: '序章：命簿初开', nextChapterId: 'qi',
    objectives: [
      { id: 'prologue_npc_contact', required: true, predicate: { type: 'anyNpcAffinityAtLeast', value: 5 }, publicText: '认识一位愿意指点你的青云宗人物' },
      { id: 'prologue_first_clue', required: true, predicate: { type: 'anyFlag', flags: ['lifespan_mark', 'bronze_bell'] }, publicText: '触及寿元或雾隐秘境的第一道线索' }
    ]
  },
  {
    id: 'qi', index: 1, title: '炼气：命火有痕', nextChapterId: 'foundation',
    objectives: [
      { id: 'qi_reach_ninth_layer', required: true, predicate: { type: 'realmAtLeast', realm: '炼气九层' }, publicText: '将炼气修至圆满' },
      { id: 'qi_reveal_lifespan_mark', required: true, predicate: { type: 'anyFlag', flags: ['lifespan_mark', 'ascension_contract'] }, publicText: '查明寿元异常的第一道痕迹' }
    ]
  },
  {
    id: 'foundation', index: 2, title: '筑基：道基与宗门', nextChapterId: 'golden_core',
    objectives: [
      { id: 'foundation_success', required: true, predicate: { type: 'realmAtLeast', realm: '筑基初期' }, publicText: '成功筑基' },
      { id: 'foundation_sect_path', required: true, predicate: { type: 'sectPathSelected' }, publicText: '确定宗门暗线中的立场' },
      { id: 'foundation_npc_bond', required: true, predicate: { type: 'anyNpcAffinityAtLeast', value: 12 }, publicText: '完成一条关键人物关系线' }
    ]
  },
  {
    id: 'golden_core', index: 3, title: '金丹：丹成见世', nextChapterId: 'mist',
    objectives: [
      { id: 'golden_core_success', required: true, predicate: { type: 'realmAtLeast', realm: '金丹初期' }, publicText: '成功结丹' },
      { id: 'golden_core_sect_conflict', required: true, predicate: { type: 'flag', flag: 'sect_elder_split' }, publicText: '触发青云宗长老分歧' },
      { id: 'golden_core_mist_access', required: true, predicate: { type: 'anyFlag', flags: ['mist_entry_unlocked', 'mist_archive'] }, publicText: '取得雾隐秘境进入资格' }
    ]
  },
  {
    id: 'mist', index: 4, title: '雾隐秘境：铜铃残档', nextChapterId: 'ascension_scam',
    objectives: [
      { id: 'mist_truth_count', required: true, predicate: { type: 'truthFlagCountAtLeast', value: 3 }, publicText: '找到至少三条雾隐真相线索' },
      { id: 'mist_key_clue', required: true, predicate: { type: 'anyFlag', flags: ['heaven_gate_key', 'bronze_bell'] }, publicText: '取得青铜铃或天门秘钥线索' }
    ]
  },
  {
    id: 'ascension_scam', index: 5, title: '飞升骗局：天门账帖', nextChapterId: 'finale',
    objectives: [
      { id: 'scam_contract', required: true, predicate: { type: 'flag', flag: 'ascension_contract' }, publicText: '确认天门契的真实存在' },
      { id: 'scam_truth_count', required: true, predicate: { type: 'truthFlagCountAtLeast', value: 4 }, publicText: '核对足够多的飞升者真相' },
      { id: 'scam_stance', required: true, predicate: { type: 'contractStanceSelected' }, publicText: '决定如何面对飞升契约' }
    ]
  },
  {
    id: 'finale', index: 6, title: '终局分支', nextChapterId: null,
    objectives: [
      { id: 'finale_stance', required: true, predicate: { type: 'finalChoiceMade' }, publicText: '完成天门契最终抉择' }
    ]
  }
];

export function listChapterDefinitions() {
  return CHAPTER_CATALOG.map((item) => structuredClone(item));
}

export function getChapterDefinition(chapterId) {
  return CHAPTER_CATALOG.find((item) => item.id === chapterId) ?? null;
}
