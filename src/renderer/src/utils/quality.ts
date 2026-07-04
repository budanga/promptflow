export interface QualityScoreCard {
  overall: number;
  clarity: number;
  context: number;
  constraints: number;
  examples: number;
  format: number;
  suggestions: string[];
}

export function analyzePromptQuality(content: string): QualityScoreCard {
  const text = content.trim();
  const suggestions: string[] = [];
  
  if (text.length === 0) {
    return {
      overall: 0,
      clarity: 0,
      context: 0,
      constraints: 0,
      examples: 0,
      format: 0,
      suggestions: ['Write some prompt template content to run the quality analysis.']
    };
  }

  // Heuristics checks
  
  // 1. Clarity (0-100)
  let clarityScore = 40;
  const activeVerbs = ['write', 'create', 'generate', 'summarize', 'analyze', 'translate', 'explain', 'review', 'build', 'draft'];
  const hasActiveVerb = activeVerbs.some(v => text.toLowerCase().includes(v));
  if (hasActiveVerb) clarityScore += 20;
  
  const hasLists = /(-|\*|\d+\.)\s+/.test(text);
  if (hasLists) clarityScore += 20;
  
  if (text.length > 150) clarityScore += 20;
  if (text.length < 40) clarityScore -= 20;
  
  clarityScore = Math.max(10, Math.min(100, clarityScore));
  if (clarityScore < 70) {
    suggestions.push('Use active verbs (e.g. "Create", "Analyze") and lists to make instructions clear and structured.');
  }

  // 2. Context (0-100)
  let contextScore = 20;
  const personaKeywords = ['you are', 'act as', 'persona', 'expert', 'specialist', 'role'];
  const hasPersona = personaKeywords.some(k => text.toLowerCase().includes(k));
  if (hasPersona) contextScore += 40;
  
  const targetKeywords = ['for a', 'target', 'audience', 'user', 'client', 'intended'];
  const hasTarget = targetKeywords.some(k => text.toLowerCase().includes(k));
  if (hasTarget) contextScore += 40;
  
  contextScore = Math.max(10, Math.min(100, contextScore));
  if (!hasPersona) {
    suggestions.push('Define a clear persona or role (e.g. "You are an expert copywriter...") to set the context.');
  }
  if (!hasTarget) {
    suggestions.push('Identify the target audience or user profile (e.g. "...for a non-technical manager").');
  }

  // 3. Constraints (0-100)
  let constraintsScore = 20;
  const exclusionKeywords = ['avoid', 'do not', "don't", 'never', 'excluding', 'without', 'no explanations', 'restrict'];
  const hasExclusion = exclusionKeywords.some(k => text.toLowerCase().includes(k));
  if (hasExclusion) constraintsScore += 40;
  
  const limitKeywords = ['words', 'paragraphs', 'sentences', 'lines', 'limit', 'length', 'characters'];
  const hasLimit = limitKeywords.some(k => text.toLowerCase().includes(k));
  if (hasLimit) constraintsScore += 40;

  constraintsScore = Math.max(10, Math.min(100, constraintsScore));
  if (!hasExclusion) {
    suggestions.push('Add negative constraints (e.g. "Avoid verbose introductions") to limit unnecessary output.');
  }
  if (!hasLimit) {
    suggestions.push('Specify output length or size limit constraints (e.g. "Limit the summary to 3 bullet points").');
  }

  // 4. Examples (0-100)
  let examplesScore = 15;
  const exampleKeywords = ['example:', 'examples:', 'input:', 'output:', 'e.g.', 'for instance', 'here is a draft', 'shot'];
  const hasExample = exampleKeywords.some(k => text.toLowerCase().includes(k));
  if (hasExample) examplesScore += 85;

  examplesScore = Math.max(10, Math.min(100, examplesScore));
  if (!hasExample) {
    suggestions.push('Include few-shot examples (e.g. "Example Input: ... Example Output: ...") to guide the generation format.');
  }

  // 5. Format (0-100)
  let formatScore = 20;
  const formatKeywords = ['json', 'markdown', 'csv', 'table', 'html', 'bullet points', 'yaml', 'format as', 'output structure', 'list of'];
  const hasFormat = formatKeywords.some(k => text.toLowerCase().includes(k));
  if (hasFormat) formatScore += 80;

  formatScore = Math.max(10, Math.min(100, formatScore));
  if (!hasFormat) {
    suggestions.push('Specify a concrete output structure format (e.g. "Output as valid JSON" or "Format in a markdown table").');
  }

  // Compute Overall Score
  const overall = Math.round(
    (clarityScore + contextScore + constraintsScore + examplesScore + formatScore) / 5
  );

  return {
    overall,
    clarity: clarityScore,
    context: contextScore,
    constraints: constraintsScore,
    examples: examplesScore,
    format: formatScore,
    suggestions: suggestions.length > 0 ? suggestions : ['This prompt template meets all standard structural guidelines! Excellent work.']
  };
}
