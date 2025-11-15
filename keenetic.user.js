// ==UserScript==
// @name         Keenetic DSL Stats Logger
// @namespace    https://github.com/mortyobnoxious/keenetic-dsl-stats
// @version      3.4
// @description  Fetches, parses, and injects raw DSL driver stats and a reset button into the dashboard and diagnostics pages with auto-refresh.
// @author       Morty
// @match        http://192.168.1.1/*
// @grant        GM_addStyle
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';
    const extractionDefinitions = [
        { key: 'uptime', regex: /Uptime:\s+(.+)/, type: 'single' },
        { key: 'fecErrors', regex: /FEC errors fast:\s+([\d\.]+)\s+([\d\.]+)/, type: 'dual' },
        { key: 'crcErrors', regex: /CRC errors fast:\s+([\d\.]+)\s+([\d\.]+)/, type: 'dual' },
    ];

    function extractStats(text, definitions) {
        const stats = {};
        for (const def of definitions) {
            const match = def.regex.exec(text);
            if (match) {
                if (def.type === 'single') stats[def.key] = match[1].trim();
                else if (def.type === 'dual') stats[def.key] = { ds: parseFloat(match[1]), us: parseFloat(match[2]) };
            }
        }
        return stats;
    }

    GM_addStyle(".tm-custom-button{background-color:transparent;border:1px solid #555;color:#ccc;padding:6px 12px;border-radius:4px;cursor:pointer;font-size:14px;font-family:inherit;transition:all .2s ease}.tm-custom-button:hover{background-color:#444;border-color:#777;color:#fff}.tm-custom-button:disabled{opacity:.5;cursor:not-allowed;background-color:#222}");

    async function sendCliCommand(command) {
        try {
            const response = await fetch('http://192.168.1.1/rci/', {
                method: 'POST',
                headers: { 'Referrer': 'http://192.168.1.1/webcli/parse', 'Accept': 'application/json, text/plain, */*', 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify([{ "parse": command }])
            });
            if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
            if (response.redirected) throw new Error('Request redirected to login page.');
            return await response.json();
        } catch (error) {
            console.error(`Keenetic DSL Stats Script: Error sending command "${command}":`, error);
        }
    }

    async function fetchAndParseStats() {
        const data = await sendCliCommand('more proc:/driver/ensoc_dsl/dsl_stats');
        try {
            if (data && data[0]?.parse?.message) {
                return extractStats(data[0].parse.message.join('\n'), extractionDefinitions);
            }
        } catch (error) {
            console.error('Keenetic DSL Stats Script: Error parsing stats:', error);
        }
        return null;
    }

    async function resetDslInterface(button) {
        const span = button.querySelector('span');
        button.disabled = true;
        span.textContent = 'Sending DOWN...';
        await sendCliCommand('interface Dsl0 down');
        span.textContent = 'Waiting 1s...';
        await new Promise(resolve => setTimeout(resolve, 1000));
        span.textContent = 'Sending UP...';
        await sendCliCommand('interface Dsl0 up');
        span.textContent = 'Reset DSL';
        button.disabled = false;
    }

    function updateOrCreateRow(id, container, ng, config, label, valueHtml) {
        let row = document.getElementById(id);
        if (!row) {
            row = document.createElement(config.rowType);
            row.id = id;
            row.className = config.rowClass;
            container.appendChild(row);
        }
        row.setAttribute(ng, '');
        if (config.rowType === 'tr') {
            row.innerHTML = `<td class="${config.labelClass}" ${ng}>${label}</td><td class="${config.valueClass}" ${ng}>${valueHtml}</td>`;
        } else {
            row.innerHTML = `<span class="${config.labelClass}" ${ng}>${label}</span>${valueHtml.startsWith('<div') ? valueHtml : `<span class="${config.valueClass}" ${ng}>${valueHtml}</span>`}`;
        }
    }

    function createOrUpdateButton(container, ng, config) {
        if (document.getElementById('tm-reset-dsl-row')) return;
        const row = document.createElement(config.rowType);
        row.id = 'tm-reset-dsl-row';
        row.className = config.rowClass;
        row.setAttribute(ng, '');
        row.innerHTML = (config.rowType === 'tr')
            ? `<td class="${config.labelClass}" ${ng}>Actions</td><td class="${config.valueClass}" ${ng}>${config.btnHtml}</td>`
            : `<span class="${config.labelClass}" ${ng}>Actions</span><span class="${config.valueClass}" ${ng}>${config.btnHtml}</span>`;
        container.appendChild(row);
        document.getElementById('tm-reset-dsl-btn').addEventListener('click', (e) => resetDslInterface(e.currentTarget));
    }

    async function runUpdate(config) {
        const el = document.querySelector(config.containerSelector);
        if (!el) return false;
        const container = config.findParent(el);
        if (!container) return false;
        const ng = Array.from(container.attributes).find(attr => attr.name.startsWith('_ngcontent'))?.name;
        if (!ng) return false;
        const stats = await fetchAndParseStats();
        if (!stats) return false;

        if (config.showUptime && stats.uptime) {
            updateOrCreateRow('tm-uptime', container, ng, config, 'Uptime', config.singleTmpl(stats.uptime, ng));
        }
        if (stats.crcErrors) {
            updateOrCreateRow('tm-crc-errors', container, ng, config, 'CRC errors (fast)', config.dualTmpl(stats.crcErrors.ds, stats.crcErrors.us, ng));
        }
        if (stats.fecErrors) {
            updateOrCreateRow('tm-fec-errors', container, ng, config, 'FEC errors (fast)', config.dualTmpl(stats.fecErrors.ds, stats.fecErrors.us, ng));
        }
        createOrUpdateButton(container, ng, config);
        return true;
    }

    const pageConfigs = {
        'dsl': {
            containerSelector: 'ndw-block-header[heading="diagnostics.dsl.header"]',
            findParent: (el) => el.parentElement,
            rowType: 'div',
            rowClass: 'dsl-info__row ng-star-inserted',
            labelClass: 'dsl-info__label',
            valueClass: 'dsl-info__value',
            singleTmpl: (val, ng) => `${val}`,
            dualTmpl: (ds, us, ng) => `<div class="dsl-info__container" ${ng}><span class="dsl-info__wrapper ng-star-inserted" ${ng}><ndw-svg-icon class="dsl-info__icon svg-icon-xs" ${ng}><svg class="ndw-svg-icon svg-arrow-down-dims ng-star-inserted" ${ng}><use href="./assets/sprite/sprite.svg#arrow-down"></use></svg></ndw-svg-icon><span class="dsl-info__value" ${ng}>${ds}</span></span><span class="dsl-info__wrapper ng-star-inserted" ${ng}><ndw-svg-icon class="dsl-info__icon svg-icon-xs" ${ng}><svg class="ndw-svg-icon svg-arrow-up-dims ng-star-inserted" ${ng}><use href="./assets/sprite/sprite.svg#arrow-up"></use></svg></ndw-svg-icon><span class="dsl-info__value" ${ng}>${us}</span></span></div>`,
            btnHtml: `<button id="tm-reset-dsl-btn" class="tm-custom-button"><span>Reset DSL</span></button>`,
            showUptime: true
        },
        'dashboard': {
            containerSelector: '.wan-connection-data__additional-info table',
            findParent: (el) => el,
            rowType: 'tr',
            rowClass: 'wan-info-property',
            labelClass: 'wan-info-property__label',
            valueClass: 'wan-info-property__value wan-info-value',
            singleTmpl: (val, ng) => `<span ${ng}>${val}</span>`,
            dualTmpl: (ds, us, ng) => `<span ${ng}>${ds}</span>&nbsp;/&nbsp;<span ${ng}>${us}</span>`,
            btnHtml: `<button id="tm-reset-dsl-btn" class="tm-custom-button"><span>Reset DSL</span></button>`,
            showUptime: false
        }
    };

    let currentPage = null;
    let statsIntervalId = null;

    setInterval(async () => {
        const href = window.location.href;
        let newPage = null;
        if (href.endsWith('/diagnostics/dsl')) newPage = 'dsl';
        else if (href.endsWith('/dashboard')) newPage = 'dashboard';

        if (newPage !== currentPage) {
            if (statsIntervalId) clearInterval(statsIntervalId);
            statsIntervalId = null;
        }
        if (newPage && !statsIntervalId) {
            const success = await runUpdate(pageConfigs[newPage]);
            if (success) {
                statsIntervalId = setInterval(() => runUpdate(pageConfigs[newPage]), 5000);
            }
        }
        currentPage = newPage;
    }, 500);
})();
