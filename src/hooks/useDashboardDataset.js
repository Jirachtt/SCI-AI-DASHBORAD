import { useEffect, useState } from 'react';
import {
    ensureDashboardLiveData,
    getDashboardDatasetMetaSync,
    getDashboardDatasetSync,
    onDashboardLiveDataChange,
} from '../services/dashboardLiveDataService';

export default function useDashboardDataset(id) {
    const [state, setState] = useState(() => ({
        data: getDashboardDatasetSync(id),
        meta: getDashboardDatasetMetaSync(id),
    }));

    useEffect(() => {
        let mounted = true;
        ensureDashboardLiveData([id]).then(() => {
            if (!mounted) return;
            setState({
                data: getDashboardDatasetSync(id),
                meta: getDashboardDatasetMetaSync(id),
            });
        });

        const unsubscribe = onDashboardLiveDataChange(event => {
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
