/*
 * Signal brand behaviour. No framework; every feature checks that its markup exists.
 * - theme toggle (saved in localStorage, applied before paint in layout.antlers.html)
 * - header border on scroll, mobile path bar hides while scrolling down
 * - mobile menu sheet
 * - dot field: a canvas grid that brightens near the cursor
 * - name decode: the hero name resolves from random characters once
 */

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
const root = document.documentElement;
const cssVar = (name) => getComputedStyle(root).getPropertyValue(name).trim();

/* ---------- theme ---------- */
const isLight = () => (root.dataset.theme ? root.dataset.theme === 'light' : window.matchMedia('(prefers-color-scheme: light)').matches);
const fields = [];

function labelThemeToggles() {
    document.querySelectorAll('[data-theme-toggle]').forEach((button) => {
        button.setAttribute('aria-label', isLight() ? 'Switch to dark theme' : 'Switch to light theme');
    });
}

/*
 * The new theme grows as a circle from the toggle that was clicked (View Transitions API).
 * Browsers without it get a short colour cross-fade; reduced motion switches instantly.
 */
function switchTheme(origin) {
    const next = isLight() ? 'dark' : 'light';
    const apply = () => {
        root.dataset.theme = next;
        try { localStorage.setItem('theme', next); } catch (e) {}
        labelThemeToggles();
        fields.forEach((field) => field.draw());
    };

    if (reduceMotion) return apply();

    if (!document.startViewTransition) {
        root.classList.add('theme-fade');
        apply();
        setTimeout(() => root.classList.remove('theme-fade'), 350);
        return;
    }

    const rect = origin.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));

    document.startViewTransition(apply).ready.then(() => {
        root.animate(
            { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
            { duration: 560, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)', pseudoElement: '::view-transition-new(root)' },
        );
    });
}

document.querySelectorAll('[data-theme-toggle]').forEach((button) => {
    button.addEventListener('click', () => switchTheme(button));
});
labelThemeToggles();

/* ---------- header + path bar ---------- */
const header = document.querySelector('[data-header]');
const pathbar = document.querySelector('[data-pathbar]');
let lastY = window.scrollY;

window.addEventListener('scroll', () => {
    const y = window.scrollY;
    header?.toggleAttribute('data-scrolled', y > 8);
    if (pathbar) {
        if (y > lastY + 4 && y > 240) pathbar.setAttribute('data-away', '');
        if (y < lastY - 4) pathbar.removeAttribute('data-away');
    }
    lastY = y;
}, { passive: true });

/* ---------- mobile menu sheet ---------- */
const menu = document.querySelector('[data-menu]');
const menuOpen = document.querySelector('[data-menu-open]');

function setMenu(open) {
    if (!menu) return;
    menu.toggleAttribute('data-open', open);
    menuOpen?.setAttribute('aria-expanded', String(open));
    document.body.style.overflow = open ? 'hidden' : '';
    document.querySelectorAll('#main, [data-header], footer, [data-pathbar]').forEach((el) => { el.inert = open; });
    if (open) {
        fields.forEach((field) => field.request());
        setTimeout(() => (menu.querySelector('a[aria-current]') || menu.querySelector('a'))?.focus(), 60);
    } else {
        menuOpen?.focus();
    }
}

menuOpen?.addEventListener('click', () => setMenu(true));
menu?.querySelector('[data-menu-close]')?.addEventListener('click', () => setMenu(false));
menu?.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') setMenu(false);
    if (event.key !== 'Tab') return;
    const focusable = [...menu.querySelectorAll('a, button')];
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
});

/* ---------- dot field ---------- */
function dotField(canvas) {
    const host = canvas.parentElement;
    const context = canvas.getContext('2d');
    const gap = 22;
    const reach = 150;
    const base = Number(canvas.dataset.base || 0.14);
    const lift = base < 0.12 ? 0.45 : 0.7;
    const field = { px: -999, py: -999, frame: 0, width: 0, height: 0 };

    field.draw = () => {
        field.frame = 0;
        const ratio = Math.min(window.devicePixelRatio || 1, 2);
        const width = host.clientWidth;
        const height = host.clientHeight;
        if (!width || !height) return;
        if (width !== field.width || height !== field.height) {
            field.width = width;
            field.height = height;
            canvas.width = width * ratio;
            canvas.height = height * ratio;
        }
        context.setTransform(ratio, 0, 0, ratio, 0, 0);
        context.clearRect(0, 0, width, height);
        const dot = cssVar('--dot');
        const accent = cssVar('--accent-bg');

        for (let y = gap / 2; y < height; y += gap) {
            for (let x = gap / 2; x < width; x += gap) {
                const distance = Math.hypot(x - field.px, y - field.py);
                const p = distance < reach ? 1 - distance / reach : 0;
                const push = p ? (p * 5) / (distance || 1) : 0;
                context.globalAlpha = base + p * lift;
                context.fillStyle = p > 0.82 ? accent : dot;
                context.beginPath();
                context.arc(x + (x - field.px) * push, y + (y - field.py) * push, 0.9 + p * 1.1, 0, Math.PI * 2);
                context.fill();
            }
        }
        context.globalAlpha = 1;
    };
    field.request = () => { if (!field.frame) field.frame = requestAnimationFrame(field.draw); };

    if (finePointer && !reduceMotion) {
        host.addEventListener('pointermove', (event) => {
            const rect = canvas.getBoundingClientRect();
            field.px = event.clientX - rect.left;
            field.py = event.clientY - rect.top;
            field.request();
        });
        host.addEventListener('pointerleave', () => { field.px = field.py = -999; field.request(); });
    }
    new ResizeObserver(field.request).observe(host);
    fields.push(field);
    field.request();
}

document.querySelectorAll('[data-dot-field]').forEach(dotField);
window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => {
    labelThemeToggles();
    fields.forEach((field) => field.request());
});

/* ---------- name decode ---------- */
function decode(element, duration = 700) {
    if (reduceMotion) return;
    const target = element.textContent;
    const glyphs = 'abcdefghijklmnopqrstuvwxyz0123456789/<>{}#';
    const start = performance.now();
    const tick = (now) => {
        const k = Math.min(1, (now - start) / duration);
        const shown = Math.floor(k * target.length);
        element.textContent = target.slice(0, shown) + [...target.slice(shown)]
            .map((c) => (c === ' ' ? c : glyphs[Math.floor(Math.random() * glyphs.length)]))
            .join('');
        if (k < 1) requestAnimationFrame(tick);
        else element.textContent = target;
    };
    requestAnimationFrame(tick);
}

document.querySelectorAll('[data-decode]').forEach((element) => decode(element));
