// Stands in for every `~icons/...` import in tests, which run without the
// icons plugin. The simulation never draws an icon.
export default function icon(): null {
  return null;
}
