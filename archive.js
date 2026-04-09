// ---- アーカイブ機能 ----

function toggleArchiveMenu(e) {
    e.stopPropagation();
    document.getElementById('archive_dropdown_menu').classList.toggle('open');
}

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

    const { error: archiveError } = await supabaseClient
        .from('archived_tasks')
        .insert(tasks);

    if (archiveError) {
        console.error('アーカイブエラー:', archiveError);
        alert('タスクのアーカイブに失敗しました');
        return;
    }

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
    loadData();
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

    const { error: restoreError } = await supabaseClient
        .from('tasks')
        .insert({
            ...archivedTask,
            id: undefined
        });

    if (restoreError) {
        console.error('復元エラー:', restoreError);
        alert('タスクの復元に失敗しました');
        return;
    }

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
    loadData();
}
