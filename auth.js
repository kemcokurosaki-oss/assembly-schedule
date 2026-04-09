// Supabase 設定
const S_URL = "https://dgekjzkrybrswsxlcbvh.supabase.co";
const S_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRnZWtqemtyeWJyc3dzeGxjYnZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg4ODQ3MjIsImV4cCI6MjA4NDQ2MDcyMn0.BsEj53lV3p76yE9fMPTaLn7ocKTNzYPTqIAnBafYItU";
// createClient呼び出し前にURLのtype情報を保存（Supabaseがhashを処理・クリアする前に取得）
const _pageInitType = new URLSearchParams(window.location.hash.replace('#', '?')).get('type')
                   || new URLSearchParams(window.location.search).get('type');
const supabaseClient = supabase.createClient(S_URL, S_KEY);

// ===== 認証管理 =====
// 編集可能なメールアドレスリスト
const EDITORS = [
    'm2-kusakabe@kusakabe.com', // 常務
    'e-kurosaki@kusakabe.com',  // 工程管理者
    's-morimura@kusakabe.com',  // 工程管理者
    // 組立部員は確定後にここに追加
];
let _isEditor = false;

function _updateUIForAuth(isEditor) {
    _isEditor = isEditor;
    gantt.config.readonly = !isEditor;
    document.getElementById('create_task_btn').style.display  = isEditor ? '' : 'none';
    document.getElementById('multi_delete_btn').style.display  = isEditor ? '' : 'none';
    document.getElementById('archive_btn_wrap').style.display  = isEditor ? '' : 'none';
    const authBtn = document.getElementById('auth_btn');
    if (authBtn) {
        authBtn.textContent = isEditor ? 'ログアウト' : 'ログイン';
        authBtn.classList.toggle('logged-in', isEditor);
    }
    gantt.render();
}

function handleAuthBtn() {
    if (_isEditor) { doLogout(); } else { openLoginDialog(); }
}

function openLoginDialog() {
    document.getElementById('login_email').value = '';
    document.getElementById('login_password').value = '';
    document.getElementById('login_error').style.display = 'none';
    document.getElementById('login_overlay').classList.add('open');
    setTimeout(() => document.getElementById('login_email').focus(), 100);
}

function closeLoginDialog() {
    document.getElementById('login_overlay').classList.remove('open');
}

async function doLogin() {
    const email    = document.getElementById('login_email').value.trim();
    const password = document.getElementById('login_password').value;
    const errEl    = document.getElementById('login_error');
    errEl.style.display = 'none';
    document.getElementById('login_btn_submit').textContent = '処理中...';
    const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
    document.getElementById('login_btn_submit').textContent = 'ログイン';
    if (error) {
        errEl.textContent = 'メールアドレスまたはパスワードが正しくありません';
        errEl.style.display = 'block';
    } else {
        closeLoginDialog();
    }
}

async function doLogout() {
    await supabaseClient.auth.signOut();
}

function openSetPasswordDialog() {
    document.getElementById('setpw_pw1').value = '';
    document.getElementById('setpw_pw2').value = '';
    document.getElementById('setpw_error').style.display = 'none';
    document.getElementById('setpw_overlay').classList.add('open');
    setTimeout(() => document.getElementById('setpw_pw1').focus(), 100);
}

async function doSetPassword() {
    const pw1 = document.getElementById('setpw_pw1').value;
    const pw2 = document.getElementById('setpw_pw2').value;
    const errEl = document.getElementById('setpw_error');
    errEl.style.display = 'none';

    if (pw1.length < 8) {
        errEl.textContent = 'パスワードは8文字以上で入力してください';
        errEl.style.display = 'block';
        return;
    }
    if (pw1 !== pw2) {
        errEl.textContent = 'パスワードが一致しません';
        errEl.style.display = 'block';
        return;
    }

    document.getElementById('setpw_btn_submit').textContent = '処理中...';
    const { error } = await supabaseClient.auth.updateUser({ password: pw1 });
    document.getElementById('setpw_btn_submit').textContent = 'パスワードを設定する';

    if (error) {
        errEl.textContent = 'エラーが発生しました: ' + error.message;
        errEl.style.display = 'block';
    } else {
        document.getElementById('setpw_overlay').classList.remove('open');
        // URLのハッシュをクリア
        history.replaceState(null, '', window.location.pathname + window.location.search);
        const { data: { user } } = await supabaseClient.auth.getUser();
        _updateUIForAuth(!!user && EDITORS.includes(user.email));
    }
}

// 認証状態の変化を監視（ページロード時・ログイン・ログアウト時に自動で呼ばれる）
supabaseClient.auth.onAuthStateChange((_event, session) => {
    if (_event === 'PASSWORD_RECOVERY' || (_event === 'SIGNED_IN' && _pageInitType === 'invite')) {
        // 招待メール・パスワードリセットのリンクからのアクセス
        openSetPasswordDialog();
    } else {
        const email = session?.user?.email || '';
        _updateUIForAuth(!!session && EDITORS.includes(email));
    }
});
