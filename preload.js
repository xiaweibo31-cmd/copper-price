const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // 刷新数据
  refresh: () => ipcRenderer.invoke('refresh'),
  // 设置刷新间隔 (毫秒)
  setRefreshInterval: (ms) => ipcRenderer.invoke('set-refresh-interval', ms),
  // 停止自动刷新
  stopRefresh: () => ipcRenderer.invoke('stop-refresh'),
  // 监听刷新开始
  onFetchStart: (cb) => {
    const handler = () => cb();
    ipcRenderer.on('fetch-start', handler);
    return () => ipcRenderer.removeListener('fetch-start', handler);
  },
  // 监听刷新完成
  onFetchDone: (cb) => {
    const handler = (_e, result) => cb(result);
    ipcRenderer.on('fetch-done', handler);
    return () => ipcRenderer.removeListener('fetch-done', handler);
  },
});
