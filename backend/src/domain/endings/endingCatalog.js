export const ENDING_CATALOG = [
  {
    id: 'break_contract',
    priority: 40,
    title: '破契留世',
    body: '你以掌中真火撕开天门契的闭环，留下来见证被契约遮蔽的众生重新获得选择。',
    requires: { minTruthFlags: 4, requiredFlags: ['heaven_gate_key'], contractStance: 'reject' }
  },
  {
    id: 'sacrifice_to_break',
    priority: 35,
    title: '以身拆契',
    body: '你把自己的命火钉入契文裂口，以一身因果换来后来者不必再签下同一份契约。',
    requires: { minTruthFlags: 3, contractStance: 'sacrifice' }
  },
  {
    id: 'false_ascension',
    priority: 30,
    title: '伪飞升',
    body: '你顺着天门留下的假路升入云上，却在最后一刻保住了自己的名字与退路。',
    requires: { contractStance: 'accept' }
  },
  {
    id: 'mist_guardian',
    priority: 20,
    title: '雾隐守门',
    body: '你留在雾隐秘境守住铜铃残档，让这段被抹去的历史不再任人篡改。',
    requires: { contractStance: 'guard' }
  },
  {
    id: 'unfinished_truth',
    priority: 0,
    title: '真相未竟',
    body: '你走到了天门之前，却仍有关键真相埋在雾中。',
    requires: { fallback: true }
  }
];
