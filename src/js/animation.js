/**
 * Hiệu ứng GSAP cho trang HTML thuần (xuất từ Google Stitch).
 *
 * Cách dùng: thêm HAI dòng này vào cuối <body> của MỖI trang HTML:
 *   <script src="https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js"></script>
 *   <script src="animations.js"></script>
 *
 * Tính năng:
 *  1) Nhấn nút: mọi <button>, [role="button"], .btn và phần tử có data-press
 *     co lại khi nhấn, nảy nhẹ khi thả. Thêm data-no-press để loại trừ.
 *  2) Hiện dần: phần tử có thuộc tính data-reveal sẽ trượt lên và hiện dần,
 *     kể cả khi được thêm vào trang sau này (ví dụ sau khi gọi API).
 *  3) SGKAnim.shake(el): rung nhẹ khi lỗi (ví dụ không nhận ra sách).
 *
 * Tự tắt khi người dùng bật "giảm chuyển động" trong hệ điều hành.
 */
(function () {
    "use strict";

    if (typeof gsap === "undefined") {
        console.warn("[animations.js] Chưa tải GSAP, bỏ qua hiệu ứng.");
        return;
    }

    var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var PRESS = "button:not([disabled]), [role='button'], .btn, [data-press]";

    /* ---------- 1) Hiệu ứng nhấn nút (event delegation, không cần sửa từng nút) ---------- */
    if (!reduce) {
        var pressed = null;

        document.addEventListener("pointerdown", function (e) {
            var t = e.target;
            var el = t && t.closest ? t.closest(PRESS) : null;
            if (!el || el.hasAttribute("data-no-press")) return;
            pressed = el;
            gsap.to(el, { scale: 0.95, duration: 0.12, ease: "power2.out", overwrite: "auto" });
        });

        function release() {
            if (!pressed) return;
            var el = pressed;
            pressed = null;
            gsap.to(el, {
                scale: 1,
                duration: 0.5,
                ease: "elastic.out(1, 0.5)",
                overwrite: "auto",
                // Xóa transform còn sót để không xung đột với hover/transition của CSS
                onComplete: function () { gsap.set(el, { clearProps: "transform" }); },
            });
        }
        document.addEventListener("pointerup", release);
        document.addEventListener("pointercancel", release);
        window.addEventListener("blur", release);
    }

    /* ---------- 2) Hiện dần phần tử data-reveal (cả phần tử thêm vào sau) ---------- */
    var done = new WeakSet();

    function reveal(target) {
        if (reduce) return;
        var list = [];
        if (typeof target === "string") {
            list = Array.prototype.slice.call(document.querySelectorAll(target));
        } else if (target && target.nodeType === 1) {
            if (target.hasAttribute("data-reveal")) list.push(target);
            list = list.concat(Array.prototype.slice.call(target.querySelectorAll("[data-reveal]")));
        } else if (target && target.length) {
            list = Array.prototype.slice.call(target);
        }
        list = list.filter(function (el) {
            if (done.has(el)) return false;
            done.add(el);
            return true;
        });
        if (!list.length) return;
        gsap.from(list, {
            opacity: 0,
            y: 16,
            duration: 0.4,
            ease: "power2.out",
            stagger: 0.06,
            clearProps: "opacity,transform",
        });
    }

    // Gom các phần tử mới thêm trong cùng một khung hình để stagger chạy liền mạch
    var queue = [];
    var scheduled = false;
    function flush() {
        scheduled = false;
        var nodes = queue;
        queue = [];
        var all = [];
        nodes.forEach(function (n) {
            if (n.hasAttribute && n.hasAttribute("data-reveal")) all.push(n);
            if (n.querySelectorAll) {
                all = all.concat(Array.prototype.slice.call(n.querySelectorAll("[data-reveal]")));
            }
        });
        reveal(all);
    }

    if (!reduce) {
        new MutationObserver(function (muts) {
            muts.forEach(function (m) {
                m.addedNodes.forEach(function (n) {
                    if (n.nodeType === 1) queue.push(n);
                });
            });
            if (queue.length && !scheduled) {
                scheduled = true;
                requestAnimationFrame(flush);
            }
        }).observe(document.documentElement, { childList: true, subtree: true });
    }

    function init() { reveal("[data-reveal]"); }
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }

    /* ---------- 3) Rung nhẹ khi lỗi ---------- */
    function shake(el) {
        if (!el || reduce) return;
        gsap.fromTo(
            el,
            { x: 0 },
            { x: 8, duration: 0.06, repeat: 5, yoyo: true, ease: "power1.inOut", clearProps: "transform" }
        );
    }

    window.SGKAnim = { reveal: reveal, shake: shake };
})();