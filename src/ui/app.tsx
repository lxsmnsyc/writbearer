import { type JSX, onCleanup, onMount } from 'solid-js';
import Game from '../game/game';

export default function App(): JSX.Element {
  let canvas: HTMLCanvasElement | undefined;
  onMount(() => {
    if (!canvas) {
      return;
    }
    const game = new Game(canvas);
    game.start();
    onCleanup(() => {
      game.stop();
    });
  });
  return (
    <main class="grid h-full place-items-center bg-black">
      <canvas
        ref={(el) => {
          canvas = el;
        }}
        class="max-h-full max-w-full cursor-crosshair [image-rendering:pixelated]"
      />
    </main>
  );
}
