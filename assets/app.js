// 打卡数据存储与计算（支持多设备同步）
window.STATE = {
  KEY: "wangzai_dashboard_v1",
  todayISO: function() {
    const d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0") + "-" + String(d.getDate()).padStart(2,"0");
  },
  load() {
    try {
      const raw = localStorage.getItem(this.KEY);
      if (raw) return JSON.parse(raw);
    } catch(e) {}
    return { checkIns: {}, readingProgress: {}, tenderSessions: {} };
  },
  save(state) {
    localStorage.setItem(this.KEY, JSON.stringify(state));
    // 多设备同步：异步推送到远程
    if (window.SYNC) {
      window.SYNC.saveAndSync(state);
    }
  },
  getToday(state) {
    return state.checkIns[this.todayISO()] || {};
  },
  setTodayItem(key, val, state) {
    const today = this.todayISO();
    if (!state.checkIns[today]) state.checkIns[today] = {};
    state.checkIns[today][key] = val;
    this.save(state);
  }
};

// 页面加载时初始化远程同步
(async function() {
  if (window.SYNC) {
    await window.SYNC.init();
    // 同步完成后刷新页面数据
    if (window.renderProgress) window.renderProgress();
    if (window.renderAllChecks) window.renderAllChecks();
  }
})();

// 倒计时
window.calcDaysLeft = function(targetDateStr) {
  const target = new Date(targetDateStr + "T08:00:00");
  const now = new Date();
  const diff = target.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diff / (24*3600*1000)));
};

// 距离"今天"开始的天数（用于"今日预习第几课"的判定）
window.dayIndex = function(startISO) {
  const start = new Date(startISO + "T08:00:00");
  const now = new Date();
  const diff = now.getTime() - start.getTime();
  return Math.max(0, Math.floor(diff / (24*3600*1000)));
};

// 今日应预习的课次（从今天起每天+1）
window.todayLessonNo = function() {
  const idx = window.dayIndex("2026-08-10");
  return idx + 1;  // 第1天 = 第1课
};

// 今日应做的口算类型（先100以内，做完再做乘法，循环）
window.todayMathType = function() {
  const idx = window.dayIndex("2026-08-10");
  // 假设口算有2阶段：先100以内约30天，再乘法约30天
  // 用户给"100以内1页或乘法1页" - 让我做成每日轮换
  const phase = Math.floor(idx / 30) % 2;
  const phaseLabel = phase === 0 ? "100以内加减" : "乘法口诀";
  const phaseDay = (idx % 30) + 1;
  return { phase, phaseLabel, phaseDay };
};

// 招标每日主题（12天到8/22，从今天8/10开始还有12天）
window.todayTenderTopic = function() {
  const days = Math.min(12, window.dayIndex("2026-08-10") + 1);
  const topics = window.APP.tenderTopics;
  return { day: days, total: 12, topic: topics[(days-1) % topics.length] };
};

// 渲染顶部今日信息
window.renderHeader = function() {
  const now = new Date();
  const weekdays = ["周日","周一","周二","周三","周四","周五","周六"];
  const text = `${now.getFullYear()}年${now.getMonth()+1}月${now.getDate()}日 · ${weekdays[now.getDay()]}`;
  document.querySelectorAll(".js-today").forEach(el => el.textContent = text);
};

// 倒计时区渲染
window.renderCountdowns = function() {
  const tenderLeft = window.calcDaysLeft("2026-08-22");
  const taxLeft = window.calcDaysLeft("2026-08-29");
  const tenderEl = document.getElementById("cd-tender");
  const tenderSubEl = document.getElementById("cd-tender-sub");
  const taxEl = document.getElementById("cd-tax");
  const taxSubEl = document.getElementById("cd-tax-sub");
  if (tenderEl) tenderEl.textContent = tenderLeft + " 天";
  if (taxEl) taxEl.textContent = taxLeft + " 天";
  if (tenderSubEl) {
    tenderSubEl.textContent = tenderLeft === 0 ? "就在今天！加油！" : "时间在减少 ↘";
  }
  if (taxSubEl) {
    taxSubEl.textContent = taxLeft === 0 ? "就在今天！加油！" : "时间在减少 ↘";
  }
};

// 招标每日主题渲染
window.renderTenderTopic = function() {
  const box = document.getElementById("tender-topic");
  if (!box) return;
  const t = window.todayTenderTopic();
  box.innerHTML = `
    <div style="display:flex; align-items:center; gap:8px;">
      <span class="tag danger">今日重点</span>
      <span style="color:var(--text-2); font-size:12px;">距离考试还有 <strong style="color:var(--danger)">${window.calcDaysLeft("2026-08-22")}</strong> 天</span>
    </div>
    <h4 style="margin:8px 0 4px; font-size:15px;">📚 第${t.day}/${t.total}天：${t.topic}</h4>
    <p style="color:var(--text-2); font-size:12px; margin:0;">建议时长 60 分钟，先复习法规原文，再做120题巩固。</p>
  `;
};

// 语文今日预习
window.renderYuwenToday = function() {
  const box = document.getElementById("yw-today");
  if (!box || !window.LESSONS) return;
  const lessonNo = window.todayLessonNo();
  const today = window.LESSONS[lessonNo - 1];
  if (!today) {
    box.innerHTML = `<p class="empty">🎉 全部35课已预习完毕！</p>`;
    return;
  }
  const dict = today.dictation && today.dictation[0];
  box.innerHTML = `
    <div style="display:flex; align-items:center; gap:8px;">
      <span class="tag warn">第${lessonNo}课 · ${today.type}</span>
      <span style="color:var(--text-2); font-size:12px;">PDF 第 ${today.page} 页</span>
    </div>
    <h4 style="margin:8px 0 4px; font-size:16px;">${today.title}</h4>
    ${dict ? `<p style="font-size:12px; color:var(--text-2); margin:0 0 6px;">生字听写：<strong>${dict.words}</strong></p>` : ""}
    ${today.theme ? `<p style="font-size:12px; color:var(--text-2); margin:6px 0;">📌 ${today.theme}</p>` : ""}
    <div style="display:flex; gap:8px; margin-top:8px;">
      <a class="btn" href="pages/yuwen.html#lesson-${lessonNo}" style="flex:1; text-align:center;">查看详情</a>
    </div>
  `;
};

// 旺仔每日打卡列表
window.KIDS_TASKS = [
  { id: "yw-preview", name: "语文预习", icon: "📖", page: "pages/yuwen.html" },
  { id: "yw-recite", name: "晨读打卡", icon: "🔔" },
  { id: "yw-recite-must", name: "必背内容", icon: "✍️" },
  { id: "math", name: "口算100以内 / 乘法", icon: "🧮" },
  { id: "writing", name: "练字30分钟", icon: "🖌️" },
  { id: "reading", name: "每日阅读", icon: "📚", page: "pages/reading.html" },
  { id: "exercise", name: "每日运动", icon: "⚽" },
  { id: "english", name: "新概念A", icon: "🅰️" }
];

window.OTHER_TASKS = [
  { id: "vitD", name: "维D", icon: "💊" }
];

window.SELF_TASKS = [
  { id: "tender-study", name: "招标竞赛复习", icon: "🎯" },
  { id: "tender-quiz", name: "招标120题", icon: "📝" },
  { id: "tax-study", name: "税法复习", icon: "💰" }
];

window.renderCheckList = function(taskList, containerId, subtitle) {
  const c = document.getElementById(containerId);
  if (!c) return;
  const state = window.STATE.load();
  const today = window.STATE.getToday(state);
  c.innerHTML = "";
  taskList.forEach(t => {
    const checked = today[t.id] === true;
    const row = document.createElement("div");
    row.className = "check-row";
    row.innerHTML = `
      <input type="checkbox" id="chk-${t.id}" ${checked ? "checked":""}>
      <label for="chk-${t.id}">
        <span>${t.icon} ${t.name}</span>
        ${subtitle && subtitle[t.id] ? `<div class="meta">${subtitle[t.id]}</div>` : ""}
      </label>
      ${t.page ? `<a href="${t.page}" class="meta" style="text-decoration:underline;">进入</a>` : ""}
    `;
    row.querySelector("input").addEventListener("change", e => {
      const s = window.STATE.load();
      window.STATE.setTodayItem(t.id, e.target.checked, s);
      window.renderProgress();
    });
    c.appendChild(row);
  });
};

window.renderAllChecks = function() {
  // 个人学习
  window.renderCheckList(window.SELF_TASKS, "self-tasks", {
    "tender-study": "通读法规原文、整理笔记",
    "tender-quiz": "120题练习（70单选 + 20判断 + 30多选）",
    "tax-study": "税法教材重点章节"
  });
  // 旺仔
  const mathInfo = window.todayMathType();
  window.renderCheckList(window.KIDS_TASKS, "kids-tasks", {
    "yw-preview": "预习今日一课 + 听写生字",
    "yw-recite": "晨读古诗/课文",
    "yw-recite-must": "对照背诵表过关",
    "math": `今日：${mathInfo.phaseLabel} 第${mathInfo.phaseDay}天`,
    "writing": "铅笔字帖一页",
    "reading": "亲子共读 30 分钟",
    "exercise": "跳绳 / 跑步 30 分钟",
    "english": "新概念A 一课"
  });
  // 其他
  window.renderCheckList(window.OTHER_TASKS, "other-tasks");
};

// 渲染进度条
window.renderProgress = function() {
  const state = window.STATE.load();
  const today = window.STATE.getToday(state);
  const all = [...window.SELF_TASKS, ...window.KIDS_TASKS, ...window.OTHER_TASKS];
  const done = all.filter(t => today[t.id] === true).length;
  const pct = Math.round(done / all.length * 100);

  const fill = document.getElementById("progress-fill");
  const text = document.getElementById("progress-text");
  if (fill) fill.style.width = pct + "%";
  if (text) text.textContent = `${done} / ${all.length} 项 · ${pct}%`;

  // 学习连续天数
  const streak = window.calcStreak();
  const streakEl = document.getElementById("streak");
  if (streakEl) streakEl.innerHTML = streak > 0 ? `<span class="fire">🔥</span> 已连续打卡 <strong>${streak}</strong> 天` : `今日还没有打卡哦`;
};

window.calcStreak = function() {
  const state = window.STATE.load();
  let d = 0;
  const today = new Date();
  // 检查今天或昨天的打卡
  for (let i = 0; i < 365; i++) {
    const d2 = new Date(today);
    d2.setDate(d2.getDate() - i);
    const key = d2.getFullYear() + "-" + String(d2.getMonth()+1).padStart(2,"0") + "-" + String(d2.getDate()).padStart(2,"0");
    const cd = state.checkIns[key];
    if (!cd) {
      // 允许今天未完成（凌晨时）
      if (i === 0) continue;
      break;
    }
    const allTasks = [...window.SELF_TASKS, ...window.KIDS_TASKS, ...window.OTHER_TASKS];
    const completed = allTasks.filter(t => cd[t.id] === true).length;
    if (completed === 0) {
      if (i === 0) continue;
      break;
    }
    d++;
  }
  return d;
};

// 导出数据
window.exportData = function() {
  const state = window.STATE.load();
  const blob = new Blob([JSON.stringify(state, null, 2)], {type: "application/json"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "旺仔学习记录_" + window.STATE.todayISO() + ".json";
  a.click();
  URL.revokeObjectURL(url);
};

// 重置全部
window.resetAll = function() {
  if (!confirm("确定要清空所有打卡记录吗？此操作不可恢复。")) return;
  localStorage.removeItem(window.STATE.KEY);
  if (window.SYNC) {
    window.SYNC.saveAndSync({ checkIns: {}, readingProgress: {}, tenderSessions: {}, _syncTime: Date.now() });
  }
  location.reload();
};
