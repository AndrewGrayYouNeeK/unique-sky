# Stable star keys and the claims rekey plan

`src/lib/starKey.js` is standalone (no app imports), so the checkout/claims branch
(`feat/web-checkout-claims`) can adopt it without depending on the sky view.

## Identifier model

Every star object can carry these identifiers: `gaia_source_id` (preferred), `hip`,
`hd`, `tycho`, `hr`, `bayer`, `flamsteed`, `iau_name`, and `common_name`.
`starKey(ids)` picks the strongest identifier present:

```
gaia:<source_id> > hip:<n> > tyc:<a-b-c> > hd:<n> > hr:<n> > mel:<n> / m:<n> (clusters) > hyg:<n>
```

The current HYG v4.1 catalog has no Gaia or Tycho ids, so today's keys are `hip:`
(or `hd:`/`hyg:` for the few non-Hipparcos stars). When a Gaia-based tier lands, a
star that gains a Gaia id would get a new preferred key. **Store the key at claim
time and never recompute it.** A future crossmatch table can map `hip:` keys to
`gaia:` keys for lookups.

The real name (`iau_name`/`common_name`) never changes. A claim adds an edition or
owner name beside it (`displayNames()`) and never replaces it.

## Legacy ids

D1 `claims.star_id` and the hunt targets still use the original slug ids (`sirius`,
`pleiades`, ...). `LEGACY_STAR_IDS` maps each one to its catalog identifiers. Each
mapping was checked against HYG v4.1 by name, position, and magnitude, and a unit
test checks that Tier 0 contains every one. The mapping includes:

| legacy id | key |
| --- | --- |
| sirius | hip:32349 |
| polaris | hip:11767 |
| alnilam | hip:26311 |
| vega | hip:91262 |
| pleiades (cluster marker) | mel:22 |

The other 26 are in `src/lib/starKey.js`.

## Planned D1 migration (not applied; do it in its own PR)

The D1 work should be coordinated with `feat/web-checkout-claims`, which owns the
claims/checkout schema. Whichever branch merges second rebases on the other.

1. Add the column: `ALTER TABLE claims ADD COLUMN star_key TEXT;` (and the same on
   `purchases`).
2. Backfill from the mapping, generated from `LEGACY_STAR_IDS`:
   `UPDATE claims SET star_key = 'hip:32349' WHERE star_id = 'sirius';` and so on,
   one statement per legacy id.
3. Verify with `SELECT count(*) FROM claims WHERE star_key IS NULL;`, which must
   return 0.
4. Add `CREATE UNIQUE INDEX claims_star_key ON claims(star_key);`. Later, `star_key` can become the
   primary key in a table rebuild. Today `claims.star_id` is the PRIMARY KEY, and
   `purchases.star_id` references it.
5. Switch the Worker to accept and return `star_key`, keeping `star_id` as a
   read-only alias for one release. Then stop writing `star_id`.

Steps 1–4 are additive and safe to run before the code change. Back up first with
`wrangler d1 export`. Andrew must approve any remote migration.
