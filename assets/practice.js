/* === 练习页计时器 & 判分逻辑 === */
window.PRACTICE = {
  examDate: "2026-08-22",
  totalMs: 60 * 60 * 1000, // 60分钟
  spec: null,
  questions: null,
  answers: {}, // {qid: "A" | "ABC" | null}
  startTime: null,
  timerId: null,
  submitted: false,
};

function initPractice() {
  const Q = window.QUESTIONS;
  window.PRACTICE.spec = Q.specs;
  // 合并题目：单选 + 判断 + 多选
  const all = [
    ...Q.questions.single.map(q => ({...q, type:"single"})),
    ...Q.questions.judge.map(q => ({...q, type:"judge"})),
    ...Q.questions.multi.map(q => ({...q, type:"multi"})),
  ];
  window.PRACTICE.questions = all;

  // 检查当前任务进度决定今天打多少题
  // 默认：进入页面时显示今日120题；用户可改为50题、30题快速模式
  const mode = new URLSearchParams(location.search).get("mode") || "all";
  let selected = all;
  if (mode === "single") selected = Q.questions.single;
  else if (mode === "judge") selected = Q.questions.judge;
  else if (mode === "multi") selected = Q.questions.multi;
  else if (mode === "quick30") selected = all.slice(0, 30);
  else if (mode === "quick60") selected = all.slice(0, 60);

  window.PRACTICE.questions = selected;
  window.PRACTICE.startTime = Date.now();
  window.PRACTICE.answers = {};
  window.PRACTICE.submitted = false;

  renderHeader();
  renderQuestion(0);
}

function renderHeader() {
  const total = window.PRACTICE.questions.length;
  document.getElementById("q-count").textContent = `共 ${total} 题`;
}

function renderQuestion(idx) {
  const qs = window.PRACTICE.questions;
  const q = qs[idx];
  if (!q) return;

  const modeInfo = {
    "single": "单选",
    "judge": "判断",
    "multi": "多选",
  };
  const score = window.PRACTICE.spec[q.type].per_score;
  const rule = window.PRACTICE.spec[q.type].rules;

  const answersCount = Object.keys(window.PRACTICE.answers).length;

  document.getElementById("progress-label").textContent = `${answersCount} / ${qs.length} 已作答`;
  document.getElementById("progress-fill").style.width = (answersCount / qs.length * 100).toFixed(1) + "%";

  const html = `
    <div class="q-card" id="qcard-${q.id}">
      <div class="q-head">
        <span class="tag ${q.type === 'multi' ? 'warn' : (q.type === 'judge' ? '' : 'success')}">${modeInfo[q.type]} ${idx+1}/${qs.length}</span>
        <span class="meta">${q.type === 'multi' ? '多选 · 2分 · 全对才得分' : score + '分 · ' + rule}</span>
      </div>
      <div class="q-body">${q.q}</div>
      <div class="opts">
        ${q.options.map(opt => {
          const letter = opt.split(".")[0].trim();
          const isMulti = q.type === "multi";
          const isChecked = isMulti ?
            (window.PRACTICE.answers[q.id] || "").includes(letter) :
            (window.PRACTICE.answers[q.id] === letter);
          const inputType = isMulti ? "checkbox" : "radio";
          return `
            <label class="opt">
              <input type="${inputType}" name="q-${q.id}" value="${letter}" data-qid="${q.id}" data-letter="${letter}" data-multi="${isMulti}" ${isChecked ? "checked":""}>
              <span class="letter">${letter}</span>
              <span>${opt.substring(letter.length + 1).trim()}</span>
            </label>
          `;
        }).join("")}
      </div>
      <div style="display:flex; gap:8px; margin-top:14px;">
        <button class="btn" onclick="goPrev()">← 上一题</button>
        <button class="btn btn-primary" onclick="goNext()">下一题 →</button>
        <button class="btn" onclick="markSkip()">跳过 ⏭</button>
        ${idx === qs.length - 1 ? `<button class="btn btn-success" onclick="submitExam()">交卷判分</button>` : ""}
      </div>
    </div>
  `;
  document.getElementById("qzone").innerHTML = html;
  document.getElementById("qzone-title").textContent = `第 ${idx+1} 题`;
  // bind
  document.querySelectorAll(`#qcard-${q.id} input`).forEach(inp => {
    inp.addEventListener("change", onAnswer);
  });
}

function onAnswer(e) {
  const inp = e.target;
  const qid = inp.dataset.qid;
  const letter = inp.dataset.letter;
  const isMulti = inp.dataset.multi === "true";
  const q = window.PRACTICE.questions.find(q => q.id == qid);
  if (isMulti) {
    let cur = window.PRACTICE.answers[qid] || "";
    const letters = cur ? new Set(cur.split("")) : new Set();
    if (inp.checked) letters.add(letter);
    else letters.delete(letter);
    window.PRACTICE.answers[qid] = Array.from(letters).sort().join("");
    if (!window.PRACTICE.answers[qid]) delete window.PRACTICE.answers[qid];
  } else {
    if (inp.checked) window.PRACTICE.answers[qid] = letter;
  }
  // 进度更新
  const answered = Object.keys(window.PRACTICE.answers).length;
  document.getElementById("progress-label").textContent = `${answered} / ${window.PRACTICE.questions.length} 已作答`;
  document.getElementById("progress-fill").style.width = (answered / window.PRACTICE.questions.length * 100).toFixed(1) + "%";
}

window.goPrev = function() {
  const idx = parseInt(new URLSearchParams(location.hash.slice(1)).get("idx") || "0");
  const newIdx = Math.max(0, idx - 1);
  location.hash = "idx=" + newIdx;
  renderQuestion(newIdx);
};
window.goNext = function() {
  const idx = parseInt(new URLSearchParams(location.hash.slice(1)).get("idx") || "0");
  const newIdx = Math.min(window.PRACTICE.questions.length - 1, idx + 1);
  location.hash = "idx=" + newIdx;
  renderQuestion(newIdx);
};
window.markSkip = function() {
  // 清除当前题目答案并跳到下一题
  const idx = parseInt(new URLSearchParams(location.hash.slice(1)).get("idx") || "0");
  const q = window.PRACTICE.questions[idx];
  delete window.PRACTICE.answers[q.id];
  if (idx < window.PRACTICE.questions.length - 1) {
    location.hash = "idx=" + (idx + 1);
    renderQuestion(idx + 1);
  }
};

window.jumpTo = function(idx) {
  location.hash = "idx=" + idx;
  renderQuestion(idx);
};

window.submitExam = function() {
  if (!confirm("确定交卷吗？交卷后将显示成绩与错题。")) return;
  const qs = window.PRACTICE.questions;
  let totalScore = 0;
  let totalFull = 0;
  const wrongs = [];
  const right = [];
  qs.forEach(q => {
    const ans = (window.PRACTICE.answers[q.id] || "").toUpperCase().split("").sort().join("");
    const correct = (q.answer || "").toUpperCase().split("").sort().join("");
    totalFull += q.score;
    if (ans === correct && ans !== "") {
      totalScore += q.score;
      right.push(q);
    } else if (ans === "" || ans === correct) {
      // 弃答/对：规则不扣分
    } else {
      wrongs.push(q);
    }
  });

  const resultEl = document.getElementById("result-zone");
  resultEl.innerHTML = `
    <div class="list-card" style="border-color:var(--success);">
      <h3 style="color:var(--success);">📊 模拟成绩</h3>
      <div style="font-size:34px; font-weight:700; color:var(--primary); margin: 8px 0;">
        ${totalScore} <span style="font-size:16px; color:var(--text-2);">/ ${totalFull} 分</span>
      </div>
      <p style="margin: 0; font-size: 13px; color:var(--text-2)">
        答对 ${right.length} 题 · 答错 ${wrongs.length} 题 · 弃答 ${qs.length - right.length - wrongs.length} 题
      </p>
      <p style="margin: 8px 0 0; font-size: 13px;">
        ${totalScore >= totalFull * 0.85 ? "🥇 冲金！答题非常出色" :
          totalScore >= totalFull * 0.7 ? "🥈 不错！还有进步空间" :
          totalScore >= totalFull * 0.6 ? "🥉 及格，再接再厉" : "💪 别灰心，多练习"}
      </p>
    </div>
    ${wrongs.length > 0 ? `
      <div style="margin-top:14px;">
        <h3 style="color:var(--danger); margin-bottom:6px;">❌ 错题清单（${wrongs.length}）</h3>
        ${wrongs.map(q => `
          <div class="q-card">
            <div class="q-head">
              <span class="q-status no">错</span>
              <span class="meta">${q.type === 'multi' ? '多选' : q.type === 'judge' ? '判断' : '单选'}</span>
            </div>
            <div class="q-body">${q.q}</div>
            <div class="rule" style="margin-top:6px; background:#fef2f2; padding:6px 10px; border-radius:6px; color:var(--text-2);">
              <strong style="color:var(--danger);">你的答案：</strong>${window.PRACTICE.answers[q.id] || "（弃答）"}
              &nbsp;|&nbsp;
              <strong style="color:var(--success);">正确答案：</strong>${q.answer}
            </div>
          </div>
        `).join("")}
      </div>
    ` : `<p class="empty">🎉 全部答对！</p>`}
    <div class="toolbar" style="margin-top:14px;">
      <button class="btn btn-primary" onclick="initPractice()">🔄 再做一遍</button>
      <button class="btn" onclick="window.location='pages/practice.html'">📋 返回练习页</button>
    </div>
  `;

  // 标记今日打卡
  const state = window.STATE.load();
  window.STATE.setTodayItem("tender-quiz", true, state);
  window.STATE.setTodayItem("tender-study", true, state);

  // 多设备同步：推送成绩到云端
  if (window.SYNC) {
    window.SYNC.pushScore(totalScore, totalFull, {
      right: right.length,
      wrongs: wrongs.length,
      skipped: qs.length - right.length - wrongs.length,
      date: window.STATE.todayISO()
    });
  }

  resultEl.scrollIntoView({behavior: "smooth"});
  document.getElementById("qzone").style.display = "none";
  document.getElementById("qzone-title").textContent = "✅ 已交卷";
};

window.onhashchange = function() {
  const idx = parseInt(new URLSearchParams(location.hash.slice(1)).get("idx") || "0");
  if (idx >= 0 && idx < window.PRACTICE.questions.length) {
    renderQuestion(idx);
  }
};
