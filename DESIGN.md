# DESIGN.md — 现代战争战术态势指挥系统 前端设计规范

> 代号：**VISUALMAP // TACVIEW (MIL-SPEC C4ISR)**  
> 版本：v2.0 (Modern Warfare Tactical Redesign)  
> 风格参考：**《使命召唤：现代战争》(Call of Duty: Modern Warfare) HUD / TacMap / Gunsmith 战术拟真系统**  
> 原规范归档：[archive/DESIGN_v1_ARCHIVE.md](file:///e:/Project/AntigravityIDEUsed/visualMap/archive/DESIGN_v1_ARCHIVE.md)（初代青色玻璃态方案）  
> 配套工程文档：  
> - [TECHNICAL_GUIDE.md](file:///e:/Project/AntigravityIDEUsed/visualMap/TECHNICAL_GUIDE.md)（技术实施方案与底层算法）  
> - [TASKS.md](file:///e:/Project/AntigravityIDEUsed/visualMap/TASKS.md)（WBS 研发分解任务）  
> 核心关键词：**哑光装甲黑 · 战术警示琥珀金 · 严苛军规标定 · 毫米密位刻度 · 零廉价发光 · 高信息密度**

---

## 1. 设计范式重塑：告别“AI模板感”，确立“现代战争战术硬核感”

在 v1.0 版本中，界面采用了青蓝光效（Cyan Glow）、大圆角、半透明高斯模糊以及 Emoji 图标，导致整体呈现典型的**“AI生成的假未来科技感 / 廉价 SaaS 仪表盘风格”**。

在 v2.0 中，我们全面转向《使命召唤：现代战争》(COD: Modern Warfare 2019/II/III 及 Warzone) 的军用人机工效设计哲学，构建真正的**战术特种作战指挥站（C4ISR Tactical Overwatch Station）**。

### 1.1 风格特征对比矩阵

| 维度 | 旧版 AI 模板设计 (v1.0 弃用) | 现代战争战术设计 (v2.0 MW Mil-Spec) |
| :--- | :--- | :--- |
| **主基调** | 通透发光的青蓝霓虹、轻浮的毛玻璃、SaaS感 | **哑光武器碳素黑、重装甲暗灰、高对比抗反光光学玻璃** |
| **高亮强调色** | 泛滥的亮青色 (`#3FD0FF`) 与紫色光晕 | **MW 标志性战术琥珀金 (`#E5A93C`)** 与 **夜视荧光绿 (`#22C55E`)** |
| **边缘与形态** | 圆角矩形 (`border-radius: 6px~10px`)、浮动发光 | **45° 切角倒角 (`chamfer`)、硬朗直角、1px 军规发丝边框、四角准星括号** |
| **材质与质感** | 梦幻柔焦、彩色渐变底色、大面积模糊 | **防刮碳化聚合物质感、0.5px 哑光点阵、微弱水平 CRT 扫描纹、机械螺栓/凹槽** |
| **文字与标定** | 普通中文字体居多、缺乏战术代号 | **全大写粗体战术无衬线 (DIN/Chakra Petch) + 严谨等宽遥测坐标 + 军用序列号编号前缀** |
| **图标与符号** | 常见通用 Emoji (🎯, 🛡️, ⚙️, 💾) | **严苛线框瞄准具准星、北约 APP-6D 军标、雷达扇区、机械字根指示符** |
| **交互动效** | 缓慢的浮动阴影、呼吸发光动画 | **瞬时响应（<100ms）、机械卡扣脆感、激光锁定微动、声学震动反馈级转场** |

---

## 2. 视觉语言系统（Design Tokens）

### 2.1 现代战争暗色作战室（Tactical Ops Dark — 默认基准）

MW 风格的暗色并非单纯的“纯黑”，而是具有军事装备物理层次的**多重防反光装甲色系**：

#### 2.1.1 表面材质与底盘体系 (Armor & Surfaces)

```css
/* 现代战争核心装甲层级 */
--bg-void:         #080A0D; /* 极端深空黑，视口最外层无信号边缘 */
--bg-base:         #0E1116; /* 战术机箱基底，高抗冲击碳素涂料 */
--bg-surface:      #14181F; /* 默认面板底盘，坚固防眩哑光表面 */
--bg-surface-elev: #1B212B; /* 悬浮卡片、下拉装具底槽、详情弹层 */
--bg-surface-high: #242C38; /* 激活弹窗、高优先级告警托盘 */

/* 战术复合材料透明度（模拟军规加固防弹防反光视窗，而非普通毛玻璃） */
--bg-glass-tint:   rgba(14, 18, 24, 0.92);
--bg-glass-heavy:  rgba(20, 25, 33, 0.96);
--bg-hover-tint:   rgba(229, 169, 60, 0.10); /* 掠过琥珀微光 */
--bg-active-tint:  rgba(229, 169, 60, 0.22); /* 锁定琥珀底色 */
```

#### 2.1.2 战术边线与十字标尺 (Hairpins & Reticles)

```css
/* 严苛 1px 机械切分线体系 */
--line-ghost:     rgba(148, 163, 184, 0.10); /* 亚像素子网格、微型刻度 */
--line-default:   rgba(148, 163, 184, 0.22); /* 面板外框、标准分栏线 */
--line-bold:      rgba(148, 163, 184, 0.45); /* 重点边框、卡槽外缘 */
--line-accent:    #E5A93C;                   /* 锁定焦距、聚焦高亮、选择状态 */
--line-danger:    #EF4444;                   /* 交火防线、敌对锁定 */
```

#### 2.1.3 现代战争核心功能配色 (Tactical Function Colors)

现代战争 UI 中，颜色具有严苛的语义权重，绝不用于无关修饰：

| 语义角色 | Token | 色值 (HEX) | 视觉原型与军事含义 |
| :--- | :--- | :--- | :--- |
| **MW 标志战术琥珀** | `--accent` | `#E5A93C` | MW 特战部队标志色：目标引导、选中框、任务激活、战术级聚焦 |
| **琥珀明亮高光** | `--accent-bright` | `#F5B74F` | 鼠标悬停激活、击中/确认瞬间的高频闪烁 |
| **琥珀机械暗色** | `--accent-dim` | `#99681E` | 次级指示器、未填满的条形槽底色、已部署标记 |
| **友军 / NVG 绿** | `--iff-friend` | `#22C55E` | 蓝军追踪系统 (BFT)、夜视仪荧光绿标、通信链路健康 (99.8%) |
| **友军背景色** | `--iff-friend-dim`| `rgba(34, 197, 94, 0.15)` | 友军空域/行进路线走廊浅色遮罩 |
| **敌军 / FLIR 红** | `--iff-hostile` | `#EF4444` | 热成像白热/黑热反差红、高危敌对单位、武器交火杀伤包络线 |
| **敌军背景色** | `--iff-hostile-dim`| `rgba(239, 68, 68, 0.18)` | 敌方雷达侦搜扇区、导弹威胁区半透明填充 |
| **中立 / 空域天蓝** | `--iff-neutral` | `#38BDF8` | 国际民航走廊、中立监视哨、非交战区域电子信标 |
| **未知 / 态势告警** | `--iff-unknown` | `#FACC15` | 未经 IFF 应答的空中/水下接触、雷达虚警、待确认目标 |

#### 2.1.4 状态分级遥测 (System Telemetry Status)

```css
--stat-nominal:  #22C55E; /* SYSTEM READY / GPS FIX 3D / UHF SECURE */
--stat-advisory: #38BDF8; /* INTEL RECEIVED / SATELLITE HANDSHAKE */
--stat-warning:  #E5A93C; /* JAMMING DETECTED / FUEL BINGO / CONTACT PENDING */
--stat-threat:   #EF4444; /* MISSILE LAUNCH DETECTED / CAS ENGAGING */
--stat-critical: #E11D48; /* LINK LOST / OUTPOST BREACH / CASUALTY ALERT */
```

---

### 2.2 浅色军用纸图模式（Tactical Topo Paper — 测绘指挥版）

针对室外强光作业、推演报告导出与作战地图打印，系统支持一键切换至**北约北约规范纸质军用测绘图（NATO Paper Map Board）**：

| Token | 浅色测绘纸图 (`[data-theme="light"]`) | 测绘设计准则说明 |
| :--- | :--- | :--- |
| `--bg-void` | `#D2D8DF` | 战术图版金属压条与背景台面 |
| `--bg-base` | `#E3E8EE` | 标准测绘厚磅微黄防水图纸底色 |
| `--bg-surface` | `rgba(255, 255, 255, 0.94)` | 透明麦拉膜 (Mylar Overlay) 与指挥便签浮板 |
| `--line-default` | `rgba(30, 41, 59, 0.28)` | 测绘方里网主格线（深蓝灰） |
| `--text-primary`| `#0F172A` | 激光高精打印级近黑碳素墨色 |
| `--text-secondary`| `#334155` | 辅助战术标号与等高线高程数值 |
| `--accent` | `#C27803` | 测绘用深琥珀水性标定记号笔色 |
| `--iff-friend` | `#15803D` | 经典军标深丛林绿（带 1px 黑色硬描边加固） |
| `--iff-hostile` | `#DC2626` | 经典军标高对比火红（带 1px 黑色硬描边加固） |
| **等高线测绘色** | `#854D27` (棕褐主干) / `#A3663C` (支线) | 严苛遵循军用陆图规范，彻底杜绝浅蓝绿等高线 |

---

### 2.3 现代战争排版与字体阶梯（Typography & Stencils）

MW 的 UI 极具冲击力的关键在于其**全大写、紧凑、冷峻的军工字体系**：

```css
/* 字体族定义 */
--font-header:  "Chakra Petch", "Rajdhani", "DIN Alternate", "Barlow Condensed", sans-serif;
--font-tele:    "JetBrains Mono", "Share Tech Mono", "IBM Plex Mono", monospace;
--font-sans:    "Inter", "HarmonyOS Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif;

/* 字体特性设定：强制开启等宽对齐与大写间距 */
.telemetry-numeric {
  font-family: var(--font-tele);
  font-variant-numeric: tabular-nums lining-nums;
  letter-spacing: 0.04em;
}

.tactical-title {
  font-family: var(--font-header);
  text-transform: uppercase;
  letter-spacing: 0.12em;
  font-weight: 700;
}
```

#### 字号与标定比例

| 级数 | 尺寸 / 行高 | 字体族 | 战术应用场景 |
| :--- | :--- | :--- | :--- |
| `--text-2xs` | `10px / 12px` | `var(--font-tele)` | MGRS 坐标读数、密位刻度标、传感器信号强度噪点 |
| `--text-xs` | `11px / 14px` | `var(--font-tele)` | 模块前缀序列号 (`// SEC-02`)、兵种代号、IFF 状态芯片 |
| `--text-sm` | `12px / 16px` | `var(--font-sans)` | 单位列表、军用装备规格、任务简报正文 |
| `--text-md` | `14px / 20px` | `var(--font-sans)` | 标准交互按钮、对话框输入、详情面板说明 |
| `--text-lg` | `16px / 22px` | `var(--font-header)`| 子模块一级标题、武器站型号 (`M1A2 SEPv3`) |
| `--text-xl` | `20px / 24px` | `var(--font-header)`| 主情报栏标题、敌情最高威胁标识、战术行动代号 |
| `--text-2xl` | `28px / 32px` | `var(--font-tele)` | ZULU 作战母钟、倒计时总指挥表、超视距测距仪直接读数 |

---

## 3. 战术 HUD 机械微结构规范（MIL-SPEC Ornaments）

彻底废除圆润软性的通用 Web 组件特征，采用以下特种装具设计语言：

### 3.1 战术切角结构（Tactical Chamfer 45°）

所有主控制按钮、高亮指示标签以及弹出卡片**严禁使用单纯的大圆角**，采用 45 度倒角切边：

```css
/* 8px 倒角切角剪裁（右上与左下切角） */
.mw-chamfer-corners {
  clip-path: polygon(
    0 0,
    calc(100% - 8px) 0,
    100% 8px,
    100% 100%,
    8px 100%,
    0 calc(100% - 8px)
  );
}

/* 4px 微切角（用于小型标签、按钮） */
.mw-chamfer-sm {
  clip-path: polygon(
    0 0,
    calc(100% - 4px) 0,
    100% 4px,
    100% 100%,
    4px 100%,
    0 calc(100% - 4px)
  );
}
```

### 3.2 瞄准十字与四角标尺（Reticles & Corner Brackets）

重要视窗、情报卡片与雷达浮层四角，使用准星对齐符号包裹：

```
⌜                                                                  ⌝
  // TARGET DOSSIER: ENEMY COMMAND POST [CP-NORTH]
  GRID: 38T LP 41250 87310       ELEV: 242M       RANGE: 3,420M
⌞                                                                  ⌟
```

- **实现规范**：通过 CSS `::before` 与 `::after` 伪元素实现 6px × 6px 的 1.5px 硬朗直角边线，常态为 `--line-default`，激活锁定态转为 `--accent`。
- **交叉点十字刻度 (`+`)**：在视口中央、小地图网格交点处标注 1px 细线十字标尺。

### 3.3 战术点阵与机械刻度底纹（Dot Matrix & Stippling）

为面板与视窗注入物理装具质感，消除数字虚拟感：

```css
/* 面板极弱 16px 间距微型金属点阵背景 */
.mw-tactical-grid-bg {
  background-image: radial-gradient(rgba(148, 163, 184, 0.12) 1px, transparent 1px);
  background-size: 16px 16px;
}

/* 边缘精密刻度尺（模拟激光测距标尺，每 10px 一刻度） */
.mw-scale-ticks-x {
  background-image: repeating-linear-gradient(
    to right,
    var(--line-default) 0px,
    var(--line-default) 1px,
    transparent 1px,
    transparent 8px
  );
  height: 4px;
}
```

### 3.4 模块编号前缀法（Military Taxonomy Serial Prefixes）

所有模块与功能按钮禁止孤立出现，必须附带**北约战术序列编号**：
- 工具栏图标：`[M-01 // SELECT]`、`[M-02 // PAN]`、`[M-03 // SYM-OP]`、`[M-04 // STRIKE]`
- 情报面板栏目：`SEC.01 // UNIT_INTEL`、`SEC.02 // FORCE_BALANCE`、`SEC.03 // EVENT_COMMS`
- 顶栏状态：`SYS.LINK: 98.4% // UHF_CHAN: 04 // LATENCY: 12ms`

---

## 4. 全局交互布局框架（C4ISR Layout）

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│ [TOPBAR] ◈ TF-141 // VISUALMAP C4ISR  ::  OPERATION PHANTOM DART [PHASE 02]          │
│ 14:38:02.12 ZULU  T+01:45:19  |  LINK: NOMINAL (99.8%)  |  THREAT: 04 HIGH  | [EXPORT]│
├───────┬──────────────────────────────────────────────────────────────────┬───────────┤
│ [M]   │                                                                  │ [INTEL]   │
│ 战术  │                    [TACVIEW 主地图全景视窗]                       │ 战术情报  │
│ 装备轨│                                                                  │ 侧栏      │
│ 52px  │   ┌──────────────┐                            ┌──────────────┐   │ 360px     │
│       │   │  UAV 迷你雷达 │                            │  360°方位标尺 │   │           │
│ 01 SEL│   └──────────────┘                            └──────────────┘   │ 单位档案  │
│ 02 PAN│                                                                  │           │
│ 03 SYM│                                                                  │ 火力包线  │
│ 04 CAS│                                                                  │           │
│ 05 LOS│                                                                  │ 通联日志  │
│       │   [MGRS 准星追踪: 38TLP 8492 3120]   [SCALE: 1:25,000 / 1KM]      │           │
├───────┴──────────────────────────────────────────────────────────────────┴───────────┤
│ [TIMELINE] 战术推演指挥轴 (72px / 展开 220px)                                         │
│ [ ⏮ ] [ ◀◀ ] [ ▶ PLAY ] [ ▶▶ ] [ ⏭ ]  ───[PHASE 1]───◆─────●──────[PHASE 2]──────   │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

### 4.1 顶部指挥栏 TopBar (高度 48px)
- **视觉风格**：深墨色底盘 (`#0B0E13`)，底缘 1px 细线 (`--line-default`)，两端配备 45° 倒角。
- **内容布局**：
  - **左区**：战术部队徽标 + 代号 `TF-141 // VISUALMAP` + 任务状态卡 (`OPERATION PHANTOM DART`)。
  - **中区**：全等宽数字显示的 **ZULU 零时区母钟** (`14:38:02.12Z`) + **任务计时** (`T+01:45:19`) + **多路威胁计数芯片** (`THREAT LEVEL: CRITICAL [04]`)。
  - **右区**：功能按钮组采用纯线框/反差实心琥珀色，坚决移除 Emoji，代以战术字样与线框矢量图标。

### 4.2 左侧战术装备轨 ToolRail (宽度 52px，展开 260px)
- **视觉风格**：极简垂直硬质装具栏，每个按钮是一个独立的 40px × 40px 战术凹槽卡扣。
- **状态表现**：
  - 常态：`#14181F` 底，图标与文字为 `--text-muted`。
  - 悬停：背景轻微提亮，边缘亮起 1px 琥珀微光。
  - 激活（Active）：**左缘点亮 3px 纯战术琥珀色竖条，整体背景呈现 20% 琥珀透明度，图标变为高对比琥珀金**。
  - 快捷键提示：右下角小字等宽标注快捷键 `[V]`、`[H]`、`[U]`、`[G]`。

### 4.3 右侧情报侧栏 IntelPanel (标准宽 360px)
- 仿照《现代战争》武器改装与单兵特勤档案布局（Gunsmith / Operator Dossier）：
  - **标签头 (Tabs)**：矩形硬朗分段器。激活标签呈实心琥珀金 (`#E5A93C`) 填充，文本反白为纯黑 (`#080A0D`)，形成极强的目视聚焦感。
  - **单位档案卡**：
    - 顶部为兵种 MIL-STD-2525 军标高清线框徽标 + 所属编队代号 (`TF-141 / 2nd RANGER BN`)。
    - 战术指标（生命值、弹药量、燃油余量、士气）：**采用 MW 枪械属性式的十段式细长矩形充能条**，而非圆滑连续进度条；低于 3 格自动闪烁红色告警。
    - 动态遥测列表：航向角 (`HDG 048°`)、航速 (`SPD 45 KTS`)、高度 (`ALT 2,400M AGL`)，全部以高对比等宽数字排列。

### 4.4 底部推演时间轴 Timeline (默认 72px)
- **视觉风格**：声纳控制台式水平轨道，带有 10 秒/1 分钟等分刻度线。
- **推演事件标记**：菱形关键帧标记（友军行动=绿色菱形，遭遇敌火=红色倒三角，阶段转换=琥珀实心矩形）。
- **倍速切换芯片**：`[0.5X] [1.0X] [2.0X] [4.0X] [MAX]`，支持快捷微调。

---

## 5. 地图与态势图形渲染规范（Warzone TacMap Style）

### 5.1 底图与战场环境

1. **MW 战术黑区模式 (Tactical Blackout - 默认)**：
   - 陆地：`#11151C`（深冷枪灰）
   - 水系/海洋：`#090C10`（极暗吸光黑蓝）
   - 道路网络：`#1F2733`（极细高对比实线）
   - 建筑与高密区：微小几何多边形 `#18202A`，带有 1px 浅灰色外边缘。
2. **FLIR 热成像模式 (FLIR Thermal White-Hot / Black-Hot)**：
   - 地表呈现灰度反差，所有生命与车辆单位依据热力信号呈现刺眼白色（`#FFFFFF`）或亮热红（`#FF2233`），背景为高对比吸光黑。
3. **NVG 夜视仪单色绿模式 (Night Vision Phosphorus)**：
   - 全屏叠加绿磷荧光色调 (`#00FF87` 与 `#0A3319`)，叠加微弱胶片噪点与光学暗角 (Vignette)。

### 5.2 准星指示与网格坐标系统

- **实时动态准星 (Cursor Reticle)**：
  - 鼠标在地图上滑动时，光标由通用系统箭头变为**战术激光环形瞄准具**。
  - 准星侧方浮动附带 2 行微型等宽文本：`MGRS: 38TLP 4125 8731` 与 `ELEV: 128M`。
- **MGRS 方里网刻度**：
  - 视窗边缘固定贴附经纬度与千米方格刻度尺，数字直立排布，不随视角倾斜变形。

### 5.3 军标与战术标号渲染 (MIL-STD-2525D / APP-6D)

军标符号在保持北约标准化框架的同时，融入现代战争的 HUD 投影风格：

```
      [ II ]  (编制：营级)
   ┌─────────┐
   │    ▲    │
   │  /---\  │  (装甲兵图标)
   └─────────┘
  3rd ARMOR BN
  T-72B3 [LOCKED]
```

- **友方单位 (Friendly)**：青绿外框 (`#22C55E`)，内部 15% 绿色通透填充，文字白色加粗。
- **敌方单位 (Hostile)**：菱形火红外框 (`#EF4444`)，内部 20% 暗红填充；当雷达未持续捕获时，转为 4px 虚线轮廓残影态（LKP - Last Known Position），标记超时秒数（`T-180s`）。
- **选中与集火态**：
  - 军标外侧生成四角硬朗瞄准线框，伴随 1px 战术琥珀色聚焦环。
  - 射程圈（Weapon Engagement Zone）采用极细半透明琥珀色虚线旋转微动，杜绝厚重色块遮挡底图。

---

## 6. 基础控件规范（Mil-Spec Controls）

### 6.1 战术按钮组 (Buttons)

所有按钮均配备紧凑外形、全大写字体以及明显的机械悬停状态：

```css
/* MW 标志主按钮 (Primary Action) */
.btn-tactical-primary {
  height: 34px;
  background: var(--accent);
  color: #080A0D;
  font-family: var(--font-header);
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  border: none;
  clip-path: polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 6px 100%, 0 calc(100% - 6px));
  box-shadow: 0 2px 8px rgba(229, 169, 60, 0.35);
  transition: all 80ms ease-out;
}

.btn-tactical-primary:hover {
  background: var(--accent-bright);
  box-shadow: 0 0 14px rgba(229, 169, 60, 0.65);
  transform: translateY(-1px);
}

.btn-tactical-primary:active {
  background: var(--accent-dim);
  transform: translateY(1px);
}

/* MW 次级战术按钮 (Secondary / Wireframe) */
.btn-tactical-wire {
  height: 34px;
  background: rgba(20, 24, 31, 0.85);
  color: var(--text-primary);
  border: 1px solid var(--line-bold);
  font-family: var(--font-header);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  clip-path: polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 6px 100%, 0 calc(100% - 6px));
}

.btn-tactical-wire:hover {
  border-color: var(--accent);
  color: var(--accent);
  background: rgba(229, 169, 60, 0.12);
}
```

### 6.2 遥测数据分段条 (Segmented Telemetry Gauges)

在生命值、弹药储备、通信信噪比显示中，严禁使用整条平滑过渡条，改用军事装备分格仪表：

```html
<!-- 10格战术分段条规范 -->
<div class="mw-gauge" data-level="8">
  <span class="pip active"></span>
  <span class="pip active"></span>
  <span class="pip active"></span>
  <span class="pip active"></span>
  <span class="pip active"></span>
  <span class="pip active"></span>
  <span class="pip active"></span>
  <span class="pip active"></span>
  <span class="pip"></span>
  <span class="pip"></span>
  <span class="gauge-value">80% // NOMINAL</span>
</div>
```

```css
.mw-gauge {
  display: flex;
  align-items: center;
  gap: 3px;
}
.mw-gauge .pip {
  flex: 1;
  height: 8px;
  background: var(--bg-surface-elev);
  border: 1px solid var(--line-ghost);
}
.mw-gauge .pip.active {
  background: var(--accent);
  box-shadow: 0 0 4px rgba(229, 169, 60, 0.4);
}
.mw-gauge[data-status="danger"] .pip.active {
  background: var(--stat-threat);
  box-shadow: 0 0 4px rgba(239, 68, 68, 0.5);
}
```

### 6.3 战术警报横幅与视界提示 (Alerts & Warnings)

告警根据危急程度分为 3 级，且包含全屏边缘战术响应：

| 级别 | 视觉形态 | 声光动效匹配 | 消除规则 |
| :--- | :--- | :--- | :--- |
| **DEFCON 3 (提示)** | 左缘琥珀细线，顶部滑动出 32px 黑色卡片 | 短促单音“咔哒”机械声 | 4s 自动退场 |
| **DEFCON 2 (预警)** | 琥珀色 2px 全框闪烁，附带 MGRS 扇区闪烁标 | 双音急促提示 | 需操作员鼠标点击 |
| **DEFCON 1 (致命/交火)** | **视窗四周泛起极薄 8px 暗红光晕内阴影，告警框以 1.2Hz 硬切频闪烁** | 连续三联警报频闪 | 必须手动确认或威胁解除 |

---

## 7. 动效与交互微反馈（Tactical Motion Engine）

MW 风格的动效核心原则是**“硬、脆、快”**，模拟特种作战手持加固终端与光电设备的瞬间响应，绝无拖泥带水的缓动：

```css
:root {
  /* 现代战争机械响应曲线 */
  --ease-tactical-snap: cubic-bezier(0.05, 0.9, 0.1, 1.0); /* 极速弹停 */
  --ease-tactical-in:   cubic-bezier(0.3, 0, 0.8, 0.15);   /* 瞬时收回 */

  /* 严苛时间阶梯 */
  --time-snap:   70ms;  /* 按钮卡扣、复选框、准星微动 */
  --time-fast:   140ms; /* 标签切换、面板抽屉滑动 */
  --time-normal: 220ms; /* 大窗开合、全图层模式过渡 */
}
```

- **无衰减硬切原则**：能用即时渲染（0ms）表达的开关状态，绝不用 300ms 的淡入淡出。
- **支持无障碍 Reduced Motion**：当检测到 `prefers-reduced-motion` 时，关闭任何光学平移与闪烁，直接保留高对比稳态显示。

---

## 8. CSS 核心 Token 完整落地代码（theme.css 替换基准）

以下为直接可编译并应用于前端工程的完整现代战争 CSS 变量表：

```css
/* ==========================================================================
   VISUALMAP // TACVIEW — CALL OF DUTY: MODERN WARFARE MIL-SPEC DESIGN TOKENS
   Version: 2.0 (Tactical Dark Overhaul)
   ========================================================================== */

:root,
[data-theme="dark"] {
  /* --- 基础装甲色与材质 --- */
  --bg-void:          #080A0D;
  --bg-base:          #0E1116;
  --bg-surface:       #14181F;
  --bg-surface-elev:  #1B212B;
  --bg-surface-high:  #242C38;

  --bg-panel:         rgba(16, 20, 26, 0.94);
  --bg-panel-solid:   #13171F;
  --bg-hover:         rgba(229, 169, 60, 0.12);
  --bg-active:        rgba(229, 169, 60, 0.22);

  /* --- 机械边线与准星刻度 --- */
  --line-ghost:       rgba(148, 163, 184, 0.12);
  --line-subtle:      rgba(148, 163, 184, 0.18);
  --line-default:     rgba(148, 163, 184, 0.28);
  --line-bold:        rgba(148, 163, 184, 0.50);
  --line-accent:      #E5A93C;

  /* --- 文字与数字遥测色 --- */
  --text-primary:     #F1F5F9;
  --text-secondary:   #94A3B8;
  --text-muted:       #475569;
  --text-accent:      #E5A93C;
  --text-inverse:     #080A0D;

  /* --- MW 标志性战术强调色 --- */
  --accent:           #E5A93C; /* MW Signature Tactical Amber */
  --accent-bright:    #F5B74F;
  --accent-dim:       #99681E;
  --accent-glow:      rgba(229, 169, 60, 0.45);

  /* --- 敌我识别体系 (MIL-STD / NATO) --- */
  --iff-friend:       #22C55E; /* NVG Phosphor Green */
  --iff-friend-dim:   rgba(34, 197, 94, 0.20);
  --iff-hostile:      #EF4444; /* Thermal Threat Red */
  --iff-hostile-dim:  rgba(239, 68, 68, 0.22);
  --iff-neutral:      #38BDF8; /* Air Corridor Cyan */
  --iff-unknown:      #FACC15; /* Suspicious Yellow */

  /* --- 状态体系 --- */
  --status-ok:        #22C55E;
  --status-info:      #38BDF8;
  --status-warn:      #E5A93C;
  --status-danger:    #EF4444;
  --status-critical:  #E11D48;

  /* --- 字体配置 --- */
  --font-header:      "Chakra Petch", "Rajdhani", "DIN Alternate", -apple-system, sans-serif;
  --font-mono:        "JetBrains Mono", "Share Tech Mono", Consolas, monospace;
  --font-ui:          "Inter", "HarmonyOS Sans SC", "PingFang SC", sans-serif;

  /* --- 阴影与微光 --- */
  --shadow-panel:     0 12px 36px rgba(0, 0, 0, 0.75);
  --shadow-focus:     0 0 0 1px var(--accent), 0 0 12px var(--accent-glow);
  --shadow-threat:    0 0 0 1px var(--status-danger), 0 0 16px rgba(239, 68, 68, 0.4);

  /* --- 倒角规范 --- */
  --chamfer-clip:     polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 6px 100%, 0 calc(100% - 6px));
}

/* 浅色测绘纸图模式 */
[data-theme="light"] {
  --bg-void:          #CCD3DC;
  --bg-base:          #E3E8EE;
  --bg-surface:       #F1F5F9;
  --bg-surface-elev:  #FFFFFF;
  --bg-surface-high:  #FFFFFF;

  --bg-panel:         rgba(248, 250, 252, 0.95);
  --bg-panel-solid:   #FFFFFF;
  --bg-hover:         rgba(194, 120, 3, 0.12);
  --bg-active:        rgba(194, 120, 3, 0.22);

  --line-ghost:       rgba(30, 41, 59, 0.10);
  --line-subtle:      rgba(30, 41, 59, 0.16);
  --line-default:     rgba(30, 41, 59, 0.28);
  --line-bold:        rgba(30, 41, 59, 0.55);
  --line-accent:      #B45309;

  --text-primary:     #0F172A;
  --text-secondary:   #334155;
  --text-muted:       #64748B;
  --text-accent:      #B45309;
  --text-inverse:     #FFFFFF;

  --accent:           #B45309;
  --accent-bright:    #D97706;
  --accent-dim:       #78350F;
  --accent-glow:      rgba(180, 83, 9, 0.25);

  --iff-friend:       #15803D;
  --iff-friend-dim:   rgba(21, 128, 61, 0.15);
  --iff-hostile:      #DC2626;
  --iff-hostile-dim:  rgba(220, 38, 38, 0.15);
  --iff-neutral:      #0369A1;
  --iff-unknown:      #CA8A04;

  --status-ok:        #15803D;
  --status-info:      #0369A1;
  --status-warn:      #B45309;
  --status-danger:    #DC2626;
  --status-critical:  #991B1B;

  --shadow-panel:     0 8px 30px rgba(15, 23, 42, 0.15);
  --shadow-focus:     0 0 0 1px var(--accent), 0 0 8px var(--accent-glow);
}
```

---

## 9. 现代战争风格审查与验收清单（Mil-Spec UI Checklist）

开发或审查任何 UI 模块时，对照此清单进行合规性核验：

- [ ] **杜绝 AI 假科技蓝**：暗色模式主色调严禁出现无语义的 `#3FD0FF`、`#5CE1FF` 等高饱和电光蓝光晕。
- [ ] **琥珀聚焦唯一性**：主要交互按钮、选中项、操作完成态必须统一使用 **MW 战术琥珀色 (`#E5A93C`)**。
- [ ] **严禁通用 Emoji**：界面中一律不使用操作系统 Emoji 字符，必须替换为精准的 1px 战术几何线框矢量图标或北约代号。
- [ ] **硬朗几何切角**：主浮动卡片、弹窗与按钮采用 45° 倒角 (`chamfer`) 或直角，禁用任何大于 6px 的圆角。
- [ ] **战术序列前缀**：所有模块、列表和功能键必须配备类似 `// SEC-01`、`SYS.REF`、`[U]` 格式的严谨军规标定编号。
- [ ] **数字等宽排布**：所有坐标 (MGRS/UTM)、时间 (ZULU/MET)、速度、高度数值必须声明等宽字体与 `font-variant-numeric: tabular-nums`。
- [ ] **物理机械质感**：面板背景具备抗反光点阵或微刻度，消除单调空洞的纯色块。
- [ ] **状态分格仪表**：属性条采用 10 段细长矩形机械分格（Gauges），杜绝圆头无级滑条。
