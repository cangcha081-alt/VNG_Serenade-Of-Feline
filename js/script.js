
(function () {
    'use strict';

    const btns = document.querySelectorAll('.menuBtn');
    if (!btns.length) return;

    let cur = 0;

    function focusAt(i) {
        cur = ((i % btns.length) + btns.length) % btns.length;
        btns[cur].focus();
    }

    // 加载完成后聚焦第一个按钮
    window.addEventListener('load', () => {
        setTimeout(() => { try { focusAt(0); } catch (_) {} }, 1000);
    });

    // 键盘上下切换
    document.addEventListener('keydown', (e) => {
        const focused = document.activeElement;
        const idx = Array.prototype.indexOf.call(btns, focused);
        if (idx < 0) return;

        if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
            e.preventDefault();
            focusAt(idx + 1);
        } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
            e.preventDefault();
            focusAt(idx - 1);
        } else if (e.key === 'Home') {
            e.preventDefault();
            focusAt(0);
        } else if (e.key === 'End') {
            e.preventDefault();
            focusAt(btns.length - 1);
        }
        // Enter / Space 由浏览器原生处理：触发 <a> 的点击 / 跳转
    });
})();