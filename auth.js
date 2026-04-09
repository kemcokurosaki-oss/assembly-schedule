// Supabase 設定
const SUPABASE_URL = "https://dgekjzkrybrswsxlcbvh.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRnZWtqemtyeWJyc3dzeGxjYnZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg4ODQ3MjIsImV4cCI6MjA4NDQ2MDcyMn0.BsEj53lV3p76yE9fMPTaLn7ocKTNzYPTqIAnBafYItU";
// createClient呼び出し前にURLのtype情報を保存（Supabaseがhashを処理・クリアする前に取得）
const _pageInitType = new URLSearchParams(window.location.hash.replace('#', '?')).get('type')
                   || new URLSearchParams(window.location.search).get('type');
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ===== 認証管理 =====
// 編集可能なメールアドレスリスト
const EDITORS = [
    'm2-kusakabe@kusakabe.com', // 常務
    'm2-tanaka@kusakabe.com',   // 田中
    'm2-yasuoka@kusakabe.com',  // 安岡
    'm2-kawabe@kusakabe.com',   // 川邊
    'm2-dan@kusakabe.com',      // 檀
    'm2-horii@kusakabe.com',    // 堀井
    'm2-miyazaki@kusakabe.com', // 宮﨑
    'm2-tsuda@kusakabe.com',    // 津田
    'm2-komura@kusakabe.com',   // 古村
    'm2-shibata@kusakabe.com',  // 柴田
    'm2-hashimoto@kusakabe.com', // 橋本
    'm2-matsumoto@kusakabe.com' // 松本
];
let _isEditor = false;

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

// ===== 認証状態監視と初期化 =====

supabaseClient.auth.onAuthStateChange((_event, session) => {
    if (_event === 'PASSWORD_RECOVERY' || (_event === 'SIGNED_IN' && _pageInitType === 'invite')) {
        openSetPasswordDialog();
    } else {
        const email = session?.user?.email || '';
        _updateUIForAuth(!!session && EDITORS.includes(email));
    }
});
