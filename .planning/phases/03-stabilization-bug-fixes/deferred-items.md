# Deferred Items - Phase 03

## Test Isolation: Unique Index Enforcement in Full Suite

**Discovered during:** Plan 03-02, Task 2
**File:** `lib/models/Submission.test.ts`
**Issue:** The "enforces unique (assignment, student) pair" test fails when running the full test suite but passes in isolation. This is a test isolation issue where MongoDB unique indexes are not consistently enforced across test suite boundaries when using `deleteMany()` for cleanup (indexes may need explicit `syncIndexes()` call).
**Impact:** Flaky test in full suite runs. No production impact.
**Recommendation:** Add `await Submission.syncIndexes()` before the duplicate test, same as was done for `Enrollment.test.ts`.
