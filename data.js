// ===== データ読み込み機能 =====

async function loadHolidays() {
    try {
        console.log('loadHolidays開始 - supabaseClient:', !!supabaseClient);

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

// ===== 初期データ読み込み =====

loadHolidays().then(() => {
    loadData();
}).catch(err => {
    console.error('初期データ読み込みエラー:', err);
});

initProjectSelect();
updateFilterButtons();
