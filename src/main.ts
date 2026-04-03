import { Plugin, TFile, Modal, Setting, Notice, Menu, App } from "obsidian";
import * as obsidian from "obsidian";
import Sortable from "sortablejs";
import { TaskKanbanSettingTab, PluginSettings, DEFAULT_SETTINGS, MetaTagConfig, GlobalMetaStyle } from "./settings";

const BasesView = (obsidian as any).BasesView;

/* ========================================================= */
/* 🌟 防崩溃悬浮提示引擎 */
/* ========================================================= */
const addTooltip = (el: HTMLElement, text: string, delay: number = 500) => {
    try {
        if (typeof (obsidian as any).setTooltip === 'function') { (obsidian as any).setTooltip(el, text, { delay }); }
        else if (typeof (el as any).setTooltip === 'function') { (el as any).setTooltip(text, { delay }); }
        else { el.setAttribute("title", text); }
    } catch(e) { el.setAttribute("title", text); }
};

/* ========================================================= */
/* 🌟 核心引擎 */
/* ========================================================= */
const toRoman = (num: number, isLower: boolean) => { let val = Math.floor(num); if (val <= 0 || val >= 4000) return String(num); const map: [number, string][] = [ [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'] ]; let res = ''; for (const [a, r] of map) { while (val >= a) { res += r; val -= a; } } const dec = num - Math.floor(num); if (dec > 0) res += '.' + String(dec).split('.')[1]; return isLower ? res.toLowerCase() : res; };
const fromRoman = (str: string) => { const s = str.toUpperCase(); const map: Record<string, number> = { I:1, V:5, X:10, L:50, C:100, D:500, M:1000 }; let num = 0; for (let i = 0; i < s.length; i++) { const curr = map[s[i]] || 0; const next = map[s[i+1]] || 0; if (curr < next) num -= curr; else num += curr; } return num; };
const toLetter = (num: number, isLower: boolean) => { let val = Math.floor(num); if (val <= 0) return String(num); let res = ""; while (val > 0) { val--; res = String.fromCharCode(65 + (val % 26)) + res; val = Math.floor(val / 26); } const dec = num - Math.floor(num); if (dec > 0) res += '.' + String(dec).split('.')[1]; return isLower ? res.toLowerCase() : res; };
const fromLetter = (str: string) => { const s = str.toUpperCase(); let num = 0; for (let i = 0; i < s.length; i++) { const code = s.charCodeAt(i); if (code >= 65 && code <= 90) num = num * 26 + (code - 64); } return num; };
const formatOrderSuffix = (num: number, format: string) => { if (format === 'padded') { const numPart = Math.floor(num).toString().padStart(2, "0"); const decPart = num % 1 !== 0 ? String(num).slice(String(num).indexOf('.')) : ""; return numPart + decPart; } if (format === 'upper_letter') return toLetter(num, false); if (format === 'lower_letter') return toLetter(num, true); if (format === 'upper_roman') return toRoman(num, false); if (format === 'lower_roman') return toRoman(num, true); return String(num); };
const parseOrderSuffix = (str: string, format: string): number => { if (!str) return 0; const parts = str.split('.'); const intPart = parts[0]; const decPart = parts[1] || ''; let num = 0; if (format.includes('letter')) num = fromLetter(intPart); else if (format.includes('roman')) num = fromRoman(intPart); else num = parseFloat(intPart) || 0; if (decPart) num += parseFloat('0.' + decPart); return num; };
const extractSortNumber = (val: any, format: string, separator: string): number => { if (val === undefined || val === null) return 0; const str = Array.isArray(val) ? String(val[0]) : String(val); const sep = separator || '-'; const parts = str.split(sep); const lastPart = parts[parts.length - 1]; if (!lastPart) return 0; if (format === 'number' || format === 'padded') { const matches = str.match(/\d+(\.\d+)?/g); if (matches) return parseFloat(matches[matches.length - 1]); return 0; } return parseOrderSuffix(lastPart, format); };
const sanitizeVal = (val: any): string => { if (val === undefined || val === null) return ""; const s = String(Array.isArray(val) ? val[0] : val).trim(); if (s.toLowerCase() === "null" || s.toLowerCase() === "undefined") return ""; return s; };
const getRealProp = (prop: any): string => { if (!prop || typeof prop !== 'string') return ""; return prop.startsWith("note.") ? prop.slice(5) : prop; };
const hexToRgba = (hex: string, opacity: number) => { if (!hex || !hex.startsWith('#')) return hex; let r = parseInt(hex.slice(1, 3), 16) || 0; let g = parseInt(hex.slice(3, 5), 16) || 0; let b = parseInt(hex.slice(5, 7), 16) || 0; return `rgba(${r}, ${g}, ${b}, ${opacity / 100})`; };

/* ========================================================= */
/* 🌟 增强创建弹窗（支持文件夹配置 + 额外属性编辑） */
/* ========================================================= */
interface PropDef { key: string; val: string | boolean; type: 'text' | 'list' | 'checkbox'; editable?: boolean; }

class RichCreateModal extends Modal {
    fileName: string = "";
    folderPath: string = "";
    titleElNode!: HTMLElement;
    extraProps: Array<{ key: string; val: string }> = [];

    constructor(
        app: App,
        private modalTitle: string,
        private propsDef: PropDef[],
        private isVirtual: boolean,
        private defaultFolder: string,
        private defaultExtraProps: Array<{ key: string; val: string }>,
        private onSubmit: (result: string, folder: string, extraProps: Array<{ key: string; val: string }>) => void
    ) {
        super(app);
        this.folderPath = defaultFolder;
        this.extraProps = defaultExtraProps.map(p => ({ ...p }));
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.addClass("kanban-create-modal");
        contentEl.createEl("h2", { text: this.modalTitle });

        new Setting(contentEl).setName(this.isVirtual ? "草稿卡片名称" : "笔记名称").addText(text => {
            text.onChange(v => {
                this.fileName = v;
                const displayNode = this.titleElNode.querySelector('.kanban-preview-title-text');
                if (displayNode) displayNode.textContent = v || "未命名";
            }).inputEl.focus();
            text.inputEl.style.width = "100%";
        });

        if (!this.isVirtual) {
            new Setting(contentEl)
                .setName("存放文件夹")
                .setDesc("留空则使用视图同目录，或全局默认设置的路径")
                .addText(text => {
                    text.setPlaceholder("例如：Projects/Tasks").setValue(this.folderPath);
                    text.onChange(v => { this.folderPath = v.trim(); });
                    text.inputEl.style.width = "100%";
                });
        }

        if (this.extraProps.length > 0 || !this.isVirtual) {
            const propsSection = contentEl.createDiv("kanban-create-extra-props");
            propsSection.createEl("div", { text: "额外属性 (可编辑):", cls: "kanban-preview-label" });
            const propsBody = propsSection.createDiv("kanban-extra-props-body");

            const renderExtraProps = () => {
                propsBody.empty();
                this.extraProps.forEach((item, i) => {
                    const row = propsBody.createDiv("kanban-extra-prop-row");
                    const keyIn = row.createEl("input", { type: "text", placeholder: "属性名" }); keyIn.style.width = "40%"; keyIn.value = item.key; keyIn.onchange = () => { this.extraProps[i].key = keyIn.value.trim(); };
                    row.createSpan({ text: " : ", cls: "kanban-extra-prop-sep" });
                    const valIn = row.createEl("input", { type: "text", placeholder: "值" }); valIn.style.width = "40%"; valIn.value = item.val; valIn.onchange = () => { this.extraProps[i].val = valIn.value.trim(); };
                    const delBtn = row.createEl("button", { text: "✕" }); delBtn.style.marginLeft = "8px"; delBtn.onclick = () => { this.extraProps.splice(i, 1); renderExtraProps(); };
                });
                const addBtn = propsBody.createEl("button", { text: "+ 添加属性", cls: "kanban-extra-prop-add" });
                addBtn.onclick = () => { this.extraProps.push({ key: "", val: "" }); renderExtraProps(); };
            };
            renderExtraProps();
        }

        contentEl.createEl("div", { text: "效果预览 (实时渲染):", cls: "kanban-preview-label" });
        const previewBox = contentEl.createDiv("kanban-rich-preview");
        this.titleElNode = previewBox.createDiv("kanban-preview-note-title");
        this.titleElNode.createSpan({ cls: "kanban-preview-title-text", text: "未命名" });
        if (this.isVirtual) this.titleElNode.createSpan({ cls: "kanban-preview-virtual-badge", text: "草稿" });

        if (this.propsDef.length > 0) {
            const propsContainer = previewBox.createDiv("kanban-preview-props");
            this.propsDef.forEach(p => {
                const row = propsContainer.createDiv("kanban-preview-prop-row");
                const keyEl = row.createDiv("kanban-preview-prop-key");
                keyEl.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg> <span>${p.key}</span>`;
                const valEl = row.createDiv("kanban-preview-prop-val");
                if (p.type === 'list') valEl.createDiv({ cls: "kanban-prop-pill", text: String(p.val) || "空" });
                else if (p.type === 'checkbox') { const cb = valEl.createEl("input", { type: "checkbox", cls: "kanban-prop-checkbox" }); cb.checked = p.val === true || p.val === "true"; cb.disabled = true; }
                else valEl.createDiv({ cls: "kanban-prop-text", text: String(p.val) || "空" });
            });
        }

        const btnGroup = contentEl.createDiv("kanban-modal-btns");
        const cancelBtn = btnGroup.createEl("button", { text: "取消" });
        cancelBtn.onclick = () => this.close();
        const submitBtn = btnGroup.createEl("button", { text: "确认创建", cls: "mod-cta" });
        submitBtn.onclick = () => {
            if (!this.fileName.trim()) { new Notice("名称不能为空！"); return; }
            this.close();
            this.onSubmit(this.fileName, this.folderPath, this.extraProps);
        };
        contentEl.addEventListener("keydown", (e: KeyboardEvent) => {
            if (e.key === "Enter" && !(e.target as HTMLElement).matches('input, textarea')) {
                if (!this.fileName.trim()) { new Notice("名称不能为空！"); return; }
                this.close();
                this.onSubmit(this.fileName, this.folderPath, this.extraProps);
            }
        });
    }
    onClose() { this.contentEl.empty(); }
}

/* ========================================================= */
/* 🌟 标签配置面板 */
/* ========================================================= */
class MetaConfigModal extends Modal {
    normalConfigs: MetaTagConfig[]; pinnedConfigs: MetaTagConfig[];
    activeTab: 'normal' | 'pinned' = 'normal'; sortableInstance: any = null;
    listContainer!: HTMLElement; listBody!: HTMLElement; expandedRows: Set<string> = new Set();

    constructor(app: App, private plugin: TaskKanbanPlugin, private viewId: string, private onSave: () => void) {
        super(app);
        const existingNormal = this.plugin.settings.viewMetaConfigs[this.viewId];
        if (existingNormal && existingNormal.length > 0) { this.normalConfigs = existingNormal.map((c: any) => ({ ...c })); }
        else { this.normalConfigs = [ { id: 'order', type: 'order', propKey: '', name: '任务阶段(简写)', enabled: true, align: 'left' }, { id: 'ctime', type: 'ctime', propKey: '', name: '创建时间', enabled: true, align: 'left' }, { id: 'project', type: 'project', propKey: '', name: '所属项目', enabled: true, align: 'right' }, { id: 'progress', type: 'progress', propKey: '', name: '任务进度', enabled: true, align: 'right' } ]; }

        const existingPinned = this.plugin.settings.pinnedMetaConfigs[this.viewId];
        if (existingPinned && existingPinned.length > 0) { this.pinnedConfigs = existingPinned.map((c: any) => ({ ...c })); }
        else { this.pinnedConfigs = [ { id: 'order', type: 'order', propKey: '', name: '任务阶段(简写)', enabled: true, align: 'left' }, { id: 'ctime', type: 'ctime', propKey: '', name: '创建时间', enabled: true, align: 'left' }, { id: 'project', type: 'project', propKey: '', name: '所属项目', enabled: true, align: 'right' } ]; }

        if (!this.normalConfigs.find(c => c.type === 'order')) this.normalConfigs.unshift({ id: 'order', type: 'order', propKey: '', name: '任务阶段(简写)', enabled: true, align: 'left' });
        if (!this.pinnedConfigs.find(c => c.type === 'order')) this.pinnedConfigs.unshift({ id: 'order', type: 'order', propKey: '', name: '任务阶段(简写)', enabled: true, align: 'left' });
    }

    onOpen() {
        const { contentEl } = this; contentEl.addClass("kanban-meta-modal");
        const datalist = contentEl.createEl("datalist", { attr: { id: "kanban-obsidian-properties" } });
        if ((this.app.metadataCache as any).getAllPropertyInfos) { const props = (this.app.metadataCache as any).getAllPropertyInfos(); Object.keys(props).forEach(p => datalist.createEl("option", { value: p })); }

        const headerArea = contentEl.createDiv({ cls: "kanban-meta-header-area" });
        headerArea.createEl("h2", { text: "卡片属性展示配置", cls: "kanban-meta-title" });

        const tabsContainer = headerArea.createDiv("kanban-meta-tabs");
        const normalTab = tabsContainer.createDiv({ cls: "kanban-meta-tab is-active", text: "常规区标签" });
        const pinnedTab = tabsContainer.createDiv({ cls: "kanban-meta-tab", text: "总结区标签" });

        normalTab.onclick = () => { this.activeTab = 'normal'; normalTab.addClass("is-active"); pinnedTab.removeClass("is-active"); this.renderList(); };
        pinnedTab.onclick = () => { this.activeTab = 'pinned'; pinnedTab.addClass("is-active"); normalTab.removeClass("is-active"); this.renderList(); };

        contentEl.createEl("p", { text: "颜色、边框等高级UI样式设置在全库打通，只需修改一次即全局生效。", cls: "kanban-meta-desc" });
        this.listContainer = contentEl.createDiv("kanban-meta-list");
        const headerRow = this.listContainer.createDiv("kanban-meta-header"); headerRow.createDiv({ text: "", cls: "kanban-meta-col-handle" }); headerRow.createDiv({ text: "启用", cls: "kanban-meta-col-toggle" }); headerRow.createDiv({ text: "区域", cls: "kanban-meta-col-align" }); headerRow.createDiv({ text: "配置", cls: "kanban-meta-col-expand" }); headerRow.createDiv({ text: "属性源", cls: "kanban-meta-col-name" }); headerRow.createDiv({ text: "删除", cls: "kanban-meta-col-delete" });
        this.listBody = this.listContainer.createDiv("kanban-meta-list-body"); this.renderList();

        const addBtn = contentEl.createEl("button", { text: "+ 新增显示属性", cls: "kanban-meta-add-btn" });
        addBtn.onclick = () => {
            const currentConfigs = this.activeTab === 'normal' ? this.normalConfigs : this.pinnedConfigs;
            currentConfigs.push({ id: `custom_${Date.now()}`, type: 'custom', propKey: '', name: '', enabled: true, align: 'right' });
            this.renderList();
        };
        const btnGroup = contentEl.createDiv("kanban-modal-btns"); const cancelBtn = btnGroup.createEl("button", { text: "取消" }); cancelBtn.onclick = () => this.close();
        const submitBtn = btnGroup.createEl("button", { text: "保存配置", cls: "mod-cta" }); submitBtn.onclick = async () => {
            this.plugin.settings.viewMetaConfigs[this.viewId] = this.normalConfigs;
            this.plugin.settings.pinnedMetaConfigs[this.viewId] = this.pinnedConfigs;
            await this.plugin.saveSettings(false); this.onSave(); this.close();
        };
    }

    renderList() {
        this.listBody.empty(); if (this.sortableInstance) { this.sortableInstance.destroy(); this.sortableInstance = null; }
        const currentConfigs = this.activeTab === 'normal' ? this.normalConfigs : this.pinnedConfigs;

        currentConfigs.forEach((conf, index) => {
            const effectiveKey = conf.type === 'custom' ? conf.propKey : conf.type;
            if (effectiveKey && !this.plugin.settings.globalMetaStyles[effectiveKey]) { this.plugin.settings.globalMetaStyles[effectiveKey] = { bgColor: '#e3e8f8', bgOpacity: 100, textColor: '#4a6eb8', fontSize: 11, fontWeight: 'normal', borderColor: 'transparent', borderWidth: 0, radius: 4, valueStyles: [] }; }
            const gStyle = this.plugin.settings.globalMetaStyles[effectiveKey] || { bgColor: '#f0f0f0', bgOpacity: 100, textColor: '#666666', fontSize: 11, fontWeight: 'normal', borderColor: 'transparent', borderWidth: 0, radius: 4, valueStyles: [] };
            const wrapper = this.listBody.createDiv("kanban-meta-row-wrapper"); wrapper.dataset.id = conf.id; const row = wrapper.createDiv("kanban-meta-row");
            const handle = row.createDiv("kanban-meta-handle kanban-meta-col-handle"); handle.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><circle cx="9" cy="12" r="1"></circle><circle cx="9" cy="5" r="1"></circle><circle cx="9" cy="19" r="1"></circle><circle cx="15" cy="12" r="1"></circle><circle cx="15" cy="5" r="1"></circle><circle cx="15" cy="19" r="1"></circle></svg>`;
            const toggleWrap = row.createDiv("kanban-meta-col-toggle"); const toggle = toggleWrap.createEl("input", { type: "checkbox", cls: "kanban-meta-toggle" }); toggle.checked = conf.enabled; toggle.onchange = () => conf.enabled = toggle.checked;
            const alignWrap = row.createDiv("kanban-meta-col-align"); const alignSelect = alignWrap.createEl("select", { cls: "kanban-meta-align" }); alignSelect.createEl("option", { value: "left", text: "居左" }); alignSelect.createEl("option", { value: "right", text: "居右" }); alignSelect.value = conf.align || 'left'; alignSelect.onchange = () => conf.align = alignSelect.value as 'left' | 'right';
            const expandWrap = row.createDiv("kanban-meta-col-expand"); const expandBtn = expandWrap.createDiv("kanban-meta-btn kanban-meta-expand-btn"); const isExpanded = this.expandedRows.has(conf.id); expandBtn.innerHTML = isExpanded ? `<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><polyline points="6 9 12 15 18 9"></polyline></svg>` : `<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><polyline points="9 6 15 12 9 18"></polyline></svg>`;

            const nameWrap = row.createDiv("kanban-meta-col-name");
            if (conf.type === 'custom') {
                if (!conf.propKey) {
                    const inputsWrapper = nameWrap.createDiv("kanban-meta-inputs"); inputsWrapper.innerHTML = `<svg class="kanban-meta-left-arrow" viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2" fill="none"><polyline points="6 9 12 15 18 9"></polyline></svg>`;
                    const propInput = inputsWrapper.createEl("input", { type: "text", cls: "kanban-meta-input", placeholder: "键入属性名..." }); propInput.setAttribute("list", "kanban-obsidian-properties"); propInput.value = conf.propKey; propInput.onchange = () => { conf.propKey = propInput.value; conf.name = propInput.value; this.renderList(); };
                } else {
                    const propInput = nameWrap.createEl("input", { type: "text", cls: "kanban-meta-input is-established", title: "点击修改" }); propInput.setAttribute("list", "kanban-obsidian-properties"); propInput.value = conf.propKey; propInput.onchange = () => { conf.propKey = propInput.value; conf.name = propInput.value; this.renderList(); };
                }
            } else if (conf.type === 'order') {
                const propInput = nameWrap.createEl("input", { type: "text", cls: "kanban-meta-input is-established", title: "修改标签别名" });
                propInput.value = conf.name; propInput.onchange = () => { conf.name = propInput.value; this.renderList(); };
            } else { nameWrap.createDiv({ cls: "kanban-meta-name-text", text: conf.name }); }

            const actionDelWrap = row.createDiv("kanban-meta-col-delete"); const delBtn = actionDelWrap.createDiv("kanban-meta-btn kanban-meta-delete-btn"); delBtn.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`;

            if (conf.type === 'ctime' || conf.type === 'order') {
                delBtn.style.opacity = '0.1'; delBtn.style.cursor = 'not-allowed';
            } else {
                delBtn.onclick = () => { currentConfigs.splice(index, 1); this.renderList(); };
            }

            const mappingArea = wrapper.createDiv("kanban-meta-mappings"); if (!isExpanded || !effectiveKey) mappingArea.style.display = "none";
            expandBtn.onclick = () => { if (!effectiveKey) { new Notice("请先输入有效的属性名！"); return; } if (this.expandedRows.has(conf.id)) { this.expandedRows.delete(conf.id); expandBtn.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><polyline points="9 6 15 12 9 18"></polyline></svg>`; mappingArea.style.display = "none"; } else { this.expandedRows.add(conf.id); expandBtn.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><polyline points="6 9 12 15 18 9"></polyline></svg>`; mappingArea.style.display = "flex"; } };

            const renderStyleEditor = (styleObj: any, isDefault: boolean, onDelete?: () => void) => {
                const rowWrap = mappingArea.createDiv("kanban-meta-mapping-row"); if (isDefault) rowWrap.addClass("default-color-row");
                if (isDefault) { rowWrap.createSpan({ text: "默认全局样式(未匹配): ", cls: "kanban-meta-small-label" }); } else { const valInput = rowWrap.createEl("input", { type: "text", cls: "kanban-meta-input kanban-meta-val-input", placeholder: "输入匹配值" }); valInput.value = styleObj.val || ""; valInput.onchange = () => styleObj.val = valInput.value; }
                const styleBox = rowWrap.createDiv("kanban-style-editor-box");
                const borderGroup = styleBox.createDiv("kanban-style-group"); borderGroup.createSpan({text: "边框", cls: "kanban-style-label"}); const bcInput = borderGroup.createEl("input", { type: "color", cls: "kanban-meta-color", title: "边框颜色" }); bcInput.value = styleObj.borderColor || "#000000"; bcInput.onchange = () => styleObj.borderColor = bcInput.value; const bwInput = borderGroup.createEl("input", { type: "number", cls: "kanban-meta-number-input", title: "粗细(px)" }); bwInput.value = String(styleObj.borderWidth || 0); bwInput.onchange = () => styleObj.borderWidth = Number(bwInput.value) || 0; const radInput = borderGroup.createEl("input", { type: "number", cls: "kanban-meta-number-input", title: "圆角(px)" }); radInput.value = String(styleObj.radius !== undefined ? styleObj.radius : 4); radInput.onchange = () => styleObj.radius = Number(radInput.value) || 0;
                const bgGroup = styleBox.createDiv("kanban-style-group"); bgGroup.createSpan({text: "背景", cls: "kanban-style-label"}); const bgInput = bgGroup.createEl("input", { type: "color", cls: "kanban-meta-color" }); bgInput.value = styleObj.bgColor || styleObj.bg || "#e3e8f8"; bgInput.onchange = () => { if(isDefault) styleObj.bgColor = bgInput.value; else styleObj.bg = bgInput.value; }; const bgOpInput = bgGroup.createEl("input", { type: "number", cls: "kanban-meta-number-input", title: "透明度(0-100)" }); bgOpInput.value = String(styleObj.bgOpacity !== undefined ? styleObj.bgOpacity : 100); bgOpInput.onchange = () => styleObj.bgOpacity = Number(bgOpInput.value) || 0;
                const fontGroup = styleBox.createDiv("kanban-style-group"); fontGroup.createSpan({text: "字体", cls: "kanban-style-label"}); const txtInput = fontGroup.createEl("input", { type: "color", cls: "kanban-meta-color" }); txtInput.value = styleObj.textColor || styleObj.text || "#4a6eb8"; txtInput.onchange = () => { if(isDefault) styleObj.textColor = txtInput.value; else styleObj.text = txtInput.value; }; const fsInput = fontGroup.createEl("input", { type: "number", cls: "kanban-meta-number-input", title: "大小(px)" }); fsInput.value = String(styleObj.fontSize || 11); fsInput.onchange = () => styleObj.fontSize = Number(fsInput.value) || 11; const fwSelect = fontGroup.createEl("select", { cls: "kanban-meta-align", attr: {style: "width: auto; padding: 2px 4px !important; height: 24px !important;"} }); fwSelect.createEl("option", { value: "normal", text: "常规" }); fwSelect.createEl("option", { value: "bold", text: "加粗" }); fwSelect.value = styleObj.fontWeight || "normal"; fwSelect.onchange = () => styleObj.fontWeight = fwSelect.value;
                if (!isDefault && onDelete) { const delBtn = rowWrap.createDiv("kanban-meta-btn kanban-meta-delete-btn"); delBtn.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`; delBtn.onclick = onDelete; }
            };

            const renderMappings = () => {
                mappingArea.empty(); const globalStyleRef = this.plugin.settings.globalMetaStyles[effectiveKey]; if (!globalStyleRef) return; renderStyleEditor(globalStyleRef, true);
                globalStyleRef.valueStyles.forEach((vc, vcIdx) => { renderStyleEditor(vc, false, () => { globalStyleRef.valueStyles.splice(vcIdx, 1); renderMappings(); }); });
                const addBtnWrap = mappingArea.createDiv("kanban-meta-mapping-row"); const addBtn = addBtnWrap.createEl("button", { text: "+ 添加特定值样式", cls: "kanban-meta-add-mapping-btn" });
                addBtn.onclick = () => { globalStyleRef.valueStyles.push({ val: "", bg: globalStyleRef.bgColor, bgOpacity: globalStyleRef.bgOpacity, text: globalStyleRef.textColor, fontSize: globalStyleRef.fontSize, fontWeight: globalStyleRef.fontWeight, borderColor: globalStyleRef.borderColor, borderWidth: globalStyleRef.borderWidth, radius: globalStyleRef.radius }); renderMappings(); };
            };
            if (effectiveKey) renderMappings();
        });
        this.sortableInstance = new Sortable(this.listBody, { handle: '.kanban-meta-handle', animation: 150, onEnd: (evt: any) => { const currentConfigs = this.activeTab === 'normal' ? this.normalConfigs : this.pinnedConfigs; const moved = currentConfigs.splice(evt.oldIndex, 1)[0]; currentConfigs.splice(evt.newIndex, 0, moved); } });
    }
    onClose() { if (this.sortableInstance) this.sortableInstance.destroy(); this.contentEl.empty(); }
}

class PromptModal extends Modal {
    constructor(app: App, private title: string, private onSubmit: (result: string) => void) { super(app); }
    onOpen() {
        const { contentEl } = this; contentEl.createEl("h3", { text: this.title }); let result = "";
        new Setting(contentEl).addText((text: any) => text.onChange((value: string) => result = value).inputEl.focus());
        new Setting(contentEl).addButton((btn: any) => btn.setButtonText("确认").setCta().onClick(() => { this.close(); this.onSubmit(result); }));
        contentEl.addEventListener("keydown", (e: KeyboardEvent) => { if (e.key === "Enter") { this.close(); this.onSubmit(result); } });
    }
    onClose() { this.contentEl.empty(); }
}

class ConfirmModal extends Modal {
    constructor(app: App, private message: string, private onConfirm: () => void, private onCancel?: () => void) { super(app); }
    onOpen() {
        this.contentEl.createEl("h3", { text: "操作确认" });
        this.contentEl.createEl("p", { text: this.message, attr: { style: "white-space: pre-wrap; margin-bottom: 20px; line-height: 1.5; color: var(--text-normal);" } });
        const setting = new Setting(this.contentEl);
        setting.addButton((btn: any) => btn.setButtonText("取消").onClick(() => { this.close(); if (this.onCancel) this.onCancel(); }));
        setting.addButton((btn: any) => btn.setButtonText("确认").setCta().onClick(() => { this.close(); this.onConfirm(); }));
    }
    onClose() { this.contentEl.empty(); }
}

interface CardData {
    type: 'file' | 'virtual'; id: string; title: string; column: string; order: string; pinnedOrder: string;
    isCompleted: boolean; isPinned: boolean; ctime: number; projectValStr: string; progressValStr: string;
    middleValStr: string; customSortValStr: string; customBadges: Record<string, string>; entry?: any;
    body?: string;
}

class KanbanView extends BasesView {
  containerEl: HTMLElement; plugin: TaskKanbanPlugin; boardEl!: HTMLElement; sortables: Sortable[] = []; isDraggingItem: boolean = false;
  savedScroll: { boardX: number, boardY: number, columns: Record<string, number> } = { boardX: 0, boardY: 0, columns: {} };
  isArchivedView: boolean = false; collapsedPinnedCols: Set<string> = new Set();
  isRendering: boolean = false; private _updateTimer: NodeJS.Timeout | null = null;

  selectedCards: Set<string> = new Set();
  lastSelectedCardId: string | null = null;

  constructor(controller: any, scrollEl: HTMLElement, plugin: TaskKanbanPlugin) { super(controller); this.plugin = plugin; this.containerEl = scrollEl.createDiv("kanban-view-container"); }

  requestUpdate() { if (this._updateTimer) clearTimeout(this._updateTimer); this._updateTimer = setTimeout(() => this.onDataUpdated(), 200); }

  // 提取项目环节的中间部分（所属项目）
  private extractMiddlePart(fullValue: string, orderPrefix: string, orderSeparator: string): string {
    if (!fullValue) return fullValue;
    const parts = fullValue.split(orderSeparator);
    if (parts.length >= 2) {
      let middleIndex = 0;
      if (orderPrefix && parts[0] === orderPrefix) {
        // 有前缀：前缀-中间-后缀
        middleIndex = 1;
      }
      if (parts.length > middleIndex) {
        return parts[middleIndex];
      }
    }
    return fullValue; // 不符合格式则返回原值
  }

  updateSelectionUI() {
      this.boardEl?.querySelectorAll('.kanban-card').forEach(el => {
          const id = (el as HTMLElement).dataset.id;
          if (id && this.selectedCards.has(id)) el.addClass('is-selected');
          else el.removeClass('is-selected');
      });
  }

  onDataUpdated() {
    if (this.isRendering) return; this.isRendering = true;
    try {
        if (this.boardEl) {
            this.savedScroll.boardX = this.boardEl.scrollLeft; this.savedScroll.boardY = this.boardEl.scrollTop;
            this.boardEl.querySelectorAll(".kanban-column-content, .kanban-pinned-wrapper").forEach(el => { const colId = (el as HTMLElement).dataset.colId; if (colId) this.savedScroll.columns[colId] = el.scrollTop; });
        }
        this.containerEl.empty(); this.sortables.forEach(s => { try { s.destroy(); } catch(e){} }); this.sortables = [];
        this.containerEl.style.setProperty("--kanban-column-width", `${this.plugin.settings.columnWidths || 280}px`);

        this.containerEl.setAttribute('tabindex', '0');
        this.containerEl.addEventListener('click', (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (!target.closest('.kanban-card') && !target.closest('.menu')) {
                this.selectedCards.clear();
                this.lastSelectedCardId = null;
                this.updateSelectionUI();
            }
        });
        this.containerEl.addEventListener('keydown', (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
                if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA' || document.activeElement.hasAttribute('contenteditable'))) return;
                const hoveredCol = this.containerEl.querySelector('.kanban-column:hover');
                const cardsToSelect = hoveredCol ? hoveredCol.querySelectorAll('.kanban-card') : this.containerEl.querySelectorAll('.kanban-card');
                cardsToSelect.forEach((c: Element) => this.selectedCards.add((c as HTMLElement).dataset.id!));
                this.updateSelectionUI();
                e.preventDefault();
            }
        });

        const entries = (this as any).data?.data || [];
        const groupByProp = getRealProp((this as any).config?.getAsPropertyId("groupByProperty") || this.plugin.settings.defaultGroupBy);

        const settings = this.plugin.settings || DEFAULT_SETTINGS;
        const orderProp = settings.defaultOrderProperty || "kanban-order";
        const progPropSetting = settings.progressProperty || "进度";
        const projPropSetting = settings.projectProperty || "项目";
        const progCompVal = settings.progressCompletedValue || "已完成";
        const progUncheckVal = settings.progressUncheckedValue || "待计划";
        // ✅ v1.0.1: 草稿对应的进度列值，从设置中读取
        const progDraftVal = settings.progressDraftValue || "待计划";
        const pBarDisplay = settings.progressBarDisplay || "animated";
        const archiveProp = getRealProp(settings.archiveProperty || "任务归档状态");
        const pinnedProp = getRealProp(settings.pinnedProperty || "任务核心总结");
        const pinnedOrderPropStr = settings.pinnedOrderProperty || "任务阶段总结";

        const yamlGroupProp = groupByProp; const yamlOrderProp = getRealProp(orderProp);
        const yamlProgProp = getRealProp(progPropSetting); const yamlProjProp = getRealProp(projPropSetting); const yamlPinnedOrderProp = getRealProp(pinnedOrderPropStr);

        const orderFormat = settings.orderFormat || "padded"; const orderPrefix = settings.orderPrefix || ""; const orderSeparator = settings.orderSeparator || "-";
        const orderMiddleProp = getRealProp(settings.orderMiddleProperty || ""); const customSortProp = getRealProp(settings.customSortProperty || "");
        const uncategorizedName = settings.uncategorizedName || "待分类"; const isDragLocked = settings.dragLocked === true;

        if (!settings.progressSyncGroups) settings.progressSyncGroups = []; const isProgressSync = settings.progressSyncGroups.includes(groupByProp);
        if (!settings.archivedColumns) settings.archivedColumns = {}; if (!settings.archivedColumns[groupByProp]) settings.archivedColumns[groupByProp] = [];
        if (!settings.archivedColumnMeta) settings.archivedColumnMeta = {}; if (!settings.columnSortDir) settings.columnSortDir = {};
        if (!settings.hiddenColumns) settings.hiddenColumns = {};
        if (!settings.hiddenColumns[groupByProp]) settings.hiddenColumns[groupByProp] = [];

        const viewMetaConfigs = settings.viewMetaConfigs || {}; const pinnedMetaConfigs = settings.pinnedMetaConfigs || {};
        const normalMetaConfigs = viewMetaConfigs[groupByProp] || [ { id: 'order', type: 'order', propKey: '', name: '任务阶段(简写)', enabled: true, align: 'left' }, { id: 'ctime', type: 'ctime', propKey: '', name: '创建时间', enabled: true, align: 'left' } ];
        const activePinnedConfigs = pinnedMetaConfigs[groupByProp] || [ { id: 'order', type: 'order', propKey: '', name: '任务阶段(简写)', enabled: true, align: 'left' }, { id: 'ctime', type: 'ctime', propKey: '', name: '创建时间', enabled: true, align: 'left' } ];

        const allCustomPropKeys = new Set([...normalMetaConfigs, ...activePinnedConfigs].map((c: MetaTagConfig) => c.propKey).filter(k => k));

        const buildOrderValue = (colName: string, middleValStr: string, num: number, isPinnedZone: boolean = false) => {
            const prefix = isPinnedZone ? settings.pinnedOrderPrefix : orderPrefix; const format = isPinnedZone ? settings.pinnedOrderFormat : orderFormat; const sep = isPinnedZone ? settings.pinnedOrderSeparator : orderSeparator;
            const mid = orderMiddleProp ? middleValStr : colName; const numPart = formatOrderSuffix(num, format);
            const parts = []; if (prefix) parts.push(prefix); if (mid) parts.push(mid); parts.push(numPart); return parts.join(sep);
        };

        const getPropsData = (col: string, midVal: string, num: number) => {
            const props: PropDef[] = []; let yaml = ""; const gVal = col === uncategorizedName ? "" : col;
            props.push({ key: yamlGroupProp, val: gVal || "空", type: gVal ? 'list' : 'text' }); yaml += `${yamlGroupProp}: ${gVal}\n`;
            if (isGlobalAuto) { const oVal = buildOrderValue(col, midVal, num); props.push({ key: yamlOrderProp, val: oVal, type: 'list' }); yaml += `${yamlOrderProp}:\n  - ${oVal}\n`; }
            (settings.defaultNewNoteProps || []).forEach(ep => { if (ep.key) { props.push({ key: ep.key, val: ep.val, type: 'text', editable: true }); yaml += `${ep.key}: ${ep.val}\n`; } });
            return { props, yaml };
        };

        const buildYamlWithExtras = (baseYaml: string, extraProps: Array<{ key: string; val: string }>) => {
            let extra = "";
            extraProps.forEach(ep => { if (ep.key) extra += `${ep.key}: ${ep.val}\n`; });
            return baseYaml + extra;
        };

        const rewriteColumnOrder = async (cardsArr: HTMLElement[], targetCol: string, isPinnedZone: boolean) => {
            const targetYamlProp = isPinnedZone ? yamlPinnedOrderProp : yamlOrderProp;
            const dir = (settings.columnSortDir && settings.columnSortDir[targetCol]) || 'asc';
            const total = cardsArr.length;

            for (let i = 0; i < total; i++) {
                const el = cardsArr[i]; const midVal = el.dataset.middleval || "";
                const num = dir === 'desc' ? (total - i) : (i + 1);
                const finalStr = buildOrderValue(targetCol, midVal, num, isPinnedZone);
                el.dataset.order = finalStr;
                if (el.dataset.type === 'virtual') {
                    const vc = settings.virtualCards.find((v:any) => v.id === el.dataset.id);
                    if (vc) { if (isPinnedZone) vc.pinnedOrder = finalStr; else vc.order = finalStr; }
                } else {
                    // 只有开启项目环节开关的视图才更新 frontmatter 中的环节属性
                    if (isGlobalAuto) {
                        const f = this.app.vault.getAbstractFileByPath(el.dataset.id!);
                        if (f instanceof TFile) await this.app.fileManager.processFrontMatter(f, fm => { fm[targetYamlProp] = [finalStr]; });
                    }
                }
            }
            // ✅ v1.0.2 FIX: 不触发 refresh-views，避免拖拽序号写入时引发全板重绘闪烁
            // 最终统一由 onEnd 末尾的 saveSettings(true) 触发一次刷新
            await this.plugin.saveSettings(false);
        };

        const updateProgress = (colId: string) => {
            const columnEl = this.boardEl.querySelector(`.kanban-column[data-col-id="${colId}"]`); if (!columnEl) return;
            const allCards = columnEl.querySelectorAll('.kanban-card:not(.kanban-card-ghost)'); let comp = 0;
            allCards.forEach(c => { if (c.classList.contains('is-completed')) comp++; });
            const countEl = columnEl.querySelector('.kanban-column-count') as HTMLElement; if (countEl) countEl.textContent = `${comp} / ${allCards.length}`;
            const fill = columnEl.querySelector('.kanban-column-progress-fill') as HTMLElement; if (fill) fill.style.width = allCards.length === 0 ? '0%' : `${(comp / allCards.length * 100).toFixed(1)}%`;
        };

        const toolbarEl = this.containerEl.createDiv("kanban-toolbar");
        // toolbarEl.createDiv({ cls: "kanban-prop-info", text: `🗂️ 分组：[ ${yamlGroupProp} ] | 项目：[ ${yamlOrderProp} ]` });
        const toolbarActions = toolbarEl.createDiv("kanban-toolbar-actions");

        const globalAutoNumBtn = toolbarActions.createDiv("kanban-toolbar-btn");
        addTooltip(globalAutoNumBtn, "开启后，拖动卡片时自动更新项目环节属性", 50);
        if (!settings.autoNumberGroups) settings.autoNumberGroups = [];
        const isGlobalAuto = settings.autoNumberGroups.includes(groupByProp);
        if (isGlobalAuto) globalAutoNumBtn.addClass("is-active");
        globalAutoNumBtn.innerHTML = `<span>项目</span>`;
        globalAutoNumBtn.onclick = async () => {
            if (isGlobalAuto) this.plugin.settings.autoNumberGroups = settings.autoNumberGroups.filter((g:any) => g !== groupByProp);
            else this.plugin.settings.autoNumberGroups.push(groupByProp);
            await this.plugin.saveSettings(); this.requestUpdate();
        };

        const progressSyncBtn = toolbarActions.createDiv("kanban-toolbar-btn");
        addTooltip(progressSyncBtn, "开启后，进度视图下跨列拖动时自动更新进度完成状态", 50);
        if (isProgressSync) progressSyncBtn.addClass("is-active");
        progressSyncBtn.innerHTML = `<span>进度</span>`;
        progressSyncBtn.onclick = async () => {
            if (isProgressSync) this.plugin.settings.progressSyncGroups = settings.progressSyncGroups.filter((g:any) => g !== groupByProp);
            else this.plugin.settings.progressSyncGroups.push(groupByProp);
            await this.plugin.saveSettings(); this.requestUpdate();
        };

        const metaConfigBtn = toolbarActions.createDiv("kanban-toolbar-btn");
        addTooltip(metaConfigBtn, "标签配置: 展开面板，自定义要在卡片上显示的属性标签及其样式与位置", 50);
        metaConfigBtn.innerHTML = `<span>标签</span>`;
        metaConfigBtn.onclick = () => { new MetaConfigModal(this.app, this.plugin, groupByProp, () => { this.requestUpdate(); }).open(); };

        const archiveToggleBtn = toolbarActions.createDiv("kanban-toolbar-btn");
        addTooltip(archiveToggleBtn, "归档库: 切换至归档区，查看和恢复已隐藏的笔记", 50);
        if (this.isArchivedView) archiveToggleBtn.addClass("is-active");
        archiveToggleBtn.innerHTML = `<span>归档</span>`;
        archiveToggleBtn.onclick = () => { this.isArchivedView = !this.isArchivedView; this.requestUpdate(); };

        const lockToggleBtn = toolbarActions.createDiv("kanban-toolbar-btn");
        addTooltip(lockToggleBtn, "拖拽锁定: 冻结拖拽功能，防止滑动浏览时误触乱序", 50);
        if (isDragLocked) lockToggleBtn.addClass("is-active");
        lockToggleBtn.innerHTML = `<span>${isDragLocked ? "解锁" : "锁定"}</span>`;
        lockToggleBtn.onclick = async () => { this.plugin.settings.dragLocked = !isDragLocked; await this.plugin.saveSettings(); this.requestUpdate(); };

        const addColTopBtn = toolbarActions.createDiv("kanban-toolbar-btn");
        addTooltip(addColTopBtn, "新增: 在视图最右侧建立一个空白新列", 50);
        addColTopBtn.innerHTML = `<span>新建</span>`;
        addColTopBtn.onclick = () => {
            new PromptModal(this.app, `请输入新列名称`, async (newCol) => {
                if (newCol && newCol.trim()) {
                    const cleanName = newCol.trim();
                    if (!settings.columnOrders[groupByProp]) settings.columnOrders[groupByProp] = [];
                    if (!settings.columnOrders[groupByProp].includes(cleanName)) {
                        this.plugin.settings.columnOrders[groupByProp].push(cleanName);
                        await this.plugin.saveSettings(); this.requestUpdate();
                    } else new Notice("该列已存在！");
                }
            }).open();
        };

        const hiddenCols = settings.hiddenColumns[groupByProp] || [];
        if (hiddenCols.length > 0) {
            const hiddenBadge = toolbarActions.createDiv("kanban-toolbar-btn kanban-hidden-badge");
            hiddenBadge.innerHTML = `<span>已隐藏 ${hiddenCols.length} 列</span>`;
            addTooltip(hiddenBadge, `点击查看并恢复隐藏的列: ${hiddenCols.join(', ')}`, 50);
            hiddenBadge.onclick = () => {
                const menu = new Menu();
                hiddenCols.forEach(colName => {
                    menu.addItem((item: any) => { item.setTitle(`恢复显示: ${colName}`).onClick(async () => { this.plugin.settings.hiddenColumns[groupByProp] = hiddenCols.filter(c => c !== colName); await this.plugin.saveSettings(); this.requestUpdate(); }); });
                });
                menu.addSeparator();
                menu.addItem((item: any) => { item.setTitle("恢复所有隐藏列").onClick(async () => { this.plugin.settings.hiddenColumns[groupByProp] = []; await this.plugin.saveSettings(); this.requestUpdate(); }); });
                const rect = hiddenBadge.getBoundingClientRect();
                menu.showAtPosition({ x: rect.left, y: rect.bottom + 5 });
            };
        }

        let savedCols = this.isArchivedView ? (settings.archivedColumns[groupByProp] || []) : (settings.columnOrders[groupByProp] || []);
        if (savedCols.includes("null")) savedCols = savedCols.filter((c:any) => c !== "null");

        // 如果按项目环节分组，则根据中间部分（所属项目）进行分组
        const useMiddlePartGrouping = groupByProp === yamlOrderProp || groupByProp === yamlProjProp;
        if (useMiddlePartGrouping) {
            // 转换 savedCols：将完整值转换为中间部分，并去重
            const convertedCols = new Set<string>();
            const newSavedCols: string[] = [];
            savedCols.forEach((col: any) => {
                const middlePart = this.extractMiddlePart(col, orderPrefix, orderSeparator);
                if (!convertedCols.has(middlePart)) {
                    convertedCols.add(middlePart);
                    newSavedCols.push(middlePart);
                }
            });
            savedCols = newSavedCols;
        }

        const groups = new Map<string, CardData[]>();
        savedCols.forEach((col:any) => groups.set(col, []));

        entries.forEach((entry: any) => {
            let isArchived = entry.getValue(archiveProp) === true || String(entry.getValue(archiveProp)).toLowerCase() === 'true';
            if (this.isArchivedView && !isArchived) return;
            if (!this.isArchivedView && isArchived) return;

            let val = sanitizeVal(entry.getValue(groupByProp)) || uncategorizedName;
            // 如果按项目环节分组，则提取中间部分作为分组键
            if (useMiddlePartGrouping) {
                val = this.extractMiddlePart(val, orderPrefix, orderSeparator) || uncategorizedName;
            }
            if (!groups.has(val)) { groups.set(val, []); savedCols.push(val); }

            let rawOrder = entry.getValue(orderProp); let finalOrder = sanitizeVal(rawOrder) || "0";
            let rawPinnedOrder = entry.getValue(pinnedOrderPropStr); let finalPinnedOrder = sanitizeVal(rawPinnedOrder) || "0";

            let fileCtime = 0; if (entry.file && entry.file.stat) fileCtime = entry.file.stat.ctime;

            let projStr = sanitizeVal(entry.getValue(projPropSetting)); let progStr = sanitizeVal(entry.getValue(progPropSetting));
            let middleValStr = sanitizeVal(orderMiddleProp ? entry.getValue(orderMiddleProp) : ""); let customSortValStr = sanitizeVal(customSortProp ? entry.getValue(customSortProp) : "");
            let pinnedStatus = entry.getValue(pinnedProp) === true || String(entry.getValue(pinnedProp)).toLowerCase() === 'true';

            let customBadgesData: Record<string, string> = {};
            allCustomPropKeys.forEach(k => { customBadgesData[k] = sanitizeVal(entry.getValue(k)); });

            let isCardCompleted = progPropSetting && progCompVal && progStr === progCompVal;

            groups.get(val)!.push({
                type: 'file', id: entry.file.path, title: entry.file.basename, column: val, order: finalOrder, pinnedOrder: finalPinnedOrder,
                isCompleted: isCardCompleted, isPinned: pinnedStatus, entry: entry, ctime: fileCtime,
                projectValStr: projStr, progressValStr: progStr, middleValStr: middleValStr, customSortValStr: customSortValStr, customBadges: customBadgesData
            });
        });

        if (!settings.virtualCards) settings.virtualCards = [];
        settings.virtualCards.forEach((vc:any) => {
            let isArchived = !!vc.archived;
            if (this.isArchivedView && !isArchived) return;
            if (!this.isArchivedView && isArchived) return;

            let column = vc.column;
            // 如果按项目环节分组，则提取中间部分作为列名
            if (useMiddlePartGrouping) {
                column = this.extractMiddlePart(column, orderPrefix, orderSeparator) || uncategorizedName;
            }

            if (!groups.has(column)) { groups.set(column, []); savedCols.push(column); }
            let vcCtime = Date.now(); try { vcCtime = parseInt(vc.id.split('-')[1]) || Date.now(); } catch (e) {}

            groups.get(column)!.push({
                type: 'virtual', id: vc.id, title: vc.title, column: column, order: vc.order, pinnedOrder: vc.pinnedOrder || "0",
                isCompleted: false, isPinned: !!vc.pinned, ctime: vcCtime,
                projectValStr: "", progressValStr: progDraftVal, middleValStr: "", customSortValStr: "", customBadges: {},
                body: vc.body || ""
            });
        });

        if (this.isArchivedView) {
            if (savedCols.length !== (settings.archivedColumns[groupByProp] || []).length) { this.plugin.settings.archivedColumns[groupByProp] = savedCols; this.plugin.saveSettings(); }
        } else {
            if (savedCols.length !== (settings.columnOrders[groupByProp] || []).length) { this.plugin.settings.columnOrders[groupByProp] = savedCols; this.plugin.saveSettings(); }
        }

        this.boardEl = this.containerEl.createDiv("kanban-board");
        if (settings.fadeBackground) this.boardEl.addClass("bkv-fade-enabled");
        if (settings.showGhostBorder) {
            this.boardEl.addClass("bkv-ghost-border-enabled");
            if (settings.ghostBorderStyle === "filled") this.boardEl.addClass("bkv-ghost-filled");
        }
        if (settings.styleCompletedCards) this.boardEl.addClass("bkv-style-completed");
        if (this.isArchivedView) this.boardEl.addClass("is-archived-view");
        if (isDragLocked) this.boardEl.addClass("is-drag-locked");
        // ✅ v1.0.15: 注入进度条颜色/速度/动画样式 CSS 变量
        // progressBarDisplay 现在直接存储动画类型（none/simple/stripes/shine/both/pulse）
        if (settings.progressBarColor) this.boardEl.style.setProperty("--kanban-progress-color", settings.progressBarColor);
        this.boardEl.style.setProperty("--kanban-progress-speed", `${settings.progressBarSpeed || 0.9}s`);
        // 兼容旧版 animated 值
        const _animStyle = settings.progressBarDisplay === "animated" ? (settings.progressBarAnimStyle || "stripes") : settings.progressBarDisplay;
        if (_animStyle && _animStyle !== "none" && _animStyle !== "simple") {
            this.boardEl.setAttribute("data-progress-anim", _animStyle);
        }

        let easingCurve = "cubic-bezier(0.25, 1, 0.5, 1)";
        if (settings.animationStyle === "bouncy") easingCurve = "cubic-bezier(0.175, 0.885, 0.32, 1.275)";
        if (settings.animationStyle === "snappy") easingCurve = "cubic-bezier(0.2, 1, 0.2, 1)";
        if (settings.animationStyle === "linear") easingCurve = "linear";

        const globalStyles = settings.globalMetaStyles || {};

        const renderCard = (card: CardData, idx: number, container: HTMLElement, colName: string, isPinnedZone: boolean = false) => {
            const cardEl = container.createDiv("kanban-card");
            cardEl.dataset.type = card.type; cardEl.dataset.id = card.id;
            cardEl.dataset.order = isPinnedZone ? card.pinnedOrder : card.order;
            cardEl.dataset.ctime = String(card.ctime); cardEl.dataset.middleval = card.middleValStr;
            (cardEl as any)._customVal = card.customSortValStr || ""; cardEl.setAttribute("tabindex", "0");

            if (this.selectedCards.has(card.id)) cardEl.addClass("is-selected");

            cardEl.addEventListener('click', (e: MouseEvent) => {
                const target = e.target as HTMLElement;
                if (target.closest('.kanban-card-menu-btn') || target.closest('.kanban-card-open-btn') || target.closest('.kanban-card-checkbox') || target.closest('.kanban-card-title[contenteditable="true"]')) return;

                if (e.ctrlKey || e.metaKey) {
                    if (this.selectedCards.has(card.id)) this.selectedCards.delete(card.id);
                    else this.selectedCards.add(card.id);
                    this.lastSelectedCardId = card.id;
                } else if (e.shiftKey && this.lastSelectedCardId) {
                    const allDomCards = Array.from(this.boardEl.querySelectorAll('.kanban-card')) as HTMLElement[];
                    const allIds = allDomCards.map(el => el.dataset.id!);
                    const startIdx = allIds.indexOf(this.lastSelectedCardId);
                    const endIdx = allIds.indexOf(card.id);
                    if (startIdx !== -1 && endIdx !== -1) {
                        const min = Math.min(startIdx, endIdx);
                        const max = Math.max(startIdx, endIdx);
                        for(let i = min; i <= max; i++) this.selectedCards.add(allIds[i]);
                    }
                    this.lastSelectedCardId = card.id;
                } else {
                    this.selectedCards.clear();
                    this.selectedCards.add(card.id);
                    this.lastSelectedCardId = card.id;
                }
                this.updateSelectionUI();
            });

            if (card.type === 'virtual') cardEl.addClass("is-virtual");
            if (card.isCompleted) cardEl.addClass("is-completed");
            if (card.isPinned) cardEl.addClass("is-pinned");

            const titleContainer = cardEl.createDiv("kanban-card-title-container");
            const checkbox = titleContainer.createEl("input", { type: "checkbox", cls: "task-list-item-checkbox kanban-card-checkbox" });
            checkbox.checked = card.isCompleted;

            if (card.type === 'virtual') {
                checkbox.disabled = true; checkbox.setAttribute("title", "草稿无法打勾，请先实体化");
            } else {
                checkbox.onchange = async () => {
                    const newState = checkbox.checked;
                    card.isCompleted = newState;
                    if (newState) cardEl.addClass("is-completed"); else cardEl.removeClass("is-completed");
                    updateProgress(colName);

                    const file = this.app.vault.getAbstractFileByPath(card.id);
                    if (file instanceof TFile) {
                        await this.app.fileManager.processFrontMatter(file, fm => {
                            // ✅ v1.0.5 FIX: 无论是否开启进度联动，勾选/取消勾选都写入 progressProperty
                            // isProgressSync 只控制跨列拖拽时是否同步 groupBy 字段，不影响复选框写入
                            if (yamlProgProp) {
                                const targetVal = newState ? progCompVal : progUncheckVal;
                                if (targetVal) {
                                    fm[yamlProgProp] = [targetVal];
                                    // 若开启进度联动且 progressProp === groupByProp，同步分组列
                                    if (isProgressSync && yamlProgProp === yamlGroupProp) {
                                        fm[yamlGroupProp] = targetVal;
                                    }
                                }
                            }
                        });
                    }
                };
            }

            const titleStr = card.type === 'file' ? (settings.cardAliases[card.id] || card.title) : card.title;
            const cardTitleEl = titleContainer.createDiv({ cls: "kanban-card-title", text: titleStr });

            if (!this.isArchivedView) {
                cardTitleEl.setAttribute("contenteditable", "true");
                cardTitleEl.onmousedown = (e: MouseEvent) => e.stopPropagation();
                cardTitleEl.onblur = async () => {
                    let newTitle = cardTitleEl.textContent?.trim();
                    if (card.type === 'file') {
                        if (!newTitle || newTitle === card.title) { delete this.plugin.settings.cardAliases[card.id]; cardTitleEl.textContent = titleStr; }
                        else if (newTitle !== titleStr) { this.plugin.settings.cardAliases[card.id] = newTitle; }
                    } else {
                        if (!newTitle) cardTitleEl.textContent = titleStr;
                        else { const vc = settings.virtualCards.find((v:any) => v.id === card.id); if (vc) vc.title = newTitle; }
                    }
                    await this.plugin.saveSettings(false);
                };
                cardTitleEl.onkeydown = (e: KeyboardEvent) => { if (e.key === "Enter") { e.preventDefault(); cardTitleEl.blur(); } };
            }

            if (card.type === 'file') {
                const openBtn = titleContainer.createDiv("kanban-card-open-btn");
                openBtn.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>`;
                openBtn.onclick = (e: MouseEvent) => { e.stopPropagation(); this.app.workspace.openLinkText(card.id, "", e.ctrlKey || e.metaKey); };
            }

            const actionIcon = titleContainer.createDiv("kanban-card-menu-btn");
            actionIcon.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"><circle cx="12" cy="5" r="1"></circle><circle cx="12" cy="12" r="1"></circle><circle cx="12" cy="19" r="1"></circle></svg>`;

            actionIcon.addEventListener('click', (e: MouseEvent) => {
                e.stopPropagation();
                try {
                    const menu = new Menu();
                    const activeIds = this.selectedCards.has(card.id) && this.selectedCards.size > 1 ? Array.from(this.selectedCards) : [card.id];
                    const isBulk = activeIds.length > 1;

                    const processBulk = async (action: (id: string, isFile: boolean, file: import("obsidian").TAbstractFile | null, vc: any) => Promise<void>) => {
                        for (const id of activeIds) {
                            const file = this.app.vault.getAbstractFileByPath(id);
                            const vc = settings.virtualCards.find((v:any) => v.id === id);
                            await action(id, !!file, file, vc);
                        }
                    };

                    if (card.type === 'file') {
                        menu.addItem((item: any) => {
                            item.setTitle("更换关联笔记").onClick(() => {
                                new PromptModal(this.app, `输入新关联的笔记名称`, async (newPath: string) => {
                                    if (!newPath) return; if (!newPath.endsWith(".md")) newPath += ".md";
                                    const newFile = this.app.metadataCache.getFirstLinkpathDest(newPath, "");
                                    if (!newFile) { new Notice(`未找到笔记: ${newPath}`); return; }
                                    const oldFile = this.app.vault.getAbstractFileByPath(card.id);
                                    if (oldFile instanceof TFile) { await this.app.fileManager.processFrontMatter(oldFile, fm => { delete fm[yamlGroupProp]; delete fm[yamlOrderProp]; if (isProgressSync && yamlProgProp) delete fm[yamlProgProp]; }); }
                                    await this.app.fileManager.processFrontMatter(newFile, fm => { fm[yamlGroupProp] = card.column; if (isGlobalAuto) fm[yamlOrderProp] = [card.order]; if (isProgressSync && yamlProgProp) { fm[yamlProgProp] = [card.isCompleted ? progCompVal : (progUncheckVal || "")]; } });
                                    new Notice(`成功转移至: ${newFile.basename}`); this.requestUpdate();
                                }).open();
                            });
                        });

                        menu.addItem((item: any) => {
                            item.setTitle(isBulk ? `切换选中的 ${activeIds.length} 项的置顶状态` : (card.isPinned ? "取消置顶 (总结) 状态" : "标为置顶 (总结) 卡片")).onClick(async () => {
                                await processBulk(async (id, isFile, file, vc) => { if (isFile && file instanceof TFile) { await this.app.fileManager.processFrontMatter(file, fm => { const currentPinned = fm[pinnedProp] === true || String(fm[pinnedProp]).toLowerCase() === 'true'; if(currentPinned) { delete fm[pinnedProp]; delete fm[yamlPinnedOrderProp]; } else { fm[pinnedProp] = true; delete fm[yamlOrderProp]; } }); } });
                                setTimeout(() => this.requestUpdate(), 300);
                            });
                        });

                        menu.addSeparator();
                        menu.addItem((item: any) => { item.setTitle(isBulk ? `从列中移除选中的 ${activeIds.length} 项 (清空属性)` : "从当前列移除 (仅清空分组属性)").onClick(async () => { await processBulk(async (id, isFile, file, vc) => { if (isFile && file instanceof TFile) await this.app.fileManager.processFrontMatter(file, fm => { delete fm[yamlGroupProp]; }); }); this.selectedCards.clear(); setTimeout(() => this.requestUpdate(), 300); }); });

                        if (!this.isArchivedView) {
                            menu.addItem((item: any) => { item.setTitle(isBulk ? `归档选中的 ${activeIds.length} 项` : "归档此卡片").onClick(async () => { await processBulk(async (id, isFile, file, vc) => { if (isFile && file instanceof TFile) await this.app.fileManager.processFrontMatter(file, fm => { fm[archiveProp] = true; }); }); this.selectedCards.clear(); setTimeout(() => this.requestUpdate(), 300); }); });
                        } else {
                            menu.addItem((item: any) => { item.setTitle(isBulk ? `恢复选中的 ${activeIds.length} 项` : "取消归档此卡片").onClick(async () => { await processBulk(async (id, isFile, file, vc) => { if (isFile && file instanceof TFile) await this.app.fileManager.processFrontMatter(file, fm => { delete fm[archiveProp]; delete fm[settings.archiveCycleProperty || "任务完成周期"]; }); }); this.selectedCards.clear(); setTimeout(() => this.requestUpdate(), 300); }); });
                        }
                        menu.addItem((item: any) => { item.setTitle(isBulk ? `删除选中的 ${activeIds.length} 项 (移至回收站)` : "删除笔记 (移至回收站)").onClick(() => { new ConfirmModal(this.app, `确定要将${isBulk ? '这 '+activeIds.length+' 项' : '该项'}彻底删除/移至回收站吗？`, async () => { await processBulk(async (id, isFile, file, vc) => { if (isFile && file instanceof TFile) await this.app.fileManager.trashFile(file); }); this.selectedCards.clear(); setTimeout(() => this.requestUpdate(), 300); }).open(); }); });

                    } else {
                        // ✅ v1.0.1 FIX: 草稿转真实笔记完整修复
                        if (!this.isArchivedView) {
                            menu.addItem((item: any) => {
                                item.setTitle("生成真实笔记").onClick(async () => {
                                    const { props, yaml } = getPropsData(colName, card.middleValStr, (groups.get(colName) || []).length + 1);
                                    const vcRef = settings.virtualCards.find((v:any) => v.id === card.id);
                                    const defaultFolder2 = vcRef?.targetFolder || settings.defaultNewNoteFolder || (() => {
                                        const firstRealFile = entries.find((entryObj:any) => entryObj.file && entryObj.file.parent && entryObj.file.parent.path !== "/");
                                        return firstRealFile ? firstRealFile.file.parent.path : "";
                                    })();

                                    new RichCreateModal(
                                        this.app, `将草稿「${card.title}」转为真实笔记`, props, false,
                                        defaultFolder2, settings.defaultNewNoteProps || [],
                                        async (noteName: string, folderPath: string, extraProps) => {
                                            const cleanName = noteName.trim();
                                            let targetFolder = folderPath.trim();
                                            if (!targetFolder) {
                                                const firstRealFile = entries.find((entryObj:any) => entryObj.file && entryObj.file.parent);
                                                if (firstRealFile) targetFolder = firstRealFile.file.parent.path !== "/" ? firstRealFile.file.parent.path : "";
                                            }
                                            const fullPath = targetFolder ? `${targetFolder}/${cleanName}.md` : `${cleanName}.md`;
                                            if (this.app.vault.getAbstractFileByPath(fullPath)) { new Notice(`文件已存在：${fullPath}`); return; }

                                            if (targetFolder) { try { await this.app.vault.createFolder(targetFolder); } catch(e) { /* folder exists */ } }

                                            // 构建 YAML，包含进度属性（设置为待计划/draft值）
                                            const vcBody = vcRef?.body || "";
                                            let finalYaml = buildYamlWithExtras(yaml, extraProps);
                                            // ✅ 草稿转真实笔记时，自动写入进度属性为 draftValue
                                            if (yamlProgProp && progDraftVal && !finalYaml.includes(yamlProgProp + ":")) {
                                                finalYaml += `${yamlProgProp}: ${progDraftVal}\n`;
                                            }
                                            const fm = `---\n${finalYaml}---\n`;
                                            const fileContent = vcBody ? `${fm}\n${vcBody}` : fm;

                                            try {
                                                await this.app.vault.create(fullPath, fileContent);
                                                // ✅ v1.0.1 FIX: 直接操作 plugin.settings 中的数组，确保持久化
                                                this.plugin.settings.virtualCards = this.plugin.settings.virtualCards.filter((v:any) => v.id !== card.id);
                                                await this.plugin.saveSettings(true);
                                                new Notice(`成功生成笔记：${cleanName}`);
                                            } catch (err: any) { new Notice("创建失败: " + err.message); }
                                        }
                                    ).open();
                                });
                            });

                            menu.addItem((item: any) => {
                                item.setTitle(isBulk ? `切换选中的 ${activeIds.length} 项的置顶状态` : (card.isPinned ? "取消置顶 (总结) 状态" : "标为置顶 (总结) 卡片")).onClick(async () => {
                                    await processBulk(async (id, isFile, file, vc) => { if (vc) vc.pinned = !vc.pinned; });
                                    await this.plugin.saveSettings(true); this.requestUpdate();
                                });
                            });
                            menu.addSeparator();
                            menu.addItem((item: any) => { item.setTitle(isBulk ? `归档选定的 ${activeIds.length} 项草稿` : "归档此草稿").onClick(async () => { await processBulk(async (id, isFile, file, vc) => { if (vc) vc.archived = true; }); this.selectedCards.clear(); await this.plugin.saveSettings(true); this.requestUpdate(); }); });
                        } else {
                            menu.addItem((item: any) => { item.setTitle(isBulk ? `恢复选中的 ${activeIds.length} 项草稿` : "取消归档此草稿").onClick(async () => { await processBulk(async (id, isFile, file, vc) => { if (vc) { vc.archived = false; delete vc.archiveCycle; } }); this.selectedCards.clear(); await this.plugin.saveSettings(true); this.requestUpdate(); }); });
                        }
                        menu.addItem((item: any) => { item.setTitle(isBulk ? `删除选中的 ${activeIds.length} 项草稿` : "彻底删除草稿卡片").onClick(async () => { await processBulk(async (id, isFile, file, vc) => { if (vc) this.plugin.settings.virtualCards = this.plugin.settings.virtualCards.filter((v:any) => v.id !== id); }); this.selectedCards.clear(); await this.plugin.saveSettings(true); this.requestUpdate(); }); });
                    }
                    const rect = actionIcon.getBoundingClientRect(); menu.showAtPosition({ x: rect.right, y: rect.bottom + 5 });
                } catch (err) { console.error("Card menu error:", err); }
            });

            const footerContainer = cardEl.createDiv("kanban-card-footer clear-fix");
            const leftTags: HTMLElement[] = []; const rightTags: HTMLElement[] = [];
            const currentAreaConfigs = isPinnedZone ? activePinnedConfigs : normalMetaConfigs;

            currentAreaConfigs.forEach((conf: MetaTagConfig) => {
                const confAlign = conf.align || (conf.id === 'ctime' ? 'left' : 'right'); if (!conf.enabled) return;
                const effectiveKey = conf.type === 'custom' ? conf.propKey : conf.type;
                const gStyle = globalStyles[effectiveKey] || { bgColor: '#f0f0f0', bgOpacity: 100, textColor: '#666666', fontSize: 11, fontWeight: 'normal', borderColor: 'transparent', borderWidth: 0, radius: 4, valueStyles: [] };
                let textVal = "";

                if (conf.type === 'ctime') { const dateObj = new Date(card.ctime); const yyyy = dateObj.getFullYear().toString(); const yy = yyyy.slice(-2); const mm = String(dateObj.getMonth() + 1).padStart(2, '0'); const dd = String(dateObj.getDate()).padStart(2, '0'); textVal = (settings.dateFormat || "YYYY-MM-DD").replace(/YYYY/g, yyyy).replace(/YY/g, yy).replace(/MM/g, mm).replace(/DD/g, dd); }
                else if (conf.type === 'order') { const finalSuffix = formatOrderSuffix(idx + 1, isPinnedZone ? settings.pinnedOrderFormat : orderFormat); textVal = (settings.orderBadgePrefix || "") + finalSuffix; }
                else if (conf.type === 'project') { if (yamlGroupProp === yamlProjProp) return; textVal = card.projectValStr; }
                else if (conf.type === 'progress') { if (yamlGroupProp === yamlProgProp) return; textVal = card.progressValStr; }
                else if (conf.type === 'custom') { textVal = card.customBadges[conf.propKey] || card.customBadges[conf.id]; }

                if (textVal) {
                    let finalBg = gStyle.bgColor; let finalOp = gStyle.bgOpacity; let finalTxt = gStyle.textColor; let finalRadius = gStyle.radius; let finalFs = gStyle.fontSize; let finalFw = gStyle.fontWeight; let finalBc = gStyle.borderColor; let finalBw = gStyle.borderWidth;
                    if (gStyle.valueStyles && gStyle.valueStyles.length > 0) { const matched = gStyle.valueStyles.find((vc: any) => vc.val === textVal); if (matched) { finalBg = matched.bg; finalOp = matched.bgOpacity !== undefined ? matched.bgOpacity : gStyle.bgOpacity; finalTxt = matched.text; finalRadius = matched.radius !== undefined ? matched.radius : gStyle.radius; finalFs = matched.fontSize !== undefined ? matched.fontSize : gStyle.fontSize; finalFw = matched.fontWeight || gStyle.fontWeight; finalBc = matched.borderColor || gStyle.borderColor; finalBw = matched.borderWidth !== undefined ? matched.borderWidth : gStyle.borderWidth; } }
                    const badge = document.createElement("div"); badge.className = `kanban-card-meta-badge kanban-card-badge-${confAlign}`; badge.textContent = textVal; badge.style.backgroundColor = hexToRgba(finalBg, finalOp); badge.style.color = finalTxt; badge.style.borderRadius = `${finalRadius}px`; badge.style.fontSize = `${finalFs}px`; badge.style.fontWeight = finalFw;
                    if(finalBw > 0) badge.style.border = `${finalBw}px solid ${finalBc}`; else badge.style.border = "none";
                    if (confAlign === 'left') leftTags.push(badge); else rightTags.push(badge);
                }
            });

            leftTags.forEach(el => footerContainer.appendChild(el)); rightTags.reverse().forEach(el => footerContainer.appendChild(el));
            if (settings.showCardPath && card.type === 'file') { const pathEl = document.createElement("div"); pathEl.className = "kanban-card-preview"; pathEl.textContent = card.id.replace(/\.md$/i, ""); footerContainer.appendChild(pathEl); }
            cardEl.onkeydown = (e: KeyboardEvent) => { if ((e.key === " " || e.key === "Enter") && document.activeElement !== cardTitleEl && card.type === 'file') { e.preventDefault(); checkbox.checked = !checkbox.checked; checkbox.dispatchEvent(new Event("change")); } };
        };

        // ✅ v1.0.14: 在 boardEl 捕获阶段记录 mousedown 时的精确偏移
        let _dragOffsetX = 8;
        let _dragOffsetY = 8;

        this.boardEl.addEventListener('mousedown', (e: MouseEvent) => {
            const card = (e.target as HTMLElement).closest('.kanban-card') as HTMLElement | null;
            if (!card) return;
            const rect = card.getBoundingClientRect();
            _dragOffsetX = Math.round(e.clientX - rect.left);
            _dragOffsetY = Math.round(e.clientY - rect.top);
        }, true);

        const initSortable = (container: HTMLElement) => {
            const sortable = new Sortable(container, {
                group: 'shared', animation: settings.animationDuration, easing: easingCurve,
                // ✅ v1.0.14 FIX: 使用原生 HTML5 拖拽（forceFallback: false）避免坐标系错位
                // 原生拖拽在 Obsidian Electron 环境中能正确处理 body transform
                forceFallback: false,
                scroll: true, scrollSensitivity: 80, scrollSpeed: 15,
                filter: ".kanban-card-checkbox, .kanban-card-title, .kanban-card-menu-btn, .kanban-card-open-btn", preventOnFilter: false,
                delay: settings.dragDelay, delayOnTouchOnly: false, disabled: isDragLocked,
                ghostClass: 'kanban-card-ghost',
                chosenClass: 'kanban-card-chosen',
                dragClass: 'kanban-card-dragging',
                onStart: (evt: any) => {
                    this.boardEl.addClass("is-dragging-card");
                    const item = evt.item as HTMLElement;

                    // ✅ v1.0.15: 多选拖拽时，构建包含所有选中卡片的叠层预览图
                    const draggedId = item.dataset.id;
                    const isMultiDrag = draggedId && this.selectedCards.has(draggedId) && this.selectedCards.size > 1;

                    const w = item.offsetWidth;
                    const h = item.offsetHeight;

                    let dragImageEl: HTMLElement;

                    if (isMultiDrag) {
                        // 按照 DOM 顺序收集选中的卡片元素
                        const allDomCards = Array.from(this.boardEl.querySelectorAll('.kanban-card')) as HTMLElement[];
                        const selectedEls = allDomCards.filter(el => this.selectedCards.has(el.dataset.id!));

                        // 创建叠层容器
                        dragImageEl = document.createElement('div');
                        dragImageEl.style.cssText = [
                            `width:${w}px`,
                            `height:${h + (selectedEls.length - 1) * 6}px`,
                            'position:fixed', 'top:-9999px', 'left:-9999px',
                            'pointer-events:none', 'z-index:9999',
                        ].join(';');

                        // 叠层渲染：最下面的卡片先渲染，主卡片在最上层
                        selectedEls.forEach((el, i) => {
                            const clone = el.cloneNode(true) as HTMLElement;
                            const offset = (selectedEls.length - 1 - i) * 6;
                            clone.style.cssText = [
                                `width:${w}px`, `height:${h}px`,
                                'position:absolute', `top:${offset}px`, 'left:0',
                                `opacity:${i === selectedEls.length - 1 ? '0.95' : String(0.5 + i * 0.1)}`,
                                'background:var(--background-primary)',
                                'border:2px solid var(--interactive-accent)',
                                `box-shadow:0 ${4 + i * 2}px ${12 + i * 4}px rgba(0,0,0,0.18)`,
                                'border-radius:6px', 'box-sizing:border-box', 'overflow:hidden',
                                `transform:rotate(${i === selectedEls.length - 1 ? 2 : (i - selectedEls.length + 2) * 1.5}deg)`,
                            ].join(';');
                            dragImageEl.appendChild(clone);
                        });

                        // 数量角标
                        const badge = document.createElement('div');
                        badge.style.cssText = [
                            'position:absolute', 'top:-8px', 'right:-8px',
                            'background:var(--interactive-accent)', 'color:#fff',
                            'border-radius:50%', 'width:20px', 'height:20px',
                            'display:flex', 'align-items:center', 'justify-content:center',
                            'font-size:11px', 'font-weight:700', 'z-index:1',
                            'box-shadow:0 2px 4px rgba(0,0,0,0.2)',
                        ].join(';');
                        badge.textContent = String(selectedEls.length);
                        dragImageEl.appendChild(badge);

                        // 其他选中的卡片保持半透明可见（不隐藏）
                        selectedEls.forEach(el => {
                            if (el !== item) el.style.opacity = '0.3';
                        });
                    } else {
                        // 单选：创建单张卡片预览图
                        dragImageEl = item.cloneNode(true) as HTMLElement;
                        dragImageEl.style.cssText = [
                            `width:${w}px`, `height:${h}px`,
                            'position:fixed', 'top:-9999px', 'left:-9999px',
                            'opacity:0.9', 'pointer-events:none', 'z-index:9999',
                            'background:var(--background-primary)',
                            'border:2px solid var(--interactive-accent)',
                            'box-shadow:0 8px 24px rgba(0,0,0,0.25)',
                            'border-radius:6px', 'box-sizing:border-box', 'overflow:hidden',
                            'transform:rotate(2deg)',
                        ].join(';');
                    }

                    document.body.appendChild(dragImageEl);
                    (item as any)._dragImageEl = dragImageEl;

                    // 设置自定义拖拽图像
                    const nativeDragEvent = evt.originalEvent as DragEvent;
                    if (nativeDragEvent?.dataTransfer) {
                        nativeDragEvent.dataTransfer.effectAllowed = 'move';
                        nativeDragEvent.dataTransfer.setDragImage(dragImageEl, _dragOffsetX, _dragOffsetY);
                    }

                    // ✅ 不隐藏原始元素，让 ghost 占位符可见
                    item.style.opacity = '0.4';
                },
                onEnd: async (evt: any) => {
                    this.boardEl.removeClass("is-dragging-card");
                    // ✅ v1.0.14: 恢复原始元素显示，清理 drag image 节点
                    evt.item.style.opacity = '';
                    const dragImg = (evt.item as any)._dragImageEl;
                    if (dragImg && dragImg.parentNode) dragImg.parentNode.removeChild(dragImg);
                    delete (evt.item as any)._dragImageEl;

                    // ✅ v1.0.15: 恢复多选时其他卡片的透明度（不再使用 is-hidden-by-multidrag）
                    this.boardEl.querySelectorAll('.kanban-card').forEach((el: Element) => {
                        (el as HTMLElement).style.opacity = '';
                    });
                    this.boardEl.querySelectorAll('.is-hidden-by-multidrag').forEach((el: Element) => el.classList.remove('is-hidden-by-multidrag'));

                    const draggedId = evt.item.dataset.id; const toColName = evt.to.dataset.colId;
                    const isToPinned = evt.to.dataset.isPinned === "true"; const isFromPinned = evt.from.dataset.isPinned === "true";
                    const activeIds = (draggedId && this.selectedCards.has(draggedId) && this.selectedCards.size > 1) ? Array.from(this.selectedCards) : [draggedId];
                    if (isToPinned && !isFromPinned) evt.item.addClass("is-pinned"); else if (!isToPinned && isFromPinned) evt.item.removeClass("is-pinned");
                    let settingsNeedSave = false;
                    if (activeIds.length > 1) {
                        // ✅ v1.0.15: 按 DOM 原始顺序排列多选卡片，保持集合内部顺序不变
                        const allDomCards = Array.from(this.boardEl.querySelectorAll('.kanban-card')) as HTMLElement[];
                        const orderedOtherIds = allDomCards
                            .filter(el => activeIds.includes(el.dataset.id!) && el.dataset.id !== draggedId)
                            .map(el => el.dataset.id!);

                        const toContainer = evt.to; const refNode = evt.item.nextSibling;
                        for (const id of orderedOtherIds) {
                            const el = this.boardEl.querySelector(`.kanban-card[data-id="${CSS.escape(id as string)}"]`) as HTMLElement;
                            if (el) { if (refNode) toContainer.insertBefore(el, refNode); else toContainer.appendChild(el); }
                        }
                    }
                    for (const id of activeIds) {
                        const el = this.boardEl.querySelector(`.kanban-card[data-id="${CSS.escape(id as string)}"]`) as HTMLElement; if (!el) continue;
                        const elType = el.dataset.type;
                        if (elType === 'virtual') { const vc = settings.virtualCards.find((v:any) => v.id === id); if (vc && vc.column !== toColName) { vc.column = toColName; settingsNeedSave = true; } if (isToPinned && vc) { vc.pinned = true; settingsNeedSave = true; } else if (!isToPinned && isFromPinned && vc) { vc.pinned = false; settingsNeedSave = true; } }
                        else { const f = this.app.vault.getAbstractFileByPath(id!); if (f instanceof TFile) { await this.app.fileManager.processFrontMatter(f, fm => { if (fm[yamlGroupProp] !== toColName) { fm[yamlGroupProp] = toColName; settingsNeedSave = true; } if (isToPinned && !isFromPinned) { fm[pinnedProp] = true; delete fm[yamlOrderProp]; } else if (!isToPinned && isFromPinned) { delete fm[pinnedProp]; } if (isProgressSync && yamlProgProp && toColName) { fm[yamlProgProp] = [toColName]; } }); } }
                    }
                    updateProgress(evt.from.dataset.colId); if (evt.from !== evt.to) updateProgress(evt.to.dataset.colId);
                    const siblingEls = Array.from(evt.to.querySelectorAll(".kanban-card")) as HTMLElement[]; await rewriteColumnOrder(siblingEls, toColName, isToPinned);
                    if (isGlobalAuto && evt.from !== evt.to) { const fromSiblingEls = Array.from(evt.from.querySelectorAll(".kanban-card")) as HTMLElement[]; await rewriteColumnOrder(fromSiblingEls, evt.from.dataset.colId!, isFromPinned); }
                    // ✅ v1.0.6 FIX: 拖拽结束不再调 requestUpdate()。
                    // SortableJS 已将 DOM 移动到正确位置，只需持久化数据即可。
                    // requestUpdate 会触发 containerEl.empty() 全板重建，导致闪烁。
                    if (settingsNeedSave) await this.plugin.saveSettings(false);
                }
            });
            this.sortables.push(sortable);
        };

        const visibleCols = savedCols.filter((c: string) => {
            if (hiddenCols.includes(c)) return false;
            // ✅ v1.0.3: 全局永久隐藏列（含任意自定义列名）
            const globalHidden = settings.globalHiddenColumns || [];
            if (globalHidden.includes(c)) return false;
            return true;
        });

        visibleCols.forEach((colName: string) => {
            const allCards = groups.get(colName) || [];
            const dir = (settings.columnSortDir && settings.columnSortDir[colName]) || 'asc';
            const mult = dir === 'desc' ? -1 : 1;

            const pinnedCards = allCards.filter(c => c.isPinned);
            pinnedCards.sort((a, b) => (extractSortNumber(a.pinnedOrder, settings.pinnedOrderFormat, settings.pinnedOrderSeparator) - extractSortNumber(b.pinnedOrder, settings.pinnedOrderFormat, settings.pinnedOrderSeparator)) * mult);

            const normalCards = allCards.filter(c => !c.isPinned);
            normalCards.sort((a, b) => (extractSortNumber(a.order, orderFormat, orderSeparator) - extractSortNumber(b.order, orderFormat, orderSeparator)) * mult);

            let compCount = 0; allCards.forEach(c => { if(c.isCompleted) compCount++; });
            const cards = allCards;

            const colEl = this.boardEl.createDiv("kanban-column"); colEl.dataset.colId = colName;
            const savedWidth = (settings.columnWidths && settings.columnWidths[colName]) ? settings.columnWidths[colName] : 280;
            colEl.style.width = `${savedWidth}px`; colEl.style.flex = `0 0 ${savedWidth}px`;

            const resizerEl = colEl.createDiv("kanban-column-resizer");
            resizerEl.onmousedown = (e: MouseEvent) => {
                e.preventDefault(); e.stopPropagation();
                const startX = e.clientX; const startWidth = colEl.offsetWidth;
                const onMouseMove = (moveEvent: MouseEvent) => { const newWidth = Math.max(200, startWidth + (moveEvent.clientX - startX)); colEl.style.width = `${newWidth}px`; colEl.style.flex = `0 0 ${newWidth}px`; };
                const onMouseUp = async () => { document.removeEventListener("mousemove", onMouseMove); document.removeEventListener("mouseup", onMouseUp); colEl.removeClass("is-resizing"); if (!this.plugin.settings.columnWidths) this.plugin.settings.columnWidths = {}; this.plugin.settings.columnWidths[colName] = parseInt(colEl.style.width); await this.plugin.saveSettings(); };
                colEl.addClass("is-resizing"); document.addEventListener("mousemove", onMouseMove); document.addEventListener("mouseup", onMouseUp);
            };

            const headerEl = colEl.createDiv("kanban-column-header");
            const headerTopArea = headerEl.createDiv("kanban-column-header-top");
            const leftControls = headerTopArea.createDiv("kanban-column-left-controls");
            const dragHandle = leftControls.createDiv("kanban-column-drag-handle");
            dragHandle.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"><circle cx="9" cy="12" r="1"></circle><circle cx="9" cy="5" r="1"></circle><circle cx="9" cy="19" r="1"></circle><circle cx="15" cy="12" r="1"></circle><circle cx="15" cy="5" r="1"></circle><circle cx="15" cy="19" r="1"></circle></svg>`;

            const titleWrap = headerTopArea.createDiv({ cls: "kanban-column-title-wrap" });

            // ✅ v1.0.1: 列标题改为 contenteditable，支持直接点击修改
            const titleEl = titleWrap.createDiv({ cls: "kanban-column-title" });
            if (this.isArchivedView && settings.archivedColumnMeta && settings.archivedColumnMeta[colName]) {
                const meta = settings.archivedColumnMeta[colName];
                titleEl.textContent = colName;
                titleEl.setAttribute("contenteditable", "false");
                titleWrap.createDiv({ cls: "kanban-column-archive-meta", text: `归档自: ${meta.originView} | 周期: ${meta.duration}` });
            } else {
                // 如果按项目环节分组，则提取中间部分作为显示标题
                let displayName = colName;
                if (groupByProp === yamlProjProp || groupByProp === yamlOrderProp) {
                    // 使用统一的提取方法
                    displayName = this.extractMiddlePart(colName, settings.orderPrefix || '', settings.orderSeparator || '-');
                }
                titleEl.textContent = displayName;
                titleEl.setAttribute("contenteditable", "true");
                titleEl.onmousedown = (e: MouseEvent) => e.stopPropagation();
                titleEl.onkeydown = (e: KeyboardEvent) => { if (e.key === "Enter") { e.preventDefault(); titleEl.blur(); } if (e.key === "Escape") { titleEl.textContent = colName; titleEl.blur(); } };
                titleEl.onblur = async () => {
                    const newDisplayName = titleEl.textContent?.trim();
                    if (!newDisplayName) { titleEl.textContent = displayName; return; }

                    // 计算原始显示名（用于比较）
                    const originalDisplayName = displayName;
                    if (newDisplayName === originalDisplayName) { titleEl.textContent = originalDisplayName; return; }

                    // 确定新的列名（完整值）
                    let newColName = newDisplayName;
                    if (groupByProp === yamlProjProp || groupByProp === yamlOrderProp) {
                        // 按项目环节分组：构建新的完整值
                        const prefix = settings.orderPrefix || '';
                        const separator = settings.orderSeparator || '-';
                        const parts = colName.split(separator);
                        if (parts.length >= 2) {
                            let middleIndex = 0;
                            if (prefix && parts[0] === prefix) {
                                middleIndex = 1;
                            }
                            if (parts.length > middleIndex) {
                                parts[middleIndex] = newDisplayName;
                                newColName = parts.join(separator);
                            }
                        }
                    }

                    // ✅ 重命名列：更新 columnOrders、columnWidths、hiddenColumns 中的 key
                    const renameInArray = (arr: string[]) => { const idx = arr.indexOf(colName); if (idx !== -1) arr[idx] = newColName; };
                    renameInArray(this.plugin.settings.columnOrders[groupByProp] || []);
                    if (this.plugin.settings.columnWidths[colName] !== undefined) { this.plugin.settings.columnWidths[newColName] = this.plugin.settings.columnWidths[colName]; delete this.plugin.settings.columnWidths[colName]; }
                    if (this.plugin.settings.columnSortDir[colName]) { this.plugin.settings.columnSortDir[newColName] = this.plugin.settings.columnSortDir[colName]; delete this.plugin.settings.columnSortDir[colName]; }

                    // 更新所有虚拟卡片的 column 字段
                    this.plugin.settings.virtualCards.forEach((vc: any) => { if (vc.column === colName) vc.column = newColName; });

                    // 更新所有真实笔记的 frontmatter
                    for (const card of allCards) {
                        if (card.type === 'file') {
                            const file = this.app.vault.getAbstractFileByPath(card.id);
                            if (file instanceof TFile) {
                                await this.app.fileManager.processFrontMatter(file, fm => {
                                    if (fm[yamlGroupProp] === colName) fm[yamlGroupProp] = newName;
                                    // 更新项目环节的中间部分
                                    if (orderMiddleProp && fm[orderMiddleProp] === colName) {
                                        fm[orderMiddleProp] = newName;
                                    }
                                    // 更新完整项目环节值中的中间部分
                                    if (yamlOrderProp && fm[yamlOrderProp]) {
                                        const orderValue = fm[yamlOrderProp];
                                        if (typeof orderValue === 'string') {
                                            const prefix = settings.orderPrefix || '';
                                            const separator = settings.orderSeparator || '-';
                                            const parts = orderValue.split(separator);
                                            // 格式：前缀-中间-后缀，或中间-后缀（如果无前缀）
                                            if (parts.length >= 2) {
                                                let middleIndex = 0;
                                                if (prefix && parts[0] === prefix) {
                                                    // 有前缀：前缀-中间-后缀
                                                    middleIndex = 1;
                                                }
                                                if (parts[middleIndex] === colName) {
                                                    parts[middleIndex] = newName;
                                                    fm[yamlOrderProp] = parts.join(separator);
                                                }
                                            }
                                        }
                                    }
                                });
                            }
                        }
                    }
                    colEl.dataset.colId = newName;
                    await this.plugin.saveSettings(true);
                    new Notice(`列 [${colName}] 已重命名为 [${newName}]`);
                };
            }

            const rightGroupEl = headerTopArea.createDiv("kanban-column-right-group");
            rightGroupEl.createDiv({ cls: "kanban-column-count", text: `${compCount} / ${allCards.length}` });
            const menuBtn = rightGroupEl.createDiv("kanban-col-menu-btn");
            menuBtn.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="5" r="1"></circle><circle cx="12" cy="12" r="1"></circle><circle cx="12" cy="19" r="1"></circle></svg>`;

            if (pBarDisplay !== "none" && !isProgressSync) {
                const progressWrapper = headerEl.createDiv("kanban-column-progress-wrapper"); const progressBg = progressWrapper.createDiv("kanban-column-progress-bg"); const progressFill = progressBg.createDiv("kanban-column-progress-fill");
                // ✅ v1.0.15: 兼容新进度条配置——animated 旧值或直接为动画类型名时均添加 is-animated
                if (pBarDisplay === "animated" || (pBarDisplay !== "simple" && pBarDisplay !== "none")) progressFill.addClass("is-animated");
                const initPercent = allCards.length === 0 ? 0 : Math.round((compCount / allCards.length) * 100); progressFill.style.width = `${initPercent}%`;
            }

            const drawerWrap = headerEl.createDiv("kanban-column-drawer-wrap");
            const toggleBtn = drawerWrap.createDiv("kanban-pinned-toggle-btn");
            const isExpanded = settings.expandedPinnedCols?.[groupByProp]?.includes(colName);
            if (isExpanded) toggleBtn.addClass("is-expanded");

            const columnContent = colEl.createDiv("kanban-column-content");

            const pinnedWrapper = columnContent.createDiv("kanban-pinned-wrapper");
            pinnedWrapper.dataset.animation = settings.pinnedDisplayAnimation || "slide";
            if (isExpanded) pinnedWrapper.addClass("is-expanded");

            const pinnedContainer = pinnedWrapper.createDiv("kanban-pinned-container");
            const pinnedInnerEl = pinnedContainer.createDiv("kanban-pinned-inner");
            if (pinnedCards.length === 0) pinnedInnerEl.addClass("is-empty");
            pinnedInnerEl.dataset.colId = colName; pinnedInnerEl.dataset.isPinned = "true";

            const pinnedHintEl = pinnedInnerEl.createDiv("kanban-pinned-hint");
            pinnedHintEl.textContent = "↑ 拖拽到此置顶 ↑";

            drawerWrap.onclick = async () => {
                if (!this.plugin.settings.expandedPinnedCols) this.plugin.settings.expandedPinnedCols = {};
                if (!this.plugin.settings.expandedPinnedCols[groupByProp]) this.plugin.settings.expandedPinnedCols[groupByProp] = [];
                const expandedSet = new Set(this.plugin.settings.expandedPinnedCols[groupByProp]);
                if (expandedSet.has(colName)) { expandedSet.delete(colName); toggleBtn.removeClass("is-expanded"); pinnedWrapper.removeClass("is-expanded"); }
                else { expandedSet.add(colName); toggleBtn.addClass("is-expanded"); pinnedWrapper.addClass("is-expanded"); }
                this.plugin.settings.expandedPinnedCols[groupByProp] = Array.from(expandedSet);
                await this.plugin.saveSettings(false);
            };

            pinnedCards.forEach((card, idx) => { renderCard(card, idx, pinnedInnerEl, colName, true); });
            initSortable(pinnedInnerEl);

            const bodyEl = columnContent.createDiv("kanban-column-body");
            bodyEl.dataset.colId = colName; bodyEl.dataset.isPinned = "false";
            normalCards.forEach((card, idx) => { renderCard(card, idx, bodyEl, colName, false); });
            initSortable(bodyEl);

            menuBtn.addEventListener("click", (e: MouseEvent) => {
                e.stopPropagation();
                try {
                    const menu = new Menu();
                    if (!this.isArchivedView) {
                        menu.addItem((item: any) => {
                            item.setTitle("新建真实笔记").onClick(() => {
                                const { props, yaml } = getPropsData(colName, "", allCards.length + 1);
                                const defaultFolder2 = settings.defaultNewNoteFolder || (() => { const firstRealFile = entries.find((entryObj:any) => entryObj.file && entryObj.file.parent && entryObj.file.parent.path !== "/"); return firstRealFile ? firstRealFile.file.parent.path : ""; })();
                                new RichCreateModal(this.app, `在列 [${colName}] 中创建真实笔记`, props, false, defaultFolder2, settings.defaultNewNoteProps || [], async (noteName: string, folderPath: string, extraProps) => {
                                    const cleanName = noteName.trim(); let targetFolder = folderPath.trim();
                                    if (!targetFolder) { const firstRealFile = entries.find((entryObj:any) => entryObj.file && entryObj.file.parent); if (firstRealFile) targetFolder = firstRealFile.file.parent.path !== "/" ? firstRealFile.file.parent.path : ""; }
                                    const fullPath = targetFolder ? `${targetFolder}/${cleanName}.md` : `${cleanName}.md`;
                                    if (this.app.vault.getAbstractFileByPath(fullPath)) { new Notice(`文件已存在：${fullPath}`); return; }
                                    if (targetFolder) { try { await this.app.vault.createFolder(targetFolder); } catch(e) {} }
                                    const finalYaml = buildYamlWithExtras(yaml, extraProps);
                                    const fm = `---\n${finalYaml}---\n`;
                                    try { await this.app.vault.create(fullPath, fm); new Notice(`成功创建笔记: ${cleanName}`); this.requestUpdate(); } catch (err: any) { new Notice("创建失败: " + err.message); }
                                }).open();
                            });
                        });

                        // ✅ v1.0.1: 草稿新建时自动写入进度属性为 draftValue
                        menu.addItem((item: any) => {
                            item.setTitle("添加草稿卡片").onClick(() => {
                                const { props } = getPropsData(colName, "", allCards.length + 1);
                                const defaultFolder2 = settings.defaultNewNoteFolder || "";
                                new RichCreateModal(this.app, `在 [${colName}] 列添加草稿卡片`, props, true, defaultFolder2, settings.defaultNewNoteProps || [], async (cardTitle: string, folderPath: string, extraProps) => {
                                    if (cardTitle && cardTitle.trim()) {
                                        const finalOrderValue = isGlobalAuto ? buildOrderValue(colName, "", allCards.length + 1) : "";
                                        const newVc: any = {
                                            id: `vc-${Date.now()}-${Math.floor(Math.random()*1000)}`,
                                            title: cardTitle.trim(),
                                            column: colName,
                                            order: finalOrderValue,
                                            // ✅ v1.0.1: 草稿卡片记录 progressDraftValue，转真实笔记时写入
                                            progressValue: progDraftVal,
                                            body: "",
                                            targetFolder: folderPath.trim()
                                        };
                                        this.plugin.settings.virtualCards.push(newVc);
                                        await this.plugin.saveSettings(true); this.requestUpdate();
                                    }
                                }).open();
                            });
                        });
                        menu.addSeparator();
                    }

                    menu.addItem((item: any) => { item.setTitle("切换呈现方向 (正序/倒序)").onClick(async () => { if (!this.plugin.settings.columnSortDir) this.plugin.settings.columnSortDir = {}; const cur = this.plugin.settings.columnSortDir[colName] || 'asc'; this.plugin.settings.columnSortDir[colName] = cur === 'asc' ? 'desc' : 'asc'; await this.plugin.saveSettings(false); this.requestUpdate(); }); });
                    menu.addItem((item: any) => { item.setTitle("按卡片名称排序 (A-Z)").onClick(async () => { this.plugin.isViewUpdating = true; const cardsArr = Array.from(bodyEl.querySelectorAll(".kanban-card")) as HTMLElement[]; cardsArr.sort((a, b) => (a.querySelector(".kanban-card-title")?.textContent || "").localeCompare(b.querySelector(".kanban-card-title")?.textContent || "")); cardsArr.forEach(el => bodyEl.appendChild(el)); await rewriteColumnOrder(cardsArr, colName, false); new Notice(`已对 [${colName}] 按名称排序`); setTimeout(() => { this.plugin.isViewUpdating = false; }, 800); }); });
                    menu.addItem((item: any) => { item.setTitle("按创建时间排序 (最新到最旧)").onClick(async () => { this.plugin.isViewUpdating = true; const cardsArr = Array.from(bodyEl.querySelectorAll(".kanban-card")) as HTMLElement[]; cardsArr.sort((a, b) => Number(b.dataset.ctime) - Number(a.dataset.ctime)); cardsArr.forEach(el => bodyEl.appendChild(el)); await rewriteColumnOrder(cardsArr, colName, false); new Notice(`已对 [${colName}] 按时间排序`); setTimeout(() => { this.plugin.isViewUpdating = false; }, 800); }); });
                    if (customSortProp) { menu.addItem((item: any) => { item.setTitle(`按属性 [${customSortProp}] 排序`).onClick(async () => { this.plugin.isViewUpdating = true; const cardsArr = Array.from(bodyEl.querySelectorAll(".kanban-card")) as HTMLElement[]; cardsArr.sort((a, b) => { let valA = (a as any)._customVal || ""; let valB = (b as any)._customVal || ""; let numA = parseFloat(valA); let numB = parseFloat(valB); if (!isNaN(numA) && !isNaN(numB)) return numA - numB; return String(valA).localeCompare(String(valB)); }); cardsArr.forEach(el => bodyEl.appendChild(el)); await rewriteColumnOrder(cardsArr, colName, false); new Notice(`已对 [${colName}] 按自定义属性排序`); setTimeout(() => { this.plugin.isViewUpdating = false; }, 800); }); }); }

                    menu.addSeparator();

                    if (!this.isArchivedView) {
                        menu.addItem((item: any) => { item.setTitle("在此视图中隐藏此列").onClick(async () => { if (!this.plugin.settings.hiddenColumns) this.plugin.settings.hiddenColumns = {}; if (!this.plugin.settings.hiddenColumns[groupByProp]) this.plugin.settings.hiddenColumns[groupByProp] = []; if (!this.plugin.settings.hiddenColumns[groupByProp].includes(colName)) { this.plugin.settings.hiddenColumns[groupByProp].push(colName); } await this.plugin.saveSettings(false); this.requestUpdate(); }); });
                        menu.addItem((item: any) => { item.setTitle("移除整个列表 (保留笔记)").onClick(() => { new ConfirmModal(this.app, `确定要移除整个列 [${colName}] 吗？\n列内的笔记不会被删除，仅清空属性。`, async () => { for (const card of allCards) { if (card.type === 'file') { const file = this.app.vault.getAbstractFileByPath(card.id); if (file instanceof TFile) await this.app.fileManager.processFrontMatter(file, fm => { delete fm[yamlGroupProp]; }); } else { const vc = settings.virtualCards.find((v:any) => v.id === card.id); if (vc) vc.column = uncategorizedName; } } this.plugin.settings.columnOrders[groupByProp] = savedCols.filter((c:any) => c !== colName); delete this.plugin.settings.columnWidths[colName]; await this.plugin.saveSettings(true); this.requestUpdate(); }).open(); }); });
                        menu.addItem((item: any) => { item.setTitle("归档列内所有卡片 (保留列表)").onClick(() => { new ConfirmModal(this.app, `确定要归档 [${colName}] 列内的所有卡片吗？\n列表本身将保留在当前视图。`, async () => { let minCtime = Date.now(); let hasCards = false; for (const card of allCards) { if (card.ctime && card.ctime < minCtime) { minCtime = card.ctime; hasCards = true; } } const now = Date.now(); const days = hasCards ? Math.max(1, Math.ceil((now - minCtime) / (1000 * 60 * 60 * 24))) : 0; const durationStr = `${days}天`; const cycleProp = settings.archiveCycleProperty || "任务完成周期"; for (const card of allCards) { if (card.type === 'file') { const file = this.app.vault.getAbstractFileByPath(card.id); if (file instanceof TFile) await this.app.fileManager.processFrontMatter(file, fm => { fm[archiveProp] = true; fm[cycleProp] = durationStr; }); } else { const vc = settings.virtualCards.find((v:any) => v.id === card.id); if (vc) { vc.archived = true; (vc as any).archiveCycle = durationStr; } } } await this.plugin.saveSettings(true); this.requestUpdate(); }).open(); }); });
                        menu.addItem((item: any) => { item.setTitle("归档整个列表及卡片").onClick(() => { new ConfirmModal(this.app, `确定要归档 [${colName}] 吗？\n该列及其所有笔记将在当前及其他视图中隐藏。`, async () => { let minCtime = Date.now(); let hasCards = false; for (const card of allCards) { if (card.ctime && card.ctime < minCtime) { minCtime = card.ctime; hasCards = true; } } const now = Date.now(); const days = hasCards ? Math.max(1, Math.ceil((now - minCtime) / (1000 * 60 * 60 * 24))) : 0; const durationStr = `${days}天`; if (!this.plugin.settings.archivedColumnMeta) this.plugin.settings.archivedColumnMeta = {}; this.plugin.settings.archivedColumnMeta[colName] = { originView: yamlGroupProp, duration: durationStr }; this.plugin.settings.columnOrders[groupByProp] = (this.plugin.settings.columnOrders[groupByProp] || []).filter(c => c !== colName); if (!this.plugin.settings.archivedColumns[groupByProp]) this.plugin.settings.archivedColumns[groupByProp] = []; if (!this.plugin.settings.archivedColumns[groupByProp].includes(colName)) this.plugin.settings.archivedColumns[groupByProp].push(colName); const cycleProp = settings.archiveCycleProperty || "任务完成周期"; for (const card of allCards) { if (card.type === 'file') { const file = this.app.vault.getAbstractFileByPath(card.id); if (file instanceof TFile) await this.app.fileManager.processFrontMatter(file, fm => { fm[archiveProp] = true; fm[cycleProp] = durationStr; }); } else { const vc = settings.virtualCards.find((v:any) => v.id === card.id); if (vc) { vc.archived = true; (vc as any).archiveCycle = durationStr; } } } await this.plugin.saveSettings(true); this.requestUpdate(); }).open(); }); });
                    } else {
                        menu.addItem((item: any) => { item.setTitle("取消归档该列表").onClick(() => { new ConfirmModal(this.app, `确定要恢复 [${colName}] 吗？\n该列及其笔记将重新回到普通视图，并删除归档属性标记。`, async () => { this.plugin.settings.archivedColumns[groupByProp] = (this.plugin.settings.archivedColumns[groupByProp] || []).filter(c => c !== colName); if (!this.plugin.settings.columnOrders[groupByProp]) this.plugin.settings.columnOrders[groupByProp] = []; if (!this.plugin.settings.columnOrders[groupByProp].includes(colName)) this.plugin.settings.columnOrders[groupByProp].push(colName); const cycleProp = settings.archiveCycleProperty || "任务完成周期"; for (const card of allCards) { if (card.type === 'file') { const file = this.app.vault.getAbstractFileByPath(card.id); if (file instanceof TFile) await this.app.fileManager.processFrontMatter(file, fm => { delete fm[archiveProp]; delete fm[cycleProp]; }); } else { const vc = settings.virtualCards.find((v:any) => v.id === card.id); if (vc) { vc.archived = false; delete (vc as any).archiveCycle; } } } if (this.plugin.settings.archivedColumnMeta && this.plugin.settings.archivedColumnMeta[colName]) { delete this.plugin.settings.archivedColumnMeta[colName]; } await this.plugin.saveSettings(true); this.requestUpdate(); }).open(); }); });
                    }
                    menu.addItem((item: any) => { item.setTitle("删除整个列表及笔记 (移至回收站)").onClick(() => { new ConfirmModal(this.app, `【极度危险】\n确定要彻底删除列 [${colName}] 并且将列内所有笔记移入回收站吗？`, async () => { for (const card of allCards) { if (card.type === 'file') { const file = this.app.vault.getAbstractFileByPath(card.id); if (file instanceof TFile) await this.app.fileManager.trashFile(file); } else { this.plugin.settings.virtualCards = settings.virtualCards.filter((v:any) => v.id !== card.id); } } if (this.isArchivedView) { this.plugin.settings.archivedColumns[groupByProp] = savedCols.filter((c:any) => c !== colName); } else { this.plugin.settings.columnOrders[groupByProp] = savedCols.filter((c:any) => c !== colName); } delete this.plugin.settings.columnWidths[colName]; await this.plugin.saveSettings(true); this.requestUpdate(); }).open(); }); });

                    const rect = menuBtn.getBoundingClientRect(); menu.showAtPosition({ x: rect.right, y: rect.bottom + 5 });
                } catch (err) { console.error("Column menu fallback error:", err); }
            });
        });

        const boardSortable = new Sortable(this.boardEl, {
            animation: settings.animationDuration, easing: easingCurve, handle: ".kanban-column-drag-handle",
            filter: ".kanban-col-menu-btn, .kanban-column-resizer", preventOnFilter: false,
            // ✅ v1.0.14: 列拖拽也使用原生 HTML5 拖拽
            forceFallback: false,
            disabled: isDragLocked, ghostClass: 'kanban-column-ghost',
            onStart: (evt: any) => {
                this.boardEl.addClass("is-dragging-column");
                const item = evt.item as HTMLElement;

                // 创建列拖拽预览图像
                const clone = item.cloneNode(true) as HTMLElement;
                clone.style.cssText = `
                    position: fixed; top: -9999px; left: -9999px;
                    width: ${item.offsetWidth}px; height: ${Math.min(item.offsetHeight, 400)}px;
                    overflow: hidden; opacity: 0.95; pointer-events: none; z-index: 9999;
                    box-shadow: 0 12px 32px rgba(0,0,0,0.25);
                    border-radius: 8px; transform: rotate(1deg);
                    border: 2px solid var(--interactive-accent);
                `;
                document.body.appendChild(clone);
                (item as any)._columnDragClone = clone;

                const nativeEvt = evt.originalEvent as DragEvent;
                if (nativeEvt?.dataTransfer) {
                    nativeEvt.dataTransfer.effectAllowed = 'move';
                    nativeEvt.dataTransfer.setDragImage(clone, 60, 20);
                }

                // 不隐藏原始列，让 ghost 占位符可见
                item.style.opacity = '0.4';
            },
            onEnd: async () => {
                this.plugin.isViewUpdating = true;
                this.boardEl.removeClass("is-dragging-column");

                // 清理拖拽预览
                const columns = this.boardEl.querySelectorAll('.kanban-column');
                columns.forEach((col: Element) => {
                    const colEl = col as HTMLElement;
                    colEl.style.opacity = '';
                    const clone = (colEl as any)._columnDragClone;
                    if (clone && clone.parentNode) clone.parentNode.removeChild(clone);
                    delete (colEl as any)._columnDragClone;
                });

                const newOrder = Array.from(this.boardEl.querySelectorAll(".kanban-column")).map(el => (el as HTMLElement).dataset.colId!);
                const hidden = hiddenCols.filter(c => !newOrder.includes(c));
                if (this.isArchivedView) { this.plugin.settings.archivedColumns[groupByProp] = [...newOrder, ...hidden]; }
                else { this.plugin.settings.columnOrders[groupByProp] = [...newOrder, ...hidden]; }
                await this.plugin.saveSettings(false); setTimeout(() => { this.plugin.isViewUpdating = false; }, 2000);
            }
        });
        this.sortables.push(boardSortable);

    } finally {
        this.isRendering = false;
    }
  }
  static getViewOptions() { return [{ displayName: "分组依据", type: "property", key: "groupByProperty", filter: (prop: string) => !prop.startsWith("file."), placeholder: "选择属性" }]; }
}

export default class TaskKanbanPlugin extends Plugin {
  settings: PluginSettings = DEFAULT_SETTINGS;
  isViewUpdating: boolean = false;
  // ✅ v1.0.4: 注册所有活跃的 KanbanView，以便设置变更时立即刷新
  activeKanbanViews: Set<KanbanView> = new Set();

  /** 立即刷新所有活跃看板视图（供设置页调用，无需 bases:refresh-views）*/
  refreshAllKanbanViews() {
    this.activeKanbanViews.forEach(view => { try { view.requestUpdate(); } catch(e) {} });
  }

  async onload() {
    await this.loadSettings();

    if (!this.settings.globalMetaStyles) this.settings.globalMetaStyles = {};
    if (!this.settings.pinnedMetaConfigs) this.settings.pinnedMetaConfigs = {};
    if (!this.settings.expandedPinnedCols) this.settings.expandedPinnedCols = {};
    if (!this.settings.hiddenColumns) this.settings.hiddenColumns = {};
    if (!this.settings.defaultNewNoteProps) this.settings.defaultNewNoteProps = [];
    if (!this.settings.globalHiddenColumns) this.settings.globalHiddenColumns = [];
    if (!this.settings.stageProperty) this.settings.stageProperty = "任务所处阶段";
    if (!this.settings.stageValues) this.settings.stageValues = [];
    if (this.settings.progressBarColor === undefined) this.settings.progressBarColor = "";
    if (!this.settings.progressBarAnimStyle) this.settings.progressBarAnimStyle = "stripes";
    if (!this.settings.progressBarSpeed) this.settings.progressBarSpeed = 0.9;
    if (!this.settings.ghostBorderStyle) this.settings.ghostBorderStyle = "dashed";
    if (!this.settings.orderBadgeStyle) this.settings.orderBadgeStyle = "hash";

    let needSave = false;
    Object.values(this.settings.viewMetaConfigs).forEach(configs => {
        configs.forEach(c => {
            const key = c.type === 'custom' ? c.propKey : c.type;
            if (key && !this.settings.globalMetaStyles[key]) {
                this.settings.globalMetaStyles[key] = { bgColor: (c as any).bgColor || '#e3e8f8', bgOpacity: 100, textColor: (c as any).textColor || '#4a6eb8', fontSize: (c as any).fontSize || 11, fontWeight: 'normal', borderColor: 'transparent', borderWidth: 0, radius: (c as any).radius !== undefined ? (c as any).radius : 4, valueStyles: ((c as any).valueColors || []).map((vc: any) => ({ val: vc.val, bg: vc.bg, bgOpacity: 100, text: vc.text, fontSize: (c as any).fontSize || 11, fontWeight: 'normal', borderColor: 'transparent', borderWidth: 0, radius: (c as any).radius || 4 })) };
                needSave = true;
            }
        });
    });
    if (needSave) await this.saveSettings(false);

    this.addSettingTab(new TaskKanbanSettingTab(this.app, this));
    (this as any).registerBasesView("kanban-view", {
      name: "TaskKanban", icon: "columns",
      factory: (controller: any, scrollEl: HTMLElement) => {
        const view = new KanbanView(controller, scrollEl, this);
        this.activeKanbanViews.add(view);
        return view;
      },
      options: KanbanView.getViewOptions
    });
  }
  async loadSettings() { this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData()); }
  async saveSettings(triggerRefresh = true) { await this.saveData(this.settings); if (triggerRefresh) this.app.workspace.trigger("bases:refresh-views"); }
}
