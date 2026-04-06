// Kor w.Chat - SillyTavern Font Extension
import { saveSettingsDebounced } from '../../../../script.js';
import { extension_settings } from '../../../extensions.js';

const EXT_NAME = 'kor-wchat-fonts';
// Font Awesome, 이모지, SVG, 아이콘 요소 제외
const CHAT_SELECTOR = [
    '#chat .mes_text',
    '#chat .mes_text p',
    '#chat .mes_text span:not(.fa):not([class*="fa-"])',
    '#chat .mes_text div:not(.fa):not([class*="fa-"])',
    '#chat .mes_text em',
    '#chat .mes_text strong',
    '#chat .mes_text b',
    '#chat .mes_text li',
    '#chat .mes_text a',
].join(', ');
const STYLE_ID = 'kwc-applied-style';

const defaultSettings = {
    fonts: [],
    activeFont: null,
    fontSize: null,
    bold: false,
};

function initSettings() {
    if (!extension_settings[EXT_NAME]) {
        extension_settings[EXT_NAME] = structuredClone(defaultSettings);
    }
    for (const [k, v] of Object.entries(defaultSettings)) {
        if (extension_settings[EXT_NAME][k] === undefined) {
            extension_settings[EXT_NAME][k] = v;
        }
    }
}

function S() { return extension_settings[EXT_NAME]; }

// ── Style injection ────────────────────────────────────────────────────────

function buildAndApply() {
    document.getElementById(STYLE_ID)?.remove();

    const lines = [];
    const font = S().fonts.find(f => f.name === S().activeFont);

    if (font) {
        lines.push(`/* Kor w.Chat: ${font.name} */`);
        lines.push(font.cssContent);
        const sizeRule  = S().fontSize ? `font-size: ${S().fontSize}px !important;` : '';
        const boldRule  = S().bold ? 'font-weight: bold !important;' : 'font-weight: normal !important;';
        lines.push(`${CHAT_SELECTOR} { font-family: '${font.fontFamily}', sans-serif !important; ${sizeRule} ${boldRule} }`);
    } else if (S().fontSize || S().bold) {
        // No font active but size/bold changed
        const sizeRule = S().fontSize ? `font-size: ${S().fontSize}px !important;` : '';
        const boldRule = S().bold ? 'font-weight: bold !important;' : '';
        if (sizeRule || boldRule) {
            lines.push(`${CHAT_SELECTOR} { ${sizeRule} ${boldRule} }`);
        }
    }

    if (lines.length) {
        const el = document.createElement('style');
        el.id = STYLE_ID;
        el.textContent = lines.join('\n');
        document.head.appendChild(el);
    }
}

function resetAll() {
    document.getElementById(STYLE_ID)?.remove();
    S().activeFont = null;
    S().fontSize = null;
    S().bold = false;
    saveSettingsDebounced();
}

// ── Toast ──────────────────────────────────────────────────────────────────

function toast(msg, type = 'success') {
    const el = document.getElementById('kf-toast');
    if (!el) return;
    el.textContent = msg;
    el.className = `kf-toast kf-toast-${type}`;
    el.style.display = 'block';
    clearTimeout(el._t);
    el._t = setTimeout(() => { el.style.display = 'none'; }, 2500);
}

// ── Font list ──────────────────────────────────────────────────────────────

function renderFontList() {
    const list = document.getElementById('kf-font-list');
    if (!list) return;

    if (S().fonts.length === 0) {
        list.innerHTML = '<div class="kf-empty-state">아직 추가된 폰트가 없습니다.</div>';
        return;
    }

    list.innerHTML = '';
    S().fonts.forEach(font => {
        // inject preview face
        const pid = `kwc-prev-${CSS.escape(font.name)}`;
        if (!document.getElementById(pid)) {
            const s = document.createElement('style');
            s.id = pid;
            s.textContent = font.cssContent;
            document.head.appendChild(s);
        }

        const isActive = font.name === S().activeFont;
        const item = document.createElement('div');
        item.className = 'kf-font-item' + (isActive ? ' active' : '');
        item.innerHTML = `
            <div class="kf-font-info">
                <span class="kf-font-name">${esc(font.name)}</span>
                <span class="kf-font-badge kf-badge-${font.type}">${font.type === 'local' ? '📁 로컬' : '🌐 눈누'}</span>
                <span class="kf-font-swatch" style="font-family:'${esc(font.fontFamily)}',sans-serif">가나다 ABC</span>
            </div>
            <div class="kf-font-actions">
                <button class="kf-btn ${isActive ? 'kf-btn-active' : 'kf-btn-apply'}" data-name="${esc(font.name)}">
                    ${isActive ? '✓ 적용중' : '적용'}
                </button>
                <button class="kf-btn kf-btn-remove" data-name="${esc(font.name)}">삭제</button>
            </div>
        `;
        list.appendChild(item);
    });

    list.querySelectorAll('.kf-btn-apply').forEach(btn => {
        btn.addEventListener('click', () => {
            S().activeFont = btn.dataset.name;
            buildAndApply();
            saveSettingsDebounced();
            renderFontList();
            toast(`✅ "${btn.dataset.name}" 적용됨`);
        });
    });
    list.querySelectorAll('.kf-btn-remove').forEach(btn => {
        btn.addEventListener('click', () => {
            const name = btn.dataset.name;
            if (S().activeFont === name) { S().activeFont = null; buildAndApply(); }
            S().fonts = S().fonts.filter(f => f.name !== name);
            document.getElementById(`kwc-prev-${CSS.escape(name)}`)?.remove();
            saveSettingsDebounced();
            renderFontList();
            toast(`🗑️ "${name}" 삭제됨`, 'info');
        });
    });
}

function esc(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Local file ─────────────────────────────────────────────────────────────

async function loadLocalFile(file, customName) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => {
            const ext = file.name.split('.').pop().toLowerCase();
            const fmtMap  = { ttf:'truetype', otf:'opentype', woff:'woff', woff2:'woff2' };
            const mimeMap = { ttf:'font/ttf', otf:'font/otf', woff:'font/woff', woff2:'font/woff2' };
            const b64 = e.target.result.split(',')[1];
            const dataUrl = `data:${mimeMap[ext]||'font/ttf'};base64,${b64}`;
            const fontFamily = customName || file.name.replace(/\.[^.]+$/, '');
            const cssContent = `@font-face { font-family: '${fontFamily}'; src: url('${dataUrl}') format('${fmtMap[ext]||'truetype'}'); }`;
            resolve({ name: fontFamily, fontFamily, cssContent, type: 'local' });
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// ── Noonnu CSS parse ───────────────────────────────────────────────────────

async function parseNoonnuCSS(css, customName) {
    css = css.trim();

    // @import url(...) 형식
    if (css.startsWith('@import')) {
        const urlMatch = css.match(/@import\s+url\(['"]?([^'"\)]+)['"]?\)/);
        if (!urlMatch) throw new Error('@import URL을 인식할 수 없습니다.');
        const cssUrl = urlMatch[1];

        // 원격 CSS fetch → @font-face 추출 + 상대경로 → 절대경로 변환
        let resolvedCss = '';
        let families = [];
        try {
            const res = await fetch(cssUrl);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const remoteCss = await res.text();

            // 상대경로 → 절대경로 변환
            const baseUrl = cssUrl.substring(0, cssUrl.lastIndexOf('/') + 1);
            resolvedCss = remoteCss.replace(
                /url\(['"]?(?!https?:\/\/|data:)([^'"\)]+)['"]?\)/g,
                (match, path) => `url('${baseUrl}${path}')`
            );

            // font-family 목록 수집
            const fmMatches = [...remoteCss.matchAll(/font-family\s*:\s*['"]([^'"]+)['"]/g)];
            families = [...new Set(fmMatches.map(m => m[1].trim()))];
        } catch(e) {
            throw new Error(`CSS 파일을 가져오지 못했습니다: ${e.message}\n폰트 이름 칸에 직접 입력해주세요.`);
        }

        if (families.length === 0) throw new Error('CSS 파일에서 font-family를 찾지 못했습니다.');

        // 사용할 font-family 결정
        let fontFamily = customName || '';
        if (!fontFamily) {
            if (families.length === 1) {
                fontFamily = families[0];
            } else {
                // 여러 개면 선택 팝업
                fontFamily = await showFamilyPicker(families);
                if (!fontFamily) throw new Error('폰트를 선택하지 않았습니다.');
            }
        }

        return {
            name: customName || fontFamily,
            fontFamily,
            cssContent: resolvedCss, // 절대경로로 변환된 전체 CSS
            type: 'noonnu'
        };
    }

    // @font-face 형식 처리
    const familyMatch = css.match(/font-family\s*:\s*['"]?([^'";\n]+)['"]?\s*;/);
    if (!familyMatch) throw new Error('@font-face 코드에서 font-family를 찾을 수 없습니다.');
    const fontFamily = familyMatch[1].trim();
    const name = customName || fontFamily;
    return { name, fontFamily, cssContent: css, type: 'noonnu' };
}

// 여러 font-family 중 선택 팝업
function showFamilyPicker(families) {
    return new Promise((resolve) => {
        // 기존 팝업 제거
        document.getElementById('kwc-family-picker')?.remove();

        const overlay = document.createElement('div');
        overlay.id = 'kwc-family-picker';
        overlay.style.cssText = `
            position:fixed; top:0; left:0; width:100vw; height:100vh;
            background:rgba(0,0,0,0.6); z-index:99999;
        `;

        const box = document.createElement('div');
        box.style.cssText = `
            background:var(--SmartThemeBlurTintColor, #1e1e2e);
            border:1px solid var(--SmartThemeBorderColor, #555);
            border-radius:12px; padding:20px; max-width:360px; width:90%;
            box-shadow:0 8px 32px rgba(0,0,0,0.5);
            position:fixed;
            top:50%; left:50%;
            transform:translate(-50%, -50%);
            max-height:80vh;
            overflow-y:auto;
            box-sizing:border-box;
        `;

        box.innerHTML = `
            <div style="font-weight:700; margin-bottom:6px; font-size:1em;">폰트를 선택하세요</div>
            <div style="font-size:0.8em; color:var(--SmartThemeEmColor,#aaa); margin-bottom:14px;">
                이 CSS 파일에 여러 폰트가 있습니다.
            </div>
            <div id="kwc-family-list" style="display:flex; flex-direction:column; gap:6px; max-height:280px; overflow-y:auto;"></div>
            <button id="kwc-picker-cancel" style="
                margin-top:14px; width:100%; padding:7px;
                background:rgba(255,255,255,0.07); border:1px solid var(--SmartThemeBorderColor,#555);
                border-radius:6px; color:var(--SmartThemeBodyColor,#ccc); cursor:pointer; font-size:0.85em;
            ">취소</button>
        `;

        const list = box.querySelector('#kwc-family-list');
        families.forEach(fam => {
            const btn = document.createElement('button');
            btn.style.cssText = `
                padding:8px 12px; background:rgba(255,255,255,0.04);
                border:1px solid var(--SmartThemeBorderColor,#444); border-radius:8px;
                color:var(--SmartThemeBodyColor,#ddd); cursor:pointer; text-align:left;
                font-size:0.88em; transition:background 0.15s;
            `;
            btn.innerHTML = `<span style="font-family:'${fam}',sans-serif; font-size:1.1em;">${fam}</span>`;
            btn.onmouseenter = () => btn.style.background = 'rgba(167,139,250,0.15)';
            btn.onmouseleave = () => btn.style.background = 'rgba(255,255,255,0.04)';
            btn.onclick = () => { overlay.remove(); resolve(fam); };
            list.appendChild(btn);
        });

        box.querySelector('#kwc-picker-cancel').onclick = () => { overlay.remove(); resolve(null); };
        overlay.appendChild(box);
        document.body.appendChild(overlay);
    });
}

// ── Events ─────────────────────────────────────────────────────────────────

let pendingLocal = null;

function bindEvents() {
    // Tabs
    document.querySelectorAll('#korean-fonts-panel .kf-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('#korean-fonts-panel .kf-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('#korean-fonts-panel .kf-tab-content').forEach(c => c.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById(`kf-tab-${tab.dataset.tab}`)?.classList.add('active');
            if (tab.dataset.tab === 'manage') renderFontList();
        });
    });

    // Drop zone
    const dropZone = document.getElementById('kf-drop-zone');
    const fileInput = document.getElementById('kf-file-input');
    dropZone?.addEventListener('click', () => fileInput?.click());
    dropZone?.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
    dropZone?.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
    dropZone?.addEventListener('drop', e => {
        e.preventDefault(); dropZone.classList.remove('drag-over');
        if (e.dataTransfer.files[0]) handleFileSelect(e.dataTransfer.files[0]);
    });
    fileInput?.addEventListener('change', () => { if (fileInput.files[0]) handleFileSelect(fileInput.files[0]); });

    async function handleFileSelect(file) {
        const name = document.getElementById('kf-local-name')?.value.trim() || '';
        try {
            pendingLocal = await loadLocalFile(file, name);
            let ps = document.getElementById('kwc-pending-style');
            if (!ps) { ps = document.createElement('style'); ps.id = 'kwc-pending-style'; document.head.appendChild(ps); }
            ps.textContent = pendingLocal.cssContent;
            const pt = document.getElementById('kf-local-preview-text');
            if (pt) pt.style.fontFamily = `'${pendingLocal.fontFamily}', sans-serif`;
            document.getElementById('kf-local-preview').style.display = 'block';
            dropZone.querySelector('.kf-upload-text').textContent = `📄 ${file.name}`;
            toast(`파일 로드: ${file.name}`);
        } catch(err) { toast('파일 오류: ' + err.message, 'error'); }
    }

    document.getElementById('kf-add-local')?.addEventListener('click', async () => {
        const name = document.getElementById('kf-local-name')?.value.trim() || '';
        if (!pendingLocal) { toast('파일을 먼저 선택해주세요.', 'error'); return; }
        const fd = { ...pendingLocal };
        if (name) { fd.name = name; fd.fontFamily = name; }
        if (S().fonts.find(f => f.name === fd.name)) { toast(`"${fd.name}" 이름이 이미 있습니다.`, 'error'); return; }
        S().fonts.push(fd);
        saveSettingsDebounced();
        pendingLocal = null;
        document.getElementById('kf-local-name').value = '';
        document.getElementById('kf-local-preview').style.display = 'none';
        dropZone.querySelector('.kf-upload-text').textContent = '클릭하거나 파일을 드래그하세요';
        fileInput.value = '';
        toast(`✅ "${fd.name}" 추가됨!`);
    });

    // Noonnu CSS paste: live preview as you type
    const cssInput = document.getElementById('kf-noonnu-css');
    cssInput?.addEventListener('input', async () => {
        const css = cssInput.value.trim();
        if (!css) { document.getElementById('kf-noonnu-preview').style.display = 'none'; return; }
        try {
            const fd = await parseNoonnuCSS(css, document.getElementById('kf-noonnu-name')?.value.trim() || '');
            // 이름 자동 채우기
            const nameEl = document.getElementById('kf-noonnu-name');
            if (nameEl && !nameEl.value.trim()) nameEl.value = fd.fontFamily;
            let ps = document.getElementById('kwc-noonnu-preview-style');
            if (!ps) { ps = document.createElement('style'); ps.id = 'kwc-noonnu-preview-style'; document.head.appendChild(ps); }
            ps.textContent = fd.cssContent;
            const pt = document.getElementById('kf-noonnu-preview-text');
            if (pt) pt.style.fontFamily = `'${fd.fontFamily}', sans-serif`;
            document.getElementById('kf-noonnu-preview').style.display = 'block';
            document.getElementById('kf-noonnu-error').style.display = 'none';
        } catch(_) {
            document.getElementById('kf-noonnu-preview').style.display = 'none';
        }
    });

    document.getElementById('kf-add-noonnu')?.addEventListener('click', async () => {
        const css = document.getElementById('kf-noonnu-css')?.value.trim();
        const name = document.getElementById('kf-noonnu-name')?.value.trim() || '';
        const errEl = document.getElementById('kf-noonnu-error');
        if (!css) { errEl.textContent = 'CSS 코드를 붙여넣어주세요.'; errEl.style.display = 'block'; return; }
        try {
            const fd = await parseNoonnuCSS(css, name);
            if (S().fonts.find(f => f.name === fd.name)) { errEl.textContent = `"${fd.name}" 이름이 이미 있습니다.`; errEl.style.display = 'block'; return; }
            S().fonts.push(fd);
            S().activeFont = fd.name;
            buildAndApply();
            saveSettingsDebounced();
            document.getElementById('kf-noonnu-css').value = '';
            document.getElementById('kf-noonnu-name').value = '';
            document.getElementById('kf-noonnu-preview').style.display = 'none';
            errEl.style.display = 'none';
            toast(`✅ "${fd.name}" 추가 및 적용됨!`);
        } catch(err) {
            errEl.textContent = '⚠️ ' + err.message;
            errEl.style.display = 'block';
        }
    });

    // Font size slider
    const slider = document.getElementById('kf-font-size');
    const sizeLabel = document.getElementById('kf-font-size-label');
    slider?.addEventListener('input', () => {
        S().fontSize = parseInt(slider.value);
        sizeLabel.textContent = slider.value + 'px';
        buildAndApply();
        saveSettingsDebounced();
    });
    document.getElementById('kf-reset-size')?.addEventListener('click', () => {
        S().fontSize = null;
        slider.value = 16; sizeLabel.textContent = '16px';
        buildAndApply();
        saveSettingsDebounced();
    });

    // Bold toggle
    const boldChk = document.getElementById('kf-bold-toggle');
    boldChk?.addEventListener('change', () => {
        S().bold = boldChk.checked;
        buildAndApply();
        saveSettingsDebounced();
        toast(boldChk.checked ? '볼드체 켜짐' : '볼드체 꺼짐', 'info');
    });

    // Reset all
    document.getElementById('kf-reset-font')?.addEventListener('click', () => {
        resetAll();
        slider.value = 16; sizeLabel.textContent = '16px';
        if (boldChk) boldChk.checked = false;
        renderFontList();
        toast('기본 폰트로 복원됨', 'info');
    });
}

function restoreState() {
    if (S().activeFont || S().fontSize || S().bold) buildAndApply();

    const slider = document.getElementById('kf-font-size');
    const sizeLabel = document.getElementById('kf-font-size-label');
    if (slider && S().fontSize) {
        slider.value = S().fontSize;
        sizeLabel.textContent = S().fontSize + 'px';
    }
    const boldChk = document.getElementById('kf-bold-toggle');
    if (boldChk) boldChk.checked = !!S().bold;
}

// ── Entry ──────────────────────────────────────────────────────────────────

jQuery(async () => {
    initSettings();

    const baseUrl = import.meta.url.replace('index.js', '');
    const html = await $.get(`${baseUrl}index.html`);

    // HTML already contains the full inline-drawer structure with chevron icon
    $('#extensions_settings2').append(html);

    bindEvents();
    restoreState();
});
