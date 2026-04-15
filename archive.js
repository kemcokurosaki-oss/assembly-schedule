// ---- アーカイブ機能 ----
// アーカイブ = 全体工程表の completed_projects テーブルに登録された完了済み工事番号
// 組立工程表からアーカイブへの手動移動は行わない（全体工程表で管理）

let _archiveDetailProjectNumber = null;
let _archiveDetailTaskType = 'assembly';

async function openArchiveList() {
    const tableDiv = document.getElementById('archive_list_table');
    tableDiv.innerHTML = '<div style="padding:20px;text-align:center;color:#888;">読み込み中...</div>';

    const { data, error } = await supabaseClient
        .from('completed_projects')
        .select('*')
        .order('project_number', { ascending: true });
    if (error) { alert('読み込みエラー: ' + error.message); return; }

    if (!data || data.length === 0) {
        tableDiv.innerHTML = '<div style="padding:20px;text-align:center;color:#888;">完了済みの工事はありません</div>';
    } else {
        tableDiv.innerHTML = `<table>
            <thead><tr><th>工事番号</th><th>顧客名</th><th>工事概要</th><th>完了日</th><th>操作</th></tr></thead>
            <tbody>${data.map(cp => `
                <tr>
                    <td>${cp.project_number || ''}</td>
                    <td>${cp.customer_name || ''}</td>
                    <td>${cp.project_details || ''}</td>
                    <td>${cp.completed_date || ''}</td>
                    <td style="white-space:nowrap;">
                        <button class="btn" style="font-size:11px;padding:2px 8px;" onclick="openArchiveDetail('${cp.project_number}')">詳細</button>
                    </td>
                </tr>`).join('')}
            </tbody></table>`;
    }
    document.getElementById('archive_list_overlay').classList.add('open');
}

function closeArchiveList() {
    document.getElementById('archive_list_overlay').classList.remove('open');
}

async function openArchiveDetail(projectNumber) {
    _archiveDetailProjectNumber = projectNumber;
    _archiveDetailTaskType = currentTaskTypeFilter || 'assembly';
    document.getElementById('archive_detail_title').textContent = `${projectNumber} のタスク一覧`;
    document.getElementById('archive_detail_overlay').classList.add('open');
    await _loadArchiveDetailTable();
}

function switchArchiveDetailTab(taskType) {
    _archiveDetailTaskType = taskType;
    _loadArchiveDetailTable();
}

async function _loadArchiveDetailTable() {
    const typeFilter = _archiveDetailTaskType;
    ['assembly', 'business_trip'].forEach(t => {
        const btn = document.getElementById('dtab_' + t);
        if (btn) btn.classList.toggle('active', t === typeFilter);
    });

    const tableDiv = document.getElementById('archive_detail_table');
    tableDiv.innerHTML = '<div style="padding:20px;text-align:center;color:#888;">読み込み中...</div>';

    // 組立工程表のタスクは is_detailed=false（設計工程表の is_detailed=true とは別）
    // major_item が「組立」または「電装」のタスクのみ対象
    let query = supabaseClient
        .from('tasks')
        .select('*')
        .eq('project_number', _archiveDetailProjectNumber)
        .neq('is_detailed', true)
        .or('major_item.eq.組立,major_item.eq.電装')
        .order('machine', { ascending: true, nullsFirst: true })
        .order('unit', { ascending: true, nullsFirst: true })
        .order('start_date', { ascending: true, nullsFirst: true })
        .order('sort_order', { ascending: true, nullsFirst: false });

    // assembly は task_type=null または 'assembly' も含む
    if (typeFilter === 'assembly') {
        query = query.or('task_type.is.null,task_type.eq.assembly');
    } else {
        query = query.eq('task_type', typeFilter);
    }

    const { data, error } = await query;
    if (error) { alert('読み込みエラー: ' + error.message); return; }

    if (!data || data.length === 0) {
        tableDiv.innerHTML = '<div style="padding:20px;text-align:center;color:#888;">このモードのタスクはありません</div>';
    } else {
        tableDiv.innerHTML = `<table>
            <colgroup>
                <col style="width:90px;">
                <col style="width:44px;">
                <col style="width:44px;">
                <col style="width:110px;">
                <col style="width:80px;">
                <col style="width:80px;">
                <col style="width:38px;">
            </colgroup>
            <thead><tr>
                <th>タスク名</th><th>機械</th><th>ユニ</th>
                <th>担当</th><th>開始日</th><th>完了予定日</th><th>日数</th>
            </tr></thead>
            <tbody>${data.map(t => `
                <tr>
                    <td>${t.text || ''}</td>
                    <td>${t.machine || ''}</td>
                    <td>${t.unit || ''}</td>
                    <td>${t.owner || ''}</td>
                    <td>${t.start_date ? t.start_date.substring(0, 10) : ''}</td>
                    <td>${t.end_date ? t.end_date.substring(0, 10) : ''}</td>
                    <td>${t.duration != null ? t.duration : ''}</td>
                </tr>`).join('')}
            </tbody></table>`;
    }
}

function closeArchiveDetail() {
    document.getElementById('archive_detail_overlay').classList.remove('open');
}

function openArchiveCopyFromDetail() {
    openArchiveCopy(_archiveDetailProjectNumber);
}

function openArchiveCopy(projectNumber) {
    _archiveCopySrc = projectNumber;
    document.getElementById('archive_copy_src').textContent = projectNumber;
    document.getElementById('archive_copy_input').value = '';
    document.getElementById('archive_copy_overlay').classList.add('open');
}

function closeArchiveCopy() {
    document.getElementById('archive_copy_overlay').classList.remove('open');
    _archiveCopySrc = null;
}

async function executeArchiveCopy() {
    const newNum = document.getElementById('archive_copy_input').value.trim();
    if (!newNum) { alert('工事番号を入力してください'); return; }
    if (!_archiveCopySrc) return;

    const typeFilter = _archiveDetailTaskType;
    let query = supabaseClient
        .from('tasks')
        .select('*')
        .eq('project_number', _archiveCopySrc)
        .neq('is_detailed', true)
        .or('major_item.eq.組立,major_item.eq.電装');

    if (typeFilter === 'assembly') {
        query = query.or('task_type.is.null,task_type.eq.assembly');
    } else {
        query = query.eq('task_type', typeFilter);
    }

    const { data, error } = await query;
    if (error || !data || data.length === 0) { alert('コピー元データの取得に失敗しました'); return; }

    const srcNum = _archiveCopySrc;
    const copies = data.map(t => {
        const copy = { ...t };
        delete copy.id;
        copy.project_number = newNum;
        copy.is_archived = false;
        copy.archived_at = null;
        return copy;
    });

    const { error: insertError } = await supabaseClient.from('tasks').insert(copies);
    if (insertError) { alert('コピーに失敗しました: ' + insertError.message); return; }

    closeArchiveCopy();
    closeArchiveList();
    await loadCompletedProjects();
    await loadData();
    await initProjectSelect(null);
    alert(`「${srcNum}」を「${newNum}」としてコピーしました`);
}
