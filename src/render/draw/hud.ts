import { areaOf } from '../../gen/layers';
import type { Stage } from '../../gen/stage';
import { C } from '../palette';
import type { Frame } from '../renderer';
import { H, SCALE, W } from './scene';

// How a run ends, as the last screen says it.
const ENDING: Record<'fallen' | 'sealed' | 'risen', [string, string]> = {
  fallen: ['The bearer has fallen.', 'The Writ lies where it fell, for the Guild to send again.'],
  sealed: ['The Creditor is sealed again.', 'The bearer dies with it. The run is cleared.'],
  risen: ['The Creditor rises.', 'Every merc is dead. The run is lost.'],
};

// What is drawn over the whole screen: a notice, the boss's bar and the
// end of a run.
export default function drawHud(out: CanvasRenderingContext2D, f: Frame): void {
  out.font = '600 17px Inter, system-ui, sans-serif';
  // A notice, such as who deserted, shows above the party for a while.
  if (f.notice) {
    out.textAlign = 'center';
    const y = H * SCALE - 132;
    const width = out.measureText(f.notice).width + 24;
    out.fillStyle = 'rgba(0,0,0,0.6)';
    out.fillRect((W * SCALE - width) / 2, y - 20, width, 28);
    out.fillStyle = C.gold;
    out.fillText(f.notice, (W * SCALE) / 2, y);
    out.textAlign = 'start';
  }
  if (f.boss?.alive && (f.boss.aware || f.stage.tomb)) {
    // The boss's name and health across the top, as Diablo 2 shows them.
    const w = 360;
    const x = (W * SCALE - w) / 2;
    out.textAlign = 'center';
    out.fillStyle = '#d6d0c4';
    out.fillText(f.boss.name, (W * SCALE) / 2, 92);
    out.textAlign = 'start';
    out.fillStyle = 'rgba(0,0,0,0.7)';
    out.fillRect(x, 100, w, 8);
    out.fillStyle = C.blood;
    out.fillRect(x + 1, 101, Math.round(((w - 2) * f.boss.hp) / f.boss.derived.maxHp), 6);
  }
  if (f.over) {
    const [title, line] = ENDING[f.ending ?? 'fallen'];
    out.fillStyle = 'rgba(0,0,0,0.6)';
    out.fillRect(0, 0, W * SCALE, H * SCALE);
    out.fillStyle = f.ending === 'sealed' ? C.gold : C.blood;
    out.font = '700 44px Cinzel, Georgia, serif';
    out.textAlign = 'center';
    out.fillText(title, (W * SCALE) / 2, (H * SCALE) / 2);
    out.font = '17px Inter, system-ui, sans-serif';
    out.fillStyle = '#c8c2b6';
    out.fillText(line, (W * SCALE) / 2, (H * SCALE) / 2 + 36);
    out.font = '16px ui-monospace, monospace';
    out.fillStyle = '#9a9a9a';
    out.fillText(
      `Seed ${f.seed} · ${f.region}, ${place(f.stage)} · Slain: ${f.slain}`,
      (W * SCALE) / 2,
      (H * SCALE) / 2 + 70,
    );
    out.fillText('Press R to draw another lot.', (W * SCALE) / 2, (H * SCALE) / 2 + 96);
    out.textAlign = 'start';
  }
}

// Where the party is, for the end of a run.
function place(stage: Stage): string {
  if (stage.kind === 'waystation') {
    return 'Waystation';
  }
  if (stage.kind === 'tomb') {
    return 'The Tomb';
  }
  if (stage.kind === 'guild') {
    return 'The Guild House';
  }
  const area = `Area ${areaOf(stage.index)}`;
  if (stage.kind === 'elite') {
    return `${area}, Elite`;
  }
  if (stage.kind === 'camp') {
    return `${area}, Camp`;
  }
  if (stage.kind === 'town') {
    return `${area}, Town`;
  }
  if (stage.kind === 'event') {
    return `${area}, Event`;
  }
  return area;
}
