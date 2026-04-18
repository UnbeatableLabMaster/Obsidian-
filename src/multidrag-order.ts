export interface MultiDragCommitPhases {
    setSuspended: (value: boolean) => void;
    syncMovedCards?: () => Promise<void> | void;
    playInsertion?: () => Promise<void> | void;
    rewriteTargetOrder?: () => Promise<void> | void;
    rewriteSourceOrder?: () => Promise<void> | void;
    persistSettings?: () => Promise<void> | void;
}

export const MAX_MULTIDRAG_VISIBLE_LAYERS = 6;

export const getMultiDragPreviewIds = (orderedIds: string[]): string[] => {
    if (orderedIds.length <= MAX_MULTIDRAG_VISIBLE_LAYERS) return [...orderedIds];
    return orderedIds.slice(-MAX_MULTIDRAG_VISIBLE_LAYERS);
};

export const getMultiDragVisibleDepth = (visibleCount: number, index: number): number => {
    return Math.max(0, Math.min(MAX_MULTIDRAG_VISIBLE_LAYERS - 1, visibleCount - 1 - index));
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


