import { EventPriority } from '../../core/event-emitter';
import { SimEvents } from '../events';
import type Sim from '../sim';

/**
 * Skills, from rAthena: mana is spent and the cooldown starts when the
 * windup begins. The effect comes on release.
 */
export default function setupSkillMechanics(sim: Sim): void {
  sim.on(SimEvents.UnitSkillWindup, EventPriority.Exact, (event) => {
    const u = event.source;
    u.mana -= u.skillCost(event.skill);
    u.skillCooldowns.set(event.skill.id, event.skill.cooldown);
    u.cast = { skill: event.skill, target: event.target, t: 0 };
    if (event.target) {
      u.face(event.target);
    }
  });

  sim.on(SimEvents.UnitSkillRelease, EventPriority.Pre, (event) => {
    if (!event.source.alive) {
      event.disabled = true;
    }
  });

  sim.on(SimEvents.UnitSkillRelease, EventPriority.Exact, (event) => {
    event.skill.release(event.source, event.target, sim);
  });
}
