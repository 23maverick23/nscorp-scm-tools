# SCR Manager Assistant Refactoring Plan

## Executive Summary

This document outlines a comprehensive refactoring plan for `scr_mgr_assistant.js` (3,643 lines), a Tampermonkey userscript that enhances NetSuite's SC Request form management. The script currently works flawlessly but suffers from performance issues due to synchronous/blocking operations on the main thread.

**Key Metrics:**
- Total Lines: 3,643
- Main Function Size: ~3,238 lines (lines 405-3643)
- NetSuite API Calls: ~6 major search operations
- Identified Issues: Dead code, blocking operations, code duplication, monolithic structure

---

## Table of Contents

1. [Code Architecture Overview](#code-architecture-overview)
2. [Dead Code & Cleanup Opportunities](#dead-code--cleanup-opportunities)
3. [Synchronous/Blocking Operations](#synchronousblocking-operations)
4. [Function Complexity Analysis](#function-complexity-analysis)
5. [Performance Optimization Opportunities](#performance-optimization-opportunities)
6. [Refactoring Recommendations](#refactoring-recommendations)
7. [Implementation Phases](#implementation-phases)

---

## Code Architecture Overview

### Current Structure

The script follows this general structure:

```
1. Global Constants & Configuration (lines 1-88)
2. GM_config Setup (lines 89-389)
3. Main Init Function (lines 381-389)
4. buildToolbarAndForms() - MONOLITHIC FUNCTION (lines 405-3643)
   ├─ Person Class Definition (lines 431-591)
   ├─ Settings Object (lines 607-630)
   ├─ CSS Styling (lines 659-860)
   ├─ HTML Templates (lines 862-1625)
   ├─ SuiteScript API Functions (lines 1667-3142)
   ├─ DOM Event Handlers (lines 3297-3642)
   └─ Form Initialization (lines 3562-3642)
```

### Key Components

1. **Configuration Management**: GM_config for user settings with custom modal
2. **Caching System**: Browser storage for SC availability data
3. **Person Class**: Object model for Solution Consultants
4. **NetSuite Integration**: Direct nlapiSearchRecord/nlapiSetFieldValue calls
5. **Skills Search**: Body of Work ranking system with industry/product matching
6. **UI Components**: Fomantic UI (Semantic UI fork) for modals and dropdowns

---

## Dead Code & Cleanup Opportunities

### 1. Commented Out Code (REMOVE)

| Location | Description | Action |
|----------|-------------|--------|
| Lines 416-418 | Debugging waitForKeyElements code | **DELETE** |
| Line 421 | Commented fomantic_css style injection | **DELETE** |
| Lines 1391-1416 | Alternate async click handler (noted as "doesn't do anything different") | **DELETE** |
| Lines 1628-1632 | Old button bar injection method | **DELETE** |
| Lines 1761-1762 | Commented search columns | **DELETE** |
| Lines 2065-2068 | Commented nRating formula column | **DELETE** |
| Lines 2174-2177 | Duplicate commented nRating formula | **DELETE** |
| Line 2168 | Commented lastupdate column | **DELETE** |

**Total Lines to Remove: ~35 lines**

### 2. Unused/Empty Functions

| Location | Function | Issue | Action |
|----------|----------|-------|--------|
| Lines 3368-3372 | `$('#_searchindustrylink').click()` | Empty handler with only comment | **DELETE or IMPLEMENT** |

### 3. Duplicate Logic

| Pattern | Occurrences | Recommendation |
|---------|-------------|----------------|
| Director switch statements | 5+ locations | Extract to `getDirectorId(name)` |
| Filter construction | 3+ locations | Extract to `buildTeamFilters()` |
| Date formatting | Multiple | Extract to `formatDate(date)` |
| Hard-coded IDs | Lines 1686-1694 | Already centralized, but referenced inconsistently |

---

## Synchronous/Blocking Operations

### Major Blocking Issues

#### 1. NetSuite API Calls (Blocking)

All `nlapiSearchRecord` and `nlapiLoadRecord` calls execute synchronously on the main thread:

| Function | Line | Records Searched | Estimated Impact |
|----------|------|------------------|------------------|
| `getCurrentEmp()` | 1667 | Employee Roster | Low (single record) |
| `getWorkloadData()` | 1696 | SC Request records | **HIGH** (6 months of data) |
| `getPeopleData()` | 1814 | Employee Roster | **MEDIUM** (all active SCs) |
| `getBodyOfWorkIndustryData()` | 2005 | Industry Ratings | **MEDIUM** (filtered results) |
| `getBodyOfWorkSkillData()` | 2102 | Skills Matrix | **HIGH** (large dataset) |
| `getRequestMetadata()` | 2989 | Customer record load | Low (single record) |

**Problem**: These calls block UI rendering and user interaction.

#### 2. Artificial Delays

| Location | Delay | Purpose | Issue |
|----------|-------|---------|-------|
| Line 2691 | 2000ms | Wait before table update | Blocks unnecessarily |
| Line 2740 | 1000ms | Wait before removing dimmer | Cosmetic delay |

**Problem**: `sleep()` function (lines 2672-2674) adds 3 seconds of artificial delay to skills search.

#### 3. Heavy Data Processing (Blocking)

| Function | Line | Operation | Impact |
|----------|------|-----------|--------|
| `consolidateSkillsData()` | 2230 | Nested reduce/map operations | **HIGH** |
| `generateBodtOfWorkHtml()` | 2538 | Loop building HTML strings | **MEDIUM** |
| `customSortEmployees()` | 2349 | Multi-criteria sorting | **MEDIUM** |

**Problem**: All data processing happens synchronously on main thread.

---

## Function Complexity Analysis

### 1. Monolithic Function: `buildToolbarAndForms()`

**Lines**: 405-3643 (3,238 lines!)
**Contains**: Everything from class definitions to event handlers

**Responsibilities** (Too Many!):
- Define Person class
- Build CSS styling
- Create HTML templates
- Define all utility functions
- Perform NetSuite searches
- Initialize UI components
- Attach event handlers
- Initialize forms

**Recommendation**: Break into ~15-20 separate functions/modules

### 2. Complex Functions Requiring Refactoring

| Function | Lines | Cyclomatic Complexity | Issues |
|----------|-------|----------------------|--------|
| `consolidateSkillsData()` | 246 | Very High | Multiple nested operations, hard to follow |
| `getPeopleData()` | 118 | High | Filter logic duplicated elsewhere |
| `getBodyOfWorkSkillData()` | 126 | High | Similar to industry data function |
| `updateBodyOfWorkTable()` | 62 | Medium | Combines data fetching with UI updates |
| `generateBodtOfWorkHtml()` | 108 | Medium | Builds HTML in imperative loop |

### 3. Recommended Simplifications

#### Current: consolidateSkillsData()
```javascript
function consolidateSkillsData(data, sortKey, sortOperator) {
  // 246 lines of nested reduce/map/filter operations
  // Handles: aggregation, HTML generation, ranking, sorting, filtering
}
```

#### Suggested Refactor:
```javascript
function consolidateSkillsData(skillsData, industryData, options) {
  const aggregated = aggregateEmployeeSkills(skillsData);
  const withIndustry = mergeIndustryData(aggregated, industryData);
  const filtered = applyIndustryFilter(withIndustry, options);
  const sorted = sortByCriteria(filtered, options);
  return sorted;
}
```

---

## Performance Optimization Opportunities

### 1. Asynchronous Operations (CRITICAL)

#### Current Problem:
```javascript
// Line 2691-2696 - Everything blocks for 2 seconds!
sleep(2000, function() {
  const resultA = getBodyOfWorkSkillData(skills, tableFilters.skills);  // BLOCKS
  const resultB = getBodyOfWorkIndustryData(industryId, tableFilters.industry);  // BLOCKS
  // More blocking work...
});
```

#### Recommended Solution:
```javascript
async function updateBodyOfWorkTable(skills, industryId, tableFilters) {
  const dimmer = $('#tableSkillsLoader').addClass('active');

  try {
    // Run searches in parallel
    const [skillsData, industryData] = await Promise.all([
      searchSkillsAsync(skills, tableFilters.skills),
      industryId ? searchIndustryAsync(industryId, tableFilters.industry) : Promise.resolve([])
    ]);

    const consolidated = consolidateSkillsData([skillsData, industryData], tableFilters.sorting);
    updateTableUI(consolidated, industryId);
  } finally {
    dimmer.removeClass('active');
  }
}
```

**Impact**: Could reduce load time from 3+ seconds to < 1 second

### 2. Web Workers for Data Processing

Heavy data processing should move off the main thread:

```javascript
// Create worker for skills consolidation
const skillsWorker = new Worker('skills-processor.js');

skillsWorker.postMessage({ skillsData, industryData, options });

skillsWorker.onmessage = (e) => {
  const rankedEmployees = e.data;
  updateTableUI(rankedEmployees);
};
```

**Benefits**:
- Non-blocking data processing
- Smoother UI interactions
- Better perceived performance

**Considerations**:
- Userscripts can create workers with Blob URLs
- Need to extract pure functions (no DOM access in worker)

### 3. Caching Improvements

#### Current Issues:
- Cache checked only once on load (line 2843)
- No cache invalidation strategies
- Cache refresh blocks entire UI

#### Recommendations:
```javascript
// Implement stale-while-revalidate pattern
async function getPeopleCacheWithRefresh() {
  const cache = getCachedData();

  if (cache) {
    // Return cached data immediately
    const stale = isCacheStale(cache.timestamp);
    if (stale) {
      // Refresh in background
      refreshCacheAsync().then(newData => {
        updateDropdownValues(newData);
      });
    }
    return cache.data;
  } else {
    // No cache, must wait
    return await refreshCacheAsync();
  }
}
```

### 4. Lazy Loading

Not all functionality needs to load immediately:

| Component | Current | Recommended |
|-----------|---------|-------------|
| Skills search UI | Loads on page load | Load when modal opens |
| Body of Work data | Loads on search | Pre-fetch on modal open |
| Industry dropdown | Full list inline | Virtual scrolling for large lists |

### 5. Reduce DOM Manipulation

#### Current:
```javascript
// Line 2638-2641 - Building HTML string in loop
for (i; i < len; i++) {
  const row = /* html */ `<tr>...</tr>`;  // 50+ lines of template
  html.push(row);
}
```

#### Recommended:
```javascript
// Use DocumentFragment or templating library
const fragment = document.createDocumentFragment();
data.forEach(item => {
  const row = createRowElement(item);  // Reusable element creation
  fragment.appendChild(row);
});
tableBody.appendChild(fragment);  // Single reflow
```

---

## Refactoring Recommendations

### Phase 1: Quick Wins (Low Risk, High Impact)

1. **Remove Dead Code** (~35 lines)
   - Delete all commented code sections
   - Remove unused functions

2. **Extract Constants**
   ```javascript
   // Create constants.js section
   const DIRECTOR_IDS = { jeff: 727821, karl: 106513, /* ... */ };
   const PRODUCT_SKILL_MAP = { "2": "591", "3": "827", /* ... */ };
   const REGION_STATE_MAP = { /* ... */ };
   ```

3. **Extract Utility Functions**
   - `formatDate(date)` - consolidate 3+ date formatting instances
   - `getDirectorId(name)` - replace 5+ switch statements
   - `convertNameFormat(name)` - already exists, use consistently

4. **Remove Artificial Delays**
   - Replace `sleep(2000, callback)` with immediate execution
   - Use CSS transitions for dimmer instead of `sleep(1000)`

**Estimated Effort**: 4-6 hours
**Performance Gain**: ~3 seconds reduced latency

### Phase 2: Structural Refactoring (Medium Risk, High Impact)

1. **Break Up Monolithic Function**

   Extract into separate functions:
   ```javascript
   // Main entry point
   function buildToolbarAndForms() {
     const settings = getSettings();
     const empRec = getCurrentEmp();

     injectStyles(settings.theme);
     renderToolbar(settings);
     renderModals(settings);
     initializeFormHandlers(settings, empRec);
     attachEventListeners(settings);
   }

   // Separate files/sections
   function injectStyles(theme) { /* ... */ }
   function renderToolbar(settings) { /* ... */ }
   function renderModals(settings) { /* ... */ }
   function initializeFormHandlers(settings, empRec) { /* ... */ }
   function attachEventListeners(settings) { /* ... */ }
   ```

2. **Extract Person Class**
   ```javascript
   // Move to top-level or separate section
   class Person {
     // Lines 431-591, unchanged
   }
   ```

3. **Separate Template Strings**
   ```javascript
   const templates = {
     toolbar: (settings) => `<div class="ui menu">...</div>`,
     requestForm: (settings) => `<form>...</form>`,
     notesForm: () => `<form>...</form>`,
     // ...
   };
   ```

4. **Consolidate Filter Logic**
   ```javascript
   function buildEmployeeFilters(options) {
     const filters = [
       new nlobjSearchFilter('custrecord_emproster_rosterstatus', null, 'is', 1),
       new nlobjSearchFilter('custrecord_emproster_eminactive', null, 'is', 'F'),
       // ... base filters
     ];

     if (options.filterMe) filters.push(/* ... */);
     if (options.filterVertical) filters.push(/* ... */);
     if (options.filterDirector) filters.push(getDirectorFilter(options.filterDirector));

     return filters;
   }
   ```

**Estimated Effort**: 2-3 days
**Maintenance Benefit**: Significant improvement in readability

### Phase 3: Async/Performance (Higher Risk, Highest Impact)

1. **Wrap NetSuite API in Promises**
   ```javascript
   function searchRecordsAsync(recordType, filters, columns) {
     return new Promise((resolve, reject) => {
       try {
         const results = nlapiSearchRecord(recordType, null, filters, columns);
         resolve(results || []);
       } catch (error) {
         reject(error);
       }
     });
   }
   ```

2. **Convert Data Fetching to Async**
   ```javascript
   async function getPeopleDataAsync() {
     const [workloadData, rosterResults] = await Promise.all([
       settings.includeAvailability ? getWorkloadDataAsync() : Promise.resolve({}),
       searchRecordsAsync('customrecord_emproster', filters, columns)
     ]);

     return processResults(rosterResults, workloadData);
   }
   ```

3. **Implement Web Worker for Skills Processing**
   ```javascript
   // skills-worker.js (inline as Blob URL)
   self.onmessage = function(e) {
     const { skillsData, industryData, options } = e.data;
     const results = consolidateSkillsData([skillsData, industryData], options.sorting);
     self.postMessage(results);
   };

   // In main script
   const workerCode = `self.onmessage = ...`;  // Full worker code
   const blob = new Blob([workerCode], { type: 'application/javascript' });
   const workerUrl = URL.createObjectURL(blob);
   const worker = new Worker(workerUrl);
   ```

4. **Implement Progressive Rendering**
   ```javascript
   // Instead of building entire table at once
   async function renderTableProgressively(data) {
     const batchSize = 10;
     for (let i = 0; i < data.length; i += batchSize) {
       const batch = data.slice(i, i + batchSize);
       renderBatch(batch);
       await nextFrame();  // Yield to browser
     }
   }

   function nextFrame() {
     return new Promise(resolve => requestAnimationFrame(resolve));
   }
   ```

**Estimated Effort**: 1-2 weeks
**Performance Gain**: 50-75% reduction in perceived load time

### Phase 4: Advanced Optimizations (Optional)

1. **Implement Virtual Scrolling** for large dropdown lists
2. **Add Service Worker** for offline caching
3. **Implement Debouncing** for search inputs
4. **Add Loading States** with skeleton screens
5. **Optimize Memory Usage** - clear large datasets after use

---

## Implementation Phases

### Phase 1: Cleanup & Quick Wins (Week 1)
- [ ] Remove all dead code (~35 lines)
- [ ] Extract constants to top-level
- [ ] Create utility functions for repeated patterns
- [ ] Remove artificial delays (`sleep` calls)
- [ ] Add JSDoc comments to major functions
- [ ] Test: Verify no functionality broken

**Deliverable**: Cleaner, faster code with ~3s performance improvement

### Phase 2: Structural Refactoring (Weeks 2-3)
- [ ] Extract Person class to module-level
- [ ] Break buildToolbarAndForms into 5-7 functions
- [ ] Extract HTML templates to template object
- [ ] Consolidate filter building logic
- [ ] Create separate sections with clear comments
- [ ] Test: Full regression testing

**Deliverable**: Maintainable code structure

### Phase 3: Async Implementation (Weeks 4-5)
- [ ] Create Promise wrappers for NetSuite API
- [ ] Convert getPeopleData to async
- [ ] Convert getWorkloadData to async
- [ ] Convert Body of Work searches to async
- [ ] Implement parallel Promise.all calls
- [ ] Update UI code to handle async data
- [ ] Test: Verify all searches work correctly

**Deliverable**: Non-blocking NetSuite operations

### Phase 4: Advanced Performance (Weeks 6-7)
- [ ] Implement Web Worker for skills consolidation
- [ ] Add progressive rendering for large tables
- [ ] Implement better caching strategy
- [ ] Add error boundaries and retry logic
- [ ] Performance testing and profiling
- [ ] Test: Measure performance improvements

**Deliverable**: Optimally performing userscript

### Phase 5: Polish & Documentation (Week 8)
- [ ] Add comprehensive error handling
- [ ] Create inline documentation
- [ ] Add performance metrics logging
- [ ] Create user-facing changelog
- [ ] Final testing across all scenarios

**Deliverable**: Production-ready, documented code

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Breaking existing functionality | Medium | High | Comprehensive testing at each phase |
| NetSuite API limitations | Low | Medium | Test async patterns in sandbox first |
| Browser compatibility issues | Low | Low | Use well-supported async patterns |
| Performance regression | Low | Medium | Measure before/after with profiling |
| User disruption during update | Low | Low | Use semantic versioning, beta testing |

---

## Success Metrics

### Performance Targets

| Metric | Current | Target | Measurement |
|--------|---------|--------|-------------|
| Initial page load | ~2-3s | < 1s | Time to interactive |
| Skills search | ~3-5s | < 1s | Search to results |
| Dropdown population | ~1-2s | < 0.5s | First paint to interactive |
| Memory usage | Unknown | < 50MB | Chrome DevTools |
| Script size | 3,643 lines | < 3,000 lines | Line count |

### Code Quality Targets

| Metric | Current | Target |
|--------|---------|--------|
| Largest function | 3,238 lines | < 100 lines |
| Cyclomatic complexity | Very High | Medium |
| Code duplication | High | Low |
| Test coverage | 0% | 50%+ (if testing added) |

---

## Detailed Function Inventory

### Functions Using NetSuite API (All Blocking)

1. `getCurrentEmp()` - Line 1667 (1 search)
2. `getWorkloadData()` - Line 1696 (1 search, heavy)
3. `getPeopleData()` - Line 1814 (1 search + getWorkloadData)
4. `getBodyOfWorkIndustryData()` - Line 2005 (1 search)
5. `getBodyOfWorkSkillData()` - Line 2102 (1 search, heavy)
6. `getRequestMetadata()` - Line 2989 (1 record load)

### Heavy Processing Functions

1. `consolidateSkillsData()` - Line 2230 (246 lines, complex reduce/map)
2. `generateBodtOfWorkHtml()` - Line 2538 (108 lines, string building)
3. `customSortEmployees()` - Line 2349 (multi-criteria sort)
4. `sortPeopleData()` - Line 1897 (nested in getPeopleData)

### Utility Functions (Reusable)

1. `convertNameFormat()` - Line 2676 ✓
2. `extractLocationString()` - Line 2478 ✓
3. `generateWeightedRating()` - Line 2489 ✓
4. `availabilityRanking()` - Line 2318 ✓
5. `getRegion()` - Line 2965 ✓
6. `getProductSkills()` - Line 2908 ✓

### Setter Functions (25+ similar functions)

Lines 3065-3273: Many simple setter functions that could potentially be consolidated into a generic `setField(fieldId, value)` pattern.

---

## Recommended Reading Order for Refactoring

When implementing refactoring, work in this order to minimize risk:

1. **Extract and test utilities first** (Phase 1)
2. **Break up buildToolbarAndForms** (Phase 2)
3. **Implement async layer** (Phase 3)
4. **Add performance optimizations** (Phase 4)

Each phase should include:
- Implementation
- Unit testing (if possible)
- Integration testing in NetSuite sandbox
- User acceptance testing
- Deployment to production

---

## Notes & Observations

### Positive Aspects

1. **Well-organized sections** with ASCII art headers - easy to navigate
2. **Person class** is well-designed with proper getters/setters
3. **Caching system** is thoughtful (just needs async)
4. **Settings management** with GM_config is professional
5. **Consistent naming conventions** throughout
6. **Good use of template literals** for HTML generation

### Areas of Concern

1. **No error handling** around NetSuite API calls
2. **No logging** of errors or performance metrics
3. **No retry logic** for failed searches
4. **Hard-coded values** (director IDs, product mappings) should be configurable
5. **No automated testing** - high risk for regressions

### Future Enhancements (Post-Refactoring)

1. Add unit tests for pure functions
2. Implement error boundaries for graceful failures
3. Add performance monitoring/metrics
4. Create configuration UI for mappings
5. Add keyboard shortcuts for power users
6. Implement undo/redo for form changes
7. Add export functionality for skills data

---

## Conclusion

The `scr_mgr_assistant.js` userscript is a sophisticated tool with excellent functionality but suffers from performance issues due to its monolithic structure and synchronous operations.

**Key Recommendations:**
1. **Remove dead code** (35+ lines) - Quick win
2. **Break up the 3,238-line function** - Critical for maintainability
3. **Implement async/await** for NetSuite API calls - Critical for performance
4. **Extract Web Worker** for heavy processing - Major performance boost
5. **Improve caching strategy** - Better UX

**Expected Outcomes:**
- 50-75% reduction in load times
- Significantly improved maintainability
- Reduced risk of bugs through better structure
- Better user experience with non-blocking UI

The refactoring can be done incrementally over 6-8 weeks, with each phase delivering tangible improvements while maintaining full functionality.
