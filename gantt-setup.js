// Gantt 基本構成
gantt.config.date_format = "%Y-%m-%d";

// 担当者プルダウン用インラインエディタ（複数選択対応）
const OWNER_OPTIONS_ASSEMBLY   = ['米澤','桂','香西','古賀','長谷川','早川','廣田','宮本','山下','センティル','増田','外注'];
const OWNER_OPTIONS_ELECTRICAL = ['木村(至)','木村(圭)','守時','外注(電)'];
// major_item に応じた担当者リストを返す
function getOwnerOptions(task) {
    return String(task.major_item) === '電装' ? OWNER_OPTIONS_ELECTRICAL : OWNER_OPTIONS_ASSEMBLY;
}

function _removeOwnerPopup() {
    const p = document.getElementById('owner_multiselect_popup');
    if (p) p.remove();
}

gantt.config.editor_types.owner_select = {
    show: function(id, column, config, placeholder) {
        const task = gantt.getTask(id);
        const currentValue = (task[column.map_to] || '').trim();

        // セル内：現在値を表示するだけのラベル
        placeholder.innerHTML = `<div id="owner_ms_label" style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:11px;font-family:メイリオ,sans-serif;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:default;box-sizing:border-box;padding:0 2px;">${currentValue || '　'}</div>`;

        // 既存ポップアップ削除
        _removeOwnerPopup();

        const selectedNames = currentValue ? currentValue.split(/[,、\s]+/).map(s => s.trim()).filter(Boolean) : [];

        // チェックボックスポップアップ
        const popup = document.createElement('div');
        popup.id = 'owner_multiselect_popup';
        popup.style.cssText = 'position:fixed;background:#fff;border:1px solid #aaa;border-radius:4px;box-shadow:0 3px 10px rgba(0,0,0,0.25);z-index:99999;padding:4px 0;min-width:120px;max-height:300px;overflow-y:auto;';

        getOwnerOptions(task).forEach(name => {
            const label = document.createElement('label');
            label.style.cssText = 'display:flex;align-items:center;padding:5px 12px;cursor:pointer;font-size:13px;font-family:メイリオ,Meiryo,sans-serif;white-space:nowrap;user-select:none;';
            label.innerHTML = `<input type="checkbox" value="${name}" style="margin-right:7px;cursor:pointer;">${name}`;
            const cb = label.querySelector('input');
            cb.checked = selectedNames.includes(name);
            // チェック変更時にセルのラベルを更新
            cb.addEventListener('change', () => {
                const checked = Array.from(popup.querySelectorAll('input:checked')).map(c => c.value);
                const lbl = document.getElementById('owner_ms_label');
                if (lbl) lbl.textContent = checked.join(',') || '　';
            });
            popup.appendChild(label);
        });

        // ポップアップ内のmousedownでフォーカスを奪わない（save_on_blur対策）
        popup.addEventListener('mousedown', e => e.preventDefault());

        document.body.appendChild(popup);

        // 位置をセルの直下に設定
        const rect = placeholder.getBoundingClientRect();
        popup.style.left = rect.left + 'px';
        popup.style.top  = (rect.bottom + 2) + 'px';
    },
    hide: function() {
        _removeOwnerPopup();
    },
    set_value: function(value, id, column, node) {
        const lbl = node.querySelector('#owner_ms_label');
        if (lbl) lbl.textContent = value || '　';
        const popup = document.getElementById('owner_multiselect_popup');
        if (!popup) return;
        const names = value ? value.split(/[,、\s]+/).map(s => s.trim()).filter(Boolean) : [];
        popup.querySelectorAll('input[type=checkbox]').forEach(cb => {
            cb.checked = names.includes(cb.value);
        });
    },
    get_value: function(id, column, node) {
        const popup = document.getElementById('owner_multiselect_popup');
        if (!popup) {
            const task = gantt.getTask(id);
            return task[column.map_to] || '';
        }
        return Array.from(popup.querySelectorAll('input:checked')).map(c => c.value).join(',');
    },
    is_changed: function(value, id, column, node) {
        return value !== this.get_value(id, column, node);
    },
    is_valid: function() { return true; },
    save: function() {},
    focus: function(node) {}
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

// 開始日インラインエディタ（計画・出張モード用）
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

// 完了予定日専用インラインエディタ
// Supabaseには実際の完了日(YYYY-MM-DD)を保存し、gantt内部では+1日した排他的終了日を使う
gantt.config.editor_types.completion_date = {
    show: function(id, column, config, placeholder) {
        placeholder.innerHTML = '<input type="date" name="' + column.name + '">';
        placeholder.querySelector('input').addEventListener('change', function() {
            if (!this.value) _completionDateClear(id);
        });
    },
    hide: function() {},
    set_value: function(value, id, column, node) {
        var inp = node.querySelector('input');
        if (!value || gantt.getTask(id).has_no_date) { inp.value = ''; return; }
        var d = gantt.date.add(new Date(value), -1, 'day');
        inp.value = _toDateStr(d);
    },
    get_value: function(id, column, node) {
        var val = node.querySelector('input').value;
        if (!val) {
            _clearingEndDateId = id;
            var task = gantt.getTask(id);
            var base = (task.start_date instanceof Date) ? task.start_date : new Date();
            return gantt.date.add(base, 1, 'day');
        }
        _clearingEndDateId = null;
        gantt.getTask(id).has_no_date = false; // 日付再入力時にフラグリセット
        var parts = val.split('-').map(Number);
        var completion = new Date(parts[0], parts[1] - 1, parts[2]);
        return gantt.date.add(completion, 1, 'day');
    },
    is_changed: function(value, id, column, node) {
        var val = node.querySelector('input').value;
        var origNoDate = !!gantt.getTask(id).has_no_date;
        var newNoDate  = !val;
        if (origNoDate && newNoDate) return false;
        if (origNoDate !== newNoDate) return true;
        var nv = this.get_value(id, column, node);
        if (!value || !nv) return true;
        return value.getTime() !== nv.getTime();
    },
    is_valid: function() { return true; },
    save: function() {},
    focus: function(node) {
        var inp = node.querySelector('input');
        if (!inp) return;
        inp.focus();
        if (inp.showPicker) try { inp.showPicker(); } catch(e) {}
    }
};

// 完了予定日クリアボタン：エディタAPIを使わずタスクを直接更新
function _completionDateClear(taskId) {
    // インラインエディターを閉じる（APIがあれば使う）
    try {
        if (gantt.ext && gantt.ext.inlineEditors) {
            gantt.ext.inlineEditors.hide();
        }
    } catch(e) {}

    var task = gantt.getTask(taskId);
    if (!task) return;
    var base = (task.start_date instanceof Date) ? task.start_date : new Date();
    task.end_date = gantt.date.add(base, 1, 'day');
    task.has_no_date = true;
    _clearingEndDateId = taskId;
    gantt.updateTask(taskId);
}
gantt.config.auto_scheduling = true; // 自動スケジューリングを有効化
gantt.config.start_date = new Date(2025, 0, 1);  // 2025年1月1日
gantt.config.end_date = new Date(2028, 0, 1);    // 2027年12月31日まで含める
gantt.config.fit_tasks = false; // 自動調整を無効化
// 仮想レンダリング（表示領域のみDOMを生成）を有効化
// 3年分（~1096日）の日付列を全て一括生成すると初期表示・スクロールが重くなるため
gantt.config.smart_rendering = true;

// グリッド幅をレイアウトで固定する関数（dhtmlxGanttの自動スケーリングを防ぐ）
function _setLayout(gridWidth) {
    gantt.config.layout = {
        css: "gantt_container",
        rows: [
            {
                cols: [
                    {
                        width: gridWidth,
                        min_width: 80,
                        rows: [
                            { view: "grid", scrollX: "scrollHor", scrollY: "scrollVer" }
                        ]
                    },
                    { resizer: true, width: 1 },
                    { view: "timeline", scrollX: "scrollHor", scrollY: "scrollVer" },
                    { view: "scrollbar", id: "scrollVer" }
                ]
            },
            { view: "scrollbar", id: "scrollHor" }
        ]
    };
    gantt.config.grid_width = gridWidth;
}

function _getColsSum(cols) {
    return cols.reduce((sum, c) => sum + (c.width || 0), 0);
}

_setLayout(_getColsSum(_getDrawingColumns()));
gantt.config.min_column_width = 22; // カレンダーの列幅を22に設定
gantt.config.inline_editors_save_on_blur = true; // フォーカスが外れたとき自動保存
gantt.config.row_height = 30;
gantt.config.scale_height = 60; // 3段構成（20px * 3）に合わせて調整
// マーカープラグインは initialize() 内で有効化するため、ここでは行わない

// 土日・休日クラスを返すヘルパー（スケールcssコールバック用）
function _scaleWeekendClass(date) {
    var dow = date.getDay();
    if (dow === 0) return 'gantt-scale-sun';
    if (_isHoliday(date)) return 'gantt-scale-holiday';
    if (dow === 6) return 'gantt-scale-sat';
    return '';
}

// ズーム設定
const zoomConfig = {
    levels: [
        {
            name: "day",
            scale_height: 60, // 3段構成（20px * 3）
            min_column_width: 22,
            scales: [
                {unit: "month", step: 1, format: "%Y/%n"},
                {unit: "day", step: 1, format: "%j", css: _scaleWeekendClass},
                {unit: "day", step: 1, format: (date) => ["日", "月", "火", "水", "木", "金", "土"][date.getDay()], css: _scaleWeekendClass}
            ]
        },
        {
            name: "week",
            scale_height: 60, // 2段構成（30px * 2）
            min_column_width: 22,
            scales: [
                {unit: "month", step: 1, format: "%Y/%n"},
                {unit: "week", step: 1, format: "%j"}
            ]
        }
    ]
};
gantt.ext.zoom.init(zoomConfig);
gantt.ext.zoom.setLevel("day");

function setZoom(level, btn) {
    gantt.ext.zoom.setLevel(level);
    document.querySelectorAll('.zoom-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    if (isResourceView) updateResourceData();
}

// 選択削除ボタンの表示更新
function _updateMultiDeleteBtn() {
    const btn = document.getElementById('multi_delete_btn');
    if (!btn) return;
    if (_isEditor && _gridSelection.size >= 1) {
        document.getElementById('multi_delete_count').textContent = _gridSelection.size;
        btn.style.display = '';
    } else {
        btn.style.display = 'none';
    }
}

// グリッド選択ハイライトを DOM に反映
function _applyGridSelection() {
    document.querySelectorAll('#gantt_here .gantt_row[task_id]').forEach(el => {
        el.classList.toggle('grid-row-selected', _gridSelection.has(el.getAttribute('task_id')));
    });
}

// 複数タスク一括削除
async function deleteSelectedTasks() {
    const ids = [..._gridSelection].map(id => Number(id));
    if (ids.length === 0) return;
    if (!confirm(`選択した ${ids.length} 件のタスクを削除しますか？`)) return;

    const { error } = await supabaseClient
        .from('tasks')
        .delete()
        .in('id', ids);

    if (error) {
        console.error("Error deleting tasks:", error);
        alert("削除に失敗しました。\n" + error.message);
        return;
    }

    await loadData();
    document.getElementById('multi_delete_btn').style.display = 'none';
}

// 新規タスク追加
// gantt.createTask() を使わず Supabase に直接保存して loadData() でリフレッシュする
// afterTaskId: グリッドの+ボタンから呼ばれた場合は対象行のID、ヘッダーボタンから呼ばれた場合は undefined
async function createTask(afterTaskId) {
    if (currentProjectFilter.length !== 1) {
        alert("工事番号を選択してからタスクを追加してください。");
        return;
    }
    const projectNumber = currentProjectFilter[0];

    // 現在表示中のタスク一覧を sort_order 順（nullの場合は id で代替）でソート
    const visibleTasks = gantt.getTaskByTime().filter(t => {
        const isDetailed = (t.is_detailed === true || String(t.is_detailed).toUpperCase() === 'TRUE');
        if (isDetailed) return false;
        if (String(t.major_item) !== '組立') return false;
        if (String(t.project_number) !== String(projectNumber)) return false;
        if (currentTaskTypeFilter) {
            const tt = t.task_type;
            const isNull = (tt === null || tt === undefined || tt === '' || String(tt) === 'null');
            if (currentTaskTypeFilter === 'assembly') {
                if (!isNull && String(tt) !== 'assembly') return false;
            } else {
                if (String(tt) !== currentTaskTypeFilter) return false;
            }
        }
        return true;
    }).sort((a, b) => {
        const sa = (a.sort_order != null) ? a.sort_order : a.id;
        const sb = (b.sort_order != null) ? b.sort_order : b.id;
        return sa - sb;
    });

    // sort_order と machine の決定
    // sort_order が null の行は id * 1000 を仮想値として使用（整数列でも小数にならないよう大きな間隔を確保）
    const _getSO = t => (t.sort_order != null) ? t.sort_order : t.id * 1000;

    let newSortOrder;
    let inheritMachine = "";

    if (afterTaskId != null) {
        // グリッドの+ボタン：クリックした行の1行下に挿入
        const afterIdx = visibleTasks.findIndex(t => String(t.id) === String(afterTaskId));
        if (afterIdx >= 0) {
            const afterTask = visibleTasks[afterIdx];
            inheritMachine = afterTask.machine || "";
            if (afterIdx + 1 < visibleTasks.length) {
                const nextTask = visibleTasks[afterIdx + 1];
                newSortOrder = Math.round((_getSO(afterTask) + _getSO(nextTask)) / 2);
            } else {
                newSortOrder = _getSO(afterTask) + 1000;
            }
        } else {
            // 見つからない場合は末尾
            newSortOrder = visibleTasks.length > 0 ? (_getSO(visibleTasks[visibleTasks.length - 1]) + 1000) : 1000;
            inheritMachine = visibleTasks.length > 0 ? (visibleTasks[visibleTasks.length - 1].machine || "") : "";
        }
    } else {
        // ヘッダーの「新規タスク追加」ボタン：末尾に追加
        newSortOrder = visibleTasks.length > 0 ? (_getSO(visibleTasks[visibleTasks.length - 1]) + 1000) : 1000;
        inheritMachine = visibleTasks.length > 0 ? (visibleTasks[visibleTasks.length - 1].machine || "") : "";
    }

    const today = new Date();
    // 完了予定日=今日、期間=2週間（14日）のデフォルト設定
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - 13); // 13日前から開始 → 完了日=今日で14日間

    const { data, error } = await supabaseClient
        .from('tasks')
        .insert([{
            text: "",
            start_date: _toDateStr(startDate),
            end_date: _toDateStr(today), // 完了日=今日（loadData時に+1日してgantの排他的終了日にする）
            project_number: projectNumber,
            machine: inheritMachine,
            unit: "",
            unit2: "",
            model_type: "",
            part_number: "",
            quantity: 0,
            manufacturer: "",
            status: "",
            customer_name: "",
            project_details: "",
            characteristic: "",
            derivation: "",
            owner: "",
            total_sheets: 0,
            completed_sheets: 0,
            task_type: currentTaskTypeFilter || null,
            is_business_trip: currentTaskTypeFilter === 'business_trip',
            wish_date: _toDateStr(today),
            is_detailed: false,
            major_item: '組立',
            sort_order: newSortOrder
        }])
        .select();

    if (error) {
        console.error("Error adding task:", error);
        alert("タスクの追加に失敗しました。\n" + error.message);
        return;
    }

    // データ再読み込みしてからインライン編集を起動
    await loadData();

    if (data && data[0]) {
        const newId = data[0].id;
        gantt.showTask(newId);
        const editCol = gantt.config.columns.find(c => c.name === "text");
        if (editCol && editCol.editor) {
            setTimeout(() => {
                gantt.ext.inlineEditors.startEdit(newId, "text");
            }, 100);
        }
    }
}

// 完了予定日クリア時：フラグを元にhas_no_dateを設定
gantt.attachEvent("onBeforeTaskUpdate", function(id, task) {
    if (_clearingEndDateId === id) {
        task.has_no_date = true;
        _clearingEndDateId = null;
    }
    return true;
});

// Supabase への保存処理（バーのドラッグ等、gantt内部でタスクが追加された場合の安全網）
gantt.attachEvent("onAfterTaskAdd", async function(id, item) {
    // createTask() からは呼ばれない（直接Supabase保存のため）
    // ライトボックス経由の追加など他の経路で使われる場合のみ動作
});

gantt.attachEvent("onAfterTaskUpdate", async function(id, item) {
    try {
        // has_no_dateの場合はend_dateをnullで保存、それ以外は-1日して完了日を保存
        const endDateStr = item.has_no_date
            ? null
            : _toDateStr(gantt.date.add(new Date(item.end_date), -1, 'day'));

        const { error } = await supabaseClient
            .from('tasks')
            .update({
                text: item.text,
                start_date: _toDateStr(item.start_date),
                end_date: endDateStr,
                project_number: item.project_number,
                machine: item.machine,
                unit: item.unit,
                unit2: item.unit2,
                model_type: item.model_type,
                part_number: item.part_number,
                quantity: item.quantity,
                manufacturer: item.manufacturer,
                status: item.status,
                customer_name: item.customer_name,
                project_details: item.project_details,
                hyphen: item.hyphen ?? null,
                characteristic: item.characteristic,
                derivation: item.derivation,
                owner: item.owner,
                total_sheets: Number(item.total_sheets) || 0,
                completed_sheets: Number(item.completed_sheets) || 0,
                duration: item.duration,
                task_type: item.task_type || currentTaskTypeFilter || null,
                is_business_trip: (item.task_type || currentTaskTypeFilter) === 'business_trip',
                wish_date: item.wish_date || null
            })
            .eq('id', id);

        if (error) {
            console.error("Error updating task:", error);
            alert("タスクの更新に失敗しました。\n" + error.message);
        } else {
            if (isResourceView) updateResourceData();
            // ▼マークの色を即時更新
            requestAnimationFrame(_renderWishDateMarks);
        }
    } catch (e) {
        console.error("Exception in onAfterTaskUpdate:", e);
        alert("タスク更新中に予期せぬエラーが発生しました。");
    }
});

// ドラッグ（移動・リサイズ）後にSupabaseへ保存
gantt.attachEvent("onAfterTaskDrag", async function(id, mode, e) {
    const item = gantt.getTask(id);
    const completionDate = gantt.date.add(new Date(item.end_date), -1, 'day');
    try {
        const { error } = await supabaseClient
            .from('tasks')
            .update({
                start_date: _toDateStr(item.start_date),
                end_date: _toDateStr(completionDate),
            })
            .eq('id', id);
        if (error) console.error("Error saving drag:", error);
        else if (isResourceView) updateResourceData();
    } catch(e) {
        console.error("Exception in onAfterTaskDrag:", e);
    }
});

gantt.attachEvent("onAfterTaskDelete", async function(id, item) {
    try {
        const { error } = await supabaseClient
            .from('tasks')
            .delete()
            .eq('id', id);

        if (error) {
            console.error("Error deleting task:", error);
            alert("タスクの削除に失敗しました。\n" + error.message);
        }
    } catch (e) {
        console.error("Exception in onAfterTaskDelete:", e);
        alert("タスク削除中に予期せぬエラーが発生しました。");
    }
});

// 編集画面（ライトボックス）のセクション定義（タスクタイプ別）
function _getLightboxSections(taskType) {
    if (taskType === 'long_lead_item') {
        return [
            { name: "project_number",   height: 30, map_to: "project_number", type: "textarea" },
            { name: "machine",          height: 30, map_to: "machine",         type: "textarea" },
            { name: "unit",             height: 30, map_to: "unit",            type: "textarea" },
            { name: "description",      height: 30, map_to: "text",            type: "textarea_full" },
            { name: "part_number",      height: 30, map_to: "part_number",     type: "textarea" },
            { name: "quantity",         height: 30, map_to: "quantity",        type: "textarea" },
            { name: "manufacturer",            height: 30, map_to: "manufacturer",           type: "textarea" },
            { name: "owner",            height: 30, map_to: "owner",           type: "owner_select_lb" },
            { name: "end_date",         height: 30, map_to: "end_date",        type: "template" },
            { name: "wish_date_lb",     height: 30, map_to: "wish_date",       type: "wish_date_lb" },
        ];
    } else if (taskType === 'planning' || taskType === 'business_trip') {
        return [
            { name: "project_number",  height: 30, map_to: "project_number",  type: "textarea" },
            { name: "customer_name",   height: 30, map_to: "customer_name",   type: "textarea" },
            { name: "project_details", height: 30, map_to: "project_details", type: "textarea" },
            { name: "description",     height: 30, map_to: "text",            type: "textarea_full" },
            { name: "owner",           height: 30, map_to: "owner",           type: "owner_select_lb" },
            { name: "date_range",      height: 30, map_to: "start_date",      type: "date_range" },
        ];
    } else {
        // assembly（デフォルト）
        return [
            { name: "project_number",   height: 30, map_to: "project_number",  type: "textarea" },
            { name: "machine",          height: 30, map_to: "machine",          type: "textarea" },
            { name: "unit",             height: 30, map_to: "unit",             type: "textarea" },
            { name: "description",      height: 30, map_to: "text",             type: "textarea_full" },
            { name: "model_type",       height: 30, map_to: "model_type",       type: "textarea" },
            { name: "unit2",            height: 30, map_to: "unit2",            type: "textarea" },
            { name: "characteristic",   height: 30, map_to: "characteristic",   type: "textarea" },
            { name: "derivation",       height: 30, map_to: "derivation",       type: "textarea" },
            { name: "owner",            height: 30, map_to: "owner",            type: "owner_select_lb" },
            { name: "sheets_pair",      height: 30, map_to: "total_sheets",     type: "sheets_pair" },
            { name: "date_range",       height: 30, map_to: "start_date",       type: "date_range" },
            { name: "wish_date_lb",     height: 30, map_to: "wish_date",        type: "wish_date_lb" },
        ];
    }
}

gantt.config.lightbox.sections = _getLightboxSections('assembly');

gantt.locale.labels.section_project_number   = "工事番号";
gantt.locale.labels.section_machine          = "機械";
gantt.locale.labels.section_unit             = "ユニット";
gantt.locale.labels.section_description      = "組立図面名 / 品名 / タスク";
gantt.locale.labels.section_model_type       = "機種";
gantt.locale.labels.section_unit2            = "ユニット2";
gantt.locale.labels.section_characteristic   = "特性";
gantt.locale.labels.section_derivation       = "派生";
gantt.locale.labels.section_owner            = "担当";
gantt.locale.labels.section_total_sheets     = "総枚数";
gantt.locale.labels.section_completed_sheets = "完了枚数";
gantt.locale.labels.section_sheets_pair      = "枚数";
gantt.locale.labels.section_start_date       = "開始日";
gantt.locale.labels.section_end_date         = "完了予定日";
gantt.locale.labels.section_date_range       = "期間";
gantt.locale.labels.section_part_number      = "型式・図番";
gantt.locale.labels.section_quantity         = "個数";
gantt.locale.labels.section_manufacturer            = "メーカー";
gantt.locale.labels.section_customer_name    = "客先";
gantt.locale.labels.section_project_details  = "工事名";
gantt.locale.labels.section_wish_date_lb     = "出図希望日 / 手配期日";

// カスタムテンプレート（input type="date"）
// 全幅テキストエリア（組立図面名・品名など）
gantt.form_blocks["textarea_full"] = {
    render: function(sns) {
        return "<div class='gantt_cal_ltext'><textarea class='lb-textarea-full' style='height:26px;font-size:12px;line-height:18px;padding:4px 4px 0 4px;box-sizing:border-box;resize:none;overflow:hidden;border:1px solid #ccc;border-radius:4px;'></textarea></div>";
    },
    set_value: function(node, value, task, sns) {
        node.querySelector("textarea").value = value || '';
    },
    get_value: function(node, task, sns) {
        return node.querySelector("textarea").value;
    },
    focus: function(node) {
        node.querySelector("textarea").focus();
    }
};

// 担当プルダウン（ライトボックス用）
gantt.form_blocks["owner_select_lb"] = {
    render: function(sns) {
        return `<div class='gantt_cal_ltext'><select style='width:100%;height:30px;border:1px solid #ccc;border-radius:4px;padding:0 5px;'></select></div>`;
    },
    set_value: function(node, value, task, sns) {
        const sel = node.querySelector("select");
        const opts = ['', ...getOwnerOptions(task)].map(n =>
            `<option value="${n}">${n || '-- 未選択 --'}</option>`).join('');
        sel.innerHTML = opts;
        sel.value = value || '';
    },
    get_value: function(node, task, sns) {
        return node.querySelector("select").value;
    },
    focus: function(node) {
        node.querySelector("select").focus();
    }
};

// 出図希望日 / 手配期日（wish_date、文字列 YYYY-MM-DD）ライトボックス用
gantt.form_blocks["wish_date_lb"] = {
    render: function(sns) {
        return "<div class='gantt_cal_ltext'><input type='date' style='width:110px;height:26px;border:1px solid #ccc;border-radius:4px;padding:0 4px;font-size:12px;'></div>";
    },
    set_value: function(node, value, task, sns) {
        node.querySelector("input").value = value || '';
    },
    get_value: function(node, task, sns) {
        return node.querySelector("input").value || null;
    },
    focus: function(node) {
        node.querySelector("input").focus();
    }
};

gantt.form_blocks["template"] = {
    render: function(sns) {
        return "<div class='gantt_cal_ltext'><input type='date' id='cal_" + sns.name + "' style='width:110px;height:26px;border:1px solid #ccc;border-radius:4px;padding:0 4px;font-size:12px;'></div>";
    },
    set_value: function(node, value, task, sns) {
        const input = node.querySelector("input");
        if (value) {
            const date = new Date(value);
            const y = date.getFullYear();
            const m = ("0" + (date.getMonth() + 1)).slice(-2);
            const d = ("0" + date.getDate()).slice(-2);
            input.value = `${y}-${m}-${d}`;
        }
    },
    get_value: function(node, task, sns) {
        return node.querySelector("input").value;
    },
    focus: function(node) {
        node.querySelector("input").focus();
    }
};

// 総枚数と完了枚数を横並びで表示するカスタムフォームブロック
gantt.form_blocks["sheets_pair"] = {
    render: function(sns) {
        return `<div class='gantt_cal_ltext' style='display:flex;gap:6px;align-items:center;'>
            <span style='font-size:11px;white-space:nowrap;color:#555;'>総枚数</span>
            <input type='number' id='lb_total_sheets' min='0' style='width:60px;height:26px;border:1px solid #ccc;border-radius:4px;padding:0 4px;font-size:12px;'>
            <span style='font-size:11px;white-space:nowrap;color:#555;'>完了枚数</span>
            <input type='number' id='lb_completed_sheets' min='0' style='width:60px;height:26px;border:1px solid #ccc;border-radius:4px;padding:0 4px;font-size:12px;'>
        </div>`;
    },
    set_value: function(node, value, task, sns) {
        document.getElementById('lb_total_sheets').value     = task.total_sheets     || '';
        document.getElementById('lb_completed_sheets').value = task.completed_sheets || '';
    },
    get_value: function(node, task, sns) {
        task.total_sheets     = document.getElementById('lb_total_sheets').value;
        task.completed_sheets = document.getElementById('lb_completed_sheets').value;
        return task.total_sheets;
    },
    focus: function(node) {
        const el = document.getElementById('lb_total_sheets');
        if (el) el.focus();
    }
};

// 開始日と完了予定日を横並びで表示するカスタムフォームブロック
gantt.form_blocks["date_range"] = {
    render: function(sns) {
        return `<div class='gantt_cal_ltext' style='display:flex;gap:6px;align-items:center;'>
            <span style='font-size:11px;white-space:nowrap;color:#555;'>開始日</span>
            <input type='date' id='cal_start_date' style='width:110px;height:26px;border:1px solid #ccc;border-radius:4px;padding:0 4px;font-size:12px;'>
            <span style='font-size:11px;white-space:nowrap;color:#555;'>完了予定日</span>
            <input type='date' id='cal_end_date' style='width:110px;height:26px;border:1px solid #ccc;border-radius:4px;padding:0 4px;font-size:12px;'>
        </div>`;
    },
    set_value: function(node, value, task, sns) {
        const startInput = document.getElementById('cal_start_date');
        const endInput   = document.getElementById('cal_end_date');
        if (task.start_date) {
            const d = new Date(task.start_date);
            startInput.value = `${d.getFullYear()}-${("0"+(d.getMonth()+1)).slice(-2)}-${("0"+d.getDate()).slice(-2)}`;
        }
        if (task.end_date) {
            // end_date はDHTMLX排他的終了（翌日0時）なので1日引いて表示
            const d = new Date(task.end_date.getTime() - 24*60*60*1000);
            endInput.value = `${d.getFullYear()}-${("0"+(d.getMonth()+1)).slice(-2)}-${("0"+d.getDate()).slice(-2)}`;
        }
    },
    get_value: function(node, task, sns) {
        // 実際の保存処理は onLightboxSave で行う
        return task.start_date;
    },
    focus: function(node) {
        const el = document.getElementById('cal_start_date');
        if (el) el.focus();
    }
};

// 完了予定日と期間から開始日を計算するロジック
gantt.attachEvent("onTaskLoading", function(task){
    if (task.start_date && task.end_date) {
        // 初期読み込み時はそのまま
    }
    return true;
});

// ライトボックス保存時の処理
gantt.attachEvent("onLightboxSave", function(id, task, is_new){
    const startEl = document.getElementById("cal_start_date");
    const endEl   = document.getElementById("cal_end_date");
    const startStr = startEl ? startEl.value : "";
    const endStr   = endEl   ? endEl.value   : "";
    const duration = parseInt(task.duration) || 1;

    if (startStr && endStr) {
        task.start_date = new Date(startStr);
        task.end_date = new Date(endStr);
        task.end_date = gantt.date.add(task.end_date, 1, "day");
        task.duration = gantt.calculateDuration(task.start_date, task.end_date);
    } else if (startStr && duration) {
        task.start_date = new Date(startStr);
        task.end_date = gantt.date.add(task.start_date, duration, "day");
    } else if (endStr && duration) {
        task.end_date = new Date(endStr);
        task.end_date = gantt.date.add(task.end_date, 1, "day");
        task.start_date = gantt.date.add(task.end_date, -duration, "day");
    }

    return true;
});

// ライトボックス表示前の処理（担当別モード時は非表示）
gantt.attachEvent("onBeforeLightbox", function(id) {
    if (isResourceFullscreen) return false;
    const task = gantt.getTask(id);
    const taskType = task ? (task.task_type || 'assembly') : 'assembly';
    gantt.config.lightbox.sections = _getLightboxSections(taskType);

    if (taskType === 'business_trip') {
        gantt.locale.labels.section_description  = "タスク";
    } else {
        gantt.locale.labels.section_description  = "組立図面名 / 品名 / タスク";
        gantt.locale.labels.section_wish_date_lb = "出図希望日";
    }

    return true;
});

// ライトボックスを閉じた時の後処理
gantt.attachEvent("onAfterLightbox", function() {
    return true;
});

// 日付フォーマット共通テンプレート
function _fmtDate(obj) {
    if (obj.has_no_date || !obj.end_date) return "";
    // end_dateはdhtmlxGanttの排他的終了（完了日の翌日0時）なので1日引いて完了日を表示
    const date = new Date(obj.end_date.getTime() - 24 * 60 * 60 * 1000);
    const y = String(date.getFullYear()).slice(-2);
    const m = ("0" + (date.getMonth() + 1)).slice(-2);
    const d = ("0" + date.getDate()).slice(-2);
    return `${y}/${m}/${d}`;
}

// 進捗テンプレート
function _progressTemplate(obj) {
    const total = parseFloat(obj.total_sheets) || 0;
    const completed = parseFloat(obj.completed_sheets) || 0;
    let progress = 0;
    if (total > 0) {
        progress = Math.min(100, Math.round((completed / total) * 100));
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const isOverdue = (progress === 0 && obj.end_date && obj.end_date < today);
    const fillClass = isOverdue ? "progress-fill progress-overdue" : "progress-fill";
    const fillWidth = isOverdue ? "100%" : `${progress}%`;
    return `<div class="progress-cell-container">
                <div class="${fillClass}" style="width:${fillWidth};"></div>
                <span style="position:relative; z-index:2; color:black; font-weight:normal;">${progress}%</span>
            </div>`;
}

// 図面列定義（デフォルト）
function _getDrawingColumns() {
    return [
        { name: "project_number",  label: "工番",       width: 45,  align: "center", editor: { type: "text", map_to: "project_number" } },
        { name: "machine",         label: "機械",       width: 40,  align: "center", editor: { type: "text", map_to: "machine" } },
        { name: "unit",            label: "ユニ",       width: 40,  align: "center", editor: { type: "text", map_to: "unit" } },
        { name: "text",            label: "タスク",     width: 120, tree: true, align: "left",   editor: { type: "text", map_to: "text" } },
        { name: "notes",           label: "備考",       width: 100, align: "left",   editor: { type: "text", map_to: "notes" } },
        { name: "owner",           label: "担当",       width: 80,  align: "center", editor: { type: "owner_select", map_to: "owner" } },
        { name: "start_date",      label: "開始",       width: 65,  align: "center",
          template: function(task) {
            if (!task.start_date) return "";
            const d = task.start_date;
            const yy = String(d.getFullYear()).slice(-2);
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            const dd = String(d.getDate()).padStart(2, '0');
            return yy + '/' + mm + '/' + dd;
          },
          editor: { type: "start_date_editor", map_to: "start_date" } },
        { name: "end_date",        label: "終了",       width: 65,  align: "center", template: _fmtDate, editor: { type: "completion_date", map_to: "end_date" } },
        { name: "duration",        label: "日数",       width: 35,  align: "center", editor: { type: "number", map_to: "duration", min: 1 } },
        { name: "add_btn",         label: "",           width: 25,  align: "center", template: (task) => _isEditor ? `<div class='custom_add_btn' onclick='createTask(${task.id})'>+</div>` : '' }
    ];
}
// 図面列合計: 18+18+120+16+16+14+16+16+16+16+16+20+20+20 = 342px

// 長納期品列定義
function _getLongtermColumns() {
    return [
        { name: "project_number", label: "工事<br>番号", width: 35,  align: "center", editor: { type: "text",   map_to: "project_number" } },
        { name: "machine",    label: "機械",           width: 32,  align: "center", editor: { type: "text",   map_to: "machine" } },
        { name: "unit",       label: "ユニ",           width: 32,  align: "center", editor: { type: "text",   map_to: "unit" } },
        { name: "text",       label: "品名",           width: 103, tree: true, align: "left",   editor: { type: "text",   map_to: "text" } },
        { name: "part_number", label: "型式・図番",     width: 85,  align: "left", editor: { type: "text",   map_to: "part_number" } },
        { name: "quantity",   label: "個数",           width: 28,  align: "center", editor: { type: "number", map_to: "quantity", min: 0 } },
        { name: "manufacturer",      label: "メーカー",       width: 70,  align: "center", editor: { type: "text",   map_to: "manufacturer" } },
        { name: "owner",      label: "担当",           width: 32,  align: "center", editor: { type: "owner_select", map_to: "owner" } },
        { name: "end_date",   label: "手配<br>予定日", width: 60,  align: "center", template: _fmtDate, editor: { type: "completion_date", map_to: "end_date" } },
        { name: "status",     label: "状態",           width: 32,  align: "center",
          template: function(task) {
              const v = task.status || '';
              if (v === '未') return `<span style="display:block;width:100%;background:#e53935;color:#000;border-radius:2px;">${v}</span>`;
              return v;
          },
          editor: { type: "status_select", map_to: "status" } },
        { name: "add_btn",    label: "",               width: 25,  align: "center", template: (task) => _isEditor ? `<div class='custom_add_btn' onclick='createTask(${task.id})'>+</div>` : '' }
    ];
}
// 長納期品列合計: 32+42+190+85+28+70+32+60+20 = 559px

// 列設定の初期化
gantt.config.columns = _getDrawingColumns();

// 出張列定義
function _getTripColumns() {
    return [
        { name: "project_number",  label: "工事番号", width: 60,  align: "center", editor: { type: "text", map_to: "project_number" } },
        { name: "machine",         label: "機械",     width: 40,  align: "center", editor: { type: "text", map_to: "machine" } },
        { name: "unit",            label: "ユニ",     width: 40,  align: "center", editor: { type: "text", map_to: "unit" } },
        { name: "text",            label: "タスク",   width: 230, tree: true, align: "left",   editor: { type: "text", map_to: "text" } },
        { name: "owner",           label: "担当",     width: 40,  align: "center", editor: { type: "owner_select", map_to: "owner" } },
        { name: "start_date",      label: "開始日",   width: 65,  align: "center",
          template: function(task) {
            if (!task.start_date) return "";
            const d = task.start_date;
            const yy = String(d.getFullYear()).slice(-2);
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            const dd = String(d.getDate()).padStart(2, '0');
            return yy + '/' + mm + '/' + dd;
          },
          editor: { type: "start_date_editor", map_to: "start_date" } },
        { name: "end_date",        label: "終了日",   width: 65,  align: "center", template: _fmtDate, editor: { type: "completion_date", map_to: "end_date" } },
        { name: "add_btn",         label: "",         width: 25,  align: "center", template: (task) => _isEditor ? `<div class='custom_add_btn' onclick='createTask(${task.id})'>+</div>` : '' }
    ];
}

// 計画（組立）列定義
function _getPlanningColumns() {
    return [
        { name: "project_number",  label: "工事番号", width: 60,  align: "center", editor: { type: "text", map_to: "project_number" } },
        { name: "machine",         label: "機械",     width: 40,  align: "center", editor: { type: "text", map_to: "machine" } },
        { name: "unit",            label: "ユニ",     width: 40,  align: "center", editor: { type: "text", map_to: "unit" } },
        { name: "text",            label: "タスク",   width: 150, tree: true, align: "left",   editor: { type: "text", map_to: "text" } },
        { name: "notes",           label: "備考",     width: 100, align: "left",   editor: { type: "text", map_to: "notes" } },
        { name: "owner",           label: "担当",     width: 40,  align: "center", editor: { type: "owner_select", map_to: "owner" } },
        { name: "start_date",      label: "開始",     width: 65,  align: "center",
          template: function(task) {
            if (!task.start_date) return "";
            const d = task.start_date;
            const yy = String(d.getFullYear()).slice(-2);
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            const dd = String(d.getDate()).padStart(2, '0');
            return yy + '/' + mm + '/' + dd;
          },
          editor: { type: "start_date_editor", map_to: "start_date" } },
        { name: "end_date",        label: "終了",     width: 65,  align: "center", template: _fmtDate, editor: { type: "completion_date", map_to: "end_date" } },
        { name: "duration",        label: "日数",     width: 35,  align: "center", editor: { type: "number", map_to: "duration", min: 1 } },
        { name: "add_btn",         label: "",         width: 25,  align: "center", template: (task) => _isEditor ? `<div class='custom_add_btn' onclick='createTask(${task.id})'>+</div>` : '' }
    ];
}

// 列セット切り替え
function switchColumns(filterType) {
    let cols;
    if (filterType === 'long_lead_item') cols = _getLongtermColumns();
    else if (filterType === 'business_trip') cols = _getTripColumns();
    else if (filterType === 'planning') cols = _getPlanningColumns();
    else cols = _getDrawingColumns();
    gantt.config.columns = cols;
    _setLayout(_getColsSum(cols));
    gantt.render();
}

// スタイルとテンプレート
gantt.templates.task_text = function(start, end, task) {
    const colorClass = getOwnerColorClass(task.owner);
    const textColor = "#fff";
    return `<span style="color:${textColor};">${task.text}</span>`;
};

gantt.templates.task_class = function(start, end, task) {
    let css = task.has_no_date ? "hidden_bar " : "";
    css += getOwnerColorClass(task.owner);
    return css;
};
gantt.templates.timeline_cell_class = function(task, date) {
    // 週単位表示では列が週単位なので土日判定を適用しない
    if (gantt.ext.zoom.getCurrentLevel() !== 0) return "";
    if (date.getDay() === 0 || date.getDay() === 6 || _isHoliday(date)) return "weekend";
    return "";
};

gantt.templates.grid_row_class = function(start, end, task) {
    return "";
};

// フィルタリング（is_detailed=FALSE かつ major_item=組立or電装のみ表示、かつ工事番号フィルタ）
gantt.attachEvent("onBeforeTaskDisplay", function(id, task) {
    // is_detailed が TRUE のタスクは設計工程表用なので除外
    const isDetailed = (task.is_detailed === true || String(task.is_detailed).toUpperCase() === 'TRUE');
    if (isDetailed) return false;

    // major_item が「組立」または「電装」のもののみ表示
    const mi = String(task.major_item);
    if (mi !== '組立' && mi !== '電装') return false;

    // 工事番号フィルタ
    if (currentProjectFilter.length > 0) {
        if (!currentProjectFilter.includes(String(task.project_number))) return false;
    }

    // task_typeフィルタ（'assembly'の場合はtask_type=nullも含む）
    if (currentTaskTypeFilter) {
        const tt = task.task_type;
        const isNull = (tt === null || tt === undefined || tt === '' || String(tt) === 'null');
        if (currentTaskTypeFilter === 'assembly') {
            if (!isNull && String(tt) !== 'assembly') return false;
        } else {
            if (String(tt) !== currentTaskTypeFilter) return false;
        }
    }

    // タスク名フィルタ（複数選択対応）
    if (currentTaskNameFilter.length > 0) {
        const taskText = String(task.text || '').trim();
        const matches = currentTaskNameFilter.some(f => {
            if (f === '出荷') return taskText === '出荷準備' || taskText === '工場出荷';
            return taskText === f;
        });
        if (!matches) return false;
    }

    // 担当者フィルタ（複数選択対応）
    if (currentOwnerFilter.length > 0) {
        const taskOwners = String(task.owner || '').split(/[,、\s]+/).map(o => o.trim());
        if (!currentOwnerFilter.some(f => taskOwners.includes(f))) return false;
    }

    return true;
});

// JSローカル日付を "YYYY-MM-DD" 文字列に変換（Supabase date列への保存用）
function _toDateStr(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

// Supabaseのdate列（"YYYY-MM-DD"）をローカル深夜0時のDateとして解釈するヘルパー
function _parseSupabaseDate(str) {
    if (!str) return null;
    if (typeof str !== 'string') return new Date(str);
    const s = str.trim();
    // "YYYY-MM-DD" 形式（時刻なし）→ ローカル深夜0時
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
        const [y, mo, d] = s.split('-').map(Number);
        return new Date(y, mo - 1, d);
    }
    // 時刻あり・タイムゾーンなし → UTCとして解釈
    if (!s.endsWith('Z') && !/[+-]\d{2}:?\d{2}$/.test(s)) {
        return new Date(s.replace(' ', 'T') + 'Z');
    }
    return new Date(s);
}

// データ読み込み
async function loadData() {
    const [tasksResult, locationsResult] = await Promise.all([
        supabaseClient
            .from('tasks')
            .select('*')
            .neq('is_archived', true)
            .order('project_number', { ascending: true })
            .order('machine', { ascending: true, nullsFirst: true })
            .order('unit', { ascending: true, nullsFirst: true })
            .order('start_date', { ascending: true, nullsFirst: true })
            .order('id', { ascending: true }),
        supabaseClient
            .from('task_locations')
            .select('task_id, area_group, area_number')
    ]);

    const { data, error } = tasksResult;
    if (error) {
        console.error("Supabase error:", error);
        return;
    }

    const today = new Date().toISOString().split('T')[0];

    const parsedTasks = data.map(t => {
        const startDate = t.start_date
            ? _parseSupabaseDate(t.start_date)
            : new Date(today + 'T00:00:00Z');

        let endDate;
        let hasNoDate = false;

        if (t.end_date) {
            // end_date あり → +1日して排他的終了日に
            endDate = gantt.date.add(_parseSupabaseDate(t.end_date), 1, 'day');
        } else if (t.duration && Number(t.duration) > 0) {
            // end_date なし・duration あり → start_date + duration日
            endDate = gantt.date.add(startDate, Number(t.duration), 'day');
        } else if (t.start_date) {
            // start_date だけあれば1日バーで表示
            endDate = gantt.date.add(startDate, 1, 'day');
        } else {
            // 日付が何もなければバー非表示
            hasNoDate = true;
            endDate = gantt.date.add(startDate, 1, 'day');
        }

        return {
            ...t,
            start_date: startDate,
            end_date:   endDate,
            has_no_date: hasNoDate,
            parent: 0
        };
    });

    // 工事番号昇順 → 機械別 → ユニット別 にソート
    parsedTasks.sort((a, b) => {
        // 1. 工事番号
        const pa = String(a.project_number || '');
        const pb = String(b.project_number || '');
        if (pa < pb) return -1;
        if (pa > pb) return 1;
        // 2. 機械
        const ma = String(a.machine || '');
        const mb = String(b.machine || '');
        if (ma < mb) return -1;
        if (ma > mb) return 1;
        // 3. ユニット
        const ua = String(a.unit || '');
        const ub = String(b.unit || '');
        if (ua < ub) return -1;
        if (ua > ub) return 1;
        // 4. 開始日昇順
        const da = a.start_date ? new Date(a.start_date).getTime() : 0;
        const db = b.start_date ? new Date(b.start_date).getTime() : 0;
        if (da !== db) return da - db;
        // 5. sort_order（同一グループ内の細かい順序）
        const sa = (a.sort_order != null) ? a.sort_order : a.id * 1000;
        const sb = (b.sort_order != null) ? b.sort_order : b.id * 1000;
        return sa - sb;
    });

    // 全体工程表で完了済みになった工事番号のタスクを除外
    const activeTasks = parsedTasks.filter(t =>
        !completedProjectNums.has(String(t.project_number || '').trim())
    );

    // データ更新時は選択をリセット
    _gridSelection.clear();
    _lastGridClickId = null;

    gantt.clearAll();
    gantt.parse({
        data: activeTasks
    });

    // task_locations データを構築
    const locData = locationsResult.data;
    if (locData) {
        const taskMap = new Map(activeTasks.map(t => [t.id, t]));
        taskLocationsData = locData
            .map(loc => ({ ...loc, task: taskMap.get(loc.task_id) || null }))
            .filter(loc => loc.task !== null);
    } else {
        taskLocationsData = [];
    }

    // 追加：データ読み込み完了直後にリソースデータを更新
    if (isResourceView) {
        updateResourceData();
        gantt.render();
    }

    // 組立場所モード中はフロアプランを再描画
    if (isLocationMode) {
        renderLocationFloorPlan();
    }
}

// グローバル変数の定義
let projectMap = new Map();
let currentTaskTypeFilter = null; // null = 全表示
let currentProjectFilter = [];    // 空配列 = 全工事番号

// 全体工程表の completed_projects テーブルから取得した完了済み工事番号
let completedProjectNums = new Set();

// 休日セット（"YYYY-MM-DD" 形式で保持）
let HOLIDAYS = new Set();

// 組立場所フロアプランビュー用
let taskLocationsData = []; // { task_id, area_group, area_number, task }
let isLocationMode = false;
let _fpDragData = null; // { task_id, from_group, from_area } ドラッグ中のデータ

async function loadCompletedProjects() {
    const { data, error } = await supabaseClient
        .from('completed_projects')
        .select('project_number');
    if (error) { console.error('completedProjects 読み込みエラー:', error); return; }
    completedProjectNums = new Set((data || []).map(c => String(c.project_number).trim()));
}

async function loadHolidays() {
    const { data, error } = await supabaseClient.from('holidays').select('date');
    if (error) { console.error('休日読み込みエラー:', error); return; }
    HOLIDAYS = new Set(data.map(row => {
        // "2026/3/20" → "2026-03-20" に正規化
        const parts = String(row.date).split('/');
        if (parts.length !== 3) return null;
        return parts[0] + '-' + String(parts[1]).padStart(2,'0') + '-' + String(parts[2]).padStart(2,'0');
    }).filter(Boolean));
}

function _isHoliday(date) {
    const key = date.getFullYear() + '-' +
        String(date.getMonth() + 1).padStart(2,'0') + '-' +
        String(date.getDate()).padStart(2,'0');
    return HOLIDAYS.has(key);
}
let currentOwnerFilter = [];      // 空配列 = 全担当者
let currentTaskNameFilter = [];   // 空配列 = 全タスク名
let _clearingEndDateId = null;   // 完了予定日クリア中のタスクID
let isResourceFullscreen = false;

function _initOwnerFilterDropdown() {
    const list = document.getElementById('owner_chk_list');
    if (!list) return;
    const makeItem = name => `
        <label style="display:block; padding:4px 10px; cursor:pointer; white-space:nowrap; font-size:13px; font-family:'メイリオ',Meiryo,sans-serif;">
            <input type="checkbox" class="owner-chk-item" value="${name}" onchange="ownerFilterItemChanged()"> ${name}
        </label>
    `;
    const assemblySeparator = `<div style="padding:2px 10px 0; font-size:11px; color:#888; font-family:'メイリオ',Meiryo,sans-serif;">組立</div>`;
    const assemblyItems = OWNER_OPTIONS_ASSEMBLY.map(makeItem).join('');
    const separator = `<div style="border-top:1px solid #ccc; margin:4px 0; padding:2px 10px 0; font-size:11px; color:#888; font-family:'メイリオ',Meiryo,sans-serif;">電装</div>`;
    const electricalItems = OWNER_OPTIONS_ELECTRICAL.map(makeItem).join('');
    list.innerHTML = assemblySeparator + assemblyItems + separator + electricalItems;
}

function toggleProjectFilterDropdown() {
    const dd = document.getElementById('project_filter_dropdown');
    if (dd) dd.style.display = dd.style.display === 'none' ? '' : 'none';
}

function projectFilterAllChanged(checkbox) {
    document.querySelectorAll('.project-chk-item').forEach(chk => { chk.checked = false; });
    currentProjectFilter = [];
    gantt.render();
    _updateProjectFilterBtn();
    updateDisplay();
}

function projectFilterItemChanged() {
    const selected = [];
    document.querySelectorAll('.project-chk-item:checked').forEach(chk => selected.push(chk.value));
    currentProjectFilter = selected;
    const allChk = document.getElementById('project_chk_all');
    if (allChk) allChk.checked = selected.length === 0;
    gantt.render();
    _updateProjectFilterBtn();
    updateDisplay();
}

function _updateProjectFilterBtn() {
    const btn = document.getElementById('project_filter_btn');
    if (!btn) return;
    if (currentProjectFilter.length === 0) {
        btn.textContent = '工事番号: 全表示';
    } else if (currentProjectFilter.length === 1) {
        btn.textContent = currentProjectFilter[0];
    } else {
        btn.textContent = currentProjectFilter[0] + ' 他' + (currentProjectFilter.length - 1) + '件';
    }
}

function toggleOwnerFilterDropdown() {
    const dd = document.getElementById('owner_filter_dropdown');
    if (dd) dd.style.display = dd.style.display === 'none' ? '' : 'none';
}

function ownerFilterAllChanged(checkbox) {
    document.querySelectorAll('.owner-chk-item').forEach(chk => { chk.checked = false; });
    currentOwnerFilter = [];
    gantt.render();
    _updateOwnerFilterBtn();
}

function ownerFilterItemChanged() {
    const selected = [];
    document.querySelectorAll('.owner-chk-item:checked').forEach(chk => selected.push(chk.value));
    currentOwnerFilter = selected;
    const allChk = document.getElementById('owner_chk_all');
    if (allChk) allChk.checked = selected.length === 0;
    gantt.render();
    _updateOwnerFilterBtn();
}

function _updateOwnerFilterBtn() {
    const btn = document.getElementById('owner_filter_btn');
    if (!btn) return;
    if (currentOwnerFilter.length === 0) {
        btn.textContent = '担当者: 全員';
    } else if (currentOwnerFilter.length === 1) {
        btn.textContent = currentOwnerFilter[0];
    } else {
        btn.textContent = currentOwnerFilter[0] + ' 他' + (currentOwnerFilter.length - 1) + '名';
    }
}

function toggleTaskNameFilterDropdown() {
    const dd = document.getElementById('task_name_filter_dropdown');
    if (dd) dd.style.display = dd.style.display === 'none' ? '' : 'none';
}

function taskNameFilterAllChanged(checkbox) {
    document.querySelectorAll('.task-name-chk-item').forEach(chk => { chk.checked = false; });
    currentTaskNameFilter = [];
    gantt.render();
    _updateTaskNameFilterBtn();
}

function taskNameFilterItemChanged() {
    const selected = [];
    document.querySelectorAll('.task-name-chk-item:checked').forEach(chk => selected.push(chk.value));
    currentTaskNameFilter = selected;
    const allChk = document.getElementById('task_name_chk_all');
    if (allChk) allChk.checked = selected.length === 0;
    gantt.render();
    _updateTaskNameFilterBtn();
}

function _updateTaskNameFilterBtn() {
    const btn = document.getElementById('task_name_filter_btn');
    if (!btn) return;
    if (currentTaskNameFilter.length === 0) {
        btn.textContent = 'タスク名: 全表示';
    } else if (currentTaskNameFilter.length === 1) {
        btn.textContent = currentTaskNameFilter[0];
    } else {
        btn.textContent = currentTaskNameFilter[0] + ' 他' + (currentTaskNameFilter.length - 1) + '件';
    }
}

// ドロップダウン外クリックで閉じる
document.addEventListener('click', function(e) {
    const ownerWrap = document.getElementById('owner_filter_wrap');
    if (ownerWrap && !ownerWrap.contains(e.target)) {
        const dd = document.getElementById('owner_filter_dropdown');
        if (dd) dd.style.display = 'none';
    }
    const projectWrap = document.getElementById('project_filter_wrap');
    if (projectWrap && !projectWrap.contains(e.target)) {
        const dd = document.getElementById('project_filter_dropdown');
        if (dd) dd.style.display = 'none';
    }
    const taskNameWrap = document.getElementById('task_name_filter_wrap');
    if (taskNameWrap && !taskNameWrap.contains(e.target)) {
        const dd = document.getElementById('task_name_filter_dropdown');
        if (dd) dd.style.display = 'none';
    }
    const archiveBtnWrap = document.getElementById('archive_btn_wrap');
    if (archiveBtnWrap && !archiveBtnWrap.contains(e.target)) {
        const menu = document.getElementById('archive_dropdown_menu');
        if (menu) menu.classList.remove('open');
    }
});

function updateFilterButtons() {
    document.getElementById('resource_home_btn').classList.toggle('active', isResourceFullscreen);
    document.getElementById('drawing_filter_btn').classList.toggle('active', currentTaskTypeFilter === 'assembly');
    document.getElementById('longterm_filter_btn').classList.toggle('active', currentTaskTypeFilter === 'long_lead_item');
    document.getElementById('trip_filter_btn').classList.toggle('active', currentTaskTypeFilter === 'business_trip');
    // 担当別モード中はボタン行の上下余白を均等にして行を調整
    const filterBtnRow = document.getElementById('filter_btn_row');
    if (filterBtnRow) filterBtnRow.style.minHeight = isResourceFullscreen ? '36px' : '';
    const headerPanel = document.querySelector('.header-panel');
    if (headerPanel) headerPanel.style.padding = isResourceFullscreen ? '6px 10px 3px 10px' : '';
    // 担当別モード中は2・3行目を非表示、新規タスク追加ボタンも非表示
    const zoomRow = document.getElementById('zoom_row');
    if (zoomRow) zoomRow.style.display = isResourceFullscreen ? 'none' : '';
    const dropdownsRow = document.getElementById('dropdowns_row');
    if (dropdownsRow) dropdownsRow.style.display = isResourceFullscreen ? 'none' : '';
    // 担当者フィルターは通常ガント時のみ表示（担当別全画面・組立場所モードでは非表示）
    const ownerWrap = document.getElementById('owner_filter_wrap');
    if (ownerWrap) ownerWrap.style.display = (isResourceFullscreen || isLocationMode || currentTaskTypeFilter === 'long_lead_item') ? 'none' : '';
    const addBtn = document.getElementById('create_task_btn');
    if (addBtn) addBtn.style.display = (isResourceFullscreen || !_isEditor) ? 'none' : '';
}

// タスクバークリック時の編集（担当別モードでは無効）
function _showResourceLightbox(id) {
    if (isResourceFullscreen) return;
    gantt.showLightbox(id);
}

gantt.attachEvent('onAfterLightbox', function() {
    if (isResourceFullscreen) {
        // ライトボックスを閉じたらガントを再び非表示に戻す
        const ganttEl = document.getElementById('gantt_here');
        ganttEl.style.cssText = 'display:none;';
    }
});

function returnToResourceView() {
    if (isResourceFullscreen) {
        // 担当別モード中に再クリック → 組立モードへ切り替え
        currentTaskTypeFilter = null; // setTaskTypeFilter内で'assembly'に設定させる
        setTaskTypeFilter('assembly');
        return;
    }
    currentTaskTypeFilter = null;
    updateFilterButtons();
    _enterResourceFullscreen();
}

function _colSetName(filterType) {
    if (filterType === 'long_lead_item') return 'longterm';
    if (filterType === 'business_trip')  return 'trip';
    if (filterType === 'planning')        return 'trip';
    return 'default';
}

function setTaskTypeFilter(type) {
    const prevColSet = _colSetName(currentTaskTypeFilter);
    // 同じフィルターを再クリックしても null にせず assembly にフォールバック
    currentTaskTypeFilter = (currentTaskTypeFilter === type) ? 'assembly' : type;
    // 組立場所モード中に他モードへ切り替える場合は、先にフロアプラン表示を解除する
    if (typeof isLocationMode !== 'undefined' && isLocationMode && currentTaskTypeFilter !== 'long_lead_item') {
        exitLocationMode();
    }
    updateFilterButtons();

    // フィルターON → ガントビューに切り替え
    if (isResourceFullscreen) {
        _exitResourceFullscreen();
    }
    if (_colSetName(currentTaskTypeFilter) !== prevColSet) {
        switchColumns(currentTaskTypeFilter);
    } else {
        gantt.refreshData();
    }
    // ブラウザの描画確定後にズームレベルを再設定してカレンダーヘッダーを完全再描画
    setTimeout(() => {
        gantt.setSizes();
        const currentLevel = document.querySelector('.zoom-btn.active')?.textContent === '週単位' ? 'week' : 'day';
        gantt.ext.zoom.setLevel(currentLevel);
    }, 0);
}

function toggleDrawingFilter()  { setTaskTypeFilter('assembly'); }
function toggleTripFilter()     { setTaskTypeFilter('business_trip'); }

function toggleLongtermFilter() {
    if (currentTaskTypeFilter === 'long_lead_item') {
        // 解除 → 組立モードへ戻る
        currentTaskTypeFilter = 'assembly';
        exitLocationMode();
        updateFilterButtons();
        switchColumns('assembly');
    } else {
        // 担当別全画面モード中なら先に解除
        if (isResourceFullscreen) _exitResourceFullscreen();
        currentTaskTypeFilter = 'long_lead_item';
        updateFilterButtons();
        enterLocationMode();
    }
}

// 工事番号セレクトボックスの表示更新
function updateDisplay() {
    const display = document.getElementById('project_display');
    if (display) {
        if (currentProjectFilter.length === 0) {
            display.innerText = "工事番号: 全表示";
        } else if (currentProjectFilter.length === 1) {
            const info = projectMap.get(currentProjectFilter[0]);
            display.innerText = `${currentProjectFilter[0]} ${info?.customer || ""} ${info?.details || ""}`;
        } else {
            display.innerText = currentProjectFilter.join('、');
        }
    }

    if (isResourceView) {
        updateResourceData();
    }
    gantt.render();
}

// 工事番号フィルターの初期化
async function initProjectSelect(projectParam) {
    const { data } = await supabaseClient
        .from('tasks')
        .select('project_number, customer_name, project_details, is_detailed, major_item')
        .neq('is_archived', true);
    if (!data) return;

    // 工事番号ごとの情報をマップに格納（is_detailed=false かつ major_item=組立 or 電装 のタスクのみ）
    projectMap = new Map();
    data.forEach(item => {
        if (!item.project_number) return;
        if (completedProjectNums.has(String(item.project_number).trim())) return; // 全体工程表で完了済みを除外
        const isDetailed = (item.is_detailed === true || String(item.is_detailed).toUpperCase() === 'TRUE');
        if (isDetailed) return;
        const mi = String(item.major_item);
        if (mi !== '組立' && mi !== '電装') return;
        const existing = projectMap.get(item.project_number);
        const customer = item.customer_name || (existing ? existing.customer : "");
        const details = item.project_details || (existing ? existing.details : "");
        projectMap.set(item.project_number, { customer, details });
    });

    const nums = Array.from(projectMap.keys()).sort();
    const list = document.getElementById('project_chk_list');
    list.innerHTML = nums.map(n => `
        <label style="display:block; padding:4px 10px; cursor:pointer; white-space:nowrap; font-size:13px; font-family:'メイリオ',Meiryo,sans-serif;">
            <input type="checkbox" class="project-chk-item" value="${n}" onchange="projectFilterItemChanged()"> ${n}
        </label>`).join('');

    // URLパラメータで初期選択
    if (projectParam) {
        const chk = list.querySelector(`.project-chk-item[value="${projectParam}"]`);
        if (chk) {
            chk.checked = true;
            currentProjectFilter = [String(projectParam)];
            const allChk = document.getElementById('project_chk_all');
            if (allChk) allChk.checked = false;
        }
    }

    _updateProjectFilterBtn();
    updateDisplay();
}

// 初期化関数
async function initialize() {
    const urlParams = new URLSearchParams(window.location.search);
    const projectParam = urlParams.get('project_no') || urlParams.get('project');
    console.log("URLパラメータ:", projectParam);

    // 0. プラグインの有効化
    gantt.plugins({
        marker: true,
        multiselect: true
    });

    // 1. Gantt初期化（デフォルトは読み取り専用、ログイン後に解除）
    gantt.config.readonly = true;
    gantt.config.columns = _getDrawingColumns();
    _setLayout(_getColsSum(gantt.config.columns));

    gantt.init("gantt_here");

    // === グリッド操作設定 ===

    // タスク選択が変わるたびに選択削除ボタンを更新
    gantt.attachEvent("onTaskClick", function(id, e) {
        setTimeout(_updateMultiDeleteBtn, 0);
        return true;
    });
    gantt.attachEvent("onEmptyClick", function(e) {
        _gridSelection.clear();
        _lastGridClickId = null;
        _applyGridSelection();
        setTimeout(_updateMultiDeleteBtn, 0);
        return true;
    });
    // 再描画後にグリッド選択ハイライトを復元
    gantt.attachEvent("onGanttRender", function() {
        _applyGridSelection();
    });

    // キャプチャフェーズでグリッドセルのクリックを横取り
    // → dhtmlxGanttのバブルリスナー（インライン編集起動）に届かせない
    // シングルクリック: バーが見えるようタイムラインをスクロール
    // ＋ボタン（.custom_add_btn）は横取りせずそのまま通過させる
    document.getElementById("gantt_here").addEventListener("click", function(e) {
        if (e.target.closest(".custom_add_btn")) return;
        const cell = e.target.closest(".gantt_cell");
        if (!cell) return;
        e.stopImmediatePropagation();
        const row = cell.closest("[task_id]");
        if (!row) return;
        const taskId = row.getAttribute("task_id");

        if (e.ctrlKey || e.metaKey) {
            // Ctrl+クリック：トグル選択
            if (_gridSelection.has(taskId)) {
                _gridSelection.delete(taskId);
            } else {
                _gridSelection.add(taskId);
            }
            _lastGridClickId = taskId;
        } else if (e.shiftKey && _lastGridClickId) {
            // Shift+クリック：範囲選択
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
            // 通常クリック：単一選択＋バースクロール
            _gridSelection.clear();
            _gridSelection.add(taskId);
            _lastGridClickId = taskId;
            const task = gantt.getTask(taskId);
            if (task) {
                const state = gantt.getScrollState();
                const taskX = gantt.posFromDate(task.start_date);
                // 1回のscrollToでX/Y両方を指定することで競合を防ぐ
                // 左マージン40pxを取り、タスク開始日がビューポート左寄りに来るようにする
                gantt.scrollTo(Math.max(0, taskX - 40), state.y);
            }
        }
        _applyGridSelection();
        _updateMultiDeleteBtn();
    }, true);

    // ダブルクリック: インラインエディタを開く（ライトボックスはブロック）
    // バーのダブルクリックは .gantt_cell を持たないため通過し、デフォルトのライトボックスが開く
    document.getElementById("gantt_here").addEventListener("dblclick", function(e) {
        if (!_isEditor) return;
        const cell = e.target.closest(".gantt_cell");
        if (!cell) return;
        e.stopImmediatePropagation();
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

    // 右クリックコンテキストメニュー（コピー・削除）
    const _ctxMenu = document.createElement('div');
    _ctxMenu.id = 'gantt_ctx_menu';
    _ctxMenu.innerHTML =
        '<div id="gantt_ctx_copy"       class="gantt_ctx_item">このタスクをコピー</div>' +
        '<div id="gantt_ctx_copy_multi" class="gantt_ctx_item">選択した行をコピー（<span id="gantt_ctx_copy_multi_count">0</span>件）</div>' +
        '<div class="gantt_ctx_sep"></div>' +
        '<div id="gantt_ctx_paste"      class="gantt_ctx_item disabled">コピーした行を貼り付け</div>' +
        '<div class="gantt_ctx_sep"></div>' +
        '<div id="gantt_ctx_delete"     class="gantt_ctx_item">このタスクを削除</div>';
    document.body.appendChild(_ctxMenu);

    let _ctxTaskId = null;
    let _copiedTasks = []; // 複数行コピーのバッファ

    document.getElementById("gantt_here").addEventListener("contextmenu", function(e) {
        if (!_isEditor) return;
        const row = e.target.closest("[task_id]");
        if (!row) return;
        e.preventDefault();
        _ctxTaskId = row.getAttribute("task_id");
        // 選択件数を更新
        document.getElementById("gantt_ctx_copy_multi_count").textContent = _gridSelection.size;
        // 削除ラベルを選択数に応じて切り替え
        const isMultiDelete = _gridSelection.size > 1 && _gridSelection.has(String(_ctxTaskId));
        document.getElementById("gantt_ctx_delete").textContent =
            isMultiDelete ? `選択した ${_gridSelection.size} 件を削除` : "このタスクを削除";
        // コピーの有効/無効（工事番号が1つ選択されていない場合は不可）
        const _copyDisabled = currentProjectFilter.length !== 1;
        document.getElementById("gantt_ctx_copy").classList.toggle('disabled', _copyDisabled);
        document.getElementById("gantt_ctx_copy_multi").classList.toggle('disabled', _copyDisabled);
        // 貼り付けの有効/無効
        document.getElementById("gantt_ctx_paste").classList.toggle('disabled', _copiedTasks.length === 0);
        _ctxMenu.style.display = 'block';
        const menuH = _ctxMenu.offsetHeight;
        const menuW = _ctxMenu.offsetWidth;
        const top = (e.clientY + menuH > window.innerHeight) ? e.clientY - menuH : e.clientY;
        const left = (e.clientX + menuW > window.innerWidth) ? e.clientX - menuW : e.clientX;
        _ctxMenu.style.top = (top + window.scrollY) + 'px';
        _ctxMenu.style.left = (left + window.scrollX) + 'px';
    });

    // コピー項目設定
    const COPY_FIELDS = [
        { key: 'project_number',  label: '工事番号',   default: true },
        { key: 'machine',         label: '機械',       default: true },
        { key: 'unit',            label: 'ユニ',       default: false },
        { key: 'unit2',           label: 'ユニ2',      default: true },
        { key: 'text',            label: 'タスク名',   default: false },
        { key: 'model_type',      label: '機種',       default: true },
        { key: 'part_number',     label: '型式・図番', default: true },
        { key: 'quantity',        label: '個数',       default: true },
        { key: 'manufacturer',    label: 'メーカー',   default: true },
        { key: 'status',          label: '状態',       default: true },
        { key: 'customer_name',   label: '客先名',     default: true },
        { key: 'project_details', label: '案件詳細',   default: true },
        { key: 'characteristic',  label: '特性',       default: true },
        { key: 'derivation',      label: '派生',       default: true },
        { key: 'owner',           label: '担当',       default: true },
        { key: 'start_date',      label: '開始日',     default: true },
        { key: 'end_date',        label: '完了予定日', default: false },
        { key: 'total_sheets',    label: '総枚数',     default: false },
        { key: 'completed_sheets',label: '完了枚数',   default: false },
    ];
    const COPY_OPTS_KEY = 'gantt_copy_opts';

    // コピーモーダルの生成
    const _copyOverlay = document.createElement('div');
    _copyOverlay.id = 'copy_options_overlay';
    _copyOverlay.innerHTML = `
        <div id="copy_options_dialog">
            <h3>コピーする項目を選択</h3>
            <div class="copy-opts-grid">
                ${COPY_FIELDS.map(f => `
                    <label>
                        <input type="checkbox" data-copy-key="${f.key}">
                        ${f.label}
                    </label>`).join('')}
            </div>
            <div class="copy-opts-actions">
                <button class="btn" id="copy_opts_cancel">キャンセル</button>
                <button class="btn btn-primary" id="copy_opts_exec">コピー実行</button>
            </div>
        </div>`;
    document.body.appendChild(_copyOverlay);

    // チェック状態をlocalStorageから復元
    function _loadCopyOpts() {
        try {
            return JSON.parse(localStorage.getItem(COPY_OPTS_KEY) || 'null');
        } catch { return null; }
    }
    function _saveCopyOpts() {
        const state = {};
        _copyOverlay.querySelectorAll('[data-copy-key]').forEach(cb => {
            state[cb.dataset.copyKey] = cb.checked;
        });
        localStorage.setItem(COPY_OPTS_KEY, JSON.stringify(state));
    }
    function _applyDefaultOpts() {
        const saved = _loadCopyOpts();
        _copyOverlay.querySelectorAll('[data-copy-key]').forEach(cb => {
            const key = cb.dataset.copyKey;
            const field = COPY_FIELDS.find(f => f.key === key);
            cb.checked = saved ? (saved[key] ?? field.default) : field.default;
        });
    }

    let _copySourceId = null;

    // コピーメニュークリック → モーダル表示
    document.getElementById("gantt_ctx_copy").addEventListener("click", function() {
        _copySourceId = _ctxTaskId;
        _ctxMenu.style.display = 'none';
        _ctxTaskId = null;
        if (!_copySourceId || !gantt.isTaskExists(_copySourceId)) return;
        _applyDefaultOpts();
        _copyOverlay.classList.add('open');
    });

    document.getElementById("copy_opts_cancel").addEventListener("click", function() {
        _copyOverlay.classList.remove('open');
        _copySourceId = null;
    });

    // コピー元の直下に挿入する sort_order を計算するヘルパー
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
                if (taskType === 'assembly') {
                    if (!isNull && String(tt) !== 'assembly') return false;
                } else {
                    if (String(tt) !== String(taskType)) return false;
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

    // 単一コピー実行
    document.getElementById("copy_opts_exec").addEventListener("click", async function() {
        _saveCopyOpts();
        _copyOverlay.classList.remove('open');
        if (!_copySourceId || !gantt.isTaskExists(_copySourceId)) return;

        const src = gantt.getTask(_copySourceId);
        const insertSortOrder = _calcInsertAfterSortOrder(_copySourceId);
        _copySourceId = null;

        // チェック状態を収集
        const checked = {};
        _copyOverlay.querySelectorAll('[data-copy-key]').forEach(cb => {
            checked[cb.dataset.copyKey] = cb.checked;
        });

        const _v  = (key, fallback) => checked[key] ? (src[key] || fallback) : fallback;
        const _n  = (key) => checked[key] ? (Number(src[key]) || 0) : 0;
        const _dt = (key) => {
            if (!checked[key]) return null;
            if (key === 'end_date') {
                return src.end_date instanceof Date
                    ? _toDateStr(gantt.date.add(new Date(src.end_date), -1, 'day'))
                    : src.end_date;
            }
            return src[key] instanceof Date ? _toDateStr(src[key]) : src[key];
        };

        const { data, error } = await supabaseClient
            .from('tasks')
            .insert([{
                text:             _v('text', ""),
                start_date:       _dt('start_date'),
                end_date:         _dt('end_date'),
                project_number:   _v('project_number', ""),
                machine:          _v('machine', ""),
                unit:             _v('unit', ""),
                unit2:            _v('unit2', ""),
                model_type:       _v('model_type', ""),
                part_number:      _v('part_number', ""),
                quantity:         _n('quantity'),
                manufacturer:     _v('manufacturer', ""),
                status:           _v('status', ""),
                customer_name:    _v('customer_name', ""),
                project_details:  _v('project_details', ""),
                characteristic:   _v('characteristic', ""),
                derivation:       _v('derivation', ""),
                owner:            _v('owner', ""),
                total_sheets:     _n('total_sheets'),
                completed_sheets: _n('completed_sheets'),
                task_type:        currentTaskTypeFilter || src.task_type || null,
                is_detailed:      false,
                major_item:       '組立',
                sort_order:       insertSortOrder
            }])
            .select();

        if (error) {
            console.error("Error copying task:", error);
            alert("タスクのコピーに失敗しました。\n" + error.message);
            return;
        }

        await loadData();
        if (data && data[0]) gantt.showTask(data[0].id);
    });

    // 複数行コピー
    document.getElementById("gantt_ctx_copy_multi").addEventListener("click", function() {
        _ctxMenu.style.display = 'none';
        if (_gridSelection.size === 0) { alert("行を選択してからコピーしてください。"); return; }
        _copiedTasks = [..._gridSelection]
            .map(id => gantt.isTaskExists(id) ? gantt.getTask(id) : null)
            .filter(Boolean);
        alert(`${_copiedTasks.length} 行をコピーしました。\n貼り付け先の工事番号を選択して右クリック →「コピーした行を貼り付け」してください。`);
        _ctxTaskId = null;
    });

    // 複数行貼り付け
    document.getElementById("gantt_ctx_paste").addEventListener("click", async function() {
        _ctxMenu.style.display = 'none';
        if (_copiedTasks.length === 0) return;
        if (currentProjectFilter.length !== 1) {
            alert("貼り付け先の工事番号を1つ選択してください。");
            return;
        }
        const destProject = currentProjectFilter[0];

        // 現在表示中タスクの末尾 sort_order を求める
        const _getSO = t => (t.sort_order != null) ? t.sort_order : t.id * 1000;
        const visibleTasks = gantt.getTaskByTime().filter(t => {
            const isDetailed = (t.is_detailed === true || String(t.is_detailed).toUpperCase() === 'TRUE');
            if (isDetailed) return false;
            if (String(t.major_item) !== '組立') return false;
            if (String(t.project_number) !== String(destProject)) return false;
            if (currentTaskTypeFilter) {
                const tt = t.task_type;
                const isNull = (tt === null || tt === undefined || tt === '' || String(tt) === 'null');
                if (currentTaskTypeFilter === 'assembly') {
                    if (!isNull && String(tt) !== 'assembly') return false;
                } else {
                    if (String(tt) !== currentTaskTypeFilter) return false;
                }
            }
            return true;
        }).sort((a, b) => _getSO(a) - _getSO(b));

        let baseSO = visibleTasks.length > 0 ? _getSO(visibleTasks[visibleTasks.length - 1]) : 0;

        // コピー元タスクをsort_order順に並べて貼り付け順序を維持
        const sortedCopied = [..._copiedTasks].sort((a, b) => _getSO(a) - _getSO(b));

        const insertRows = sortedCopied.map((src, i) => {
            const endDate = src.end_date instanceof Date
                ? _toDateStr(gantt.date.add(new Date(src.end_date), -1, 'day'))
                : src.end_date;
            const startDate = src.start_date instanceof Date
                ? _toDateStr(src.start_date)
                : src.start_date;
            return {
                text:             src.text             || "",
                start_date:       startDate,
                end_date:         endDate,
                project_number:   destProject,
                machine:          src.machine          || "",
                unit:             src.unit             || "",
                unit2:            src.unit2            || "",
                model_type:       src.model_type       || "",
                part_number:      src.part_number      || "",
                quantity:         Number(src.quantity) || 0,
                manufacturer:     src.manufacturer     || "",
                status:           src.status           || "",
                customer_name:    src.customer_name    || "",
                project_details:  src.project_details  || "",
                characteristic:   src.characteristic   || "",
                derivation:       src.derivation       || "",
                owner:            src.owner            || "",
                total_sheets:     Number(src.total_sheets)     || 0,
                completed_sheets: Number(src.completed_sheets) || 0,
                task_type:        currentTaskTypeFilter || src.task_type || null,
                is_detailed:      false,
                major_item:       '組立',
                sort_order:       baseSO + (i + 1) * 1000
            };
        });

        const { error } = await supabaseClient.from('tasks').insert(insertRows);
        if (error) {
            console.error("Error pasting tasks:", error);
            alert("貼り付けに失敗しました。\n" + error.message);
            return;
        }

        await loadData();
        _ctxTaskId = null;
    });

    // 削除
    document.getElementById("gantt_ctx_delete").addEventListener("click", async function() {
        _ctxMenu.style.display = 'none';
        // 複数選択中かつ右クリック行が選択に含まれる場合 → 一括削除
        if (_gridSelection.size > 1 && _ctxTaskId && _gridSelection.has(String(_ctxTaskId))) {
            const ids = [..._gridSelection].map(id => Number(id));
            if (!confirm(`選択した ${ids.length} 件のタスクを削除しますか？`)) { _ctxTaskId = null; return; }
            const { error } = await supabaseClient.from('tasks').delete().in('id', ids);
            if (error) { alert("削除に失敗しました。\n" + error.message); _ctxTaskId = null; return; }
            await loadData();
        } else if (_ctxTaskId) {
            if (confirm("このタスクを削除しますか？")) gantt.deleteTask(_ctxTaskId);
        }
        _ctxTaskId = null;
    });

    document.addEventListener("click", function(e) {
        if (!e.target.closest('#gantt_ctx_menu')) {
            _ctxMenu.style.display = 'none';
        }
    });

    // 2. 完了済み工事番号（全体工程表連動）と休日データを読み込む
    await loadCompletedProjects();
    await loadHolidays();

    // 3. セレクトボックスを構築（パラメータがあれば selected になる）
    await initProjectSelect(projectParam);

    // 3. マーカー追加
    const today = new Date();
    gantt.addMarker({
        start_date: today,
        css: "today-line",
        text: "今日",
        title: "今日: " + gantt.templates.date_grid(today)
    });

    // 4. データを読み込む
    await loadData();

    // 5. フィルタ適用
    updateDisplay();

    // 担当者フィルタードロップダウンのチェックボックスを生成
    _initOwnerFilterDropdown();

    // 6. 再描画
    gantt.render();

    // 6b. 今日の日付へスクロール（ガントモード表示時の初期位置）
    gantt.showDate(new Date());

    // 7. 初期表示モードを設定
    // task_type パラメータがある場合（全体工程表から遷移）はガントモードで起動
    //   - task_type=assembly      → 組立モード
    //   - task_type=business_trip → 出張モード
    // task_type パラメータがない場合（直接アクセス）は全タスクをガントで表示
    const taskTypeParam = urlParams.get('task_type');
    requestAnimationFrame(() => {
        if (taskTypeParam) {
            // 全体工程表からの遷移：指定モードのガントビューで起動
            currentTaskTypeFilter = taskTypeParam;
            updateFilterButtons();
            switchColumns(taskTypeParam);
            // フィルターボタンクリック時と同様にズームレベルを再設定してカレンダーヘッダーを完全再描画
            setTimeout(() => {
                gantt.setSizes();
                const currentLevel = document.querySelector('.zoom-btn.active')?.textContent === '週単位' ? 'week' : 'day';
                gantt.ext.zoom.setLevel(currentLevel);
            }, 0);
        } else {
            // 直接アクセス：組立モードで起動
            currentTaskTypeFilter = 'assembly';
            updateFilterButtons();
            switchColumns('assembly');
            setTimeout(() => {
                gantt.setSizes();
                const currentLevel = document.querySelector('.zoom-btn.active')?.textContent === '週単位' ? 'week' : 'day';
                gantt.ext.zoom.setLevel(currentLevel);
            }, 0);
        }
    });
}

// 担当者カラー凡例モーダル
function showOwnerLegend() {
    const existing = document.getElementById('owner_legend_overlay');
    if (existing) { existing.remove(); return; }

    const assemblyEntries = [
        { name: '米澤',     cls: 'owner-yonezawa'  },
        { name: '桂',       cls: 'owner-katsura'   },
        { name: '香西',     cls: 'owner-kozai'     },
        { name: '古賀',     cls: 'owner-koga'      },
        { name: '長谷川',   cls: 'owner-hasegawa'  },
        { name: '早川',     cls: 'owner-hayakawa'  },
        { name: '廣田',     cls: 'owner-hirota'    },
        { name: '宮本',     cls: 'owner-miyamoto'  },
        { name: '山下',     cls: 'owner-yamashita' },
        { name: 'センティル', cls: 'owner-senthil' },
        { name: '増田',     cls: 'owner-masuda'    },
        { name: '外注',     cls: 'owner-gaichuu'   },
    ];
    const electricalEntries = [
        { name: '木村(至)', cls: 'owner-kimura-i'  },
        { name: '木村(圭)', cls: 'owner-kimura-k'  },
        { name: '守時',     cls: 'owner-moritoki'  },
        { name: '外注(電)', cls: 'owner-gaichuu-e' },
    ];

    const makeRow = e =>
        `<div style="display:flex;align-items:center;gap:8px;margin-bottom:5px;">
            <div class="${e.cls}" style="width:80px;height:22px;border-radius:3px;display:flex;align-items:center;justify-content:center;font-size:12px;font-family:メイリオ,sans-serif;">${e.name}</div>
        </div>`;

    const overlay = document.createElement('div');
    overlay.id = 'owner_legend_overlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:99999;display:flex;align-items:flex-start;justify-content:flex-end;padding:50px 16px 0 0;box-sizing:border-box;';
    overlay.innerHTML = `
        <div style="background:#fff;border:1px solid #ccc;border-radius:6px;box-shadow:0 4px 16px rgba(0,0,0,0.2);padding:14px 16px;min-width:150px;">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
                <span style="font-weight:bold;font-size:13px;font-family:メイリオ,sans-serif;">担当者カラー凡例</span>
                <button onclick="document.getElementById('owner_legend_overlay').remove()" style="border:none;background:none;font-size:16px;cursor:pointer;line-height:1;padding:0 0 0 12px;">×</button>
            </div>
            <div style="font-size:11px;color:#888;margin-bottom:6px;font-family:メイリオ,sans-serif;">組立</div>
            ${assemblyEntries.map(makeRow).join('')}
            <div style="font-size:11px;color:#888;margin:8px 0 6px;font-family:メイリオ,sans-serif;border-top:1px solid #eee;padding-top:8px;">電装</div>
            ${electricalEntries.map(makeRow).join('')}
        </div>`;

    // オーバーレイ背景クリックで閉じる
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);
}

// ==========================================
// 組立場所フロアプランビュー
// ==========================================

function enterLocationMode() {
    isLocationMode = true;

    // ガントを非表示・ズーム行を非表示
    document.getElementById('gantt_here').style.display = 'none';
    const zoomRow = document.getElementById('zoom_row');
    if (zoomRow) zoomRow.style.display = 'none';

    // 工事番号・タスク名フィルター、新規追加ボタンを非表示
    const hideIds = ['project_filter_wrap', 'task_name_filter_wrap', 'create_task_btn', 'multi_delete_btn'];
    hideIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });

    // フロアプランを表示
    document.getElementById('location_floorplan').style.display = 'block';

    renderLocationFloorPlan();
}

function exitLocationMode() {
    isLocationMode = false;

    // フロアプランを非表示
    document.getElementById('location_floorplan').style.display = 'none';

    // ズーム行を復元・ガントを表示
    const zoomRow = document.getElementById('zoom_row');
    if (zoomRow) zoomRow.style.display = '';
    document.getElementById('gantt_here').style.display = '';

    // 工事番号・タスク名フィルターを再表示（新規追加ボタンはエディター権限チェックに任せる）
    const showIds = ['project_filter_wrap', 'task_name_filter_wrap'];
    showIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = '';
    });
    // 新規追加ボタン・選択削除ボタンはエディター権限に従って表示
    const addBtn = document.getElementById('create_task_btn');
    if (addBtn) addBtn.style.display = _isEditor ? '' : 'none';
    const delBtn = document.getElementById('multi_delete_btn');
    if (delBtn) delBtn.style.display = 'none'; // 選択がなければ常に非表示

    // リソース底面パネルが開いていれば閉じる
    if (isResourceView && !isResourceFullscreen) {
        toggleResourceView();
    }

    setTimeout(() => {
        gantt.setSizes();
        const level = document.querySelector('.zoom-btn.active')?.textContent === '週単位' ? 'week' : 'day';
        gantt.ext.zoom.setLevel(level);
    }, 0);
}

// ---- スナップショット生成 ----
function _buildLocationSnapshots() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 現在進行中または将来のエントリのみ対象
    // task.end_date は排他的（+1day）なので、実際の終了日 = end_date - 1day
    const relevant = taskLocationsData.filter(loc => {
        if (!loc.task) return false;
        const actualEnd = new Date(loc.task.end_date.getTime() - 86400000);
        actualEnd.setHours(0, 0, 0, 0);
        return actualEnd >= today;
    });

    if (relevant.length === 0) return [];

    // 変化点（開始日・終了日）を収集
    const changeDates = new Set();
    changeDates.add(today.getTime()); // 常に今日から開始

    relevant.forEach(loc => {
        const t = loc.task;

        const s = new Date(t.start_date.getTime());
        s.setHours(0, 0, 0, 0);
        if (s > today) changeDates.add(s.getTime());

        const e = new Date(t.end_date.getTime() - 86400000);
        e.setHours(0, 0, 0, 0);
        if (e >= today) changeDates.add(e.getTime());
    });

    const sorted = Array.from(changeDates).sort((a, b) => a - b);

    return sorted.map(dateMs => {
        const date = new Date(dateMs);

        // この日付でアクティブなタスク
        const activeLocs = relevant.filter(loc => {
            const t = loc.task;
            const s = new Date(t.start_date.getTime()); s.setHours(0, 0, 0, 0);
            const e = new Date(t.end_date.getTime() - 86400000); e.setHours(0, 0, 0, 0);
            return s <= date && e >= date;
        });

        // この日付に終了するタスク（出荷）
        const endingLocs = relevant.filter(loc => {
            const e = new Date(loc.task.end_date.getTime() - 86400000);
            e.setHours(0, 0, 0, 0);
            return e.getTime() === dateMs;
        });

        return { date, activeLocs, endingLocs };
    });
}

// ---- フロアプラン描画 ----
function renderLocationFloorPlan() {
    const container = document.getElementById('location_floorplan');
    if (!container) return;

    const snapshots = _buildLocationSnapshots();

    if (snapshots.length === 0) {
        container.innerHTML = '<div style="padding:20px;color:#999;font-family:メイリオ,sans-serif;">組立場所に割り当てられた進行中または予定タスクがありません</div>';
        return;
    }

    // レイアウト定数
    const AREA_COUNT   = 8;
    const AREA_H       = 75;   // エリア1行の高さ (px)
    const E1_W         = 115;
    const E2_W         = 50;   // E2 通路
    const E3_W         = 115;
    const ROW_NUM_W    = 22;
    const COL_HDR_H    = 20;   // 列ヘッダー高さ

    // グリッド列定義 [幅, ラベル, 背景色, 文字色]
    const COL_DEFS = [
        { w: ROW_NUM_W, label: '',       bg: '#ddd',    fc: '' },
        { w: E3_W,      label: 'E3',     bg: '#bbdefb', fc: '#1565c0' },
        { w: E2_W,      label: '通路',   bg: '#d0d0d0', fc: '#555' },
        { w: E1_W,      label: 'E1',     bg: '#bbdefb', fc: '#1565c0' },
    ];

    let html = '<div style="display:flex;align-items:flex-start;gap:16px;padding:12px;">';

    snapshots.forEach(snap => {
        const dateLabel = _fmtSnapDate(snap.date);

        // 出荷情報（この日に終わるタスク）
        let bulletHtml = '';
        const seenTasks = new Set();
        snap.endingLocs.forEach(loc => {
            if (!loc.task || seenTasks.has(loc.task.id)) return;
            seenTasks.add(loc.task.id);
            const actualEnd = new Date(loc.task.end_date.getTime() - 86400000);
            const ds = `${actualEnd.getMonth() + 1}/${actualEnd.getDate()}`;
            bulletHtml += `<div>・${loc.task.project_number || ''}(${loc.task.machine || ''})出荷${ds}</div>`;
        });

        // グリッド列ヘッダー行
        let hdrHtml = '<div style="display:flex;">';
        COL_DEFS.forEach((c, ci) => {
            const br = ci < COL_DEFS.length - 1 ? '1px solid #888' : 'none';
            hdrHtml += `<div style="width:${c.w}px;min-width:${c.w}px;height:${COL_HDR_H}px;background:${c.bg};display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:bold;color:${c.fc};border-right:${br};flex-shrink:0;">${c.label}</div>`;
        });
        hdrHtml += '</div>';

        // グリッド本体
        let bodyHtml = '<div style="display:flex;">';

        // 行番号列
        let numCol = `<div style="display:flex;flex-direction:column;width:${ROW_NUM_W}px;flex-shrink:0;border-right:1px solid #888;">`;
        for (let area = 0; area < AREA_COUNT; area++) {
            const bb = area < AREA_COUNT - 1 ? '1px solid #ccc' : 'none';
            numCol += `<div style="height:${AREA_H}px;border-bottom:${bb};display:flex;align-items:center;justify-content:center;font-size:12px;color:#e53935;font-weight:bold;">${area}</div>`;
        }
        numCol += '</div>';
        bodyHtml += numCol;

        // E3 列
        let e3Col = `<div style="display:flex;flex-direction:column;width:${E3_W}px;flex-shrink:0;border-right:1px solid #888;">`;
        for (let area = 0; area < AREA_COUNT; area++) {
            e3Col += _fpCell(snap.activeLocs, 'E3', area, AREA_H, E3_W);
        }
        e3Col += '</div>';
        bodyHtml += e3Col;

        // E2 通路列
        let e2Col = `<div style="display:flex;flex-direction:column;width:${E2_W}px;flex-shrink:0;border-right:1px solid #888;background:#e0e0e0;">`;
        for (let area = 0; area < AREA_COUNT; area++) {
            const bb = area < AREA_COUNT - 1 ? '1px solid #bbb' : 'none';
            e2Col += `<div style="height:${AREA_H}px;border-bottom:${bb};"></div>`;
        }
        e2Col += '</div>';
        bodyHtml += e2Col;

        // E1 列
        let e1Col = `<div style="display:flex;flex-direction:column;width:${E1_W}px;flex-shrink:0;">`;
        for (let area = 0; area < AREA_COUNT; area++) {
            e1Col += _fpCell(snap.activeLocs, 'E1', area, AREA_H, E1_W);
        }
        e1Col += '</div>';
        bodyHtml += e1Col;

        bodyHtml += '</div>';

        // スナップショット全体
        html += `
            <div style="flex-shrink:0;display:flex;flex-direction:column;align-items:center;">
                <div style="font-size:13px;font-weight:bold;color:#333;font-family:メイリオ,sans-serif;margin-bottom:3px;">E棟</div>
                <div style="display:flex;align-items:center;margin-bottom:4px;">
                    <div style="border:1px solid #888;padding:2px 10px;font-size:13px;font-family:メイリオ,sans-serif;background:#fff;text-align:center;">${dateLabel}</div>
                    <span style="font-size:13px;margin-left:4px;">〜</span>
                </div>
                <div style="min-height:36px;font-size:12px;font-family:メイリオ,sans-serif;color:#333;line-height:1.7;margin-bottom:4px;width:${ROW_NUM_W + E3_W + E2_W + E1_W}px;">${bulletHtml}</div>
                <div style="border:2px solid #888;display:inline-flex;flex-direction:column;background:#fff;">
                    ${hdrHtml}
                    ${bodyHtml}
                </div>
            </div>
        `;
    });

    html += '</div>';
    container.innerHTML = html;
}

// 1セルのHTMLを生成
function _fpCell(activeLocs, group, area, cellH, colW) {
    const bb = area < 7 ? '1px solid #ccc' : 'none';
    const tasks = activeLocs.filter(l => l.area_group === group && Number(l.area_number) === area);
    let boxes = '';
    tasks.forEach(l => {
        const t = l.task;
        // エディターのみドラッグ可能
        const dragAttrs = _isEditor
            ? `draggable="true" ondragstart="_fpDragData={task_id:${l.task_id},from_group:'${group}',from_area:${area}};event.dataTransfer.effectAllowed='move';" style="background:#1565c0;color:#fff;border-radius:3px;padding:3px 4px;font-size:11px;font-family:メイリオ,sans-serif;text-align:center;line-height:1.3;max-width:${colW - 10}px;word-break:break-all;flex-shrink:0;cursor:grab;"`
            : `style="background:#1565c0;color:#fff;border-radius:3px;padding:3px 4px;font-size:11px;font-family:メイリオ,sans-serif;text-align:center;line-height:1.3;max-width:${colW - 10}px;word-break:break-all;flex-shrink:0;"`;
        boxes += `<div ${dragAttrs} title="${t.project_number || ''} ${t.machine || ''} ${t.text || ''}">
            ${t.project_number || ''}<br>${t.machine || ''}
        </div>`;
    });
    // エディターのみドロップ受け付け
    const dropAttrs = _isEditor
        ? `ondragover="event.preventDefault();this.style.background='#e3f2fd';" ondragleave="this.style.background='';" ondrop="handleLocationDrop('${group}',${area},this);this.style.background='';"`
        : '';
    return `<div ${dropAttrs} style="height:${cellH}px;border-bottom:${bb};display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;padding:3px;box-sizing:border-box;overflow:hidden;">${boxes}</div>`;
}

function _fmtSnapDate(date) {
    return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;
}

// フロアプランのドロップ処理（エリア移動）
async function handleLocationDrop(toGroup, toArea, cellEl) {
    if (!_isEditor) return;
    if (!_fpDragData) return;

    const { task_id, from_group, from_area } = _fpDragData;
    _fpDragData = null;

    // 同じセルへのドロップは無視
    if (from_group === toGroup && String(from_area) === String(toArea)) return;

    // 対象レコードのみ更新（task_id + from_group + from_area で特定）
    const { error } = await supabaseClient
        .from('task_locations')
        .update({ area_group: toGroup, area_number: String(toArea) })
        .eq('task_id', task_id)
        .eq('area_group', from_group)
        .eq('area_number', String(from_area));

    if (error) {
        console.error('場所更新エラー:', error);
        alert('場所の更新に失敗しました。');
        return;
    }

    // データ再読み込み → isLocationMode=true なので loadData 内で renderLocationFloorPlan() が呼ばれる
    await loadData();
}

// 実行
initialize();
