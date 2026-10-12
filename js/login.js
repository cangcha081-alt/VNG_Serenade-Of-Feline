// 获取所有用户
function getUsers() {
    const data = localStorage.getItem("users");
    if (!data) return [];

    try {
        const users = JSON.parse(data);
        return Array.isArray(users) ? users : [];
    } catch (error) {
        console.warn("用户数据读取失败，已使用空列表：", error);
        return [];
    }
}

// 保存所有用户
function saveUsers(users) {
    localStorage.setItem("users", JSON.stringify(users));
}

// 查找用户
function findUser(username) {
    const users = getUsers();
    return users.find(user => user.username === username);
}

// 添加用户
function addUser(username, password) {
    const users = getUsers();
    if (users.some(user => user.username === username)) {
        return false;
    }
    users.push({ username, password });
    saveUsers(users);
    return true;
}

// 获取当前表单对应的提示区域
function getActiveMsgDiv() {
    const registerForm = document.getElementById('registerForm');
    const isRegistering = window.getComputedStyle(registerForm).display !== 'none';
    return document.getElementById(isRegistering ? 'registerMsg' : 'loginMsg');
}

// 显示提示信息
function showMessage(message, type = 'error') {
    const msgDiv = getActiveMsgDiv();
    msgDiv.textContent = message;
    msgDiv.className = `msg ${type}`;
    clearTimeout(msgDiv._timer);
    msgDiv._timer = setTimeout(() => {
        msgDiv.className = "msg";
        msgDiv.textContent = "";
    }, 3000);
}

function showError(message) {
    showMessage(message, 'error');
}

function clearMessages() {
    ['loginMsg', 'registerMsg'].forEach(function(id) {
        const msgDiv = document.getElementById(id);
        clearTimeout(msgDiv._timer);
        msgDiv.className = 'msg';
        msgDiv.textContent = '';
    });
}

// 记住密码
function saveRemember(username, password) {
    const rememberMe = document.getElementById('rememberMe');
    if (rememberMe && rememberMe.checked) {
        localStorage.setItem('rememberUser', username);
        localStorage.setItem('rememberPass', password);
    } else {
        localStorage.removeItem('rememberUser');
        localStorage.removeItem('rememberPass');
    }
}

// 切换到注册表单
function switchToRegister() {
    clearMessages();
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('registerForm').style.display = 'flex';
    document.getElementById('regUser').focus();
}

// 切换到登录表单
function switchToLogin() {
    clearMessages();
    document.getElementById('registerForm').style.display = 'none';
    document.getElementById('loginForm').style.display = 'flex';
    document.getElementById('loginUser').focus();
}

// 登录
function Login() {
    const username = document.getElementById('loginUser').value.trim();
    const password = document.getElementById('loginPassword').value.trim();

    if (!username || !password) {
        showError("请输入用户名和密码");
        return;
    }
    const user = findUser(username);
    if (!user) {
        showError("用户名不存在,请先注册");
        return;
    }
    if (user.password !== password) {
        showError("密码错误,请重新输入");
        return;
    }
    saveRemember(username, password);
    window.location.href = "html/hall.html";
}

// 注册
function Register() {
    const username = document.getElementById('regUser').value.trim();
    const password = document.getElementById('regPassword').value.trim();
    const confirm = document.getElementById('regConfirm').value.trim();

    if (!username || !password || !confirm) {
        showError("请填写完整信息");
        return;
    }
    if (username.length < 2) {
        showError("用户名至少2个字符");
        return;
    }
    if (password.length < 4) {
        showError("密码至少4位");
        return;
    }
    if (password !== confirm) {
        showError("两次密码不一致");
        return;
    }
    if (findUser(username)) {
        showError("该用户名已被注册");
        return;
    }

    const success = addUser(username, password);
    if (success) {
        document.getElementById('regUser').value = '';
        document.getElementById('regPassword').value = '';
        document.getElementById('regConfirm').value = '';
        switchToLogin();
        document.getElementById('loginUser').value = username;
        document.getElementById('loginPassword').value = '';
        showMessage('注册成功！请登录', 'success');
    } else {
        showError("注册失败，请重试");
    }
}

// 加载记住的账号
function loadRemember() {
    const u = localStorage.getItem('rememberUser');
    const p = localStorage.getItem('rememberPass');
    if (u && p) {
        document.getElementById('loginUser').value = u;
        document.getElementById('loginPassword').value = p;
        document.getElementById('rememberMe').checked = true;
    }
}

// 初始化
function init() {
    if (getUsers().length === 0) {
        addUser('admin', '123456');
        addUser('test', '0000');
    }
    loadRemember();

    document.getElementById('loginBtn').onclick = Login;
    document.getElementById('registerBtn').onclick = Register;
    document.getElementById('showRegisterLink').onclick = function(e) {
        e.preventDefault(); 
        switchToRegister();
    };
    document.getElementById('showLoginLink').onclick = function(e) {
        e.preventDefault();
        switchToLogin();
    };

    document.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            const registerForm = document.getElementById('registerForm');
            if (window.getComputedStyle(registerForm).display !== 'none') {
                Register();
            } else {
                Login();
            }
        }
    });

    // 输入时隐藏错误消息
    ['loginUser', 'loginPassword', 'regUser', 'regPassword', 'regConfirm'].forEach(function(id) {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', function() {
                clearMessages();
            });
        }
    });

}

// 启动
document.addEventListener('DOMContentLoaded', init);
