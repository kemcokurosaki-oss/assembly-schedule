// グリッド複数行選択
let _gridSelection = new Set();
let _lastGridClickId = null;

// リソース表示状態
let isResourceView = false;
let lastOwnerName = '';
let currentResourceOwnerFilter = "";
let _resourceDetailOwner = null; // null=一覧表示, string=特定担当者の詳細表示
const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
const GRID_WIDTH = 1000; // gantt_design.htmlの既存設定に合わせる
// 列幅（gantt_design.htmlの既存設定に合わせる）
const COLUMN_WIDTHS = [55, 55, 250, 50, 60, 30, 40, 40, 60, 60, 60, 60, 110, 44];

// 担当者とCSSクラスのマップ
const ownerColorMap = {
    "米澤":       "owner-yonezawa",
    "桂":         "owner-katsura",
    "香西":       "owner-kozai",
    "古賀":       "owner-koga",
    "長谷川":     "owner-hasegawa",
    "早川":       "owner-hayakawa",
    "廣田":       "owner-hirota",
    "宮本":       "owner-miyamoto",
    "山下":       "owner-yamashita",
    "センティル": "owner-senthil",
    "増田":       "owner-masuda",
    "外注":       "owner-gaichuu",
    "木村(至)":   "owner-kimura-i",
    "木村(圭)":   "owner-kimura-k",
    "守時":       "owner-moritoki",
    "外注(電)":   "owner-gaichuu-e"
};

function getOwnerColorClass(ownerStr) {
    if (!ownerStr) return "owner-default";
    const owners = String(ownerStr).split(/[,、\s]+/).map(o => o.trim());
    for (const owner of owners) {
        if (ownerColorMap[owner]) return ownerColorMap[owner];
    }
    return "owner-default";
}

// レイアウト定義
const mainLayout = {
    css: "gantt_container",
    rows: [
        {
            cols: [
                { view: "grid", group: "grids", scrollY: "scrollVer" },
                { resizer: true, width: 1 },
                { view: "timeline", scrollX: "scrollHor", scrollY: "scrollVer" },
                { view: "scrollbar", id: "scrollVer" }
            ]
        },
        { view: "scrollbar", id: "scrollHor", height: 20 }
    ]
};

// リサイズ機能
(function() {
    let isResizing = false;
    let animationFrameId = null;
    const minHeight = 50;
    const maxHeight = 800;

    window.addEventListener('DOMContentLoaded', () => {
        const resizer = document.getElementById('resource_resizer');
        const panel = document.getElementById('resource_panel');
        const ganttContainer = document.getElementById('gantt_here');

        if (!resizer || !panel) return;

        resizer.addEventListener('mousedown', (e) => {
            isResizing = true;
            document.body.style.cursor = 'ns-resize';
            document.body.style.userSelect = 'none';
            e.preventDefault();
        });

        window.addEventListener('mousemove', (e) => {
            if (!isResizing) return;

            if (animationFrameId) return; // すでに処理待ちならスキップ

            animationFrameId = requestAnimationFrame(() => {
                const windowHeight = window.innerHeight;
                let newHeight = windowHeight - e.clientY;

                if (newHeight < minHeight) newHeight = minHeight;
                if (newHeight > maxHeight) newHeight = maxHeight;
                if (newHeight > windowHeight * 0.8) newHeight = windowHeight * 0.8;

                // パネルの高さを更新（flexboxによりメインガントは自動で縮む）
                panel.style.height = newHeight + 'px';

                // ガントのサイズ調整（描画を伴うので負荷が高い）
                if (window.gantt) {
                    gantt.setSizes();
                }

                animationFrameId = null;
            });
        });

        window.addEventListener('mouseup', () => {
            if (isResizing) {
                isResizing = false;
                document.body.style.cursor = 'default';
                document.body.style.userSelect = '';
                if (animationFrameId) {
                    cancelAnimationFrame(animationFrameId);
                    animationFrameId = null;
                }
                // 最後に確実にサイズを合わせる
                if (window.gantt) {
                    gantt.setSizes();
                }
            }
        });
    });
})();

// リソース表示の列幅定数（担当者名 / 詳細タスク名）
const RESOURCE_OVERVIEW_COL_WIDTH = 120;  // 担当者名列
const RESOURCE_DETAIL_COL_WIDTH   = 350;  // 詳細表示（工事番号＋タスク名列）

// ガントのタイムライン開始位置を取得（グリッド幅＋リサイザー幅を含む正確な値）
function _getRenderedGanttGridWidth() {
    // .gantt_task の offsetLeft がタイムライン開始ピクセルと完全一致する
    const taskEl = document.querySelector('#gantt_here .gantt_task');
    if (taskEl && taskEl.offsetLeft > 0) return taskEl.offsetLeft;
    const gridEl = document.querySelector('#gantt_here .gantt_grid');
    return gridEl ? gridEl.offsetWidth : (gantt.config.grid_width || 834);
}

function updateResourceData() {
    // 指定された担当者の並び順（藤山～松本(英)、外注は除外）
    const targetOwners = ["米澤", "桂", "香西", "古賀", "長谷川", "早川", "廣田", "宮本", "山下", "センティル", "増田", "外注"];

    const activeOwners = [];

    // 各担当者について、該当するタスクがあるかチェック
    targetOwners.forEach(ownerName => {
        let hasTask = false;
        gantt.eachTask(function(task){
            if (hasTask) return;
            const isDetailed = (task.is_detailed === true || String(task.is_detailed).toLowerCase() === "true" || String(task.is_detailed).toLowerCase() === "t" || String(task.is_detailed) === "1");
            const isAssembly = String(task.major_item) === '組立';
            if (!isDetailed && isAssembly && task.owner) {
                const owners = String(task.owner).split(/[,、\s]+/).map(o => o.trim());
                // 田中(善)の場合、"田中(善)" または "田中" が含まれているかチェック
                if (ownerName === "田中(善)") {
                    if (owners.includes("田中(善)") || owners.includes("田中")) {
                        hasTask = true;
                    }
                } else if (owners.includes(ownerName)) {
                    hasTask = true;
                }
            }
        });

        if (hasTask) {
            activeOwners.push(ownerName);
        }
    });

    console.log("Found active owners for resource view:", activeOwners);
    if (_resourceDetailOwner) {
        renderOwnerDetailTimeline(_resourceDetailOwner);
    } else {
        renderResourceTimeline(activeOwners);
    }
}

function renderResourceTimeline(owners) {
    const container = document.getElementById("resource_content_inner");
    if (!container) return;
    container.innerHTML = "";

    if (owners.length === 0) {
        container.innerHTML = `<div class="resource-placeholder" style="padding:20px; text-align:center; color:#999;">組立タスク（major_item: 組立）に担当者が設定されていません</div>`;
        renderResourceCalendarHeader();
        return;
    }

    const scale = gantt.getScale();
    const timelineWidth = scale.full_width;
    const columnWidth = scale.col_width;
    // 全画面時は専用幅、ボトムパネル時はガントのグリッド幅に合わせる
    const actualGridWidth = isResourceFullscreen ? RESOURCE_OVERVIEW_COL_WIDTH : (_getRenderedGanttGridWidth());
    const totalWidth = actualGridWidth + timelineWidth;
    const firstPos = gantt.posFromDate(scale.trace_x[0]);

    const gridBackground = `repeating-linear-gradient(to right, transparent, transparent ${columnWidth - 1}px, #ebebeb ${columnWidth - 1}px, #ebebeb ${columnWidth}px), repeating-linear-gradient(to bottom, transparent, transparent 29px, #ebebeb 29px, #ebebeb 30px)`;

    let weekendBackgroundHtml = "";
    if (gantt.getState().scale_unit === "day") {
        scale.trace_x.forEach((date, i) => {
            if (date.getDay() === 0 || date.getDay() === 6 || _isHoliday(date)) {
                weekendBackgroundHtml += `<div style="position: absolute; top: 0; bottom: 0; left: ${i * columnWidth}px; width: ${columnWidth}px; background: #f4f4f4; z-index: 0;"></div>`;
            }
        });
    }

    const backgroundStyle = `background-image: ${gridBackground}; background-position: ${-firstPos}px 0; background-size: ${columnWidth}px 30px; height: 100%;`;
    const todayPos = gantt.posFromDate(new Date());
    const todayLineHtml = `<div class="resource-today-line" style="left: ${todayPos}px;"></div>`;

    let html = `<div style="width: ${totalWidth}px;">`; // 全体の幅を指定するコンテナを追加
    // 担当者1人につき3行（組立・組立場所・出張）で表示
    const TASK_TYPE_ROWS = [
        { type: 'drawing',       label: '組立' },
        { type: 'business_trip', label: '出張' },
    ];

    owners.forEach((ownerName) => {
        // この担当者の全タスクを収集
        const allOwnerTasks = [];
        gantt.eachTask(t => {
            const isDetailed = (t.is_detailed === true || String(t.is_detailed).toLowerCase() === "true" || String(t.is_detailed).toLowerCase() === "t" || String(t.is_detailed) === "1");
            const isAssembly = String(t.major_item) === '組立';
            let isMatch = false;
            if (!isDetailed && isAssembly && t.owner) {
                const taskOwners = String(t.owner).split(/[,、\s]+/).map(o => o.trim());
                if (ownerName === "田中(善)") {
                    isMatch = taskOwners.includes("田中(善)") || taskOwners.includes("田中");
                } else {
                    isMatch = taskOwners.includes(ownerName);
                }
            }
            if (isMatch) allOwnerTasks.push(t);
        });

        const colorClass = getOwnerColorClass(ownerName);
        const textColor = "#fff";

        // 4行（タスク種別ごと）を描画
        TASK_TYPE_ROWS.forEach((rowDef, rowIndex) => {
            const rowTasks = allOwnerTasks.filter(t => {
                const tt = t.task_type;
                if (rowDef.type === 'drawing') {
                    // null・空・'drawing' はすべて組立タスクとして扱う
                    return !tt || tt === '' || String(tt) === 'null' || tt === 'drawing';
                }
                return String(tt) === rowDef.type;
            });
            const isFirstRow = rowIndex === 0;
            const isLastRow  = rowIndex === TASK_TYPE_ROWS.length - 1;

            // 担当者の区切り線（先頭行の上に太線）
            const borderTop    = isFirstRow ? 'border-top: 2px solid #aaa;' : '';
            const borderBottom = isLastRow  ? 'border-bottom: 2px solid #aaa;' : 'border-bottom: 1px solid #eee;';

            // 左セル：先頭行は担当者名＋ラベル、2行目以降はラベルのみ
            const labelColor = rowDef.type === 'drawing' ? '#2e7d32' : '#0277bd';
            const labelBg    = rowDef.type === 'drawing' ? '#e8f5e9' : '#e3f2fd';
            const leftCellContent = isFirstRow
                ? `<div style="width:100%;display:flex;align-items:center;justify-content:space-between;padding:0 5px;box-sizing:border-box;">
                       <div class="resource-owner-link" onclick="showOwnerDetail('${ownerName}')" title="クリックして詳細表示" style="font-weight:bold;font-size:11px;color:#333;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;">${ownerName}</div>
                       <div style="font-size:10px;color:${labelColor};background:${labelBg};border-radius:2px;padding:1px 4px;margin-left:3px;white-space:nowrap;font-weight:bold;">${rowDef.label}</div>
                   </div>`
                : `<div style="width:100%;display:flex;align-items:center;justify-content:flex-end;padding-right:5px;">
                       <div style="font-size:10px;color:${labelColor};background:${labelBg};border-radius:2px;padding:1px 4px;white-space:nowrap;font-weight:bold;">${rowDef.label}</div>
                   </div>`;

            html += `
                <div class="resource-item" style="display:flex;${borderTop}${borderBottom}min-height:30px;height:30px;align-items:stretch;width:${totalWidth}px;">
                    <div class="resource-grid-container" style="width:${actualGridWidth}px;min-width:${actualGridWidth}px;flex-shrink:0;display:flex;border-right:1px solid #ddd;background:${isFirstRow ? '#efefef' : '#f9f9f9'};position:sticky;left:0;z-index:5;">
                        ${leftCellContent}
                    </div>
                    <div class="resource-timeline" style="width:${timelineWidth}px;flex-shrink:0;position:relative;background:#fff;">
                        <div style="position:absolute;top:0;left:0;right:0;bottom:0;z-index:0;">${weekendBackgroundHtml}</div>
                        <div style="position:absolute;top:0;left:0;right:0;bottom:0;${backgroundStyle}z-index:1;"></div>
                        ${todayLineHtml}
                        <div style="position:absolute;top:0;left:0;right:0;bottom:0;z-index:2;">
            `;

            rowTasks.forEach(t => {
                const left  = gantt.posFromDate(t.start_date);
                const right = gantt.posFromDate(t.end_date);
                const width = Math.max(2, right - left);
                html += `
                    <div class="resource-cell-bar ${colorClass}"
                         style="position:absolute;top:4px;height:22px;left:${left}px;width:${width}px;z-index:10;"
                         title="${t.text} (${t.project_number})">
                         <span class="resource-bar-text" style="color:${textColor};font-size:11px;font-weight:bold;">${t.project_number || ""} ${t.text}</span>
                    </div>
                `;
            });

            html += `
                        </div>
                    </div>
                </div>
            `;
        });
    });
    html += `</div>`; // 閉じタグを追加

    container.innerHTML = html;
    renderResourceCalendarHeader();
    syncResourceScroll();
}

function renderOwnerDetailTimeline(ownerName) {
    const container = document.getElementById("resource_content_inner");
    if (!container) return;
    container.innerHTML = "";

    const scale = gantt.getScale();
    const timelineWidth = scale.full_width;
    const columnWidth = scale.col_width;
    // 全画面時は専用幅、ボトムパネル時はガントのグリッド幅に合わせる
    const actualGridWidth = isResourceFullscreen ? RESOURCE_DETAIL_COL_WIDTH : (_getRenderedGanttGridWidth());
    const totalWidth = actualGridWidth + timelineWidth;
    const firstPos = gantt.posFromDate(scale.trace_x[0]);

    const gridBackground = `repeating-linear-gradient(to right, transparent, transparent ${columnWidth - 1}px, #ebebeb ${columnWidth - 1}px, #ebebeb ${columnWidth}px), repeating-linear-gradient(to bottom, transparent, transparent 29px, #ebebeb 29px, #ebebeb 30px)`;

    let weekendBackgroundHtml = "";
    if (gantt.getState().scale_unit === "day") {
        scale.trace_x.forEach((date, i) => {
            if (date.getDay() === 0 || date.getDay() === 6 || _isHoliday(date)) {
                weekendBackgroundHtml += `<div style="position: absolute; top: 0; bottom: 0; left: ${i * columnWidth}px; width: ${columnWidth}px; background: #f4f4f4; z-index: 0;"></div>`;
            }
        });
    }

    const backgroundStyle = `background-image: ${gridBackground}; background-position: ${-firstPos}px 0; background-size: ${columnWidth}px 30px;`;
    const todayPos = gantt.posFromDate(new Date());
    const todayLineHtml = `<div class="resource-today-line" style="left: ${todayPos}px;"></div>`;

    // 担当者のタスクを収集
    const ownerTasks = [];
    gantt.eachTask(t => {
        const isDetailed = (t.is_detailed === true || String(t.is_detailed).toLowerCase() === "true" || String(t.is_detailed).toLowerCase() === "t" || String(t.is_detailed) === "1");
        const isAssembly = String(t.major_item) === '組立';
        let isMatch = false;
        if (!isDetailed && isAssembly && t.owner) {
            const taskOwners = String(t.owner).split(/[,、\s]+/).map(o => o.trim());
            if (ownerName === "田中(善)") {
                isMatch = taskOwners.includes("田中(善)") || taskOwners.includes("田中");
            } else {
                isMatch = taskOwners.includes(ownerName);
            }
        }
        if (isMatch) ownerTasks.push(t);
    });

    // 工事番号昇順でソート
    ownerTasks.sort((a, b) => {
        const pa = String(a.project_number || '');
        const pb = String(b.project_number || '');
        return pa.localeCompare(pb, undefined, { numeric: true });
    });

    if (ownerTasks.length === 0) {
        container.innerHTML = `<div style="padding:20px; text-align:center; color:#999;">タスクがありません</div>`;
        return;
    }

    const TYPE_COL_WIDTH = 30;
    const PROJ_COL_WIDTH = 60;

    const colorClass = getOwnerColorClass(ownerName);
    const textColor = "#fff";

    let html = `<div style="width: ${totalWidth}px;">`;
    ownerTasks.forEach(t => {
        const hasDate = !t.has_no_date && t.start_date && t.end_date;
        const left = hasDate ? gantt.posFromDate(t.start_date) : 0;
        const right = hasDate ? gantt.posFromDate(t.end_date) : 0;
        const barWidth = hasDate ? Math.max(2, right - left) : 0;
        const tt = t.task_type;
        const typeLabel = (!tt || tt === '' || String(tt) === 'null' || tt === 'drawing') ? '組立' : (tt === 'business_trip' ? '出張' : tt);

        html += `
            <div class="resource-item" style="display: flex; border-bottom: 1px solid #eee; min-height: 30px; height: 30px; align-items: stretch; width: ${totalWidth}px;">
                <div class="resource-grid-container" style="width: ${actualGridWidth}px; min-width: ${actualGridWidth}px; flex-shrink: 0; display: flex; border-right: 1px solid #ddd; background: #f9f9f9; position: sticky; left: 0; z-index: 5; overflow: hidden;">
                    <div style="display: flex; align-items: stretch; width: 100%; overflow: hidden; white-space: nowrap;">
                        <div style="flex-shrink: 0; width: ${TYPE_COL_WIDTH}px; min-width: ${TYPE_COL_WIDTH}px; display: flex; align-items: center; justify-content: center; font-size: 10px; color: ${typeLabel === '出張' ? '#0277bd' : '#2e7d32'}; font-weight: bold; border-right: 1px solid #e0e0e0; background: ${typeLabel === '出張' ? '#e3f2fd' : '#e8f5e9'};">${typeLabel}</div>
                        <div style="flex-shrink: 0; width: ${PROJ_COL_WIDTH}px; min-width: ${PROJ_COL_WIDTH}px; display: flex; align-items: center; padding: 0 4px; font-size: 12px; font-weight: bold; color: #546e7a; border-right: 1px solid #e0e0e0; overflow: hidden;">${t.project_number || '-'}</div>
                        <div style="flex: 1; display: flex; align-items: center; padding: 0 6px; font-size: 12px; color: #333; overflow: hidden; text-overflow: ellipsis;">${t.text}</div>
                    </div>
                </div>
                <div class="resource-timeline" style="width: ${timelineWidth}px; flex-shrink: 0; position: relative; background: #fff; overflow: hidden; z-index: 2;">
                    <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; z-index: 0;">${weekendBackgroundHtml}</div>
                    <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; ${backgroundStyle} z-index: 1;"></div>
                    ${todayLineHtml}
                    ${hasDate ? `
                    <div class="resource-cell-bar ${colorClass}"
                         style="position: absolute; top: 4px; height: 22px; left: ${left}px; width: ${barWidth}px; z-index: 10;"
                         title="${t.text} (${t.project_number})">
                         <span class="resource-bar-text" style="color:${textColor}; font-size:11px; font-weight:bold;">${t.project_number || ""} ${t.text}</span>
                    </div>` : ''}
                </div>
            </div>
        `;
    });
    html += `</div>`;
    container.innerHTML = html;
    _updateDetailToolbar(actualGridWidth);
    renderResourceCalendarHeader();
    syncResourceScroll();
}

const _DOW_NAMES = ['日', '月', '火', '水', '木', '金', '土'];

function renderResourceCalendarHeader() {
    const header = document.getElementById('resource_calendar_header');
    if (!header) return;
    // ボトムパネル時はカレンダーヘッダー不要
    if (!isResourceFullscreen) {
        header.style.display = 'none';
        return;
    }
    header.style.display = '';

    const scale = gantt.getScale();
    const timelineWidth = scale.full_width;
    const columnWidth = scale.col_width;
    // 全画面時は専用幅、ボトムパネル時はガントのグリッド幅に合わせる
    const actualGridWidth = isResourceFullscreen
        ? (_resourceDetailOwner ? RESOURCE_DETAIL_COL_WIDTH : RESOURCE_OVERVIEW_COL_WIDTH)
        : (_getRenderedGanttGridWidth());
    const dates = scale.trace_x;
    const unit = gantt.getState().scale_unit;

    // 月グループを作成
    const months = [];
    let curMonth = -1, curYear = -1, monthStart = 0;
    dates.forEach((date, i) => {
        const m = date.getMonth(), y = date.getFullYear();
        if (m !== curMonth || y !== curYear) {
            if (curMonth !== -1) months.push({ month: curMonth, year: curYear, count: i - monthStart });
            curMonth = m; curYear = y; monthStart = i;
        }
    });
    if (dates.length > 0) months.push({ month: curMonth, year: curYear, count: dates.length - monthStart });

    // 月行HTML
    let monthHtml = '';
    months.forEach(m => {
        const w = m.count * columnWidth;
        monthHtml += `<div class="resource-cal-cell resource-cal-month" style="width:${w}px;min-width:${w}px;height:22px;">${m.year}年${m.month + 1}月</div>`;
    });

    // 日/週行HTML・曜日行HTML（日単位のみ曜日行あり）
    let dayHtml = '';
    let dowHtml = '';
    dates.forEach(date => {
        const dow = date.getDay();
        const isSun = dow === 0;
        const isSat = dow === 6;
        const isHol = _isHoliday(date);
        const wkCls = (isSun || isSat || isHol) ? ' resource-cal-weekend' : '';
        const dowColor = isSun ? 'color:#ffcccc;' : (isSat || isHol) ? 'color:#cce0ff;' : '';
        const d = date.getDate();

        if (unit === 'day') {
            dayHtml += `<div class="resource-cal-cell${wkCls}" style="width:${columnWidth}px;min-width:${columnWidth}px;height:18px;${dowColor}">${d}</div>`;
            dowHtml += `<div class="resource-cal-cell${wkCls}" style="width:${columnWidth}px;min-width:${columnWidth}px;height:18px;${dowColor}">${_DOW_NAMES[dow]}</div>`;
        } else {
            // 週単位：日付のみ表示（曜日行なし）
            dayHtml += `<div class="resource-cal-cell" style="width:${columnWidth}px;min-width:${columnWidth}px;height:18px;">${d}</div>`;
        }
    });

    const dowRow = unit === 'day' ? `
        <div class="cal-row" style="height:18px;">
            <div class="cal-spacer" style="width:${actualGridWidth}px;min-width:${actualGridWidth}px;height:18px;"></div>
            <div id="resource_cal_scroll3" style="overflow:hidden;flex:1;">
                <div style="display:flex;width:${timelineWidth}px;">${dowHtml}</div>
            </div>
        </div>` : '';

    header.innerHTML = `
        <div class="cal-row" style="height:22px;">
            <div class="cal-spacer" style="width:${actualGridWidth}px;min-width:${actualGridWidth}px;height:22px;"></div>
            <div id="resource_cal_scroll" style="overflow:hidden;flex:1;">
                <div style="display:flex;width:${timelineWidth}px;">${monthHtml}</div>
            </div>
        </div>
        <div class="cal-row" style="height:18px;">
            <div class="cal-spacer" style="width:${actualGridWidth}px;min-width:${actualGridWidth}px;height:18px;"></div>
            <div id="resource_cal_scroll2" style="overflow:hidden;flex:1;">
                <div style="display:flex;width:${timelineWidth}px;">${dayHtml}</div>
            </div>
        </div>
        ${dowRow}
    `;
}

function _updateDetailToolbar(gridWidth) {
    const toolbar = document.getElementById('resource_detail_toolbar');
    if (!toolbar) return;
    if (_resourceDetailOwner) {
        toolbar.style.display = 'block';
        // ボタン右端をグリッド境界（gridWidth px）に揃える
        toolbar.innerHTML = `<div style="width:${gridWidth}px;height:100%;display:flex;justify-content:space-between;align-items:center;padding:0 6px;box-sizing:border-box;"><span style="font-size:13px;font-family:'メイリオ',Meiryo,sans-serif;color:#333;font-weight:bold;">${_resourceDetailOwner}さんの詳細リソース状況</span><button onclick="showOwnerOverview()" style="font-size:11px;padding:2px 10px;background:#fff;border:1px solid #aaa;border-radius:3px;cursor:pointer;font-family:'メイリオ',Meiryo,sans-serif;color:#333;">← 一覧に戻る</button></div>`;
    } else {
        toolbar.style.display = 'none';
        toolbar.innerHTML = '';
    }
}

function showOwnerDetail(ownerName) {
    _resourceDetailOwner = ownerName;
    document.getElementById('resource_title').textContent = `${ownerName}さんの詳細リソース状況`;
    renderOwnerDetailTimeline(ownerName);
}

function showOwnerOverview() {
    _resourceDetailOwner = null;
    _updateDetailToolbar(0);
    document.getElementById('resource_title').textContent = '担当者別リソース状況';
    updateResourceData();
}

function syncResourceScroll() {
    const left = gantt.getScrollState().x;
    const resourceContent = document.querySelector(".resource-content");
    if (resourceContent) resourceContent.scrollLeft = left;
    _syncCalendarHeaderScroll(left);
}

function _syncCalendarHeaderScroll(left) {
    const s1 = document.getElementById('resource_cal_scroll');
    const s2 = document.getElementById('resource_cal_scroll2');
    const s3 = document.getElementById('resource_cal_scroll3');
    if (s1) s1.scrollLeft = left;
    if (s2) s2.scrollLeft = left;
    if (s3) s3.scrollLeft = left;
}

// リソース全画面モードに入る（フィルターなし初期表示用）
function _enterResourceFullscreen() {
    isResourceFullscreen = true;
    isResourceView = true;
    // 担当者フィルターをリセット
    currentOwnerFilter = [];
    document.querySelectorAll('.owner-chk-item').forEach(chk => { chk.checked = false; });
    const allChk = document.getElementById('owner_chk_all');
    if (allChk) allChk.checked = true;
    _updateOwnerFilterBtn();
    const panel = document.getElementById("resource_panel");
    const ganttEl = document.getElementById("gantt_here");
    const btn = document.getElementById("resource_toggle");
    panel.classList.add('resource-fullscreen');
    // ガントを一時的に表示したままリサイズを確定させてからリソース描画
    ganttEl.style.visibility = "hidden";
    gantt.setSizes();
    updateResourceData();
    ganttEl.style.visibility = "";
    ganttEl.style.display = "none";
    panel.style.display = "flex";
    void panel.offsetHeight; // 強制リフロー：レイアウトを確定させる
    btn.style.display = "none";
    document.getElementById("resource_close_btn").style.display = "none";
    document.querySelector(".resource-header-bar").style.display = "none";
    updateFilterButtons();
    // レイアウト確定後にスクロール位置を設定
    setTimeout(() => {
        const todayX = gantt.posFromDate(new Date());
        const scrollX = Math.max(0, todayX - 300);
        const resourceContent = document.querySelector('.resource-content');
        if (resourceContent) resourceContent.scrollLeft = scrollX;
        _syncCalendarHeaderScroll(scrollX);
    }, 50);
}

// リソース全画面モードを抜けてガントビューへ
function _exitResourceFullscreen() {
    isResourceFullscreen = false;
    isResourceView = false;
    const panel = document.getElementById("resource_panel");
    const ganttEl = document.getElementById("gantt_here");
    const btn = document.getElementById("resource_toggle");
    panel.classList.remove('resource-fullscreen');
    panel.style.display = "none";
    ganttEl.style.display = "";
    btn.style.display = ""; // リソースボタンを復元
    btn.innerText = "リソース表示";
    document.getElementById("resource_close_btn").style.display = "";
    updateFilterButtons();
    setTimeout(() => {
        gantt.setSizes();
        const currentLevel = document.querySelector('.zoom-btn.active')?.textContent === '週単位' ? 'week' : 'day';
        gantt.ext.zoom.setLevel(currentLevel);
        // スクロールを微小に動かしてタイムラインを強制再描画
        const s = gantt.getScrollState();
        gantt.scrollTo(s.x + 1, s.y);
        requestAnimationFrame(() => gantt.scrollTo(s.x, s.y));
    }, 50);
}

function toggleResourceView() {
    if (isResourceFullscreen) return; // 全画面モード中は通常トグル不可
    isResourceView = !isResourceView;
    const btn = document.getElementById("resource_toggle");
    const panel = document.getElementById("resource_panel");

    if (isResourceView) {
        btn.innerText = "リソース表示×";
        btn.classList.add("btn-info");
        // コンテンツを描画してからパネルを表示（古い内容が一瞬見えるのを防ぐ）
        updateResourceData();
        panel.style.display = "flex";
    } else {
        btn.innerText = "リソース表示";
        btn.classList.remove("btn-info");
        panel.style.display = "none";
        // 詳細モードをリセット
        _resourceDetailOwner = null;
        document.getElementById('resource_title').textContent = '担当者別リソース状況';
        document.getElementById('resource_back_btn').style.display = 'none';
    }

    setTimeout(() => {
        gantt.setSizes();
        const currentLevel = document.querySelector('.zoom-btn.active')?.textContent === '週単位' ? 'week' : 'day';
        gantt.ext.zoom.setLevel(currentLevel);
        // スクロールを微小に動かしてタイムラインを強制再描画
        const s = gantt.getScrollState();
        gantt.scrollTo(s.x + 1, s.y);
        requestAnimationFrame(() => gantt.scrollTo(s.x, s.y));
    }, 50);
}

// 今日の赤線：.gantt_task（ビューポート全高）に配置し、
// .gantt_data_area の offsetLeft でスクロール量を自動取得して位置補正
function _drawMainTodayLine() {
    const taskEl = document.querySelector('#gantt_here .gantt_task');
    if (!taskEl) return;
    const dataArea = taskEl.querySelector('.gantt_data_area');
    if (!dataArea) return;

    let line = document.getElementById('main_today_line');
    if (!line) {
        line = document.createElement('div');
        line.id = 'main_today_line';
        line.style.cssText = 'position:absolute;bottom:0;width:2px;background:#ff4d4d;z-index:6;pointer-events:none;';
        taskEl.appendChild(line);
    }
    // dataArea.offsetLeft = −スクロール量（DHTMLX がスクロール時に left を負に設定）
    // posFromDate(today) = タイムライン絶対座標
    // 合計 = .gantt_task 内でのビュー座標（正しい表示位置）
    line.style.left = (dataArea.offsetLeft + gantt.posFromDate(new Date())) + 'px';
    line.style.top = (gantt.config.scale_height || 60) + 'px';
}
function _applyGanttScaleWeekendClasses() {
    const scale = gantt.getScale();
    if (!scale || !scale.trace_x) return;
    const dates = scale.trace_x;
    const scaleLines = document.querySelectorAll('#gantt_here .gantt_scale_line');
    scaleLines.forEach((line, lineIdx) => {
        if (lineIdx === 0) return; // 月行はスキップ
        const cells = line.querySelectorAll('.gantt_scale_cell');
        cells.forEach((cell, i) => {
            const date = dates[i];
            if (!date) return;
            const dow = date.getDay();
            cell.classList.remove('gantt-scale-sun', 'gantt-scale-sat');
            if (dow === 0) cell.classList.add('gantt-scale-sun');
            else if (dow === 6) cell.classList.add('gantt-scale-sat');
        });
    });
}
gantt.attachEvent("onGanttRender", _drawMainTodayLine);
gantt.attachEvent("onGanttRender", _applyGanttScaleWeekendClasses);
gantt.attachEvent("onGanttRender", function() { requestAnimationFrame(_renderWishDateMarks); });
gantt.attachEvent("onGanttScroll",  function() { _renderWishDateMarks(); });

function _toDateStr(d) {
    return d.getFullYear() + '-' +
        String(d.getMonth() + 1).padStart(2, '0') + '-' +
        String(d.getDate()).padStart(2, '0');
}

async function _saveWishDate(taskId, dateStr) {
    const { error } = await supabaseClient
        .from('tasks')
        .update({ wish_date: dateStr })
        .eq('id', taskId);
    if (error) console.error('wish_date 保存エラー:', error);
}

// onBeforeTaskDisplay と同じフィルター条件を手動で判定
function _isTaskDisplayed(task) {
    const isDetailed = (task.is_detailed === true || String(task.is_detailed).toUpperCase() === 'TRUE');
    if (isDetailed) return false;
    if (String(task.major_item) !== '組立') return false;
    if (currentProjectFilter.length > 0 && !currentProjectFilter.includes(String(task.project_number))) return false;
    if (currentTaskTypeFilter) {
        const tt = task.task_type;
        const isNull = (tt === null || tt === undefined || tt === '' || String(tt) === 'null');
        if (currentTaskTypeFilter === 'drawing') {
            if (!isNull && String(tt) !== 'drawing') return false;
        } else {
            if (String(tt) !== currentTaskTypeFilter) return false;
        }
    }
    if (currentOwnerFilter.length > 0) {
        const taskOwners = String(task.owner || '').split(/[,、\s]+/).map(o => o.trim());
        if (!currentOwnerFilter.some(f => taskOwners.includes(f))) return false;
    }
    return true;
}

function _renderWishDateMarks() {
    const dataArea = document.querySelector('#gantt_here .gantt_data_area');
    if (!dataArea) return;
    dataArea.querySelectorAll('.wish-date-mark').forEach(el => el.remove());

    const label = currentTaskTypeFilter === 'long_lead_item' ? '手配期日' : '出希望日';

    gantt.eachTask(function(task) {
        if (!task.wish_date) return;
        if (!_isTaskDisplayed(task)) return;

        const parts = String(task.wish_date).split('-');
        if (parts.length !== 3) return;
        const wishDate = new Date(+parts[0], +parts[1] - 1, +parts[2]);
        if (isNaN(wishDate.getTime())) return;

        // getTaskPosition でDOM不要の垂直位置を取得（タイムライン範囲外でも動作）
        let top;
        if (typeof gantt.getTaskPosition === 'function') {
            const pos = gantt.getTaskPosition(task, task.start_date, task.end_date);
            if (!pos) return;
            top = pos.top;
        } else {
            const taskNode = gantt.getTaskNode(task.id);
            if (!taskNode) return;
            top = taskNode.classList.contains('hidden_bar')
                ? (parseInt(taskNode.style.top) || 0)
                : taskNode.offsetTop;
        }

        // 完了予定日/手配予定日が希望日を過ぎていたら赤
        let isOverdue = false;
        if (!task.has_no_date && task.end_date) {
            // gantt内部のend_date は排他的終了日（+1日）なので-1日して実際の完了日と比較
            const actualEnd = gantt.date.add(new Date(task.end_date), -1, 'day');
            actualEnd.setHours(0, 0, 0, 0);
            const wishDay = new Date(wishDate);
            wishDay.setHours(0, 0, 0, 0);
            isOverdue = actualEnd > wishDay;
        }

        const x = gantt.posFromDate(gantt.date.add(wishDate, 1, 'day'));
        const el = document.createElement('div');
        el.className = 'wish-date-mark';
        el.style.left = x + 'px';
        el.style.top  = top + 'px';
        if (isOverdue) { el.style.color = '#c62828'; el.style.webkitTextStroke = '3.5px #fff'; el.style.paintOrder = 'stroke fill'; }
        el.title = label + ': ' + task.wish_date;
        el.textContent = '▼';
        dataArea.appendChild(el);

        // ドラッグで wish_date を変更
        el.addEventListener('mousedown', function(e) {
            e.stopPropagation();
            e.preventDefault();
            const startClientX = e.clientX;
            const startLeft    = parseFloat(el.style.left);
            let   currentLeft  = startLeft;
            el.classList.add('dragging');

            function onMove(e) {
                currentLeft = startLeft + (e.clientX - startClientX);
                el.style.left = currentLeft + 'px';
            }
            function onUp() {
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup',   onUp);
                el.classList.remove('dragging');
                const newDate = gantt.dateFromPos
                    ? gantt.dateFromPos(currentLeft)
                    : null;
                if (!newDate) return;
                const dateStr = _toDateStr(newDate);
                task.wish_date = dateStr;
                el.title = label + ': ' + dateStr;
                _saveWishDate(task.id, dateStr);
                requestAnimationFrame(_renderWishDateMarks);
            }
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup',   onUp);
        });
    });
}

// スクロール同期のイベント登録
gantt.attachEvent("onGanttScroll", function (left, top){
    _drawMainTodayLine(); // 横スクロール時に赤線位置を追従
    if (!isResourceFullscreen) {
        // ガント表示中のみリソースパネルと同期（全画面モード中は干渉しない）
        const resourceContent = document.querySelector(".resource-content");
        if (resourceContent) resourceContent.scrollLeft = left;
        _syncCalendarHeaderScroll(left);
    }
});

window.addEventListener('DOMContentLoaded', () => {
    const resourceContent = document.querySelector(".resource-content");
    if (resourceContent) {
        resourceContent.addEventListener('scroll', function() {
            // カレンダーヘッダーは常に同期
            _syncCalendarHeaderScroll(this.scrollLeft);
            // ガント表示中のみガントと同期（全画面モード中は非表示のガントに触らない）
            if (!isResourceFullscreen) {
                const ganttScroll = gantt.getScrollState();
                if (Math.abs(ganttScroll.x - this.scrollLeft) > 1) {
                    gantt.scrollTo(this.scrollLeft, null);
                }
            }
        });
    }
    document.getElementById('resource_close_btn').onclick = toggleResourceView;
});
