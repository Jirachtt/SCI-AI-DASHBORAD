import { useEffect, useState } from 'react';
import {
    ensureSharedDashboardData,
    getSharedDashboardDatasetMetaSync,
    getSharedDashboardDatasetSync,
    onSharedDashboardDataChange,
} from '../services/sharedDashboardDataService';

export default function useDashboardDataset(id) {
    const [state, setState] = useState(() => ({
        data: getSharedDashboardDatasetSync(id),
        meta: getSharedDashboardDatasetMetaSync(id),
    }));

    useEffect(() => {
        let mounted = true;
        ensureSharedDashboardData([id]).then(() => {
            if (!mounted) return;
            setState({
                data: getSharedDashboardDatasetSync(id),
                meta: getSharedDashboardDatasetMetaSync(id),
            });
        });

        const unsubscribe = onSharedDashboardDataChange(event => {
            if (!mounted || event.id !== id) return;
            setState({ data: event.payload, meta: event.meta });
        });

        return () => {
            mounted = false;
            unsubscribe();
        };
    }, [id]);

    return state;
}
