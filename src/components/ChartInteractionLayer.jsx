import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Chart as ChartJS } from 'chart.js';
import {
    Check,
    Database,
    Download,
    EllipsisVertical,
    FileSpreadsheet,
    ImageDown,
    LoaderCircle,
    Maximize2,
    Minimize2,
    RefreshCw,
    Search,
    SlidersHorizontal,
    X,
} from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
    getDashboardDatasetMeta,
    refreshDashboardDatasetFromSource,
} from '../services/dashboardLiveDataService';
import { chartToRows, downloadCSV, exportWorkbook } from '../utils/exportUtils';

const PAGE_DATASETS = {
    '/dashboard': ['dashboard_summary', 'student_stats'],
    '/dashboard/tuition': ['tuition'],
    '/dashboard/student-stats': ['student_stats'],
    '/dashboard/tcas': ['tcas_admissions'],
    '/dashboard/course-analytics': ['course_analytics'],
    '/dashboard/budget': ['university_budget', 'science_budget'],
    '/dashboard/financial': ['financial', 'science_budget'],
    '/dashboard/graduation-stats': ['graduation'],
    '/dashboard/hr': ['hr'],
    '/dashboard/research': ['research'],
    '/dashboard/strategic': ['strategic'],
};

const KNOWN_CHART_SURFACES = [
    '.chart-card',
    '.ai-page-chart-container',
    '.chat-chart-container',
    '.chart-container',
].join(',');

function safeFileName(value = 'chart') {
    return String(value)
        .replace(/[\\/:*?"<>|]+/g, '-')
        .replace(/\s+/g, '_')
        .slice(0, 100) || 'chart';
}

function chartTitle(chart, surface) {
    const configuredTitle = chart?.options?.plugins?.title?.text;
    if (Array.isArray(configuredTitle) && configuredTitle.length) return configuredTitle.join(' ');
    if (configuredTitle) return String(configuredTitle);

    const heading = surface?.querySelector?.(
        '.chart-card-title, .data-table-title, h2, h3, h4, [data-chart-title]'
    );
    return heading?.textContent?.trim() || 'กราฟข้อมูล';
}

function findChartSurface(canvas) {
    // A chart is often rendered inside a `.chart-container` within its
    // `.chart-card`.  The action host belongs to the card, not the inner
    // plotting wrapper; otherwise More options appears beside the plot or
    // an inline KPI panel instead of at the card's top-right corner.
    const card = canvas.closest('.chart-card');
    if (card) return card;

    const known = canvas.closest(KNOWN_CHART_SURFACES);
    if (known && known !== canvas.parentElement) return known;

    const wrapper = canvas.parentElement;
    return wrapper?.parentElement || wrapper || canvas;
}

function ensureChartTooltip(chart, title) {
    if (!chart || chart.canvas?.dataset.analyticsEnhanced === 'true') return;
    try {
        chart.options.plugins ||= {};
        chart.options.plugins.tooltip ||= {};
        chart.options.plugins.tooltip.enabled = true;
        chart.options.plugins.tooltip.displayColors = true;
        chart.options.interaction = {
            ...(chart.options.interaction || {}),
            mode: chart.config?.type === 'pie' || chart.config?.type === 'doughnut' ? 'nearest' : 'index',
            intersect: false,
        };
        chart.canvas.dataset.analyticsEnhanced = 'true';
        chart.canvas.setAttribute('role', 'img');
        chart.canvas.setAttribute('aria-label', `${title} — เลื่อนตัวชี้เหนือกราฟเพื่อดูรายละเอียดข้อมูล`);
        chart.update('none');
    } catch (error) {
        console.warn('[ChartInteractionLayer] Tooltip enhancement skipped:', error?.message || error);
    }
}

function canvasWithBackground(canvas, format) {
    const output = document.createElement('canvas');
    const scale = Math.min(2, window.devicePixelRatio || 1);
    output.width = Math.max(1, Math.round(canvas.width * scale));
    output.height = Math.max(1, Math.round(canvas.height * scale));
    const context = output.getContext('2d');
    const cssBackground = getComputedStyle(document.documentElement)
        .getPropertyValue('--bg-card')
        .trim() || '#ffffff';

    context.fillStyle = format === 'jpeg' ? '#ffffff' : cssBackground;
    context.fillRect(0, 0, output.width, output.height);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(canvas, 0, 0, output.width, output.height);
    return output;
}

function triggerDataUrlDownload(dataUrl, fileName) {
    const anchor = document.createElement('a');
    anchor.href = dataUrl;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
}

function getChartRows(chart, title) {
    const hiddenLabels = new Set(
        (chart?.data?.datasets || [])
            .map((dataset, index) => chart.isDatasetVisible(index) ? null : (dataset.label || title))
            .filter(Boolean)
    );
    return chartToRows(chart, title).filter(row => !hiddenLabels.has(row.dataset));
}

function datasetIdsForPath(pathname) {
    if (pathname === '/dashboard') return PAGE_DATASETS['/dashboard'];
    return PAGE_DATASETS[pathname] || [];
}

function ChartDrilldownDialog({ chart, title, onClose, portalTarget }) {
    const [query, setQuery] = useState('');
    const [dataset, setDataset] = useState('all');
    const closeButtonRef = useRef(null);
    const rows = useMemo(() => getChartRows(chart, title), [chart, title]);
    const datasets = useMemo(
        () => Array.from(new Set(rows.map(row => row.dataset).filter(Boolean))),
        [rows]
    );
    const filteredRows = useMemo(() => {
        const needle = query.trim().toLocaleLowerCase('th-TH');
        return rows.filter(row => {
            if (dataset !== 'all' && row.dataset !== dataset) return false;
            if (!needle) return true;
            return Object.values(row).some(value =>
                String(value ?? '').toLocaleLowerCase('th-TH').includes(needle)
            );
        });
    }, [dataset, query, rows]);
    const columns = useMemo(
        () => Array.from(new Set(filteredRows.slice(0, 100).flatMap(row => Object.keys(row))))
            .filter(column => !['chart'].includes(column))
            .slice(0, 8),
        [filteredRows]
    );

    useEffect(() => {
        closeButtonRef.current?.focus();
        const handleKeyDown = event => {
            if (event.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    return createPortal(
        <div className="analytics-drill-overlay" role="presentation" onMouseDown={onClose}>
            <section
                className="analytics-drill-dialog"
                role="dialog"
                aria-modal="true"
                aria-labelledby="analytics-drill-title"
                onMouseDown={event => event.stopPropagation()}
            >
                <header className="analytics-drill-header">
                    <div>
                        <span className="analytics-drill-eyebrow"><Database size={14} /> DRILL DOWN</span>
                        <h2 id="analytics-drill-title">{title}</h2>
                        <p>ข้อมูล {filteredRows.length.toLocaleString('th-TH')} รายการจากกราฟปัจจุบัน</p>
                    </div>
                    <button
                        ref={closeButtonRef}
                        type="button"
                        className="analytics-icon-button"
                        onClick={onClose}
                        aria-label="ปิดหน้าต่างเจาะลึกข้อมูล"
                    >
                        <X size={19} />
                    </button>
                </header>

                <div className="analytics-drill-filters">
                    <label className="analytics-search-field">
                        <span>ค้นหาข้อมูล</span>
                        <div><Search size={16} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="ค้นหาป้ายกำกับหรือค่า..." /></div>
                    </label>
                    <label className="analytics-select-field">
                        <span>ชุดข้อมูล</span>
                        <select value={dataset} onChange={event => setDataset(event.target.value)}>
                            <option value="all">ทั้งหมด</option>
                            {datasets.map(item => <option value={item} key={item}>{item}</option>)}
                        </select>
                    </label>
                </div>

                <div className="analytics-drill-table-wrap">
                    {filteredRows.length === 0 ? (
                        <div className="analytics-drill-empty">ไม่พบข้อมูลที่ตรงกับตัวกรอง</div>
                    ) : (
                        <table className="analytics-drill-table">
                            <thead>
                                <tr>{columns.map(column => <th key={column}>{column}</th>)}</tr>
                            </thead>
                            <tbody>
                                {filteredRows.slice(0, 250).map((row, index) => (
                                    <tr key={`${row.dataset}-${row.label}-${index}`}>
                                        {columns.map(column => <td key={column}>{String(row[column] ?? '—')}</td>)}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
                {filteredRows.length > 250 && (
                    <p className="analytics-drill-limit">แสดง 250 รายการแรก — ใช้ช่องค้นหาเพื่อเจาะจงข้อมูล</p>
                )}
            </section>
        </div>,
        portalTarget
    );
}

function ChartActionPortal({ canvas, host, pathname, user }) {
    const [menuOpen, setMenuOpen] = useState(false);
    const [menuView, setMenuView] = useState('main');
    const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
    const [working, setWorking] = useState('');
    const [status, setStatus] = useState('');
    const [drillOpen, setDrillOpen] = useState(false);
    const [fullscreen, setFullscreen] = useState(false);
    const [hiddenDatasets, setHiddenDatasets] = useState([]);
    const [categoryLimit, setCategoryLimit] = useState('all');
    const buttonRef = useRef(null);
    const menuRef = useRef(null);
    const statusTimerRef = useRef(null);
    const originalDataRef = useRef(null);
    const chart = ChartJS.getChart(canvas);
    const surface = host.closest('.analytics-chart-surface') || host.parentElement;
    const title = chartTitle(chart, surface);
    const datasets = chart?.data?.datasets || [];

    const showStatus = useCallback(message => {
        setStatus(message);
        window.clearTimeout(statusTimerRef.current);
        statusTimerRef.current = window.setTimeout(() => setStatus(''), 4200);
    }, []);

    const closeMenu = useCallback(() => {
        setMenuOpen(false);
        setMenuView('main');
    }, []);

    useEffect(() => () => window.clearTimeout(statusTimerRef.current), []);

    useEffect(() => {
        const handleFullscreenChange = () => {
            setFullscreen(document.fullscreenElement === surface || surface?.classList.contains('analytics-fallback-fullscreen'));
            const liveChart = ChartJS.getChart(canvas);
            liveChart?.resize?.();
            liveChart?.update?.('none');
        };
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
    }, [canvas, surface]);

    useEffect(() => {
        if (!fullscreen || !surface?.classList.contains('analytics-fallback-fullscreen')) return undefined;
        const exitFallbackFullscreen = event => {
            if (event.key !== 'Escape') return;
            surface.classList.remove('analytics-fallback-fullscreen');
            document.documentElement.classList.remove('analytics-fallback-fullscreen-open');
            setFullscreen(false);
            window.setTimeout(() => ChartJS.getChart(canvas)?.resize?.(), 80);
        };
        window.addEventListener('keydown', exitFallbackFullscreen);
        return () => window.removeEventListener('keydown', exitFallbackFullscreen);
    }, [canvas, fullscreen, surface]);

    useEffect(() => () => {
        surface?.classList.remove('analytics-fallback-fullscreen');
        document.documentElement.classList.remove('analytics-fallback-fullscreen-open');
    }, [surface]);

    useEffect(() => {
        if (!menuOpen) return undefined;
        const handleDismiss = event => {
            if (buttonRef.current?.contains(event.target)) return;
            if (event.target.closest?.('.analytics-chart-menu')) return;
            closeMenu();
        };
        const handleViewportChange = () => closeMenu();
        const handleScroll = event => {
            if (event.target instanceof Element && event.target.closest('.analytics-chart-menu')) return;
            closeMenu();
        };
        document.addEventListener('pointerdown', handleDismiss);
        window.addEventListener('resize', handleViewportChange);
        window.addEventListener('scroll', handleScroll, true);
        return () => {
            document.removeEventListener('pointerdown', handleDismiss);
            window.removeEventListener('resize', handleViewportChange);
            window.removeEventListener('scroll', handleScroll, true);
        };
    }, [closeMenu, menuOpen]);

    useLayoutEffect(() => {
        if (!menuOpen || !menuRef.current) return;
        const rect = menuRef.current.getBoundingClientRect();
        const nextTop = Math.max(12, Math.min(menuPosition.top, window.innerHeight - rect.height - 12));
        const nextLeft = Math.max(12, Math.min(menuPosition.left, window.innerWidth - rect.width - 12));
        if (Math.abs(nextTop - menuPosition.top) > 1 || Math.abs(nextLeft - menuPosition.left) > 1) {
            setMenuPosition({ top: nextTop, left: nextLeft });
        }
    }, [menuOpen, menuPosition.left, menuPosition.top, menuView]);

    if (!chart || !surface) return null;

    const openMenu = () => {
        const rect = buttonRef.current?.getBoundingClientRect();
        if (rect) {
            const width = 268;
            setMenuPosition({
                top: Math.max(12, Math.min(rect.bottom + 8, window.innerHeight - 410)),
                left: Math.max(12, Math.min(rect.right - width, window.innerWidth - width - 12)),
            });
        }
        setMenuOpen(value => !value);
        setMenuView('main');
    };

    const runAction = async (key, action, successMessage) => {
        closeMenu();
        setWorking(key);
        try {
            await action();
            if (successMessage) showStatus(successMessage);
        } catch (error) {
            console.error(`[ChartInteractionLayer] ${key} failed:`, error);
            showStatus(error?.message || 'ไม่สามารถดำเนินการได้ กรุณาลองอีกครั้ง');
        } finally {
            setWorking('');
        }
    };

    const refreshChart = async force => {
        chart.stop?.();
        const ids = datasetIdsForPath(pathname);
        if (force && ids.length) {
            const results = await Promise.allSettled(ids.map(id =>
                refreshDashboardDatasetFromSource(id, {
                    uid: user?.uid,
                    who: user?.email || user?.uid,
                })
            ));
            const succeeded = results.filter(result => result.status === 'fulfilled').length;
            if (succeeded === 0) {
                await Promise.all(ids.map(id => getDashboardDatasetMeta(id)));
                throw new Error('เชื่อมต่อต้นทางไม่ได้ ขณะนี้ยังแสดงข้อมูลล่าสุดที่มีในระบบ');
            }
        } else if (ids.length) {
            await Promise.all(ids.map(id => getDashboardDatasetMeta(id)));
        }

        await new Promise(resolve => window.setTimeout(resolve, 80));
        const liveChart = ChartJS.getChart(canvas);
        liveChart?.resize?.();
        liveChart?.update?.(force ? undefined : 'none');
        if (categoryLimit === 'all' && hiddenDatasets.length === 0 && liveChart) {
            originalDataRef.current = {
                labels: [...(liveChart.data.labels || [])],
                data: liveChart.data.datasets.map(dataset => [...(dataset.data || [])]),
            };
        }
        window.dispatchEvent(new CustomEvent('sci-dashboard-chart-refreshed', {
            detail: { force, pathname, datasetIds: ids },
        }));
    };

    const downloadImage = format => {
        const output = canvasWithBackground(canvas, format);
        const mime = format === 'jpeg' ? 'image/jpeg' : 'image/png';
        const dataUrl = output.toDataURL(mime, format === 'jpeg' ? 0.94 : undefined);
        triggerDataUrlDownload(dataUrl, `${safeFileName(title)}.${format === 'jpeg' ? 'jpg' : 'png'}`);
    };

    const exportExcel = async () => {
        const imageDataUrl = canvasWithBackground(canvas, 'png').toDataURL('image/png');
        await exportWorkbook(safeFileName(title), {}, [{
            name: title,
            rows: getChartRows(chart, title),
            imageDataUrl,
        }]);
    };

    const toggleFullscreen = async () => {
        closeMenu();
        if (document.fullscreenElement === surface) {
            await document.exitFullscreen();
            return;
        }
        if (surface.classList.contains('analytics-fallback-fullscreen')) {
            surface.classList.remove('analytics-fallback-fullscreen');
            document.documentElement.classList.remove('analytics-fallback-fullscreen-open');
            setFullscreen(false);
            window.setTimeout(() => ChartJS.getChart(canvas)?.resize?.(), 80);
            return;
        }
        if (surface.requestFullscreen) {
            try {
                await surface.requestFullscreen();
                await new Promise(resolve => requestAnimationFrame(resolve));
                if (document.fullscreenElement !== surface) {
                    throw new Error('Native fullscreen was not activated');
                }
            } catch {
                surface.classList.add('analytics-fallback-fullscreen');
                document.documentElement.classList.add('analytics-fallback-fullscreen-open');
                setFullscreen(true);
            }
        } else {
            surface.classList.add('analytics-fallback-fullscreen');
            document.documentElement.classList.add('analytics-fallback-fullscreen-open');
            setFullscreen(true);
        }
        window.setTimeout(() => {
            chart.resize?.();
            chart.update?.('none');
        }, 100);
    };

    const captureOriginalData = () => {
        if (!originalDataRef.current || categoryLimit === 'all') {
            originalDataRef.current = {
                labels: [...(chart.data.labels || [])],
                data: chart.data.datasets.map(dataset => [...(dataset.data || [])]),
            };
        }
    };

    const applyCategoryLimit = value => {
        const liveChart = ChartJS.getChart(canvas);
        if (!liveChart) return;
        captureOriginalData();
        const original = originalDataRef.current;
        const count = value === 'all' ? original.labels.length : Number(value);
        liveChart.data.labels = original.labels.slice(0, count);
        liveChart.data.datasets.forEach((dataset, index) => {
            dataset.data = (original.data[index] || []).slice(0, count);
        });
        setCategoryLimit(value);
        liveChart.update();
    };

    const toggleDataset = index => {
        const liveChart = ChartJS.getChart(canvas);
        if (!liveChart) return;
        const nextVisible = !liveChart.isDatasetVisible(index);
        liveChart.setDatasetVisibility(index, nextVisible);
        setHiddenDatasets(current => nextVisible
            ? current.filter(item => item !== index)
            : [...current, index]
        );
        liveChart.update();
    };

    const resetFilters = () => {
        const liveChart = ChartJS.getChart(canvas);
        if (!liveChart) return;
        if (originalDataRef.current) {
            liveChart.data.labels = [...originalDataRef.current.labels];
            liveChart.data.datasets.forEach((dataset, index) => {
                dataset.data = [...(originalDataRef.current.data[index] || [])];
                liveChart.setDatasetVisibility(index, true);
            });
        } else {
            liveChart.data.datasets.forEach((_, index) => liveChart.setDatasetVisibility(index, true));
        }
        setCategoryLimit('all');
        setHiddenDatasets([]);
        liveChart.update();
        showStatus('ล้างตัวกรองแล้ว');
    };

    const openDrilldown = () => {
        closeMenu();
        setDrillOpen(true);
    };

    const menuPortalTarget = document.fullscreenElement || document.body;
    const toolbar = createPortal(
        <button
            ref={buttonRef}
            type="button"
            className={`analytics-more-button ${menuOpen ? 'active' : ''}`}
            onClick={openMenu}
            aria-label={`ตัวเลือกเพิ่มเติมสำหรับ ${title}`}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            data-tooltip="More options"
        >
            {working ? <LoaderCircle className="analytics-spin" size={18} /> : <EllipsisVertical size={19} />}
        </button>,
        host
    );

    const menu = menuOpen ? createPortal(
        <div
            ref={menuRef}
            className="analytics-chart-menu"
            style={{ top: menuPosition.top, left: menuPosition.left }}
            role="menu"
            aria-label={`เมนูกราฟ ${title}`}
        >
            <div className="analytics-menu-heading">
                <span>{menuView === 'filters' ? 'ตัวกรองกราฟ' : 'More options'}</span>
                <small>{title}</small>
            </div>
            {menuView === 'filters' ? (
                <div className="analytics-filter-panel">
                    <div className="analytics-filter-label">จำนวนหมวดหมู่ที่แสดง</div>
                    <div className="analytics-filter-segments">
                        {['all', '5', '10', '20'].map(value => (
                            <button
                                type="button"
                                className={categoryLimit === value ? 'active' : ''}
                                onClick={() => applyCategoryLimit(value)}
                                key={value}
                            >
                                {value === 'all' ? 'ทั้งหมด' : value}
                            </button>
                        ))}
                    </div>
                    {datasets.length > 1 && (
                        <>
                            <div className="analytics-filter-label">ชุดข้อมูล</div>
                            <div className="analytics-dataset-filter-list">
                                {datasets.map((item, index) => {
                                    const visible = !hiddenDatasets.includes(index);
                                    return (
                                        <button type="button" onClick={() => toggleDataset(index)} key={`${item.label}-${index}`}>
                                            <span className={`analytics-filter-check ${visible ? 'checked' : ''}`}>
                                                {visible && <Check size={13} />}
                                            </span>
                                            <span>{item.label || `ชุดข้อมูล ${index + 1}`}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </>
                    )}
                    <div className="analytics-filter-actions">
                        <button type="button" onClick={resetFilters}>ล้างตัวกรอง</button>
                        <button type="button" className="primary" onClick={closeMenu}>เสร็จสิ้น</button>
                    </div>
                </div>
            ) : (
                <>
                    <button role="menuitem" type="button" onClick={() => runAction('refresh', () => refreshChart(false), 'อัปเดตกราฟด้วยข้อมูลล่าสุดแล้ว')}>
                        <RefreshCw size={17} /><span><b>Refresh data</b><small>อัปเดตจาก dataset ล่าสุด</small></span>
                    </button>
                    <button role="menuitem" type="button" onClick={() => runAction('force-refresh', () => refreshChart(true), 'Force refresh จากต้นทางสำเร็จ')}>
                        <RefreshCw size={17} /><span><b>Force refresh</b><small>ดึงข้อมูลใหม่จากแหล่งต้นทาง</small></span>
                    </button>
                    <button role="menuitem" type="button" onClick={toggleFullscreen}>
                        {fullscreen ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
                        <span><b>{fullscreen ? 'ออกจาก Fullscreen' : 'Fullscreen mode'}</b><small>ขยายกราฟเต็มหน้าจอ</small></span>
                    </button>
                    <div className="analytics-menu-divider" />
                    <button role="menuitem" type="button" onClick={() => setMenuView('filters')}>
                        <SlidersHorizontal size={17} /><span><b>Filter data</b><small>กรองหมวดหมู่และชุดข้อมูล</small></span>
                    </button>
                    <button role="menuitem" type="button" onClick={openDrilldown}>
                        <Database size={17} /><span><b>Drill down</b><small>ดูรายละเอียดระดับรายการ</small></span>
                    </button>
                    <div className="analytics-menu-divider" />
                    <button role="menuitem" type="button" onClick={() => runAction('csv', () => downloadCSV(title, getChartRows(chart, title)), 'ดาวน์โหลด CSV แล้ว')}>
                        <Download size={17} /><span><b>Download CSV</b><small>ข้อมูลที่กำลังแสดงในกราฟ</small></span>
                    </button>
                    <button role="menuitem" type="button" onClick={() => runAction('excel', exportExcel, 'Export Excel แล้ว')}>
                        <FileSpreadsheet size={17} /><span><b>Export Excel</b><small>ข้อมูลพร้อมรูปกราฟใน workbook</small></span>
                    </button>
                    <div className="analytics-menu-subheading">Download chart image</div>
                    <div className="analytics-image-actions">
                        <button type="button" onClick={() => runAction('png', () => downloadImage('png'), 'ดาวน์โหลด PNG แล้ว')}><ImageDown size={16} /> PNG</button>
                        <button type="button" onClick={() => runAction('jpeg', () => downloadImage('jpeg'), 'ดาวน์โหลด JPEG แล้ว')}><ImageDown size={16} /> JPEG</button>
                    </div>
                </>
            )}
        </div>,
        menuPortalTarget
    ) : null;

    const statusToast = status ? createPortal(
        <div className="analytics-action-toast" role="status" aria-live="polite">
            <Check size={16} /> {status}
        </div>,
        menuPortalTarget
    ) : null;

    return (
        <>
            {toolbar}
            {menu}
            {statusToast}
            {drillOpen && (
                <ChartDrilldownDialog
                    chart={chart}
                    title={title}
                    onClose={() => setDrillOpen(false)}
                    portalTarget={menuPortalTarget}
                />
            )}
        </>
    );
}

export default function ChartInteractionLayer() {
    const location = useLocation();
    const { user } = useAuth();
    const [entries, setEntries] = useState([]);
    const ownedHostsRef = useRef(new Set());

    useEffect(() => {
        let frame = null;
        const ownedHosts = ownedHostsRef.current;
        const scan = () => {
            frame = null;
            const nextEntries = [];
            document.querySelectorAll('canvas').forEach(canvas => {
                const chart = ChartJS.getChart(canvas);
                if (!chart) return;

                const surface = findChartSurface(canvas);
                if (!surface) return;
                surface.classList.add('analytics-chart-surface');

                let host = Array.from(surface.children).find(child =>
                    child.classList?.contains('analytics-chart-actions-host') && child.dataset.canvasId === canvas.id
                );
                if (!canvas.id) canvas.id = `analytics-chart-${Math.random().toString(36).slice(2, 10)}`;
                if (!host) {
                    host = document.createElement('div');
                    host.className = 'analytics-chart-actions-host no-print';
                    host.dataset.canvasId = canvas.id;
                    surface.appendChild(host);
                    ownedHosts.add(host);
                }
                const title = chartTitle(chart, surface);
                ensureChartTooltip(chart, title);
                nextEntries.push({ canvas, host, id: canvas.id });
            });

            setEntries(current => {
                const currentKey = current.map(item => `${item.id}:${item.host.isConnected}`).join('|');
                const nextKey = nextEntries.map(item => `${item.id}:${item.host.isConnected}`).join('|');
                return currentKey === nextKey ? current : nextEntries;
            });
        };
        const scheduleScan = () => {
            if (!frame) frame = requestAnimationFrame(scan);
        };

        scheduleScan();
        const timers = [120, 420, 900].map(delay => window.setTimeout(scheduleScan, delay));
        const interval = window.setInterval(scheduleScan, 1600);
        const observer = new MutationObserver(scheduleScan);
        observer.observe(document.body, { childList: true, subtree: true });

        return () => {
            observer.disconnect();
            if (frame) cancelAnimationFrame(frame);
            timers.forEach(timer => window.clearTimeout(timer));
            window.clearInterval(interval);
            ownedHosts.forEach(host => host.remove());
            ownedHosts.clear();
        };
    }, [location.pathname]);

    return entries.map(entry => (
        <ChartActionPortal
            key={entry.id}
            canvas={entry.canvas}
            host={entry.host}
            pathname={location.pathname}
            user={user}
        />
    ));
}
