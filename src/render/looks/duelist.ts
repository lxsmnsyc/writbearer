import { plainLook } from './held';
import type { JobLook } from './types';

// Placeholder: a plain fighter with a dagger. The duelist node draws its
// own look.
const DUELIST_LOOK: JobLook = plainLook('dagger', false);

export default DUELIST_LOOK;
