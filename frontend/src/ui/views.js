export const viewList = [
  {
    id: 'home',
    label: '洞府',
    title: '洞府清修',
    description: '整理今日修行、道友牵绊与天机札记，决定下一步命途。',
    cards: [
      { title: '静坐调息', icon: '息', command: '闭关修炼一日，稳固丹田灵气', meta: '恢复灵气' },
      { title: '拜会同门', icon: '友', command: '找林师姐打听雾隐秘境的消息', meta: '提升牵绊' },
      { title: '接取委托', icon: '令', command: '去执事堂接巡山任务', meta: '宗门声望' }
    ]
  },
  {
    id: 'cultivation',
    visible: false,
    label: '修炼',
    title: '闭关修炼',
    description: '以吐纳、闭关、破境为核心，推动境界成长并触发天劫伏笔。',
    cards: [
      { title: '三月闭关', icon: '闭', command: '闭关修炼三月，尝试突破', meta: '破境进度' },
      { title: '稳固雷息', icon: '雷', command: '继续闭关稳固境界，压住雷木双息反噬', meta: '降低风险' },
      { title: '请教瓶颈', icon: '问', command: '找玄衡长老请教突破瓶颈', meta: '师门指点' }
    ]
  },
  {
    id: 'skills',
    label: '命簿',
    title: '个人面板',
    description: '查看人物属性、境界、功法与道友牵绊，梳理当前修行底蕴。',
    cards: [
      { title: '青木诀', icon: '木', command: '研读青木诀，尝试让木息滋养经脉', meta: '心法' },
      { title: '掌心雷', icon: '雷', command: '演练掌心雷，测试雷灵根的斗法威力', meta: '术法' },
      { title: '御风步', icon: '风', command: '修习御风步，在演武场磨炼身法', meta: '身法' }
    ]
  },
  {
    id: 'realm',
    label: '天机录',
    title: '天机录',
    description: '汇总本局剧情上下文、近期回合、人物记忆、世界记录与未解伏笔。',
    cards: [
      { title: '后山探雾', icon: '山', command: '前往后山探索灵脉', meta: '探索' },
      { title: '石门符纹', icon: '符', command: '推开藤蔓后的石门，查验雾隐秘境符纹', meta: '奇遇' },
      { title: '巡山斩妖', icon: '妖', command: '接取巡山斩妖委托，调查妖兽越界', meta: '战斗' }
    ]
  },
  {
    id: 'bag',
    label: '行囊',
    title: '行囊丹器',
    description: '管理丹药、灵石、药草与法器，为下一次突破或秘境做准备。',
    cards: [
      { title: '炼制聚气丹', icon: '丹', command: '炼制一炉聚气丹', meta: '丹药' },
      { title: '坊市购药', icon: '市', command: '去坊市购买雷纹草', meta: '材料' },
      { title: '整理法器', icon: '器', command: '整理行囊中的旧符与法器，准备进入秘境', meta: '备战' }
    ]
  }
];

export const visibleViewList = viewList.filter((view) => view.visible !== false);

export function getView(id) {
  return viewList.find((view) => view.id === id) ?? viewList[0];
}
