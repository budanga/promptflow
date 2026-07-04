import { PromptDetails } from '../../../shared/types';

export class ExportPrompt {
  execute(details: PromptDetails, format: 'markdown' | 'json'): { content: string; filename: string; extension: string } {
    const sanitizedTitle = details.prompt.title.toLowerCase().replace(/[^a-z0-9]/g, '_');
    
    if (format === 'json') {
      const content = JSON.stringify(details, null, 2);
      return {
        content,
        filename: `promptflow_${sanitizedTitle}`,
        extension: 'json'
      };
    } else {
      // Format as Markdown
      const tagsStr = details.prompt.tags.map(t => t.name).join(', ');
      const content = `---
title: ${details.prompt.title}
description: ${details.prompt.description || ''}
tags: ${tagsStr}
category: ${details.prompt.categoryId || 'Uncategorized'}
notes: ${details.prompt.notes || ''}
version: ${details.latestVersion.versionNumber}
---

# ${details.prompt.title}

${details.latestVersion.content}
`;
      return {
        content,
        filename: sanitizedTitle,
        extension: 'md'
      };
    }
  }
}
