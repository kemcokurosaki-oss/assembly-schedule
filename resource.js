// ===== グローバル変数 =====

// グリッド複数行選択
let _gridSelection = new Set();
let _lastGridClickId = null;

// リソース表示状態
let isResourceView = false;
let lastOwnerName = '';
let currentResourceOwnerFilter = "";
let _resourceDetailOwner = null; // null=一覧表示, string=特定担当者の詳細表示
let isResourceFullscreen = false;

// フィルター状態
let currentTaskTypeFilter = null; // null = 全表示
let currentProjectFilter = [];    // 空配列 = 全工事番号
let currentOwnerFilter = [];      // 空配列 = 全担当者

// 休日セット（"YYYY-MM-DD" 形式で保持）
let HOLIDAYS = new Set();

// 完了日クリア用
let _clearingEndDateId = null;

// 定数
const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
const GRID_WIDTH = 1000;
const COLUMN_WIDTHS = [55, 55, 250, 50, 60, 30, 40, 40, 60, 60, 60, 60, 110, 44];

// リソース表示の列幅定数
const RESOURCE_OVERVIEW_COL_WIDTH = 120;
const RESOURCE_DETAIL_COL_WIDTH   = 350;

// 担当者とCSSクラスのマップ
const ownerColorMap = {
    "藤山": "owner-fujiyama",
    "田中(善)": "owner-tanaka",
    "田中": "owner-tanaka",
    "安岡": "owner-yasuoka",
    "川邊": "owner-kawabe",
    "檀": "owner-dan",
    "堀井": "owner-horii",
    "宮﨑": "owner-miyazaki",
    "津田": "owner-tsuda",
    "古村": "owner-komura",
    "柴田": "owner-shibata",
    "橋本": "owner-hashimoto",
    "松本(英)": "owner-matsumoto"
};

// ===== ユーティリティ関数 =====

function getOwnerColorClass(ownerName) {
    return ownerColorMap[ownerName] || '';
}

function _toDateStr(date) {
    if (!date) return '';
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function _isHoliday(date) {
    const dateStr = _toDateStr(date);
    return HOLIDAYS.has(dateStr);
}

function _getRenderedGanttGridWidth() {
    const gridEl = document.querySelector('#gantt_here .gantt_grid');
    if (!gridEl) return GRID_WIDTH;
    const computed = window.getComputedStyle(gridEl);
    const width = parseFloat(computed.width);
    return isNaN(width) ? GRID_WIDTH : width;
}

// ===== 表示制御機能 =====

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

function _applyGridSelection() {
    document.querySelectorAll('#gantt_here .gantt_grid_data .gantt_row[task_id]').forEach(row => {
        const taskId = row.getAttribute('task_id');
        if (_gridSelection.has(taskId)) {
            row.classList.add('selected');
        } else {
            row.classList.remove('selected');
        }
    });
}

function _updateMultiDeleteButton() {
    const btn = document.getElementById('multi_delete_btn');
    const count = document.getElementById('multi_delete_count');
    if (btn && count) {
        if (_gridSelection.size > 0) {
            btn.style.display = '';
            count.textContent = _gridSelection.size;
        } else {
            btn.style.display = 'none';
        }
    }
}

function _calcInsertAfterSortOrder(sourceId) {
    const src = gantt.getTask(sourceId);
    const projectNumber = src.project_number;
    const taskType = src.task_type;
    const _getSO = t => (t.sort_order != null) ? t.sort_order : t.id * 1000;

    const allTasks = gantt.getTaskByTime().filter(t => {
        const isDetailed = (t.is_detailed === true || String(t.is_detailed).toUpperCase() === 'TRUE');
        if (isDetailed) return false;
        if (String(t.major_item) !== '組立') return false;
        if (String(t.project_number) !== String(projectNumber)) return false;
        if (taskType) {
            const tt = t.task_type;
            const isNull = (tt === null || tt === undefined || tt === '' || String(tt) === 'null');
            if (taskType === 'drawing') {
                if (!isNull && String(tt) !== 'drawing') return false;
            } else {
                if (String(tt) !== taskType) return false;
            }
        }
        return true;
    }).sort((a, b) => _getSO(a) - _getSO(b));

    const idx = allTasks.findIndex(t => String(t.id) === String(sourceId));
    if (idx < 0) return _getSO(src) + 1000;

    const afterSO = _getSO(allTasks[idx]);
    if (idx + 1 < allTasks.length) {
        return Math.round((afterSO + _getSO(allTasks[idx + 1])) / 2);
    }
    return afterSO + 1000;
}

function _completionDateClear(taskId) {
    _clearingEndDateId = taskId;
    const task = gantt.getTask(taskId);
    if (task) {
        task.end_date = null;
        gantt.updateTask(task.id, task);
    }
    _clearingEndDateId = null;
}

// ===== リソース表示機能 =====

function updateResourceData() {
    const targetOwners = ["藤山", "田中(善)", "安岡", "川邊", "檀", "堀井", "宮﨑", "津田", "古村", "柴田", "橋本", "松本(英)"];

    const activeOwners = [];

    targetOwners.forEach(ownerName => {
        let hasTask = false;
        gantt.eachTask(function(task){
            if (hasTask) return;
            const isDetailed = (task.is_detailed === true || String(task.is_detailed).toLowerCase() === "true" || String(task.is_detailed).toLowerCase() === "t" || String(task.is_detailed) === "1");
            const isAssembly = String(task.major_item) === '組立';
            if (!isDetailed && isAssembly && task.owner) {
                const owners = String(task.owner).split(/[,、\s]+/).map(o => o.trim());
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

    let html = `<div style="width: ${totalWidth}px;">`;
    const TASK_TYPE_ROWS = [
        { type: 'drawing',        label: '組立' },
        { type: 'long_lead_item', label: '組立場所' },
        { type: 'business_trip',  label: '出張' },
    ];

    owners.forEach((ownerName) => {
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

        TASK_TYPE_ROWS.forEach((rowDef, rowIndex) => {
            const rowTasks = allOwnerTasks.filter(t => String(t.task_type) === rowDef.type);
            const isFirstRow = rowIndex === 0;
            const isLastRow  = rowIndex === TASK_TYPE_ROWS.length - 1;

            const borderTop    = isFirstRow ? 'border-top: 2px solid #aaa;' : '';
            const borderBottom = isLastRow  ? 'border-bottom: 2px solid #aaa;' : 'border-bottom: 1px solid #eee;';

            const leftCellContent = isFirstRow
                ? `<div style="width:100%;display:flex;align-items:center;justify-content:space-between;padding:0 5px;box-sizing:border-box;">
                       <div class="resource-owner-link" onclick="showOwnerDetail('${ownerName}')" title="クリックして詳細表示" style="font-weight:bold;font-size:11px;color:#333;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;">${ownerName}</div>
                       <div style="font-size:10px;color:#555;background:#ddd;border-radius:2px;padding:1px 4px;margin-left:3px;white-space:nowrap;">${rowDef.label}</div>
                   </div>`
                : `<div style="width:100%;display:flex;align-items:center;justify-content:flex-end;padding-right:5px;">
                       <div style="font-size:10px;color:#555;background:#eee;border-radius:2px;padding:1px 4px;white-space:nowrap;">${rowDef.label}</div>
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
    html += `</div>`;

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

    const TASK_TYPE_ORDER = { drawing: 0, long_lead_item: 1, business_trip: 2 };
    ownerTasks.sort((a, b) => {
        const ta = TASK_TYPE_ORDER[a.task_type] ?? 99;
        const tb = TASK_TYPE_ORDER[b.task_type] ?? 99;
        if (ta !== tb) return ta - tb;
        const pa = String(a.project_number || '');
        const pb = String(b.project_number || '');
        return pa.localeCompare(pb, undefined, { numeric: true });
    });

    if (ownerTasks.length === 0) {
        container.innerHTML = `<div style="padding:20px; text-align:center; color:#999;">タスクがありません</div>`;
        return;
    }

    const TASK_TYPE_LABEL = {
        drawing:        '組立',
        long_lead_item: '組立場所',
        business_trip:  '出張',
    };

    const colorClass = getOwnerColorClass(ownerName);
    const textColor = "#fff";

    let html = `<div style="width: ${totalWidth}px;">`;
    ownerTasks.forEach(t => {
        const hasDate = !t.has_no_date && t.start_date && t.end_date;
        const left = hasDate ? gantt.posFromDate(t.start_date) : 0;
        const right = hasDate ? gantt.posFromDate(t.end_date) : 0;
        const barWidth = hasDate ? Math.max(2, right - left) : 0;
        const typeLabel = TASK_TYPE_LABEL[String(t.task_type)] || String(t.task_type || '');

        html += `
            <div class="resource-item" style="display: flex; border-bottom: 1px solid #eee; min-height: 30px; height: 30px; align-items: stretch; width: ${totalWidth}px;">
                <div class="resource-grid-container" style="width: ${actualGridWidth}px; min-width: ${actualGridWidth}px; flex-shrink: 0; display: flex; border-right: 1px solid #ddd; background: #f9f9f9; position: sticky; left: 0; z-index: 5; overflow: hidden;">
                    <div style="display: flex; align-items: center; padding: 0 6px; font-size: 12px; color: #333; width: 100%; overflow: hidden; white-space: nowrap; gap: 6px;">
                        <span style="flex-shrink: 0; font-size: 10px; color: #555; background: #e0e0e0; border-radius: 2px; padding: 1px 4px;">${typeLabel}</span>
                        <span style="flex-shrink: 0; font-weight: bold; color: #546e7a; min-width: 60px;">${t.project_number || '-'}</span>
                        <span style="overflow: hidden; text-overflow: ellipsis;">${t.text}</span>
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
    renderResourceCalendarHeader();
    syncResourceScroll();
}

function showOwnerDetail(ownerName) {
    _resourceDetailOwner = ownerName;
    document.getElementById('resource_title').textContent = `${ownerName}さんの詳細リソース状況`;
    document.getElementById('resource_back_btn').style.display = '';
    document.querySelector(".resource-header-bar").style.display = '';
    renderOwnerDetailTimeline(ownerName);
}

function showOwnerOverview() {
    _resourceDetailOwner = null;
    document.getElementById('resource_title').textContent = '担当者別リソース状況';
    document.getElementById('resource_back_btn').style.display = 'none';
    document.querySelector(".resource-header-bar").style.display = 'none';
    updateResourceData();
}

// ===== UI制御機能 =====

function toggleResourcePanel() {
    toggleResourceView();
}

function toggleResourceView() {
    if (isResourceFullscreen) return;
    isResourceView = !isResourceView;
    const btn = document.getElementById("resource_toggle");
    const panel = document.getElementById("resource_panel");

    if (isResourceView) {
        btn.innerText = "メイン表示に戻す";
        updateResourceData();
        panel.style.display = "flex";
    } else {
        btn.innerText = "リソース表示";
        panel.style.display = "none";
        _resourceDetailOwner = null;
        document.getElementById('resource_title').textContent = '担当者別リソース状況';
        document.getElementById('resource_back_btn').style.display = 'none';
    }

    setTimeout(() => {
        gantt.setSizes();
        const currentLevel = document.querySelector('.zoom-btn.active')?.textContent === '週単位' ? 'week' : 'day';
        gantt.ext.zoom.setLevel(currentLevel);
        const s = gantt.getScrollState();
        gantt.scrollTo(s.x + 1, s.y);
        requestAnimationFrame(() => gantt.scrollTo(s.x, s.y));
    }, 50);
}

function _enterResourceFullscreen() {
    isResourceFullscreen = true;
    isResourceView = true;
    currentOwnerFilter = [];
    document.querySelectorAll('.owner-chk-item').forEach(chk => { chk.checked = false; });
    const allChk = document.getElementById('owner_chk_all');
    if (allChk) allChk.checked = true;
    _updateOwnerFilterBtn();
    const panel = document.getElementById("resource_panel");
    const ganttEl = document.getElementById("gantt_here");
    const btn = document.getElementById("resource_toggle");
    panel.classList.add('resource-fullscreen');
    ganttEl.style.visibility = "hidden";
    gantt.setSizes();
    updateResourceData();
    ganttEl.style.visibility = "";
    ganttEl.style.display = "none";
    panel.style.display = "flex";
    void panel.offsetHeight;
    btn.style.display = "none";
    document.getElementById("resource_close_btn").style.display = "none";
    document.querySelector(".resource-header-bar").style.display = "none";
    updateFilterButtons();
    setTimeout(() => {
        const todayX = gantt.posFromDate(new Date());
        const scrollX = Math.max(0, todayX - 300);
        const resourceContent = document.querySelector('.resource-content');
        if (resourceContent) resourceContent.scrollLeft = scrollX;
        _syncCalendarHeaderScroll(scrollX);
    }, 50);
}

function _exitResourceFullscreen() {
    isResourceFullscreen = false;
    isResourceView = false;
    const panel = document.getElementById("resource_panel");
    const ganttEl = document.getElementById("gantt_here");
    const btn = document.getElementById("resource_toggle");
    panel.classList.remove('resource-fullscreen');
    panel.style.display = "none";
    ganttEl.style.display = "";
    btn.style.display = "";
    btn.innerText = "リソース表示";
    document.getElementById("resource_close_btn").style.display = "";
    updateFilterButtons();
    setTimeout(() => {
        gantt.setSizes();
        const currentLevel = document.querySelector('.zoom-btn.active')?.textContent === '週単位' ? 'week' : 'day';
        gantt.ext.zoom.setLevel(currentLevel);
        const s = gantt.getScrollState();
        gantt.scrollTo(s.x + 1, s.y);
        requestAnimationFrame(() => gantt.scrollTo(s.x, s.y));
    }, 50);
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

// ===== カレンダーヘッダー機能 =====

function renderResourceCalendarHeader() {
    const header = document.getElementById('resource_calendar_header');
    if (!header) return;
    if (!isResourceFullscreen) {
        header.style.display = 'none';
        return;
    }
    header.style.display = '';

    const scale = gantt.getScale();
    const timelineWidth = scale.full_width;
    const columnWidth = scale.col_width;
    const actualGridWidth = isResourceFullscreen
        ? (_resourceDetailOwner ? RESOURCE_DETAIL_COL_WIDTH : RESOURCE_OVERVIEW_COL_WIDTH)
        : (_getRenderedGanttGridWidth());
    const dates = scale.trace_x;
    const unit = gantt.getState().scale_unit;

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

    let monthHtml = '';
    months.forEach(m => {
        const w = m.count * columnWidth;
        monthHtml += `<div class="resource-cal-cell resource-cal-month" style="width:${w}px;min-width:${w}px;height:22px;">${m.year}年${m.month + 1}月</div>`;
    });

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
            dowHtml += `<div class="resource-cal-cell${wkCls}" style="width:${columnWidth}px;min-width:${columnWidth}px;height:18px;${dowColor}">${dayNames[dow]}</div>`;
        } else {
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

// ===== 今日の線と週末表示 =====

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
    line.style.left = (dataArea.offsetLeft + gantt.posFromDate(new Date())) + 'px';
    line.style.top = (gantt.config.scale_height || 60) + 'px';
}

function _applyGanttScaleWeekendClasses() {
    const scale = gantt.getScale();
    if (!scale || !scale.trace_x) return;
    const dates = scale.trace_x;
    const scaleLines = document.querySelectorAll('#gantt_here .gantt_scale_line');
    scaleLines.forEach((line, lineIdx) => {
        if (lineIdx === 0) return;
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

        const wishX = gantt.posFromDate(wishDate);
        const mark = document.createElement('div');
        mark.className = 'wish-date-mark';
        mark.style.cssText = `left:${wishX}px;top:${top}px;`;
        mark.innerHTML = '▼';
        mark.title = `${label}: ${task.wish_date}`;
        dataArea.appendChild(mark);
    });
}

// ===== フィルター機能 =====

function _updateOwnerFilterBtn() {
    const btn = document.getElementById('owner_filter_btn');
    const count = document.getElementById('owner_filter_count');
    if (btn && count) {
        if (currentOwnerFilter.length > 0) {
            btn.classList.add('active');
            count.textContent = currentOwnerFilter.length;
        } else {
            btn.classList.remove('active');
            count.textContent = '';
        }
    }
}

function _updateProjectFilterBtn() {
    const btn = document.getElementById('project_filter_btn');
    const count = document.getElementById('project_filter_count');
    if (btn && count) {
        if (currentProjectFilter.length > 0) {
            btn.classList.add('active');
            count.textContent = currentProjectFilter.length;
        } else {
            btn.classList.remove('active');
            count.textContent = '';
        }
    }
}

function _handleOwnerFilterCheckboxChange(e) {
    const chk = e.target;
    const owner = chk.value;
    if (chk.checked) {
        if (!currentOwnerFilter.includes(owner)) {
            currentOwnerFilter.push(owner);
        }
    } else {
        currentOwnerFilter = currentOwnerFilter.filter(o => o !== owner);
    }
    _updateOwnerFilterBtn();
    gantt.render();
    updateResourceData();
}

function _handleProjectFilterCheckboxChange(e) {
    const chk = e.target;
    const project = chk.value;
    if (chk.checked) {
        if (!currentProjectFilter.includes(project)) {
            currentProjectFilter.push(project);
        }
    } else {
        currentProjectFilter = currentProjectFilter.filter(p => p !== project);
    }
    _updateProjectFilterBtn();
    gantt.render();
    updateResourceData();
}

// ===== UIイベントハンドラ =====

function toggleDrawingFilter() {
    currentTaskTypeFilter = currentTaskTypeFilter === 'drawing' ? null : 'drawing';
    gantt.render();
}

function toggleLongtermFilter() {
    currentTaskTypeFilter = currentTaskTypeFilter === 'long_lead_item' ? null : 'long_lead_item';
    gantt.render();
}

function toggleTripFilter() {
    currentTaskTypeFilter = currentTaskTypeFilter === 'business_trip' ? null : 'business_trip';
    gantt.render();
}

function setZoom(level, element) {
    document.querySelectorAll('.zoom-btn').forEach(btn => btn.classList.remove('active'));
    element.classList.add('active');
    if (gantt.ext && gantt.ext.zoom) {
        gantt.ext.zoom.setLevel(level);
    }
}

function addTask() {
    const task = {
        text: "新規タスク",
        start_date: new Date(),
        end_date: new Date(Date.now() + 24 * 60 * 60 * 1000),
        duration: 1,
        progress: 0,
        project_number: "",
        owner: "",
        major_item: "組立",
        task_type: "drawing",
        is_detailed: false
    };
    gantt.addTask(task);
}

function createTask() {
    addTask();
}

function deleteSelectedTasks() {
    if (_gridSelection.size > 0) {
        if (confirm(`${_gridSelection.size}件のタスクを削除してもよろしいですか？`)) {
            _gridSelection.forEach(taskId => {
                gantt.deleteTask(taskId);
            });
            _gridSelection.clear();
            _updateMultiDeleteButton();
        }
    }
}

function updateFilterButtons() {
    const drawingBtn = document.getElementById('drawing_filter_btn');
    const longtermBtn = document.getElementById('longterm_filter_btn');
    const tripBtn = document.getElementById('trip_filter_btn');

    if (drawingBtn) drawingBtn.classList.toggle('active', currentTaskTypeFilter === 'drawing');
    if (longtermBtn) longtermBtn.classList.toggle('active', currentTaskTypeFilter === 'long_lead_item');
    if (tripBtn) tripBtn.classList.toggle('active', currentTaskTypeFilter === 'business_trip');
}

function updateDisplay() {
    gantt.render();
}
