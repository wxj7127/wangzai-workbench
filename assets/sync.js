/**
 * 多设备同步模块 v2
 * 同步全部 localStorage 数据，支持手机/iPad/电脑跨设备同步
 * - 页面加载时拉取远程数据，合并到本地
 * - 数据变更时自动推送到远程
 * - 降级：远程不可用时自动回退到纯本地模式
 */
window.SYNC = (function () {
  const API_BASE = ""; // 同源部署
  const SYNC_TIME_KEY = "_sync_time";
  const DEVICE_ID_KEY = "_device_id";
  // 不同步的内部 key
  const SKIP_KEYS = new Set([SYNC_TIME_KEY, DEVICE_ID_KEY]);

  // 生成或读取设备ID
  function getDeviceId() {
    let id = localStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
      id = "dev_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
      localStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
  }

  // 收集所有需要同步的 localStorage 数据
  function collectLocal() {
    const data = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (SKIP_KEYS.has(key)) continue;
      // 跳过以 _ 开头的内部 key
      if (key && key.startsWith("_")) continue;
      data[key] = localStorage.getItem(key);
    }
    return data;
  }

  // 将远程数据写入本地（仅当远程更新时）
  function applyRemote(localData, remoteData, remoteTime) {
    const localTime = parseInt(localStorage.getItem(SYNC_TIME_KEY) || "0");
    if (remoteTime <= localTime) {
      console.log("[SYNC] 本地已是最新，跳过");
      return false;
    }

    // 合并策略：
    // 1. 远程有的 key，覆盖本地
    // 2. 本地有但远程没有的 key，保留本地（可能是本设备刚写入还未同步的）
    for (const key in remoteData) {
      if (SKIP_KEYS.has(key)) continue;
      localStorage.setItem(key, remoteData[key]);
    }
    localStorage.setItem(SYNC_TIME_KEY, String(remoteTime));
    console.log("[SYNC] 远程数据已同步到本地");
    return true;
  }

  // 从远程拉取最新状态
  async function fetchRemote() {
    try {
      const resp = await fetch(API_BASE + "/api/state", {
        cache: "no-store",
        signal: AbortSignal.timeout(5000)
      });
      if (!resp.ok) return null;
      const json = await resp.json();
      if (!json.ok || !json.data) return null;
      return { data: json.data, time: json.updatedAt };
    } catch (e) {
      console.log("[SYNC] 拉取失败，使用本地模式:", e.message);
      return null;
    }
  }

  // 推送状态到远程
  async function pushRemote() {
    try {
      const data = collectLocal();
      const now = Date.now();
      const resp = await fetch(API_BASE + "/api/state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: { kv: data, syncTime: now },
          deviceId: getDeviceId()
        }),
        signal: AbortSignal.timeout(5000)
      });
      const json = await resp.json();
      if (json.ok) {
        localStorage.setItem(SYNC_TIME_KEY, String(now));
      }
      return json.ok;
    } catch (e) {
      console.log("[SYNC] 推送失败:", e.message);
      return false;
    }
  }

  // 初始化同步：页面加载时调用
  async function init() {
    const remote = await fetchRemote();
    if (remote && remote.data && remote.data.kv) {
      const remoteTime = new Date(remote.time).getTime();
      const changed = applyRemote(collectLocal(), remote.data.kv, remoteTime);
      if (changed) {
        // 远程数据更新了本地，需要刷新页面渲染
        console.log("[SYNC] 数据已更新，刷新渲染");
      }
    }
    return true;
  }

  // 保存并同步（数据变更时调用）
  let pushTimer = null;
  function saveAndSync() {
    // 防抖：500ms 内多次调用只推一次
    if (pushTimer) clearTimeout(pushTimer);
    pushTimer = setTimeout(() => {
      pushRemote();
    }, 500);
  }

  // 兼容旧接口：接受 state 参数但忽略（已改为全量同步）
  function saveAndSyncLegacy(state) {
    if (state) {
      localStorage.setItem("wangzai_dashboard_v1", JSON.stringify(state));
    }
    saveAndSync();
  }

  // 推送练习成绩
  async function pushScore(score, total, detail) {
    try {
      const resp = await fetch(API_BASE + "/api/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceId: getDeviceId(),
          score, total, detail
        }),
        signal: AbortSignal.timeout(5000)
      });
      return (await resp.json()).ok;
    } catch (e) {
      console.log("[SYNC] 成绩推送失败:", e.message);
      return false;
    }
  }

  // 拉取历史成绩
  async function fetchScores() {
    try {
      const resp = await fetch(API_BASE + "/api/scores", { cache: "no-store" });
      const json = await resp.json();
      return json.ok ? json.data : [];
    } catch (e) {
      return [];
    }
  }

  // 检测是否有后端可用（http/https 协议即有后端）
  function isOnline() {
    return location.protocol.startsWith("http");
  }

  return {
    init,
    saveAndSync: saveAndSyncLegacy,
    pushScore,
    fetchScores,
    getDeviceId,
    isOnline,
    pushRemote
  };
})();
