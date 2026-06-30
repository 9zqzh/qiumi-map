# 秋米小地图 — Phase 1 前端原型开发规范

> **目标**：产出一个移动端优先的纯前端地图标记工具。打开链接即可用，搜索对标高德，标记数据存 localStorage。
> **适用阶段**：仅 Phase 1，无后端、无协作、无登录。
> **给 AI 工具**：本文档可直接作为 Claude/Cursor/Copilot 等的开发指令。逐节执行，完成后逐项自查。

---

## 一、项目骨架

### 1.1 文件结构

```
qiumi-map/
├── index.html              ← 唯一页面（单文件方案，所有内容在此）
├── manifest.json           ← PWA 配置
└── sw.js                   ← Service Worker（可选，Phase 1 暂可空）
```

本阶段采用**单文件**策略——一个 `index.html` 包含所有 HTML/CSS/JS。原因：
- 极简分发：一个链接搞定，不需要构建工具
- GitHub Pages 直接托管，无需部署流程
- Phase 2 引入后端时再拆分

### 1.2 技术清单

| 层级 | 技术 | 引入方式 | 说明 |
|------|------|---------|------|
| 地图 SDK | 高德 JS API 2.0 | CDN script 标签 | `https://webapi.amap.com/maps?v=2.0&key=YOUR_KEY&plugin=...` |
| 搜索 | 高德 AutoComplete + PlaceSearch | 同上 plugin | 输入联想 + POI 搜索 |
| 地理编码 | 高德 Geocoder | 同上 plugin | 点击地图逆地理编码 |
| 路线 | 高德 DrivingRoute + WalkingRoute | 同上 plugin | 驾车/步行路线 |
| UI 渲染 | 纯 HTML + CSS + Vanilla JS | 无框架 | 不使用 React/Vue 等 |
| 字体 | Google Fonts | CDN link | Nunito + ZCOOL KuaiLe（照搬现有） |
| 数据 | localStorage | 浏览器原生 API | 存标记数据、城市列表、当前状态 |

### 1.3 高德 JS API Key

开发前需要注册高德开放平台账号（https://lbs.amap.com），创建应用获取 Key。

**插件按需加载声明**（放在 script src 的 plugin 参数中）：

```
plugin=AMap.AutoComplete,AMap.PlaceSearch,AMap.Geocoder,AMap.DrivingRoute,AMap.WalkingRoute,AMap.DistrictSearch,AMap.Geolocation
```

---

## 二、品牌设计系统（照搬现有 qiumi-map.html）

以下 CSS 变量和设计语言**直接从现有文件迁移**，不得修改：

### 2.1 CSS 变量

```css
:root {
  color-scheme: light;
  --paper: #F5EDE3;
  --ink: #2C1810;
  --clay: #CC7540;
  --sage: #7C9A6B;
  --blush: #F0C0B0;
  --sky: #7BA8C0;
  --wheat: #E8D5B7;
  --cream: #FAF5EE;
  --ember: #D4644A;
  --moss: #6B8A5F;
  --siamese-brown: #8B5E3C;
  --siamese-cream: #FDF5E6;
  --shadow-warm: rgba(44,24,16,0.15);
  --shadow-deep: rgba(44,24,16,0.25);
  --radius: 18px;
  --radius-sm: 12px;
  --font-display: 'ZCOOL KuaiLe', cursive;
  --font-body: 'Nunito', sans-serif;
}
```

### 2.2 字体

```html
<link href="https://fonts.googleapis.com/css2?family=Nunito:wght@300;400;600;700;800&family=ZCOOL+KuaiLe&display=swap" rel="stylesheet">
```

- 标题/品牌文字：`ZCOOL KuaiLe`（中文 + 装饰性场景）
- 正文/UI：`Nunito`（可读性）

### 2.3 暹罗猫 IP

`<template id="siameseCatSVG">` 中已有的猫咪 SVG 是品牌 IP，所有需要 Logo 的地方（首页、地图顶部栏）都复用此 SVG。照搬现有代码即可。

### 2.4 已定义的动画

现有三个动画照搬（已用 `@keyframes` 定义）：

- `wobbleIn` — 标记弹入
- `floatUp` — 浮入
- `gentlePulse` — 强调脉冲
- `catWink` — 猫咪眨眼（Logo hover 用）

---

## 三、核心变更：Leaflet → 高德 JS API 2.0

现有代码使用 Leaflet + OpenStreetMap 瓦片。Phase 1 需要替换为高德 API。以下是**逐项迁移对照表**：

### 3.1 地图初始化

**旧（Leaflet）：**
```js
map = L.map('map', { center: [lat, lng], zoom: zoom });
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {...}).addTo(map);
```

**新（高德）：**
```js
map = new AMap.Map('map', {
  center: [lng, lat],        // ⚠️ 顺序是 [经度, 纬度]，不是 [纬度, 经度]
  zoom: zoom,
  resizeEnable: true,        // 窗口大小变化时自适应
  touchZoom: true,           // 移动端双指缩放
  dragEnable: true,
  zoomEnable: true,
  mapStyle: 'amap://styles/light',  // 浅色底图
  viewMode: '2D',
});
```

**调用顺序变化**：高德 API 采用 `[lng, lat]`，现有代码全部使用 `[lat, lng]`。迁移时需全局替换所有经纬度顺序。一个简单策略：内部存储仍用 `[lat, lng]`（兼容现有数据结构），仅在调用高德 API 时做转换。

### 3.2 标记点（Marker）

**旧：** Leaflet `L.marker([lat, lng], { icon: L.divIcon(...) })`

**新：**
```js
const marker = new AMap.Marker({
  position: [lng, lat],          // ⚠️ [经度, 纬度]
  offset: new AMap.Pixel(-10, -35), // 让图标尖端对准坐标
  content: '<div class="marker-label-wrap" data-marker-id="' + data.id + '">' +
    '<div class="marker-label-dot" style="background:' + color + '"></div>' +
    '<div class="marker-label-text" style="color:' + color + '">' + emoji + ' ' + name + '</div></div>',
  zIndex: 100,
  // 移动端点击优化
  topWhenClick: true,
});
marker.on('click', function(e) {
  // 高德事件对象结构不同：e.target 是 marker 本身
  // 需要用外部变量绑定 marker id
});
marker.setMap(map);
```

**标记的 content 属性使用 DOM 字符串**（与现有 `.marker-label-wrap` 结构完全相同），`marker-label-dot` 和 `marker-label-text` 的 CSS 照搬现有。

### 3.3 搜索：POI 输入联想 + 关键词搜索

高德的搜索分两层——`AutoComplete`（输入联想）和 `PlaceSearch`（关键词搜索）。Phase 1 使用 **AutoComplete**（输入过程中联想），效果对标高德 App 搜索框。

```js
// 初始化
const autoComplete = new AMap.AutoComplete({
  city: currentCityName,   // 限定城市，提高联想精度
  citylimit: true,         // 仅返回该城市结果
  input: 'searchInput',    // 绑定到搜索 input 的 id
});

// 监听选择结果
autoComplete.on('select', function(e) {
  const poi = e.poi;  // poi.name, poi.district, poi.address, poi.location (lng/lat)
  // 飞行动画到 POI 位置
  map.setZoomAndCenter(16, [poi.location.lng, poi.location.lat]);
  // 弹出添加标记的 modal
  showAddModal(poi.location.lng, poi.location.lat, poi.name, poi.address);
});

// 搜索下拉面板：高德 AutoComplete 自带下拉（默认注入 DOM），
// 但样式需要自定义。通过 CSS 覆盖高德默认样式类：
// .amap-sug-result { ... }  ← 高德联想下拉的容器
// .amap-sug-result .auto-item { ... }  ← 每条结果
// .amap-sug-result .auto-item:hover { background: var(--blush); }
```

**关键点**：AutoComplete 的 `input` 参数直接绑定现有 `#searchInput`，高德会自动接管输入事件。但高德自带下拉面板的默认样式很丑，需要通过 CSS 覆盖使其融入现有品牌设计。

**覆盖高德自动补全下拉面板样式：**
```css
.amap-sug-result {
  z-index: 2000 !important;
  border-radius: var(--radius) !important;
  border: 2px solid var(--wheat) !important;
  background: var(--cream) !important;
  box-shadow: 0 8px 30px var(--shadow-deep) !important;
  font-family: var(--font-body) !important;
  overflow: hidden !important;
}
.amap-sug-result .auto-item {
  padding: 12px 16px !important;
  font-size: 14px !important;
  color: var(--ink) !important;
  border-bottom: 1px dashed var(--wheat) !important;
}
.amap-sug-result .auto-item:hover,
.amap-sug-result .auto-item.cur {
  background: var(--blush) !important;
  color: var(--ink) !important;
}
```

### 3.4 POI 点选地图

用户点击地图任意位置 → 获取该坐标的地址 → 弹出添加标记 modal。

```js
map.on('click', function(e) {
  const lnglat = e.lnglat;  // [lng, lat]
  // 逆地理编码获取地址
  const geocoder = new AMap.Geocoder();
  geocoder.getAddress([lnglat.lng, lnglat.lat], function(status, result) {
    if (status === 'complete' && result.regeocode) {
      const addr = result.regeocode.formattedAddress;
      showAddModal(lnglat.lng, lnglat.lat, '', addr);
    } else {
      showAddModal(lnglat.lng, lnglat.lat, '', '');
    }
  });
});
```

### 3.5 覆盖物聚合（MarkerClusterer）

手机端标记密集时需聚合（避免手指点不到）。高德需要额外加载插件：

JS API URL 的 plugin 参数加上 `AMap.MarkerClusterer`：

```js
// 判断是否需要聚合：标记 > 15 个时启用
if (getCityMarkers().length > 15 && window.AMap.MarkerClusterer) {
  // 使用聚合
  cluster = new AMap.MarkerClusterer(map, markersArray, {
    gridSize: 60,
    maxZoom: 14,
    styles: [{ /* 聚合点样式 */ }]
  });
} else {
  // 单独渲染
  markersArray.forEach(m => m.setMap(map));
}
```

### 3.6 长按地图添加标记（移动端特有）

桌面端点按添加标记，但移动端点按和拖拽容易冲突。高德地图原生区分了 `click` 和 `hold`：

```js
// 移动端长按 = 添加标记
map.on('hold', function(e) {
  const lnglat = e.lnglat;
  // ... 同上，逆地理编码 + showAddModal
});

// 桌面端短按 = 添加标记（保留 click 行为）
map.on('click', function(e) {
  // ... 同上
});

// 通过 media query 判断：移动端用 hold，桌面端用 click
// 实现：都绑，但移动端 click 用 flag 避免与 hold 同时触发
```

### 3.7 城市边界

**旧：** Nominatim + Overpass API

**新：** 高德 `DistrictSearch`
```js
const district = new AMap.DistrictSearch({
  subdistrict: 0,
  extensions: 'all',       // 返回行政区边界坐标
  level: 'city'
});
district.search(currentCityName, function(status, result) {
  if (status === 'complete') {
    const boundaries = result.districtList[0].boundaries;
    // boundaries 是坐标数组，画多边形
    const polygon = new AMap.Polygon({
      path: boundaries,
      strokeColor: '#3388FF',
      strokeWeight: 3,
      strokeStyle: 'dashed',
      fillColor: '#3388FF',
      fillOpacity: 0.08,
    });
    polygon.setMap(map);
    map.setFitView([polygon]);
  }
});
```

### 3.8 路线规划

**旧：** OSRM

**新：** 高德 `DrivingRoute`
```js
const driving = new AMap.DrivingRoute({
  map: map,
  policy: AMap.DrivingPolicy.LEAST_TIME,
});
const waypoints = routeStops
  .map(id => markersData.find(mk => mk.id === id))
  .filter(Boolean)
  .map(m => new AMap.LngLat(m.lng, m.lat));

// 驾车路线
driving.search(waypoints[0], waypoints[waypoints.length - 1], {
  waypoints: waypoints.slice(1, -1)  // 中间途经点
}, function(status, result) {
  // result.routes[0].distance / .time
});
```

---

## 四、移动端优先的 UI 布局规范

### 4.1 全局布局策略

一个 HTML 文件，通过 CSS 媒体查询区分设备。**断点：768px**。

```
桌面端 (>768px)                    手机端 (≤768px)
┌──────────┬──────────────┐        ┌─────────────────────┐
│ 搜索栏    │  地图全屏      │        │ [🔍 搜索地点...  ✦] │ ← 浮动顶部栏
│ 在顶部栏  │              │        │                     │
│          │              │        │     🗺️ 地图全屏      │
│          │              │        │                     │
│          │              │        │              [📍+]  │ ← FAB
│          │              │        │   ┌─────────────┐   │
│          │              │        │   │ 📍 我的标记  │   │ ← 底部抽屉
│          │              │        │   └─────────────┘   │
└──────────┴──────────────┘        └─────────────────────┘
```

### 4.2 顶部栏（Top Bar）

**照搬现有的** `.top-bar` 样式（毛玻璃效果 + 居中胶囊）。桌面和手机共用。

```css
.top-bar {
  position: fixed;
  top: 16px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1000;
  display: flex;
  gap: 10px;
  align-items: center;
  background: rgba(250,245,238,0.92);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 2px solid var(--wheat);
  border-radius: 50px;
  padding: 8px 14px;
  box-shadow: 0 4px 20px var(--shadow-warm);
}
```

**手机端适配**（现有已有，补充）：
```css
@media (max-width: 768px) {
  .top-bar {
    padding: 6px 10px;
    gap: 6px;
    top: 8px;
  }
  .search-input {
    width: 140px;          /* 手机端收窄，给 Logo 留空间 */
    font-size: 13px;
    padding: 8px 36px 8px 14px;
  }
  .top-logo { font-size: 16px; }
}
```

**顶部栏按钮精简**：Phase 1 无后端，顶部栏仅保留以下按钮：
- Logo（点击回首页）
- 搜索框
- ✦ 手动添加标记
- ⬡ 数据管理（导出/导入/清空）
- ⌒ 路线模式（可选，简单的划线模式）

移除现有的 `⟳` 同步按钮（Phase 2 才需要）。

### 4.3 底部抽屉（Bottom Sheet）

**照搬现有的** `.bottom-sheet` 结构和样式（手柄 + 分类筛选 + 标记卡片列表）。

**Phase 1 新增：滑动删除**

在标记卡片上支持左滑手势露出删除按钮（移动端专用）：

```js
// 触摸事件实现滑动删除
let touchStartX = 0;
card.addEventListener('touchstart', function(e) {
  touchStartX = e.touches[0].clientX;
});
card.addEventListener('touchend', function(e) {
  const diff = e.changedTouches[0].clientX - touchStartX;
  if (diff < -60) {
    // 左滑超过 60px → 显示删除确认
    card.querySelector('.swipe-delete').classList.add('visible');
  } else if (diff > 60) {
    // 右滑 → 隐藏
    card.querySelector('.swipe-delete').classList.remove('visible');
  }
});
```

**桌面端**：标记卡片 hover 时显示编辑/删除按钮（现有方案，照搬）。

### 4.4 FAB（浮动操作按钮）

手机端右下角的快速添加标记按钮：

```css
.fab {
  position: fixed;
  bottom: 80px;           /* 在底部抽屉之上 */
  right: 20px;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: var(--clay);
  color: #fff;
  border: none;
  box-shadow: 0 4px 16px var(--shadow-deep);
  font-size: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 950;
  transition: transform 0.2s ease, background 0.2s ease;
}
.fab:hover { background: var(--ember); }
.fab:active { transform: scale(0.9); }

@media (min-width: 769px) {
  .fab { display: none; }  /* 桌面端隐藏 */
}
```

FAB 点击行为：弹出选择——"搜索地点" / "当前定位标记"。如果点"当前定位标记"，调用高德 `AMap.Geolocation` 获取用户位置。

### 4.5 Modal 弹窗

**照搬现有的** `.modal-overlay` + `.modal-card` 结构。样式不变。

**Phase 1 补充**：手机端 Modal 宽度改为 `width: 90%; max-width: 420px`，内容区域 `max-height: 80vh` 保证键盘弹出时不挤压。

### 4.6 Toast

**照搬现有的** `.toast` 样式（底部居中，深色底 + 浅色字，2.2s 自动消失）。不做修改。

### 4.7 首页（Welcome Screen）

**照搬现有的** `.welcome-overlay`，包括：
- 猫咪 Logo + "秋米小地图"
- 副标题
- 城市按钮网格 `.welcome-city-grid`
- 自定义城市输入框
- "出发"按钮

**Phase 1 优化**：城市列表从现有 localStorage 读取。首次使用时预置 DEFAULT_CITIES（北京/上海/成都/杭州/广州/深圳）。

---

## 五、功能模块清单

### 5.1 城市管理

| 功能 | 实现 | 说明 |
|------|------|------|
| 预置城市列表 | DEFAULT_CITIES 常量 | 6 个城市，含经纬度 |
| 自定义城市 | 输入框 + Nominatim 定位 | 或高德 DistrictSearch 定位 |
| 城市持久化 | localStorage `qiumi_map_data_v3` | 结��照搬现有 key |
| 城市切换 | switchCity() | 切换地图中心 + 重渲染标记 |
| 城市删除 | 按钮点 × | 仅从列表移除，不删数据 |

### 5.2 搜索（核心改造）

| 功能 | 实现 | 说明 |
|------|------|------|
| 输入联想 | 高德 `AMap.AutoComplete` | 仅当前城市，对标高德 App |
| 结果选择 | `autoComplete.on('select')` | 飞行到 POI + 弹出添加 modal |
| 结果面板样式 | CSS 覆盖 `.amap-sug-result` | 融入品牌设计 |
| 搜索范围限制 | `citylimit: true` | 聚焦当前城市 |

### 5.3 标记管理

| 功能 | 实现 | 说明 |
|------|------|------|
| 添加标记 | 搜索选择结果 / 点击地图 / hold 长按 / FAB | 弹出 modal 补全信息 |
| 编辑标记 | 点击标记 → Popup → 编辑按钮 → Modal | 或从底部抽屉卡片编辑 |
| 删除标记 | 同上 + 左滑删除（手机端） | 二次确认 |
| 标记分类 | CATEGORIES 常量（9 类） | 照搬现有：餐厅/咖啡/面包/酒馆/甜品/市场/景点/小店/其他 |
| 分类筛选 | 底部抽屉分类 pill | 照搬现有 cat-filters |
| 标记数据 | localStorage | 照搬现有数据结构（id/city/name/category/address/notes/textColor/lat/lng/date） |
| 标记颜色 | 12 色可选 | 照搬现有 MARKER_COLORS |
| 标记渲染 | 高德 Marker(content: divIcon) | 保留 `.marker-label-wrap` 视觉 |

### 5.4 地图交互

| 功能 | 实现 | 说明 |
|------|------|------|
| 点击地图添加标记 | `map.on('click')` | 桌面端 |
| 长按添加标记 | `map.on('hold')` | 移动端（高德原生支持） |
| 逆地理编码 | `AMap.Geocoder` | 点击地图自动获取地址 |
| 标记聚合 | `AMap.MarkerClusterer` | >15 个标记时启用 |
| 城市边界 | `AMap.DistrictSearch` | 虚线多边形 |
| 飞行定位 | `map.setZoomAndCenter()` | 点击标记卡片飞到该标记 |
| 缩放控件 | 高德内置 + 自定义样式 | 覆盖 `.amap-zoom` 等类 |

### 5.5 路线（简化版，Phase 1 够用即可）

| 功能 | 实现 | 说明 |
|------|------|------|
| 路线模式开关 | 顶部按钮 | 切换后标记卡片显示"+ 加入路线" |
| 添加途经点 | 点击卡片 "+" → routeStops 数组 | 照搬现有 |
| 路线计算 | 高德 `AMap.DrivingRoute` | 驾车路线 |
| 路线清除 | 按钮 | 清空 routeStops + 移除路线绘制 |
| 路线信息 | 底部浮动条 | "🚗 X 公里 · ⏱ Y 分钟" |

### 5.6 数据导入导出

| 功能 | 实现 | 说明 |
|------|------|------|
| 导出 JSON | 下载 .json 文件 | 照搬现有 |
| 导入 JSON | 文件选择 + 合并 | 去重（同 id 跳过） |
| 分享码生成 | base64 编码 → 复制 | 照搬现有（多设备离线同步用） |
| 分享码导入 | 粘贴 → 解码 → 合并 | 照搬现有 |
| 清空当前城市 | 二次确认 | 照搬现有 |

---

## 六、开发顺序（按节执行）

### 第 1 步：HTML 骨架 + CSS

创建 `index.html`：
- `<head>` 引入 Google Fonts、高德 JS API CDN
- `<body>` 写入模板 SVG（猫咪）、Welcome Screen、App Container 的 HTML 结构
- CSS 照搬现有的全部变量和组件样式
- 新增高德自动补全面板覆盖样式、FAB 样式、移动端媒体查询补充

### 第 2 步：高德地图初始化 + 城市切换

替换 Leaflet 初始化逻辑为高德 AMap.Map。城市切换时销毁旧地图实例重建。

### 第 3 步：搜索接入

替换 Nominatim/Photon 搜索为高德 AutoComplete。注意 CSS 覆盖下拉面板。

### 第 4 步：标记渲染

将 L.marker + L.divIcon 替换为 AMap.Marker + content 属性。保留 `.marker-label-wrap` 视觉。

### 第 5 步：点击/长按添加标记

`map.on('click')` + `map.on('hold')` + 逆地理编码。

### 第 6 步：路线规划

替换 OSRM 为高德 DrivingRoute。

### 第 7 步：移动端细调

- FAB 按钮
- 搜索框手机宽度
- 底部抽屉左滑删除
- 键盘避让
- 实际真机测试

### 第 8 步：数据持久化闭环

确认 localStorage 读写无误——关闭浏览器再打开，标记和城市数据不丢。

---

## 七、自查清单（每步完成后逐项勾验）

- [ ] 高德地图正常加载（无白屏、无 JS 报错）
- [ ] 搜索输入时有联想下拉（城市范围内）
- [ ] 选择搜索结果 → 地图飞到 POI → Modal 弹出 → 保存 → 地图上出现标记
- [ ] 点击地图空白处 → 获取地址 → Modal 弹出
- [ ] 手机端长按地图 → 弹出 Modal
- [ ] 标记点击 → Popup 显示信息 + 编辑/删除按钮
- [ ] 底部抽屉展开 → 标记卡片列表 → 分类筛选
- [ ] 标记编辑/删除正常工作
- [ ] 城市切换 → 地图移到新城市 → 显示该城市标记
- [ ] 路线模式 → 选择途经点 → 绘制路线 + 显示距离时间
- [ ] 导出 JSON → 导入 JSON → 数据合并正确（不重复）
- [ ] 清空当前城市 → 标记消失 → 其他城市数据不丢
- [ ] 关闭浏览器 → 重新打开 → 数据和城市状态恢复
- [ ] 手机端真机测试：搜索、标记、滑动删除、键盘不遮挡
- [ ] <768px 断点下布局正确（无横向滚动条、字不溢出）

---

## 八、关键注意事项（AI 执行时务必遵守）

1. **经纬度顺序**：高德 API 所有坐标参数是 `[lng, lat]`（经度在前）。内部存储保持不变（`{lat, lng}` 对象），调用高德时转换。

2. **地图实例唯一性**：切换城市时必须 `map.destroy()` 再 `new AMap.Map()`。不能同时存在两个地图实例。

3. **高德 Key 不能提交到仓库**：将 Key 放在 `YOUR_KEY` 占位符，在文档中说明如何获取。

4. **CDN 加载失败处理**：如果高德 CDN 加载失败（网络问题），显示错误提示而不是空白页。

5. **保留现有的全部 CSS 变量和品牌色**——这些是产品调性，不要擅改。

6. **localStorage 的 key 保持不变**：`qiumi_map_data_v3`，确保已有用户升级到新版后数据不丢。

7. **现有 HTML 的 `<template id="siameseCatSVG">` 和 `injectCatSVGs()` 逻辑需要照搬**——猫咪 Logo 是品牌资产的唯一标识。

8. **先跑通桌面端，再调移动端**——高德 API 的触摸事件是开箱即用的，先保证功能对再优化体验。
