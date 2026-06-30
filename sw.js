// Service Worker for 秋米小地图
// Phase 1: 基础缓存策略（暂仅做 install/activate，不做离线缓存）

self.addEventListener('install', function(event) {
  console.log('[sw] install');
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  console.log('[sw] activate');
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', function(event) {
  // Phase 2 将实现离线缓存策略
});