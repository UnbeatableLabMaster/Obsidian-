import test from 'node:test';
import assert from 'node:assert/strict';
import * as multiDragOrder from './src/multidrag-order.ts';

const {
  applyMultiDragFinalOrderToIds,
  getMultiDragPreviewIds,
  getMultiDragVisibleDepth,
  runMultiDragCommitPhases,
} = multiDragOrder;

test('same-column leading selection keeps its original anchor when dragged card is not batch head', () => {
  const finalIds = applyMultiDragFinalOrderToIds(['A', 'B', 'X', 'C', 'D'], ['A', 'B'], 'B');
  assert.deepEqual(finalIds, ['A', 'B', 'X', 'C', 'D']);
});

test('same-column move inserts the full batch using dragged position among non-selected cards', () => {
  const finalIds = applyMultiDragFinalOrderToIds(['A', 'X', 'B', 'C', 'D'], ['A', 'B'], 'B');
  assert.deepEqual(finalIds, ['X', 'A', 'B', 'C', 'D']);
});

test('cross-column move inserts the ordered batch at the drop position', () => {
  const finalIds = applyMultiDragFinalOrderToIds(['X', 'B', 'C', 'D'], ['A', 'B'], 'B');
  assert.deepEqual(finalIds, ['X', 'A', 'B', 'C', 'D']);
});

test('preview keeps batch order when dragged card is in the middle', () => {
  assert.deepEqual(getMultiDragPreviewIds(['A', 'B', 'C']), ['A', 'B', 'C']);
});

test('preview keeps batch order when dragged card is the first card', () => {
  assert.deepEqual(getMultiDragPreviewIds(['A', 'B']), ['A', 'B']);
});

test('preview keeps the last six cards in batch order', () => {
  assert.deepEqual(
    getMultiDragPreviewIds(['A', 'B', 'C', 'D', 'E', 'F', 'G']),
    ['B', 'C', 'D', 'E', 'F', 'G'],
  );
});

test('visible depth caps at six layers and fades deeper cards progressively', () => {
  assert.equal(getMultiDragVisibleDepth(6, 0), 5);
  assert.equal(getMultiDragVisibleDepth(6, 1), 4);
  assert.equal(getMultiDragVisibleDepth(6, 2), 3);
  assert.equal(getMultiDragVisibleDepth(6, 3), 2);
  assert.equal(getMultiDragVisibleDepth(6, 4), 1);
  assert.equal(getMultiDragVisibleDepth(6, 5), 0);
  assert.equal(getMultiDragVisibleDepth(10, 0), 5);
  assert.equal(getMultiDragVisibleDepth(10, 9), 0);
});

test('multi-drag commit suspends rerender before any writes and releases after commit', async () => {
  assert.equal(typeof runMultiDragCommitPhases, 'function');

  const events: string[] = [];
  let suspended = false;

  await runMultiDragCommitPhases({
    setSuspended(value) {
      suspended = value;
      events.push(`suspend:${value}`);
    },
    syncMovedCards: async () => {
      events.push(`sync:${suspended}`);
    },
    playInsertion: async () => {
      events.push(`animate:${suspended}`);
    },
    rewriteTargetOrder: async () => {
      events.push(`target:${suspended}`);
    },
    rewriteSourceOrder: async () => {
      events.push(`source:${suspended}`);
    },
    persistSettings: async () => {
      events.push(`save:${suspended}`);
    },
  });

  assert.deepEqual(events, [
    'suspend:true',
    'sync:true',
    'animate:true',
    'target:true',
    'source:true',
    'save:true',
    'suspend:false',
  ]);
});

test('multi-drag commit always releases rerender suspension after failure', async () => {
  assert.equal(typeof runMultiDragCommitPhases, 'function');

  const events: string[] = [];
  let suspended = false;

  await assert.rejects(
    runMultiDragCommitPhases({
      setSuspended(value) {
        suspended = value;
        events.push(`suspend:${value}`);
      },
      syncMovedCards: async () => {
        events.push(`sync:${suspended}`);
        throw new Error('sync failed');
      },
      playInsertion: async () => {
        events.push(`animate:${suspended}`);
      },
      rewriteTargetOrder: async () => {
        events.push(`target:${suspended}`);
      },
    }),
    /sync failed/,
  );

  assert.deepEqual(events, [
    'suspend:true',
    'sync:true',
    'suspend:false',
  ]);
});
