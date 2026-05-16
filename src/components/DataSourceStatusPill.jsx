import { useEffect, useMemo, useState } from 'react';
import { Database, ShieldAlert, ShieldCheck } from 'lucide-react';
import {
    ensureDataAccuracy,
    getDataAccuracySnapshot,
    onDataAccuracyChange,
} from '../services/dataAccuracyService';

function formatNumber(value) {
    return Number.isFinite(Number(value)) ? Number(value).toLocaleString('th-TH') : '-';
}

function pillTone(snapshot) {
    const rec = snapshot?.studentReconcile || {};
    if (rec.studentRosterWarning || rec.difference !== 0) return 'warning';
    if (snapshot?.score >= 90) return 'success';
    return 'info';
}

export default function DataSourceStatusPill() {
    const [snapshot, setSnapshot] = useState(() => getDataAccuracySnapshot());

    useEffect(() => {
        let mounted = true;
        ensureDataAccuracy()
            .then(next => { if (mounted) setSnapshot(next); })
            .catch(() => { if (mounted) setSnapshot(getDataAccuracySnapshot()); });
        const unsubscribe = onDataAccuracyChange(next => setSnapshot(next));
        return () => {
            mounted = false;
            unsubscribe();
        };
    }, []);

    const tone = pillTone(snapshot);
    const Icon = tone === 'success' ? ShieldCheck : tone === 'warning' ? ShieldAlert : Database;
    const title = useMemo(() => {
        const rec = snapshot.studentReconcile || {};
        return [
            `Data Accuracy ${formatNumber(snapshot.score)}%`,
            `Official ${formatNumber(rec.officialTotal)} / Roster ${formatNumber(rec.localTotal)}`,
            rec.studentRosterAccuracyLabel,
            rec.recommendation,
        ].filter(Boolean).join('\n');
    }, [snapshot]);

    return (
        <span className={`header-status-pill header-data-accuracy ${tone}`} title={title}>
            <Icon size={14} />
            <span>Data {formatNumber(snapshot.score)}%</span>
        </span>
    );
}
