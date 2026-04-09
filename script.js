// ===== 初期設定とグローバル変数 =====

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

// 定数
const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
const GRID_WIDTH = 1000; // gantt_design.htmlの既存設定に合わせる
const COLUMN_WIDTHS = [55, 55, 250, 50, 60, 30, 40, 40, 60, 60, 60, 60, 110, 44]; 

// リソース表示の列幅定数
const RESOURCE_OVERVIEW_COL_WIDTH = 120;  // 担当者名列
const RESOURCE_DETAIL_COL_WIDTH   = 350;  // 詳細表示（工事番号＋タスク名列）

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

// 編集可能なメールアドレスリスト
const EDITORS = [
    'm2-kusakabe@kusakabe.com', // 常務
    'm2-tanaka@kusakabe.com',   // 田中
    'm2-yasuoka@kusakabe.com',   // 安岡
    'm2-kawabe@kusakabe.com',    // 川邊
    'm2-dan@kusakabe.com',       // 檀
    'm2-horii@kusakabe.com',     // 堀井
    'm2-miyazaki@kusakabe.com',  // 宮﨑
    'm2-tsuda@kusakabe.com',     // 津田
    'm2-komura@kusakabe.com',    // 古村
    'm2-shibata@kusakabe.com',   // 柴田
    'm2-hashimoto@kusakabe.com',  // 橋本
    'm2-matsumoto@kusakabe.com'  // 松本
];

// Supabase設定
const SUPABASE_URL = "https://dgekjzkrybrswsxlcbvh.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRnZWtqemtyeWJyc3dzeGxjYnZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg4ODQ3MjIsImV4cCI6MjA4NDQ2MDcyMn0.BsEj53lV3p76yE9fMPTaLn7ocKTNzYPTqIAnBafYItU";

let supabaseClient;
let _isEditor = false;
let _pageInitType = 'normal';

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

// ===== 認証機能 =====

function _updateUIForAuth(isEditor) {
    _isEditor = isEditor;
    if (gantt && gantt.config) {
        gantt.config.readonly = !isEditor;
    }
    const createBtn = document.getElementById('create_task_btn');
    if (createBtn) createBtn.style.display = isEditor ? '' : 'none';
    const deleteBtn = document.getElementById('multi_delete_btn');
    if (deleteBtn) deleteBtn.style.display = isEditor ? '' : 'none';
    const archiveBtn = document.getElementById('archive_btn_wrap');
    if (archiveBtn) archiveBtn.style.display = isEditor ? '' : 'none';
    const authBtn = document.getElementById('auth_btn');
    if (authBtn) {
        authBtn.textContent = isEditor ? 'ログアウト' : 'ログイン';
        authBtn.classList.toggle('logged-in', isEditor);
    }
    if (gantt && gantt.render) {
        gantt.render();
    }
}

function handleAuthBtn() {
    if (_isEditor) {
        doLogout();
    } else {
        showLoginDialog();
    }
}

function showLoginDialog() {
    document.getElementById('login_overlay').style.display = 'block';
    document.getElementById('login_email').focus();
}

function closeLoginDialog() {
    document.getElementById('login_overlay').style.display = 'none';
    document.getElementById('login_error').textContent = '';
    document.getElementById('login_email').value = '';
    document.getElementById('login_password').value = '';
}

async function doLogin() {
    const email = document.getElementById('login_email').value.trim();
    const password = document.getElementById('login_password').value;
    
    if (!email || !password) {
        document.getElementById('login_error').textContent = 'メールアドレスとパスワードを入力してください';
        return;
    }

    const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
    
    if (error) {
        document.getElementById('login_error').textContent = 'ログインに失敗しました: ' + error.message;
    } else {
        closeLoginDialog();
    }
}

async function doLogout() {
    await supabaseClient.auth.signOut();
}

function openSetPasswordDialog() {
    document.getElementById('setpw_overlay').style.display = 'block';
    document.getElementById('setpw_pw1').focus();
}

function closeSetPasswordDialog() {
    document.getElementById('setpw_overlay').style.display = 'none';
    document.getElementById('setpw_error').textContent = '';
    document.getElementById('setpw_pw1').value = '';
    document.getElementById('setpw_pw2').value = '';
}

async function doSetPassword() {
    const pw1 = document.getElementById('setpw_pw1').value;
    const pw2 = document.getElementById('setpw_pw2').value;
    
    if (pw1.length < 8) {
        document.getElementById('setpw_error').textContent = 'パスワードは8文字以上で入力してください';
        return;
    }
    
    if (pw1 !== pw2) {
        document.getElementById('setpw_error').textContent = 'パスワードが一致しません';
        return;
    }
    
    const { error } = await supabaseClient.auth.updateUser({ password: pw1 });
    
    if (error) {
        document.getElementById('setpw_error').textContent = 'パスワード設定に失敗しました: ' + error.message;
    } else {
        closeSetPasswordDialog();
        alert('パスワードを設定しました');
    }
}

// ===== データ読み込み機能 =====

async function loadHolidays() {
    try {
        console.log('loadHolidays開始 - supabaseClient:', !!supabaseClient);
        console.log('supabaseライブラリ状態:', typeof supabase);
        
        if (!supabaseClient) {
            console.error('Supabaseクライアントが初期化されていません');
            return;
        }
        
        if (!supabaseClient.from) {
            console.error('supabaseClient.fromが存在しません');
            return;
        }
        
        const { data, error } = await supabaseClient
            .from('holidays')
            .select('date')
            .order('date');
        
        if (error) {
            console.error('休日データ読み込みエラー:', error);
            if (error.status === 401) {
                console.warn('認証エラー：認証が必要です');
            }
            return;
        }
        
        HOLIDAYS.clear();
        if (data && Array.isArray(data)) {
            data.forEach(holiday => {
                HOLIDAYS.add(holiday.date);
            });
            console.log('休日データ読み込み完了:', HOLIDAYS.size, '件');
        }
    } catch (err) {
        console.error('休日データ読み込み例外:', err);
        console.error('エラースタック:', err.stack);
    }
}

async function loadData() {
    try {
        if (!supabaseClient) {
            console.error('Supabaseクライアントが初期化されていません');
            return;
        }
        
        const { data, error } = await supabaseClient
            .from('tasks')
            .select('*')
            .order('sort_order', { ascending: true });
        
        if (error) {
            console.error('データ読み込みエラー:', error);
            if (error.status === 401) {
                console.warn('認証エラー：認証が必要です');
            } else {
                alert('データの読み込みに失敗しました: ' + error.message);
            }
            return;
        }
        
        if (gantt && gantt.clearAll) {
            gantt.clearAll();
        }
        
        if (data && Array.isArray(data) && data.length > 0) {
            const tasks = data.map(task => ({
                ...task,
                start_date: task.start_date ? new Date(task.start_date) : null,
                end_date: task.end_date ? gantt.date.add(new Date(task.end_date), 1, 'day') : null,
                duration: task.duration || 1
            }));
            
            if (gantt && gantt.parse) {
                gantt.parse({ data: tasks });
            }
        }
        
        if (typeof updateResourceData === 'function') {
            updateResourceData();
        }
        
    } catch (err) {
        console.error('データ処理エラー:', err);
        alert('データの処理に失敗しました');
    }
}

// ===== Ganttチャート基本設定 =====

gantt.config.date_format = "%Y-%m-%d";
gantt.config.scale_unit = "day";
gantt.config.step = 1;
gantt.config.date_grid = "%Y年%m月%d日";
gantt.config.grid_width = GRID_WIDTH;
gantt.config.add_column = false;
gantt.config.autosize = "y";
gantt.config.details_on_create = true;
gantt.config.xml_date = "%Y-%m-%d";

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

// インラインエディター設定
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
        // gantt内部の排他的終了日をSupabase用の包括的終了日に変換
        const actualEnd = gantt.date.add(new Date(value), -1, 'day');
        inp.value = _toDateStr(actualEnd);
    },
    get_value: function(id, column, node) {
        const val = node.querySelector('input').value;
        if (!val) return gantt.getTask(id).end_date;
        // Supabase用の包括的終了日をgantt内部の排他的終了日に変換
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
    // ドラッグ中のリアルタイム更新
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

// グリッドクリックイベント
document.getElementById("gantt_here").addEventListener("click", function(e) {
    const row = e.target.closest("[task_id]");
    if (!row) return;
    
    const taskId = row.getAttribute("task_id");
    if (!taskId) return;
    
    if (e.ctrlKey || e.metaKey) {
        // Ctrl/Cmd+クリック：選択トグル
        if (_gridSelection.has(taskId)) {
            _gridSelection.delete(taskId);
        } else {
            _gridSelection.add(taskId);
        }
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
        // 通常クリック：単一選択
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

// ===== リソース表示機能 =====

function updateResourceData() {
    // 指定された担当者の並び順（藤山～松本(英)、外注は除外）
    const targetOwners = ["藤山", "田中(善)", "安岡", "川邊", "檀", "堀井", "宮﨑", "津田", "古村", "柴田", "橋本", "松本(英)"];
    
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
        { type: 'drawing',        label: '組立' },
        { type: 'long_lead_item', label: '組立場所' },
        { type: 'business_trip',  label: '出張' },
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
            const rowTasks = allOwnerTasks.filter(t => String(t.task_type) === rowDef.type);
            const isFirstRow = rowIndex === 0;
            const isLastRow  = rowIndex === TASK_TYPE_ROWS.length - 1;

            // 担当者の区切り線（先頭行の上に太線）
            const borderTop    = isFirstRow ? 'border-top: 2px solid #aaa;' : '';
            const borderBottom = isLastRow  ? 'border-bottom: 2px solid #aaa;' : 'border-bottom: 1px solid #eee;';

            // 左セル：先頭行は担当者名＋ラベル、2行目以降はラベルのみ
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

    // 開始日順でソート
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
    if (isResourceFullscreen) return; // 全画面モード中は通常トグル不可
    isResourceView = !isResourceView;
    const btn = document.getElementById("resource_toggle");
    const panel = document.getElementById("resource_panel");

    if (isResourceView) {
        btn.innerText = "メイン表示に戻す";
        // コンテンツを描画してからパネルを表示（古い内容が一瞬見えるのを防ぐ）
        updateResourceData();
        panel.style.display = "flex";
    } else {
        btn.innerText = "リソース表示";
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

// ===== データ保存・削除機能 =====

async function _saveTaskToSupabase(task) {
    if (!supabaseClient) {
        console.error('Supabaseクライアントが初期化されていません');
        return;
    }
    const { error } = await supabaseClient
        .from('tasks')
        .upsert({
            id: task.id,
            text: task.text || '',
            start_date: task.start_date ? _toDateStr(task.start_date) : null,
            end_date: task.end_date ? _toDateStr(gantt.date.add(task.end_date, -1, 'day')) : null,
            project_number: task.project_number || '',
            machine: task.machine || '',
            unit: task.unit || '',
            unit2: task.unit2 || '',
            model_type: task.model_type || '',
            part_number: task.part_number || '',
            quantity: task.quantity || 0,
            manufacturer: task.manufacturer || '',
            status: task.status || '',
            customer_name: task.customer_name || '',
            project_details: task.project_details || '',
            characteristic: task.characteristic || '',
            derivation: task.derivation || '',
            owner: task.owner || '',
            total_sheets: task.total_sheets || 0,
            completed_sheets: task.completed_sheets || 0,
            wish_date: task.wish_date || null,
            task_type: task.task_type || 'drawing',
            is_detailed: task.is_detailed || false,
            major_item: task.major_item || '組立',
            sort_order: task.sort_order || task.id * 1000,
            has_no_date: task.has_no_date || false
        });
    
    if (error) {
        console.error('タスク保存エラー:', error);
        alert('タスクの保存に失敗しました: ' + error.message);
    }
}

async function _saveTaskDates(task) {
    if (!supabaseClient) {
        console.error('Supabaseクライアントが初期化されていません');
        return;
    }
    const { error } = await supabaseClient
        .from('tasks')
        .update({
            start_date: task.start_date ? _toDateStr(task.start_date) : null,
            end_date: task.end_date ? _toDateStr(gantt.date.add(task.end_date, -1, 'day')) : null,
            has_no_date: task.has_no_date || false
        })
        .eq('id', task.id);
    
    if (error) {
        console.error('日付保存エラー:', error);
        alert('日付の保存に失敗しました: ' + error.message);
    }
}

async function _deleteTaskFromSupabase(taskId) {
    if (!supabaseClient) {
        console.error('Supabaseクライアントが初期化されていません');
        return;
    }
    const { error } = await supabaseClient
        .from('tasks')
        .delete()
        .eq('id', taskId);
    
    if (error) {
        console.error('タスク削除エラー:', error);
        alert('タスクの削除に失敗しました: ' + error.message);
    }
}

async function _saveWishDate(taskId, dateStr) {
    if (!supabaseClient) {
        console.error('Supabaseクライアントが初期化されていません');
        return;
    }
    const { error } = await supabaseClient
        .from('tasks')
        .update({ wish_date: dateStr })
        .eq('id', taskId);
    if (error) console.error('wish_date 保存エラー:', error);
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
    // アクティブ状態を更新
    document.querySelectorAll('.zoom-btn').forEach(btn => btn.classList.remove('active'));
    element.classList.add('active');
    
    // ズームレベルを設定
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
            updateMultiDeleteButton();
        }
    }
}

function updateFilterButtons() {
    // フィルターボタンの状態を更新
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

// ===== カレンダーヘッダー機能 =====

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
            dowHtml += `<div class="resource-cal-cell${wkCls}" style="width:${columnWidth}px;min-width:${columnWidth}px;height:18px;${dowColor}">${dayNames[dow]}</div>`;
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

// 担当者フィルター
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

// プロジェクトフィルター
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

// ===== プロジェクト選択機能 =====

async function initProjectSelect() {
    if (!supabaseClient) {
        console.error('Supabaseクライアントが初期化されていません');
        return;
    }
    
    const { data, error } = await supabaseClient
        .from('tasks')
        .select('project_number')
        .not('project_number', 'is', null)
        .order('project_number');
    
    if (error) {
        console.error('プロジェクト番号取得エラー:', error);
        return;
    }

    const projectNumbers = [...new Set(data.map(t => t.project_number).filter(Boolean))];
    const select = document.getElementById('project_select');
    if (select) {
        select.innerHTML = '<option value="">すべてのプロジェクト</option>';
        projectNumbers.forEach(num => {
            const option = document.createElement('option');
            option.value = num;
            option.textContent = num;
            select.appendChild(option);
        });
        
        select.addEventListener('change', function() {
            const selectedProject = this.value;
            if (selectedProject) {
                currentProjectFilter = [selectedProject];
            } else {
                currentProjectFilter = [];
            }
            _updateProjectFilterBtn();
            gantt.render();
            updateResourceData();
        });
    }
}

// ===== アーカイブ機能 =====

async function archiveCompletedTasks() {
    if (!_isEditor) {
        alert('アーカイブ機能は編集者のみ使用できます');
        return;
    }
    
    if (!supabaseClient) {
        console.error('Supabaseクライアントが初期化されていません');
        return;
    }

    const { data: tasks, error } = await supabaseClient
        .from('tasks')
        .select('*')
        .eq('status', '完了')
        .lt('end_date', new Date().toISOString().split('T')[0]);

    if (error) {
        console.error('完了タスク取得エラー:', error);
        alert('完了タスクの取得に失敗しました');
        return;
    }

    if (tasks.length === 0) {
        alert('アーカイブ対象の完了タスクがありません');
        return;
    }

    if (!confirm(`${tasks.length}件の完了タスクをアーカイブしてもよろしいですか？`)) {
        return;
    }

    // アーカイブテーブルに移動
    const { error: archiveError } = await supabaseClient
        .from('archived_tasks')
        .insert(tasks);

    if (archiveError) {
        console.error('アーカイブエラー:', archiveError);
        alert('タスクのアーカイブに失敗しました');
        return;
    }

    // 元のテーブルから削除
    const taskIds = tasks.map(t => t.id);
    const { error: deleteError } = await supabaseClient
        .from('tasks')
        .delete()
        .in('id', taskIds);

    if (deleteError) {
        console.error('削除エラー:', deleteError);
        alert('元タスクの削除に失敗しました');
        return;
    }

    alert(`${tasks.length}件のタスクをアーカイブしました`);
    loadData(); // データを再読み込み
}

async function showArchivedTasks() {
    if (!supabaseClient) {
        console.error('Supabaseクライアントが初期化されていません');
        return;
    }
    const { data: archivedTasks, error } = await supabaseClient
        .from('archived_tasks')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('アーカイブタスク取得エラー:', error);
        alert('アーカイブタスクの取得に失敗しました');
        return;
    }

    if (archivedTasks.length === 0) {
        alert('アーカイブされたタスクがありません');
        return;
    }

    // アーカイブ表示用のモーダルや新しいページを表示
    // ここでは簡単なアラートで表示
    const taskList = archivedTasks.map(t => 
        `${t.project_number} - ${t.text} (${t.status})`
    ).join('\n');
    
    alert(`アーカイブされたタスク (${archivedTasks.length}件):\n${taskList}`);
}

async function restoreArchivedTask(taskId) {
    if (!_isEditor) {
        alert('復元機能は編集者のみ使用できます');
        return;
    }
    
    if (!supabaseClient) {
        console.error('Supabaseクライアントが初期化されていません');
        return;
    }

    const { data: archivedTask, error } = await supabaseClient
        .from('archived_tasks')
        .select('*')
        .eq('id', taskId)
        .single();

    if (error) {
        console.error('アーカイブタスク取得エラー:', error);
        alert('アーカイブタスクの取得に失敗しました');
        return;
    }

    // 元のテーブルに復元
    const { error: restoreError } = await supabaseClient
        .from('tasks')
        .insert({
            ...archivedTask,
            id: undefined // 新しいIDを生成
        });

    if (restoreError) {
        console.error('復元エラー:', restoreError);
        alert('タスクの復元に失敗しました');
        return;
    }

    // アーカイブテーブルから削除
    const { error: deleteError } = await supabaseClient
        .from('archived_tasks')
        .delete()
        .eq('id', taskId);

    if (deleteError) {
        console.error('アーカイブ削除エラー:', deleteError);
        alert('アーカイブからの削除に失敗しました');
        return;
    }

    alert('タスクを復元しました');
    loadData(); // データを再読み込み
}

// ===== Ganttチャート初期化関数 =====

function initializeGantt() {
    try {
        // ganttオブジェクトの存在確認
        if (typeof gantt === 'undefined') {
            console.error('ganttオブジェクトが未定義です');
            return;
        }

        // プラグイン設定
        if (gantt.plugins) {
            gantt.plugins({
                marker: true,
                multiselect: true
            });
        }

        // 読み取り専用モード（ログインしていない場合）
        if (gantt.config) {
            gantt.config.readonly = true;
        }
        
        // カラム設定
        if (gantt.config && gantt.config.columns) {
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
        }

        // Gantt初期化
        if (gantt.init) {
            gantt.init("gantt_here");
        }

        // イベントリスナー設定
        if (typeof setupGanttEventListeners === 'function') {
            setupGanttEventListeners();
        }

        console.log('Ganttチャートが初期化されました');
        
    } catch (error) {
        console.error('Gantt初期化エラー:', error);
    }
}

function setupGanttEventListeners() {
    // タスク選択が変わるたびに選択削除ボタンを更新
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
    
    // 再描画後にグリッド選択ハイライトを復元
    gantt.attachEvent("onGanttRender", function() {
        _applyGridSelection();
    });
}

function _updateMultiDeleteButton() {
    const btn = document.getElementById('multi_delete_btn');
    if (btn) {
        if (_gridSelection.size > 0) {
            btn.style.display = '';
            document.getElementById('multi_delete_count').textContent = _gridSelection.size;
        } else {
            btn.style.display = 'none';
        }
    }
}

// ===== 追加のグローバル変数定義 =====

let _clearingEndDateId = null;

// ===== 初期化処理 =====

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
    
    // 担当者フィルターイベントリスナー
    document.querySelectorAll('.owner-chk-item').forEach(chk => {
        chk.addEventListener('change', _handleOwnerFilterCheckboxChange);
    });
    
    // プロジェクトフィルターイベントリスナー
    document.querySelectorAll('.project-chk-item').forEach(chk => {
        chk.addEventListener('change', _handleProjectFilterCheckboxChange);
    });
});

// ページ読み込み完了後に強制的にGanttを再描画
window.addEventListener('load', function() {
    // DHTMLX Ganttライブラリの読み込みを待機
    setTimeout(function() {
        if (typeof gantt !== 'undefined' && gantt && gantt.render) {
            try {
                // ganttの設定と初期化
                if (typeof gantt.config !== 'undefined') {
                    gantt.config.date_format = "%Y-%m-%d %H:%i";
                }
                
                // ganttの初期化（まだ初期化されていない場合）
                if (typeof gantt.init === 'function') {
                    gantt.init("gantt_here");
                    console.log('Ganttチャートが初期化されました');
                }
                
                gantt.render();
                console.log('Ganttチャートが再描画されました');
            } catch (error) {
                console.error('Gantt再描画エラー:', error);
            }
        } else {
            console.error('ganttオブジェクトが利用できません');
        }
    }, 1000); // 1秒遅延させて確実にライブラリが読み込まれるようにする
});

// ===== Supabase初期化と認証状態監視 =====

function initializeSupabase() {
    try {
        // Supabaseライブラリの存在確認
        if (typeof supabase === 'undefined') {
            console.error('Supabaseライブラリが読み込まれていません');
            // ライブラリを動的に読み込む
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
            script.async = true;
            script.onload = function() {
                console.log('Supabaseライブラリを動的に読み込みました');
                // 少し待ってから初期化
                setTimeout(() => {
                    if (typeof supabase !== 'undefined') {
                        initializeSupabaseClient();
                    } else {
                        console.error('Supabaseライブラリがまだ利用できません');
                    }
                }, 500);
            };
            script.onerror = function() {
                console.error('Supabaseライブラリの動的読み込みに失敗しました');
                alert('Supabaseライブラリの読み込みに失敗しました');
            };
            document.head.appendChild(script);
            return;
        }
        
        initializeSupabaseClient();
        
    } catch (error) {
        console.error('Supabase初期化エラー:', error);
        alert('Supabaseの初期化に失敗しました: ' + error.message);
    }
}

function initializeSupabaseClient() {
    try {
        // Supabaseライブラリの再確認
        if (typeof supabase === 'undefined' || !supabase.createClient) {
            console.error('Supabaseライブラリが正しく読み込まれていません');
            return;
        }
        
        // Supabaseクライアント初期化
        supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        
        // 初期化確認
        if (!supabaseClient || !supabaseClient.from) {
            console.error('Supabaseクライアントの初期化に失敗しました');
            return;
        }
        
        console.log('Supabaseクライアントが正常に初期化されました');
        
        // 認証状態変化監視
        supabaseClient.auth.onAuthStateChange((_event, session) => {
            if (_event === 'PASSWORD_RECOVERY' || (_event === 'SIGNED_IN' && _pageInitType === 'invite')) {
                openSetPasswordDialog();
            } else {
                const email = session?.user?.email || '';
                _updateUIForAuth(!!session && EDITORS.includes(email));
            }
        });
        
        // 初期データ読み込み
        loadHolidays().then(() => {
            loadData().then(() => {
                // データ読み込み完了後にGanttを初期化
                initializeGantt();
            });
        }).catch(err => {
            console.error('初期データ読み込みエラー:', err);
        });
        
        // 初期化完了後にプロジェクト選択を初期化
        initProjectSelect();
        updateFilterButtons();
        
    } catch (error) {
        console.error('Supabaseクライアント初期化エラー:', error);
        alert('Supabaseクライアントの初期化に失敗しました: ' + error.message);
    }
}

window.addEventListener('DOMContentLoaded', () => {
    // DHTMLX Ganttライブラリの読み込みを待機してからSupabaseを初期化
    const waitForGantt = () => {
        if (typeof gantt !== 'undefined' && gantt.init) {
            console.log('DHTMLX Ganttライブラリが利用可能です');
            // Supabaseライブラリが確実に読み込まれるまで待機
            const checkSupabase = () => {
                if (typeof supabase !== 'undefined' && supabase.createClient) {
                    console.log('Supabaseライブラリが利用可能です');
                    initializeSupabaseClient();
                } else {
                    console.log('Supabaseライブラリを待機中...');
                    setTimeout(checkSupabase, 200);
                }
            };
            
            // 最初のチェックは少し遅延
            setTimeout(checkSupabase, 500);
        } else {
            console.log('DHTMLX Ganttライブラリを待機中...');
            setTimeout(waitForGantt, 100);
        }
    };
    
    // 最初のチェックは少し遅延
    setTimeout(waitForGantt, 500);
});

// ===== 実行スイッチ =====
window.onload = function() {
    console.log("Gantt initializing...");
    
    // ganttの存在確認
    if (typeof gantt === 'undefined') {
        console.error('ganttオブジェクトが未定義です');
        return;
    }
    
    try {
        // gantt設定
        gantt.config.date_format = "%Y-%m-%d %H:%i";
        
        // gantt初期化
        gantt.init("gantt_here");
        
        // データ取得して表示
        loadData();
        
        console.log('Gantt初期化完了');
    } catch (error) {
        console.error('Gantt初期化エラー:', error);
    }
};
