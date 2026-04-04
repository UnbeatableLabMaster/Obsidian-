import { App, Setting, PluginSettingTab } from "obsidian";
import type TaskKanbanPlugin from "./main";

export interface VirtualCard {
  id: string; title: string; column: string; order: string;
  pinnedOrder?: string; archived?: boolean; archiveCycle?: string; pinned?: boolean;
  body?: string;
  progressValue?: string;
  targetFolder?: string;
}

export interface ValueStyle {
  val: string; bg: string; bgOpacity: number; text: string; fontSize: number;
  fontWeight: string; borderColor: string; borderWidth: number; radius: number;
}

export interface GlobalMetaStyle {
  bgColor: string; bgOpacity: number; textColor: string; fontSize: number;
  fontWeight: string; borderColor: string; borderWidth: number; radius: number; valueStyles: ValueStyle[];
}

export interface MetaTagConfig {
  id: string; type: 'order' | 'ctime' | 'project' | 'progress' | 'custom';
  propKey: string; name: string; enabled: boolean; align: 'left' | 'right';
}

export interface ViewConfig {
  id: string;
  name: string;
  groupByProperty: string;
  icon?: string;
}

/** v1.0.3: 子视图 —— 视图组内的单个看板视图 */
export interface SubView {
  id: string;
  name: string;
  groupByProperty: string;
}

/** v1.0.3: 视图组 —— 对应 bases 侧边栏的一个视图入口，内含多个子视图 */
export interface ViewGroup {
  id: string;
  name: string;
  views: SubView[];
  currentSubViewId: string;
}

export interface PluginSettings {
  defaultGroupBy: string;

  // ── v1.0.3: 视图组管理 ──
  viewGroups: ViewGroup[];
  currentGroupId: string;

  // ── v1.0.2: 视图切换（保留，兼容旧数据迁移）──
  savedViews: ViewConfig[];
  currentViewId: string;

  // ── 操作交互 ──
  dragLocked: boolean;
  dragDelay: number;

  // ── 视图界面布局 ──
  globalHiddenColumns: string[];
  hiddenColumns: Record<string, string[]>;

  // 动画与视觉
  progressBarDisplay: string;       // none | simple | animated
  progressBarColor: string;         // hex 颜色，默认跟随主题
  progressBarAnimStyle: string;     // stripes | shine | pulse（animated 时）
  progressBarSpeed: number;         // 动画频率 0.1~2.0 秒（越小越快）
  pinnedDisplayAnimation: string;   // slide | fade | scale
  styleCompletedCards: boolean;
  fadeBackground: boolean;          // 拖拽时突出选中（其他内容淡化）
  showGhostBorder: boolean;
  ghostBorderStyle: string;         // dashed | filled（淡紫色填充）
  animationDuration: number;
  animationStyle: string;

  // ── 任务属性管理 ──
  // 任务管理
  projectProperty: string;
  uncategorizedName: string;
  // 任务阶段序号
  defaultOrderProperty: string;
  orderPrefix: string;
  orderMiddleProperty: string;
  orderSeparator: string;
  orderFormat: string;
  pinnedOrderProperty: string;
  pinnedOrderPrefix: string;
  pinnedOrderSeparator: string;
  pinnedOrderFormat: string;
  // 简易编号标签
  orderBadgePrefix: string;
  orderBadgeStyle: string;          // hash | no_dot | ordinal（1st/2nd）| number
  // stageProperty 管理
  stageProperty: string;
  stageValues: Array<{ val: string; orderNumMap: Record<string, string> }>;
  // 任务进度
  progressProperty: string;
  progressCompletedValue: string;
  progressUncheckedValue: string;
  progressDraftValue: string;

  // ── 其他（保留字段，暂不开放配置） ──
  pinnedProperty: string;
  archiveProperty: string;
  archiveCycleProperty: string;
  customSortProperty: string;
  showCardPath: boolean;
  dateFormat: string;
  archivedColumns: Record<string, string[]>;
  archivedColumnMeta: Record<string, { originView: string; duration: string }>;
  columnSortDir: Record<string, 'asc' | 'desc'>;
  expandedPinnedCols: Record<string, string[]>;
  defaultNewNoteFolder: string;
  defaultNewNoteProps: Array<{ key: string; val: string }>;
  columnWidths: Record<string, number>;
  columnOrders: Record<string, string[]>;
  cardAliases: Record<string, string>;
  autoNumberGroups: string[];
  progressSyncGroups: string[];
  virtualCards: VirtualCard[];
  viewMetaConfigs: Record<string, MetaTagConfig[]>;
  pinnedMetaConfigs: Record<string, MetaTagConfig[]>;
  globalMetaStyles: Record<string, GlobalMetaStyle>;
}

export const DEFAULT_SETTINGS: PluginSettings = {
  defaultGroupBy: "status",

  viewGroups: [
    {
      id: "group-1",
      name: "任务管理",
      currentSubViewId: "sub-1",
      views: [
        { id: "sub-1", name: "任务状态", groupByProperty: "status" },
        { id: "sub-2", name: "任务进度", groupByProperty: "任务执行情况" },
        { id: "sub-3", name: "所属项目", groupByProperty: "任务所属项目" }
      ]
    }
  ],
  currentGroupId: "group-1",

  savedViews: [
    { id: "view-1", name: "任务状态", groupByProperty: "status" },
    { id: "view-2", name: "任务进度", groupByProperty: "任务执行情况" },
    { id: "view-3", name: "所属项目", groupByProperty: "任务所属项目" }
  ],
  currentViewId: "view-1",

  dragLocked: false,
  dragDelay: 50,

  globalHiddenColumns: [],
  hiddenColumns: {},

  progressBarDisplay: "animated",
  progressBarColor: "",
  progressBarAnimStyle: "stripes",
  progressBarSpeed: 0.9,
  pinnedDisplayAnimation: "slide",
  styleCompletedCards: false,
  fadeBackground: true,
  showGhostBorder: true,
  ghostBorderStyle: "dashed",
  animationDuration: 200,
  animationStyle: "smooth",

  projectProperty: "任务所属项目",
  uncategorizedName: "待分类",
  defaultOrderProperty: "任务所处阶段",
  orderPrefix: "",
  orderMiddleProperty: "",
  orderSeparator: "-",
  orderFormat: "padded",
  pinnedOrderProperty: "任务阶段总结",
  pinnedOrderPrefix: "",
  pinnedOrderSeparator: "-",
  pinnedOrderFormat: "padded",
  orderBadgePrefix: "#",
  orderBadgeStyle: "hash",
  stageProperty: "任务所处阶段",
  stageValues: [],
  progressProperty: "任务执行情况",
  progressCompletedValue: "已完成",
  progressUncheckedValue: "暂搁置",
  progressDraftValue: "待计划",

  pinnedProperty: "任务核心总结",
  archiveProperty: "任务归档状态",
  archiveCycleProperty: "任务完成周期",
  customSortProperty: "",
  showCardPath: false,
  dateFormat: "YYYY-MM-DD",
  archivedColumns: {},
  archivedColumnMeta: {},
  columnSortDir: {},
  expandedPinnedCols: {},
  defaultNewNoteFolder: "",
  defaultNewNoteProps: [],
  columnWidths: {},
  columnOrders: {},
  cardAliases: {},
  autoNumberGroups: [],
  progressSyncGroups: [],
  virtualCards: [],
  viewMetaConfigs: {},
  pinnedMetaConfigs: {},
  globalMetaStyles: {},
};

// ─── 辅助：创建带左侧缩进线的子组容器 ───────────────────────────
function createSubGroup(parent: HTMLElement, extraStyle = ""): HTMLElement {
  const g = parent.createDiv();
  g.style.cssText = `padding-left:18px;border-left:2px solid var(--background-modifier-border);margin:2px 0 10px 12px;${extraStyle}`;
  return g;
}

// ─── 辅助：一级模块标题（大字加粗）────────────────────────────────
function sectionH2(parent: HTMLElement, text: string): HTMLElement {
  const el = parent.createEl("h2", { text });
  el.style.cssText = "margin-top:36px;margin-bottom:8px;padding-bottom:6px;border-bottom:2px solid var(--background-modifier-border);font-size:1.3em;font-weight:700;";
  return el;
}

// ─── 辅助：二级标题 ───────────────────────────────────────────────
function sectionH3(parent: HTMLElement, text: string): HTMLElement {
  const el = parent.createEl("h3", { text });
  el.style.cssText = "margin-top:20px;margin-bottom:6px;padding-bottom:4px;border-bottom:1px solid var(--background-modifier-border);font-size:1em;font-weight:600;";
  return el;
}

function sectionH4(parent: HTMLElement, text: string): HTMLElement {
  const el = parent.createEl("h4", { text });
  el.style.cssText = "margin-top:14px;margin-bottom:4px;color:var(--text-muted);font-size:12px;text-transform:uppercase;letter-spacing:.05em;";
  return el;
}

function desc(parent: HTMLElement, text: string) {
  parent.createEl("p", { text, attr: { style: "font-size:12px;color:var(--text-faint);margin:0 0 8px 0;line-height:1.5;" } });
}

// ─── 辅助：标签 chip ─────────────────────────────────────────────
function chip(parent: HTMLElement, text: string) {
  const span = parent.createEl("span", { text });
  span.style.cssText = "display:inline-block;padding:1px 7px;border-radius:10px;font-size:11px;background:rgba(var(--interactive-accent-rgb),.12);color:var(--interactive-accent);margin:2px 3px 2px 0;";
  return span;
}

export class TaskKanbanSettingTab extends PluginSettingTab {
  plugin: TaskKanbanPlugin;
  constructor(app: App, plugin: TaskKanbanPlugin) { super(app, plugin); this.plugin = plugin; }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    const s = this.plugin.settings;
    const save = async (refresh = false) => {
      await this.plugin.saveSettings(false);
      if (refresh) this.plugin.refreshAllKanbanViews();
    };

    // ════════════════════════════════════════════════════════════
    // 1. 任务属性管理
    // ════════════════════════════════════════════════════════════
    sectionH2(containerEl, "任务属性管理");

    // ── 1.1 任务的项目属性设置（二级标题）────────────────────────
    sectionH3(containerEl, "任务的项目属性设置");

    // 第一行：属性名称输入框
    new Setting(containerEl)
      .setName("属性名称")
      .setDesc("视图分组与项目环节功能以此属性为基准，对应看板中每一竖列即为一个项目环节。写入笔记 frontmatter 时记录任务在所属项目环节中的排列序号，格式：前缀 - 项目环节 - 序号。")
      .addText(t => { t.setValue(s.defaultOrderProperty).onChange(async v => { s.defaultOrderProperty = v.trim() || "任务所处阶段"; await save(); }); t.inputEl.style.width = "180px"; });

    // 第二~四行：缩进子组——前缀、分隔符、序号格式
    {
      const stageSub = createSubGroup(containerEl);

      new Setting(stageSub)
        .setName("类型前缀")
        .setDesc("写入属性值时加在最前面，例如 task、project。留空则不加前缀。")
        .addText(t => { t.setPlaceholder("例：task").setValue(s.orderPrefix).onChange(async v => { s.orderPrefix = v.trim(); await save(); updatePreview(); }); t.inputEl.style.width = "120px"; });

      new Setting(stageSub)
        .setName("分隔符")
        .addText(t => { t.setValue(s.orderSeparator).onChange(async v => { s.orderSeparator = v || "-"; await save(); updatePreview(); }); t.inputEl.style.width = "60px"; });

      new Setting(stageSub)
        .setName("序号后缀格式")
        .addDropdown(d => {
          d.addOption("number", "纯数字  (1, 2, 3)");
          d.addOption("padded", "补零数字  (01, 02, 03)");
          d.addOption("upper_letter", "大写字母  (A, B, C)");
          d.addOption("lower_letter", "小写字母  (a, b, c)");
          d.addOption("upper_roman", "大写罗马  (I, II, III)");
          d.addOption("lower_roman", "小写罗马  (i, ii, iii)");
          d.setValue(s.orderFormat);
          d.onChange(async v => { s.orderFormat = v; await save(); updatePreview(); });
        });

      // 第五行：简易编号标签（缩进）
      new Setting(stageSub)
        .setName("简易编号标签风格")
        .setDesc("卡片上显示该任务在当前列中的序号，抛弃完整格式，直接呈现简洁序号。")
        .addDropdown(d => {
          d.addOption("hash",    "#01  #02  #03");
          d.addOption("no_dot",  "No.1  No.2  No.3");
          d.addOption("ordinal", "1st  2nd  3rd");
          d.addOption("number",  "1  2  3（纯数字）");
          d.setValue(s.orderBadgeStyle);
          d.onChange(async v => { s.orderBadgeStyle = v; await save(); updatePreview(); });
        });

      // 第六行：属性值完整格式预览 + 建议编号预览
      const previewBox = stageSub.createDiv();
      previewBox.style.cssText = "margin-top:10px;padding:10px 14px;background:var(--background-secondary);border-radius:6px;border:1px solid var(--background-modifier-border);";
      previewBox.createEl("div", { text: "实时预览", attr: { style: "font-size:12px;font-weight:600;color:var(--text-muted);margin-bottom:8px;" } });

      const rowFull = previewBox.createDiv(); rowFull.style.cssText = "font-size:11px;color:var(--text-normal);margin-bottom:4px;display:flex;gap:6px;align-items:center;";
      rowFull.createSpan({ text: "属性值完整格式：" });
      const valFull = rowFull.createEl("code"); valFull.style.cssText = "color:var(--interactive-accent);background:rgba(var(--interactive-accent-rgb),.08);padding:1px 6px;border-radius:4px;";

      const rowBadge = previewBox.createDiv(); rowBadge.style.cssText = "font-size:11px;color:var(--text-normal);display:flex;gap:6px;align-items:center;";
      rowBadge.createSpan({ text: "简易编号示例：" });
      const valBadge = rowBadge.createEl("code"); valBadge.style.cssText = "color:var(--interactive-accent);background:rgba(var(--interactive-accent-rgb),.08);padding:1px 6px;border-radius:4px;";

      const updatePreview = () => {
        const prefix = s.orderPrefix || "";
        const sep = s.orderSeparator || "-";
        const fmt = s.orderFormat || "padded";
        let numSuffix = "01";
        if (fmt === "number") numSuffix = "1";
        else if (fmt === "padded") numSuffix = "01";
        else if (fmt === "upper_letter") numSuffix = "A";
        else if (fmt === "lower_letter") numSuffix = "a";
        else if (fmt === "upper_roman") numSuffix = "I";
        else if (fmt === "lower_roman") numSuffix = "i";
        const parts: string[] = [];
        if (prefix) parts.push(prefix);
        parts.push("示例项目");
        parts.push(numSuffix);
        valFull.textContent = parts.join(sep);

        const bdStyle = s.orderBadgeStyle || "hash";
        let bdEx = "#01";
        if (bdStyle === "hash") bdEx = "#01";
        else if (bdStyle === "no_dot") bdEx = "No.1";
        else if (bdStyle === "ordinal") bdEx = "1st";
        else if (bdStyle === "number") bdEx = "1";
        valBadge.textContent = bdEx;
      };
      updatePreview();
    }

    // 第七行（原第六）：未分类列名——独立 Setting，不缩进
    new Setting(containerEl)
      .setName("无项目属性卡片的归属列")
      .setDesc("属性值为空时卡片所在列的显示名称，例如「待分类」。")
      .addText(t => { t.setValue(s.uncategorizedName).onChange(async v => { s.uncategorizedName = v.trim() || "待分类"; await save(true); }); t.inputEl.style.width = "140px"; });

    // ── 1.2 任务进度属性设置（二级标题）──────────────────────────
    sectionH3(containerEl, "任务进度属性设置");
    {
      const progWrap = containerEl.createDiv();
      progWrap.style.marginBottom = "2px";
      new Setting(progWrap)
        .setName("属性名称")
        .setDesc("记录任务完成状态的 frontmatter 属性名。")
        .addText(t => { t.setValue(s.progressProperty).onChange(async v => { s.progressProperty = v.trim(); await save(); }); t.inputEl.style.width = "180px"; });

      const progSub = createSubGroup(progWrap);

      new Setting(progSub)
        .setName("勾选（完成）时写入的值")
        .addText(t => { t.setValue(s.progressCompletedValue).onChange(async v => { s.progressCompletedValue = v.trim(); await save(); }); t.inputEl.style.width = "140px"; });

      new Setting(progSub)
        .setName("取消勾选时退回的值")
        .addText(t => { t.setValue(s.progressUncheckedValue).onChange(async v => { s.progressUncheckedValue = v.trim(); await save(); }); t.inputEl.style.width = "140px"; });

      new Setting(progSub)
        .setName("草稿卡片对应的值")
        .setDesc("新建草稿或草稿转笔记时，进度属性自动写入此值。")
        .addText(t => { t.setValue(s.progressDraftValue).onChange(async v => { s.progressDraftValue = v.trim() || "待计划"; await save(); }); t.inputEl.style.width = "140px"; });
    }

    // ════════════════════════════════════════════════════════════
    // 2. 笔记创建设置
    // ════════════════════════════════════════════════════════════
    sectionH2(containerEl, "笔记创建设置");
    {
      const placeholder = containerEl.createDiv();
      placeholder.style.cssText = "background:var(--background-secondary);border:1px dashed var(--background-modifier-border);border-radius:8px;padding:20px 24px;color:var(--text-faint);font-size:13px;line-height:1.7;";
      placeholder.createEl("div", { text: "🚧  即将推出", attr: { style: "font-weight:600;font-size:14px;color:var(--text-muted);margin-bottom:6px;" } });
      placeholder.createEl("div", { text: "此板块将包含：" });
      const ul = placeholder.createEl("ul"); ul.style.cssText = "margin:4px 0 0 16px;padding:0;";
      ["新建笔记的默认存放目录", "创建时自动附加的额外属性（如标签、日期）", "笔记命名模板"].forEach(t => ul.createEl("li", { text: t, attr: { style: "margin:2px 0;" } }));
    }

    // ════════════════════════════════════════════════════════════
    // 3. 视图界面布局
    // ════════════════════════════════════════════════════════════
    sectionH2(containerEl, "视图界面布局");

    // ── 3.1 全局列表隐藏（二级标题）─────────────────────────────
    sectionH3(containerEl, "全局列表隐藏");
    desc(containerEl, "添加列名后，该列在所有视图中永久隐藏，与视图内临时隐藏相互独立。点击输入框可从已知列名中快速选择。");
    this.renderGlobalHiddenCols(containerEl, s, save);

    // ── 3.2 列头进度条（二级标题）───────────────────────────────
    sectionH3(containerEl, "列头进度条");
    {
      const sg = createSubGroup(containerEl);

      new Setting(sg).setName("动画样式").addDropdown(d => {
        d.addOption("none", "隐藏");
        d.addOption("simple", "纯色静态");
        d.addOption("stripes", "波浪条纹");
        d.addOption("shine", "流光扫过");
        d.addOption("both", "条纹 + 流光叠加");
        d.addOption("pulse", "脉冲闪烁");
        // 兼容旧值 "animated"
        const curVal = s.progressBarDisplay === "animated" ? (s.progressBarAnimStyle || "stripes") : s.progressBarDisplay;
        d.setValue(curVal);
        d.onChange(async v => {
          if (v === "none" || v === "simple") {
            s.progressBarDisplay = v;
          } else {
            s.progressBarDisplay = "animated";
            s.progressBarAnimStyle = v;
          }
          await save(true);
          speedRow.style.display = (v === "none" || v === "simple") ? "none" : "";
        });
        speedRow.style.display = (curVal === "none" || curVal === "simple") ? "none" : "";
      });

      const speedRow = sg.createDiv();
      new Setting(speedRow)
        .setName("动画频率")
        .setDesc("数值越小动画越快（0.1 ~ 2.0 秒）。")
        .addSlider(sl => sl.setLimits(0.1, 2.0, 0.1).setValue(s.progressBarSpeed).setDynamicTooltip()
          .onChange(async v => { s.progressBarSpeed = v; await save(true); }))
        .addExtraButton(btn => btn.setIcon("reset").setTooltip("重置为 1.0 秒").onClick(async () => {
          s.progressBarSpeed = 1.0; await save(true); this.display();
        }));
    }

    // ── 3.3 置顶区展开动画 ──────────────────────────────────────
    new Setting(containerEl)
      .setName("置顶区展开动画")
      .addDropdown(d => {
        d.addOption("slide", "推入推出（从顶部向下挤开）");
        d.addOption("fade", "淡入淡出（附带位移）");
        d.addOption("scale", "缩放展开（从顶部边缘）");
        d.setValue(s.pinnedDisplayAnimation);
        d.onChange(async v => { s.pinnedDisplayAnimation = v; await save(); });
      });

    // ── 3.4 已勾选卡片 ──────────────────────────────────────────
    new Setting(containerEl)
      .setName("已勾选卡片淡化与文字划线")
      .setDesc("开启后，已完成的卡片将半透明显示，标题加删除线。")
      .addToggle(t => t.setValue(s.styleCompletedCards).onChange(async v => { s.styleCompletedCards = v; await save(true); }));

    // ── 3.5 拖拽时突出选中内容 ──────────────────────────────────
    new Setting(containerEl)
      .setName("拖拽时突出选中内容")
      .setDesc("开启后，拖拽期间被拖动的卡片/列保持原样，其他内容作为背景淡化。")
      .addToggle(t => t.setValue(s.fadeBackground).onChange(async v => { s.fadeBackground = v; await save(true); }));

    // ── 3.6 拖拽提示框 ──────────────────────────────────────────
    {
      const ghostWrap = containerEl.createDiv();
      ghostWrap.style.marginBottom = "2px";
      new Setting(ghostWrap)
        .setName("显示拖拽插入提示框")
        .setDesc("拖拽时在可插入位置显示提示标记。")
        .addToggle(t => t.setValue(s.showGhostBorder).onChange(async v => {
          s.showGhostBorder = v; await save(true);
          ghostStyleSub.style.display = v ? "" : "none";
        }));
      const ghostStyleSub = createSubGroup(ghostWrap);
      ghostStyleSub.style.display = s.showGhostBorder ? "" : "none";
      new Setting(ghostStyleSub).setName("提示框样式").addDropdown(d => {
        d.addOption("dashed", "虚线框");
        d.addOption("filled", "淡紫色填充框");
        d.setValue(s.ghostBorderStyle);
        d.onChange(async v => { s.ghostBorderStyle = v; await save(true); });
      });
    }

    // ════════════════════════════════════════════════════════════
    // 4. 操作与交互
    // ════════════════════════════════════════════════════════════
    sectionH2(containerEl, "操作与交互");

    new Setting(containerEl)
      .setName("全局拖拽锁定")
      .setDesc("开启后禁止拖动任何卡片和列表，防止浏览时误触乱序。")
      .addToggle(t => t.setValue(s.dragLocked).onChange(async v => { s.dragLocked = v; await save(true); }));

    new Setting(containerEl)
      .setName("拖拽触发延迟（毫秒）")
      .setDesc("按住多少毫秒后才触发拖拽，设为 0 即按下立刻触发。当前版本延迟设置需重新打开看板生效。")
      .addSlider(sl => sl.setLimits(0, 300, 10).setValue(s.dragDelay).setDynamicTooltip()
        .onChange(async v => { s.dragDelay = v; await save(); }));
  }

  // ─────────────────────────────────────────────────────────────
  // 全局列表隐藏（带下拉候选）
  // ─────────────────────────────────────────────────────────────
  private renderGlobalHiddenCols(containerEl: HTMLElement, s: PluginSettings, save: (r?: boolean) => Promise<void>) {
    // 收集所有已知列名
    const knownCols = new Set<string>();
    Object.values(s.columnOrders || {}).forEach(cols => cols.forEach(c => knownCols.add(c)));
    Object.values(s.hiddenColumns || {}).forEach(cols => cols.forEach(c => knownCols.add(c)));
    knownCols.add(s.uncategorizedName || "待分类");
    (s.globalHiddenColumns || []).forEach(c => knownCols.add(c));
    const candidates = Array.from(knownCols).filter(Boolean);

    const wrapper = containerEl.createDiv();
    wrapper.style.cssText = "background:var(--background-secondary);border:1px solid var(--background-modifier-border);border-radius:8px;padding:12px 16px;margin-bottom:10px;";

    // 已隐藏的列 chips
    const tagsRow = wrapper.createDiv();
    tagsRow.style.cssText = "display:flex;flex-wrap:wrap;gap:4px;min-height:24px;margin-bottom:8px;";

    const renderTags = () => {
      tagsRow.empty();
      if ((s.globalHiddenColumns || []).length === 0) {
        tagsRow.createEl("span", { text: "暂无隐藏列", attr: { style: "font-size:12px;color:var(--text-faint);line-height:24px;" } });
        return;
      }
      (s.globalHiddenColumns || []).forEach((col, i) => {
        const tag = tagsRow.createDiv();
        tag.style.cssText = "display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:12px;background:rgba(var(--interactive-accent-rgb),.12);border:1px solid rgba(var(--interactive-accent-rgb),.25);font-size:12px;color:var(--interactive-accent);";
        tag.createSpan({ text: col });
        const rm = tag.createEl("span", { text: "×", attr: { style: "cursor:pointer;font-size:14px;line-height:1;margin-left:2px;opacity:.7;" } });
        rm.onclick = async () => {
          s.globalHiddenColumns.splice(i, 1);
          await save(true); renderTags();
        };
      });
    };
    renderTags();

    // 输入框 + 候选下拉
    const inputRow = wrapper.createDiv(); inputRow.style.cssText = "position:relative;";
    const input = inputRow.createEl("input", { type: "text", placeholder: "输入或选择要隐藏的列名…" });
    input.style.cssText = "width:100%;padding:6px 10px;border:1px solid var(--background-modifier-border);border-radius:6px;background:var(--background-primary);color:var(--text-normal);font-size:13px;box-sizing:border-box;";

    const dropdown = inputRow.createDiv();
    dropdown.style.cssText = "display:none;position:absolute;top:calc(100% + 2px);left:0;right:0;background:var(--background-primary);border:1px solid var(--background-modifier-border);border-radius:6px;box-shadow:0 4px 16px rgba(0,0,0,.12);z-index:1000;max-height:180px;overflow-y:auto;";

    const renderDropdown = (query: string) => {
      dropdown.empty();
      const already = new Set(s.globalHiddenColumns || []);
      const filtered = candidates.filter(c => !already.has(c) && c.toLowerCase().includes(query.toLowerCase()));
      if (filtered.length === 0 && !query) { dropdown.style.display = "none"; return; }
      dropdown.style.display = "";
      filtered.forEach(col => {
        const opt = dropdown.createDiv({ text: col });
        opt.style.cssText = "padding:8px 12px;cursor:pointer;font-size:13px;transition:background .15s;";
        opt.onmouseenter = () => { opt.style.background = "var(--background-secondary)"; };
        opt.onmouseleave = () => { opt.style.background = ""; };
        opt.onmousedown = async (e) => {
          e.preventDefault();
          if (!s.globalHiddenColumns) s.globalHiddenColumns = [];
          if (!s.globalHiddenColumns.includes(col)) { s.globalHiddenColumns.push(col); await save(true); renderTags(); }
          input.value = ""; dropdown.style.display = "none";
        };
      });
      // 允许直接添加未在候选中的自定义值
      if (query && !filtered.includes(query)) {
        const custom = dropdown.createDiv({ text: `添加「${query}」` });
        custom.style.cssText = "padding:8px 12px;cursor:pointer;font-size:13px;color:var(--interactive-accent);border-top:1px solid var(--background-modifier-border);";
        custom.onmouseenter = () => { custom.style.background = "var(--background-secondary)"; };
        custom.onmouseleave = () => { custom.style.background = ""; };
        custom.onmousedown = async (e) => {
          e.preventDefault();
          if (!s.globalHiddenColumns) s.globalHiddenColumns = [];
          if (!s.globalHiddenColumns.includes(query)) { s.globalHiddenColumns.push(query); await save(true); renderTags(); }
          input.value = ""; dropdown.style.display = "none";
        };
      }
    };

    input.onfocus = () => renderDropdown(input.value);
    input.oninput = () => renderDropdown(input.value);
    input.onblur = () => { setTimeout(() => { dropdown.style.display = "none"; }, 150); };
    input.onkeydown = (e: KeyboardEvent) => {
      if (e.key === "Enter" && input.value.trim()) {
        const v = input.value.trim();
        if (!s.globalHiddenColumns) s.globalHiddenColumns = [];
        if (!s.globalHiddenColumns.includes(v)) { s.globalHiddenColumns.push(v); save(true).then(() => renderTags()); }
        input.value = ""; dropdown.style.display = "none"; e.preventDefault();
      }
      if (e.key === "Escape") { dropdown.style.display = "none"; input.blur(); }
    };
  }
}
