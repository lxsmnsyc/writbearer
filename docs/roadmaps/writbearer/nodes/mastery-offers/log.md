# Log: mastery-offers

- Checked first: no mastery code existed. Built all of it.
- Offers draw from area streams (`Stream.Loot`, offsets 2000 and 3000) so a load draws the same cards; the open offer also goes in the save.
- Mastery added to the road as a last pass (`rollMastery`) so existing seeds keep their maps.
- Type named `UpgradeOffer`: `Offer` is the recruit type.
- No e2e (port 5199 is the other worker's).
- Review fixes: waystation e2e takes cards; Mastery is always 3 cards, a met bonus adds 1 shard to the picked merc; offers only for phases 2 to 4; loadOffers checks cards against the loaded mercs; no reload e2e (see outcome).
