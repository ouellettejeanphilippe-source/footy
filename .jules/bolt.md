## 2024-04-10 - O(N*M) String Normalization in Nested Loops
**Learning:** The application heavily relies on fuzzy matching strings (e.g. team names from different sources) in nested loops. Re-running `.toLowerCase().replace(/[^a-z0-9]/g, '')` on every iteration of these nested loops is a massive performance killer, consuming significant CPU time in synchronous blocks.
**Action:** Always pre-calculate invariant normalized strings into a parallel array or object mapping *before* entering nested loops for matching.
