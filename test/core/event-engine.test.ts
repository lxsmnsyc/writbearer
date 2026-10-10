import { describe, expect, it } from 'vitest';
import { type BaseEvent, EventPriority } from '../../src/core/event-emitter';
import { EventEngine, type EventMap } from '../../src/core/event-engine';
import { MergedLifecycle } from '../../src/core/lifecycle';

interface ValueEvent extends BaseEvent {
  value: number;
}

interface TestMap extends EventMap {
  value: [ValueEvent, EventPriority];
}

const event = (value = 0): ValueEvent => ({ id: 'test', disabled: false, value });

describe('EventEngine', () => {
  it('runs listeners before, at and after the mechanic, in that order', () => {
    const engine = new EventEngine<TestMap>();
    const order: string[] = [];
    engine.on('value', EventPriority.Post, () => {
      order.push('post');
    });
    engine.on('value', EventPriority.Exact, () => {
      order.push('exact');
    });
    engine.on('value', EventPriority.Pre, () => {
      order.push('pre');
    });
    engine.emit('value', event());
    expect(order).toEqual(['pre', 'exact', 'post']);
  });

  it('lets listeners change the event for the ones after them', () => {
    const engine = new EventEngine<TestMap>();
    engine.on('value', EventPriority.Pre, (e) => {
      e.value += 10;
    });
    engine.on('value', EventPriority.Exact, (e) => {
      e.value *= 2;
    });
    const e = event(1);
    engine.emit('value', e);
    expect(e.value).toBe(22);
  });

  it('skips the remaining listeners once an event is disabled', () => {
    const engine = new EventEngine<TestMap>();
    let reached = false;
    engine.on('value', EventPriority.Pre, (e) => {
      e.disabled = true;
    });
    engine.on('value', EventPriority.Exact, () => {
      reached = true;
    });
    engine.emit('value', event());
    expect(reached).toBe(false);
  });

  it('switches listeners off and on through their lifecycle', () => {
    const engine = new EventEngine<TestMap>();
    let count = 0;
    const lifecycle = new MergedLifecycle([
      engine.on('value', EventPriority.Exact, () => {
        count++;
      }),
      engine.on('value', EventPriority.Post, () => {
        count++;
      }),
    ]);
    lifecycle.stop();
    engine.emit('value', event());
    expect(count).toBe(0);
    lifecycle.start();
    engine.emit('value', event());
    expect(count).toBe(2);
  });

  it('makes a listener added during an emit wait for the next emit', () => {
    const engine = new EventEngine<TestMap>();
    let late = 0;
    engine.on('value', EventPriority.Pre, () => {
      engine.on('value', EventPriority.Post, () => {
        late++;
      });
    });
    engine.emit('value', event());
    expect(late).toBe(0);
  });
});
