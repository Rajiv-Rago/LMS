Course Generation Pipeline — Functional & Behavioral Spec

Reference Storage
- Course.references holds citations and descriptions collected during syllabus generation.

Web Search Trigger
- Triggered only during syllabus generation, after initial tests and setup rules are established.
- Stores references with short descriptions in Course.references for citation and verification.

Lesson Generation Flow
- First LLM call selects which Course.references are relevant to the lesson.
- Second LLM call generates the actual lesson content using selected references.

Initial Testing
- Runs before syllabus generation.
- Contains multiple-choice questions plus 1-3 short free-text essay responses.
- Multiple-choice gauges known and unknown topics; essays gauge depth of understanding.
- Graded by the same AI provider model.
- Results and user-set rules (passing score percentage, course description, learning outcomes, proposed curriculum) inform course tailoring.

Supplementary Module Logic
- Named "{lesson_name} (Supplementary)".
- Created by a lighter service that inserts the module after the existing module.
- End-of-module test conditions:
  - Score below 50%: user must redo the whole lesson.
  - After supplementary lesson, retake the test. If still failing, prompt user whether to continue or create a new supplementary module.
  - Supplementary module is not generated on every failed attempt; conditions control creation.

Changes Required
- Add web-search package in packages/ for agentic search integration.
- Add testing-service package for initial and end-of-module diagnostics.
- Modify Course schema to include references array.
- Modify syllabus generation to call web search and populate Course.references.
- Modify lesson generation to split into reference-selection call then content-generation call.
- Add lighter SupplementModuleService that inserts modules with "(Supplementary)" naming without full regeneration.
- Add conditional retest logic after supplementary module: prompt user to continue or create new supplement if retest still fails.

Removals / Replacements
- Remove direct single-call lesson content generation that does not filter Course.references.
- Remove automatic supplementary module creation on every end-of-module failure; replace with conditional rules (<50% redo lesson, then supplementary only once with retest).
- Remove absence of initial diagnostic testing before syllabus generation.
