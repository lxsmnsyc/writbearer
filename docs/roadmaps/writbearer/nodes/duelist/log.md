# Log: duelist

- Duel is a job-owned status (DUELING) on both fighters, each with the other as source. Its setup attaches a CheckTarget listener that refuses any choice crossing the pair. endsWithSource ends it on a death.
- Riposte cancels in CheckHit at Post (after the roll), then strikes back with BasicAttack | Sure. Parries skip Sure hits, so a counter is never parried.
- Shadowstep uses `aim` to pick the nearest aware caster or healer (hunt Support, skills, or matk) within 8 tiles.
- Content skills that gather their own victims (`challenged`, `inLine`, `around`, `after`) are not filtered by CheckTarget. Not touched: not my files.
- Open doubt: Riposte parries a hit that already rolled as hit; a crit is cancelled too.
