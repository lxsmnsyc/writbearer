import { plainLook } from './held';
import type { JobLook } from './types';

// Placeholder: a plain fighter with a mace and a shield. The warden node
// draws its own look.
const WARDEN_LOOK: JobLook = plainLook('mace', true);

export default WARDEN_LOOK;
