# Log: cc-sight-still

- Brief says mercs have kit.sight 4.5; the code default is 7 for everyone, and only the fog draws mercs at 4.5. Kept both: AI reads lightOf(u) (kit.sight), the fog reads lightFrom(u, 4.5 or 7), so nothing changes with no bonus.
- Monsters notice the bearer's lantern: noticeOf(monster, target, share) adds the target's light gain (lightOf - kit.sight) to the monster's own notice, so Wide Light moves both.
- stillFor needs a listener on every Sim, so setupStill is called from the Sim constructor (one line).
