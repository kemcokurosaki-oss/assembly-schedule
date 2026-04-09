// Gantt 基本構成
gantt.config.date_format = "%Y-%m-%d";
gantt.config.scale_unit = "day";
gantt.config.step = 1;
gantt.config.date_grid = "%Y年%m月%d日";
gantt.config.grid_width = GRID_WIDTH;
gantt.config.add_column = false;
gantt.config.autosize = "y";
gantt.config.details_on_create = true;
gantt.config.xml_date = "%Y-%m-%d";
gantt.config.readonly = true;

// プラグイン設定
if (gantt.plugins) {
    gantt.plugins({
        marker: true,
        multiselect: true
    });
}

// レイアウト設定
const mainLayout = {
    css: "gantt_container",
    cols: [
        { name: "grid", width: GRID_WIDTH, resize: true },
        { name: "timeline", width: "*", resize: true }
    ],
    rows: [
        { name: "scale", height: 60, resize: false },
        { name: "data", height: "*", resize: true }
    ]
};

gantt.config.layout = mainLayout;

// カラム設定
gantt.config.columns = [
    {name: "wbs", label: "№", width: 40, align: "center", template: function(obj) { return obj.$index + 1; }},
    {name: "project_number", label: "工事番号", width: 80, align: "center"},
    {name: "text", label: "タスク名", width: 250, tree: true},
    {name: "machine", label: "機械", width: 60, align: "center"},
    {name: "unit", label: "ユニット", width: 50, align: "center"},
    {name: "start_date", label: "開始日", width: 80, align: "center", template: function(obj) {
        return obj.start_date ? gantt.templates.date_grid(obj.start_date) : "";
    }},
    {name: "end_date", label: "完了予定日", width: 80, align: "center", template: function(obj) {
        return obj.end_date ? gantt.templates.date_grid(gantt.date.add(obj.end_date, -1, "day")) : "";
    }},
    {name: "duration", label: "工期", width: 40, align: "center"},
    {name: "owner", label: "担当者", width: 70, align: "center", editor: "owner_select"},
    {name: "status", label: "状態", width: 50, align: "center", editor: "status_select"},
    {name: "wish_date", label: "希望日", width: 80, align: "center", template: function(obj) {
        return obj.wish_date || "";
    }},
    {name: "total_sheets", label: "総枚数", width: 60, align: "center"},
    {name: "completed_sheets", label: "完了枚数", width: 70, align: "center"}
];

// 担当者プルダウン用インラインエディタ
const OWNER_OPTIONS = ['藤山','田中','安岡','川邊','檀','堀井','宮﨑','津田','古村','柴田','橋本','松本(英)'];
gantt.config.editor_types.owner_select = {
    show: function(id, column, config, placeholder) {
        const opts = OWNER_OPTIONS.map(n =>
            `<option value="${n}">${n}</option>`
        ).join('');
        placeholder.innerHTML = `<select style="width:100%;height:100%;border:1px solid #7986cb;font-family:メイリオ,sans-serif;font-size:13px;box-sizing:border-box;"><option value=""></option>${opts}</select>`;
    },
    hide: function() {},
    set_value: function(value, id, column, node) {
        node.querySelector('select').value = value || '';
    },
    get_value: function(id, column, node) {
        return node.querySelector('select').value;
    },
    is_changed: function(value, id, column, node) {
        return value !== this.get_value(id, column, node);
    },
    is_valid: function() { return true; },
    save: function() {},
    focus: function(node) {
        var sel = node.querySelector('select');
        if (sel) sel.focus();
    }
};

// ステータスプルダウン用インラインエディタ
gantt.config.editor_types.status_select = {
    show: function(id, column, config, placeholder) {
        placeholder.innerHTML = `<select style="width:100%;height:100%;border:1px solid #7986cb;font-family:メイリオ,sans-serif;font-size:13px;box-sizing:border-box;">
            <option value=""></option>
            <option value="未">未</option>
            <option value="完了">完了</option>
        </select>`;
    },
    hide: function() {},
    set_value: function(value, id, column, node) {
        node.querySelector('select').value = value || '';
    },
    get_value: function(id, column, node) {
        return node.querySelector('select').value;
    },
    is_changed: function(value, id, column, node) {
        return value !== this.get_value(id, column, node);
    },
    is_valid: function() { return true; },
    save: function() {},
    focus: function(node) {
        var sel = node.querySelector('select');
        if (sel) sel.focus();
    }
};

// 開始日エディタ
gantt.config.editor_types.start_date_editor = {
    show: function(id, column, config, placeholder) {
        placeholder.innerHTML = '<input type="date" style="width:100%;height:100%;border:1px solid #7986cb;font-family:メイリオ,sans-serif;font-size:12px;box-sizing:border-box;">';
    },
    hide: function() {},
    set_value: function(value, id, column, node) {
        const inp = node.querySelector('input');
        if (!value) { inp.value = ''; return; }
        inp.value = _toDateStr(new Date(value));
    },
    get_value: function(id, column, node) {
        const val = node.querySelector('input').value;
        if (!val) return gantt.getTask(id).start_date;
        const parts = val.split('-').map(Number);
        return new Date(parts[0], parts[1] - 1, parts[2]);
    },
    is_changed: function(value, id, column, node) {
        const nv = this.get_value(id, column, node);
        if (!value || !nv) return true;
        return value.getTime() !== nv.getTime();
    },
    is_valid: function() { return true; },
    save: function() {},
    focus: function(node) {
        const inp = node.querySelector('input');
        if (inp) { inp.focus(); if (inp.showPicker) try { inp.showPicker(); } catch(e) {} }
    }
};

// 完了日エディタ
gantt.config.editor_types.completion_date = {
    show: function(id, column, config, placeholder) {
        placeholder.innerHTML = '<input type="date" name="' + column.name + '">';
        placeholder.querySelector('input').addEventListener('change', function() {
            if (!this.value) _completionDateClear(id);
        });
    },
    hide: function() {},
    set_value: function(value, id, column, node) {
        const inp = node.querySelector('input');
        if (!value) { inp.value = ''; return; }
        const actualEnd = gantt.date.add(new Date(value), -1, 'day');
        inp.value = _toDateStr(actualEnd);
    },
    get_value: function(id, column, node) {
        const val = node.querySelector('input').value;
        if (!val) return gantt.getTask(id).end_date;
        const parts = val.split('-').map(Number);
        return gantt.date.add(new Date(parts[0], parts[1] - 1, parts[2]), 1, 'day');
    },
    is_changed: function(value, id, column, node) {
        const nv = this.get_value(id, column, node);
        if (!value || !nv) return true;
        return value.getTime() !== nv.getTime();
    },
    is_valid: function() { return true; },
    save: function() {},
    focus: function(node) {
        const inp = node.querySelector('input');
        if (inp) { inp.focus(); if (inp.showPicker) try { inp.showPicker(); } catch(e) {} }
    }
};

// タスク表示フィルター
gantt.config.filter_task = function(id, task) {
    return _isTaskDisplayed(task);
};

// ===== Ganttイベントリスナー =====

gantt.attachEvent("onBeforeTaskDisplay", function(id, task) {
    return _isTaskDisplayed(task);
});

gantt.attachEvent("onTaskDblClick", function(id, e) {
    if (!_isEditor) return false;
    return true;
});

gantt.attachEvent("onBeforeTaskDrag", function(id, mode, e) {
    if (!_isEditor) return false;
    return true;
});

gantt.attachEvent("onTaskDrag", function(id, mode, task) {
    return true;
});

gantt.attachEvent("onAfterTaskDrag", function(id, mode, e) {
    const task = gantt.getTask(id);
    _saveTaskDates(task);
});

gantt.attachEvent("onTaskResize", function(id, task) {
    return true;
});

gantt.attachEvent("onAfterTaskResize", function(id, task) {
    _saveTaskDates(task);
});

gantt.attachEvent("onBeforeTaskAdd", function(id, task) {
    if (!_isEditor) return false;
    task.is_detailed = false;
    task.major_item = "組立";
    task.task_type = currentTaskTypeFilter || "drawing";
    task.sort_order = _calcInsertAfterSortOrder(id);
    return true;
});

gantt.attachEvent("onAfterTaskAdd", function(id, task) {
    _saveTaskToSupabase(task);
});

gantt.attachEvent("onBeforeTaskDelete", function(id, task) {
    if (!_isEditor) return false;
    return confirm(`タスク「${task.text}」を削除してもよろしいですか？`);
});

gantt.attachEvent("onAfterTaskDelete", function(id) {
    _deleteTaskFromSupabase(id);
});

gantt.attachEvent("onBeforeTaskUpdate", function(id, task) {
    if (!_isEditor) return false;
    return true;
});

gantt.attachEvent("onAfterTaskUpdate", function(id, task) {
    _saveTaskToSupabase(task);
});

gantt.attachEvent("onLightboxSave", function(id, task) {
    if (!_isEditor) return false;
    task.sort_order = task.sort_order || id * 1000;
    return true;
});

gantt.attachEvent("onGanttRender", _drawMainTodayLine);
gantt.attachEvent("onGanttRender", _applyGanttScaleWeekendClasses);
gantt.attachEvent("onGanttRender", function() { requestAnimationFrame(_renderWishDateMarks); });
gantt.attachEvent("onGanttScroll", function() { _renderWishDateMarks(); });

gantt.attachEvent("onGanttScroll", function (left, top){
    _drawMainTodayLine();
    if (!isResourceFullscreen) {
        const resourceContent = document.querySelector(".resource-content");
        if (resourceContent) resourceContent.scrollLeft = left;
        _syncCalendarHeaderScroll(left);
    }
});

gantt.attachEvent("onTaskClick", function(id, e) {
    setTimeout(_updateMultiDeleteButton, 0);
    return true;
});

gantt.attachEvent("onEmptyClick", function(e) {
    _gridSelection.clear();
    _lastGridClickId = null;
    _applyGridSelection();
    setTimeout(_updateMultiDeleteButton, 0);
    return true;
});

gantt.attachEvent("onGanttRender", function() {
    _applyGridSelection();
});

// グリッドクリックイベント
document.getElementById("gantt_here").addEventListener("click", function(e) {
    const row = e.target.closest("[task_id]");
    if (!row) return;

    const taskId = row.getAttribute("task_id");
    if (!taskId) return;

    if (e.ctrlKey || e.metaKey) {
        if (_gridSelection.has(taskId)) {
            _gridSelection.delete(taskId);
        } else {
            _gridSelection.add(taskId);
        }
    } else if (e.shiftKey && _lastGridClickId) {
        const visIds = [...document.querySelectorAll('#gantt_here .gantt_grid_data .gantt_row[task_id]')]
            .map(el => el.getAttribute('task_id'));
        const a = visIds.indexOf(String(_lastGridClickId));
        const b = visIds.indexOf(String(taskId));
        if (a >= 0 && b >= 0) {
            const [from, to] = a <= b ? [a, b] : [b, a];
            for (let i = from; i <= to; i++) _gridSelection.add(visIds[i]);
        } else {
            _gridSelection.add(taskId);
        }
    } else {
        _gridSelection.clear();
        _gridSelection.add(taskId);
        _lastGridClickId = taskId;
        const scrollY = gantt.getScrollState().y;
        gantt.showTask(taskId);
        gantt.scrollTo(null, scrollY);
    }

    _applyGridSelection();
    _updateMultiDeleteButton();
}, true);

// グリッドダブルクリックでインライン編集
document.getElementById("gantt_here").addEventListener("dblclick", function(e) {
    if (!_isEditor) return;
    const cell = e.target.closest(".gantt_cell");
    if (!cell) return;
    e.stopPropagation();
    e.preventDefault();

    const row = cell.closest("[task_id]");
    if (!row) return;

    const taskId = row.getAttribute("task_id");
    if (!taskId) return;

    const cells = [...row.querySelectorAll(".gantt_cell")];
    const colIndex = cells.indexOf(cell);
    const col = gantt.config.columns[colIndex];

    if (col && col.editor) {
        gantt.ext.inlineEditors.startEdit(taskId, col.name);
    }
}, true);

// ===== Ganttチャート初期化 =====

gantt.init("gantt_here");
console.log('Ganttチャートが初期化されました');

// DOMContentLoaded後の追加初期化
window.addEventListener('DOMContentLoaded', () => {
    const resourceContent = document.querySelector(".resource-content");
    if (resourceContent) {
        resourceContent.addEventListener('scroll', function() {
            _syncCalendarHeaderScroll(this.scrollLeft);
            if (!isResourceFullscreen) {
                const ganttScroll = gantt.getScrollState();
                if (Math.abs(ganttScroll.x - this.scrollLeft) > 1) {
                    gantt.scrollTo(this.scrollLeft, null);
                }
            }
        });
    }

    document.getElementById('resource_close_btn').onclick = toggleResourceView;

    document.querySelectorAll('.owner-chk-item').forEach(chk => {
        chk.addEventListener('change', _handleOwnerFilterCheckboxChange);
    });

    document.querySelectorAll('.project-chk-item').forEach(chk => {
        chk.addEventListener('change', _handleProjectFilterCheckboxChange);
    });
});
