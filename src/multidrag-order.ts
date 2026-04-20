export interface MultiDragCommitPhases {
    setSuspended: (value: boolean) => void;
    syncMovedCards?: () => Promise<void> | void;
    playInsertion?: () => Promise<void> | void;
    rewriteTargetOrder?: () => Promise<void> | void;
    rewriteSourceOrder?: () => Promise<void> | void;
    persistSettings?: () => Promise<void> | void;
}

export type MultiDragPhase = 'extracting' | 'dragging' | 'inserting';

export const MAX_MULTIDRAG_VISIBLE_LAYERS = 5;

export const MULTIDRAG_EXTRACTION_STEP_MS = 140;

export const getMultiDragPreviewIds = (orderedIds: string[]): string[] => {
    if (orderedIds.length <= MAX_MULTIDRAG_VISIBLE_LAYERS) return [...orderedIds];
    return orderedIds.slice(-MAX_MULTIDRAG_VISIBLE_LAYERS);
};

export const getMultiDragAnchoredPreviewIds = (orderedIds: string[], draggedId: string): string[] => {
    if (!draggedId || !orderedIds.includes(draggedId)) return getMultiDragPreviewIds(orderedIds);
    const trailingIds = orderedIds.filter((id) => id !== draggedId);
    const visibleTrailingIds = trailingIds.slice(-(MAX_MULTIDRAG_VISIBLE_LAYERS - 1));
    return [...visibleTrailingIds, draggedId];
};

export const getMultiDragExtractionPreviewIds = (orderedIds: string[], revealedCount: number, draggedId?: string): string[] => {
    if (!draggedId) {
        if (revealedCount <= 0) return [];
        return getMultiDragPreviewIds(orderedIds.slice(0, revealedCount));
    }
    const trailingIds = orderedIds.filter((id) => id !== draggedId);
    if (revealedCount <= 0) return [draggedId];
    return getMultiDragAnchoredPreviewIds(trailingIds.slice(0, revealedCount).concat(draggedId), draggedId);
};

export const getMultiDragVisibleDepth = (visibleCount: number, index: number): number => {
    return Math.max(0, Math.min(MAX_MULTIDRAG_VISIBLE_LAYERS - 1, visibleCount - 1 - index));
};

export const getMultiDragLayerMotionProfile = (visibleCount: number, index: number) => {
    const depth = getMultiDragVisibleDepth(visibleCount, index);
    return {
        depth,
        offsetY: depth * 16,
        scale: 1 - depth * 0.03,
        opacity: Math.max(0.18, 1 - depth * 0.17),
    };
};

export const getMultiDragExtractionLayerMotionProfile = (visibleCount: number, index: number) => {
    const depth = getMultiDragVisibleDepth(visibleCount, index);
    return {
        depth,
        offsetY: depth * 12,
        scale: 1 - depth * 0.025,
        opacity: Math.max(0.4, 1 - depth * 0.15),
    };
};

export const getMultiDragFlightDurationMs = (visibleCount: number, index: number): number => {
    const depth = getMultiDragVisibleDepth(visibleCount, index);
    return 360 + depth * 80;
};

export const getMultiDragPhaseVisibility = (phase: MultiDragPhase) => {
    if (phase === 'extracting') {
        return {
            fallbackVisible: true,
            sourceCardsHidden: false,
            slotCardsDimmed: false,
        };
    }
    if (phase === 'inserting') {
        return {
            fallbackVisible: true,
            sourceCardsHidden: false,
            slotCardsDimmed: true,
        };
    }
    return {
        fallbackVisible: true,
        sourceCardsHidden: true,
        slotCardsDimmed: false,
    };
};

export const sanitizeMultiDragCloneClassNames = (classNames: string[]): string[] => {
    const transientClassNames = new Set([
        'is-selected',
        'is-multidrag-source',
        'is-multidrag-slot',
        'is-multidrag-slot-preview',
    ]);
    return classNames.filter((className) => !transientClassNames.has(className));
};

export const applyMultiDragFinalOrderToIds = (
    currentIds: string[],
    orderedIds: string[],
    draggedId: string,
): string[] => {
    const activeIdSet = new Set(orderedIds);
    const rawIndex = currentIds.indexOf(draggedId);
    const baseCards = currentIds.filter((id) => !activeIdSet.has(id));

    if (rawIndex === -1) {
        return [...baseCards, ...orderedIds];
    }

    const selectedBeforeDragged = currentIds
        .slice(0, rawIndex)
        .filter((id) => activeIdSet.has(id)).length;
    const insertIndex = Math.max(0, Math.min(rawIndex - selectedBeforeDragged, baseCards.length));
    const finalIds = [...baseCards];
    finalIds.splice(insertIndex, 0, ...orderedIds);
    return finalIds;
};

export const runMultiDragCommitPhases = async ({
    setSuspended,
    syncMovedCards,
    playInsertion,
    rewriteTargetOrder,
    rewriteSourceOrder,
    persistSettings,
}: MultiDragCommitPhases): Promise<void> => {
    setSuspended(true);
    try {
        await syncMovedCards?.();
        await playInsertion?.();
        await rewriteTargetOrder?.();
        await rewriteSourceOrder?.();
        await persistSettings?.();
    } finally {
        setSuspended(false);
    }
};


