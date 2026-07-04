export function extractVariables(content: string): string[] {
  const regex = /\{\{([a-zA-Z0-9_]+)\}\}/g;
  const variables: string[] = [];
  let match;
  
  while ((match = regex.exec(content)) !== null) {
    if (!variables.includes(match[1])) {
      variables.push(match[1]);
    }
  }
  
  return variables;
}

export function compileTemplate(content: string, values: Record<string, string>): string {
  let compiled = content;
  for (const [key, value] of Object.entries(values)) {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    compiled = compiled.replace(regex, value);
  }
  return compiled;
}
