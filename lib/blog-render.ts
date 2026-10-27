/**
 * Pure Blog Markdown Rendering and Reading Time Calculation
 * Client and Server safe (no database or server-only dependencies)
 */

/**
 * Calculates estimated reading time in minutes based on 200 words per minute.
 */
export function calculateReadingTime(text: string): number {
  if (!text) return 1;
  const words = text.trim().split(/\s+/).length;
  return Math.max(1, Math.ceil(words / 200));
}

/**
 * Safely converts Markdown into semantic HTML with strict XSS sanitization.
 * Escapes raw HTML tags and converts standard markdown typography.
 */
export function safeRenderMarkdown(markdown: string): string {
  if (!markdown) return '';

  // 1. First escape raw HTML tags to prevent arbitrary script execution
  let safe = markdown
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // 2. Fenced code blocks
  safe = safe.replace(/```([a-z0-9_-]*)\n([\s\S]*?)```/g, (_m, lang, code) => {
    return `<pre class="bg-slate-900 text-slate-100 p-4 rounded-xl text-xs font-mono overflow-x-auto my-4 border border-slate-800"><code class="language-${lang}">${code.trim()}</code></pre>`;
  });

  // 3. Inline code
  safe = safe.replace(/`([^`]+)`/g, '<code class="bg-slate-100 text-slate-800 px-1.5 py-0.5 rounded text-xs font-mono border border-slate-200">$1</code>');

  // 4. Headers
  safe = safe.replace(/^### (.*$)/gim, '<h3 class="text-lg font-bold text-slate-900 mt-6 mb-2 tracking-tight">$1</h3>');
  safe = safe.replace(/^## (.*$)/gim, '<h2 class="text-xl sm:text-2xl font-bold text-slate-900 mt-8 mb-3 tracking-tight border-b border-slate-100 pb-2">$1</h2>');
  safe = safe.replace(/^# (.*$)/gim, '<h1 class="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-8 mb-4 tracking-tight">$1</h1>');

  // 5. Blockquotes
  safe = safe.replace(/^\> (.*$)/gim, '<blockquote class="border-l-4 border-emerald-500 pl-4 py-2 my-4 bg-emerald-50/50 rounded-r-xl text-slate-700 italic text-sm leading-relaxed">$1</blockquote>');

  // 6. Bold and Italics
  safe = safe.replace(/\*\*([^*]+)\*\*/g, '<strong class="font-bold text-slate-900">$1</strong>');
  safe = safe.replace(/\*([^*]+)\*/g, '<em class="italic text-slate-800">$1</em>');

  // 7. Links (enforcing HTTPS / relative safe links)
  safe = safe.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+|\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-emerald-600 hover:text-emerald-700 font-semibold underline underline-offset-2">$1</a>');

  // 8. Markdown Tables
  const lines = safe.split('\n');
  const processedLines: string[] = [];
  let inTable = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('|') && line.endsWith('|')) {
      const cells = line.split('|').slice(1, -1).map((c) => c.trim());

      // Check if it's separator line |:---|:---|
      if (cells.every((c) => /^:?-+:?$/.test(c))) {
        continue;
      }

      if (!inTable) {
        inTable = true;
        processedLines.push('<div class="overflow-x-auto my-6"><table class="w-full text-left text-xs sm:text-sm border-collapse border border-slate-200 rounded-xl overflow-hidden shadow-xs">');
        processedLines.push('<thead><tr class="bg-slate-100 text-slate-800 font-bold border-b border-slate-200">');
        for (const cell of cells) {
          processedLines.push(`<th class="p-3 border-r border-slate-200 last:border-r-0">${cell}</th>`);
        }
        processedLines.push('</tr></thead><tbody>');
      } else {
        processedLines.push('<tr class="border-b border-slate-100 hover:bg-slate-50/80 transition-colors">');
        for (const cell of cells) {
          processedLines.push(`<td class="p-3 border-r border-slate-100 last:border-r-0 text-slate-700">${cell}</td>`);
        }
        processedLines.push('</tr>');
      }
    } else {
      if (inTable) {
        processedLines.push('</tbody></table></div>');
        inTable = false;
      }

      // Unordered lists
      if (line.startsWith('- ')) {
        processedLines.push(`<li class="text-sm text-slate-700 ml-4 list-disc leading-relaxed my-1">${line.slice(2)}</li>`);
      } else if (/^\d+\.\s/.test(line)) {
        processedLines.push(`<li class="text-sm text-slate-700 ml-4 list-decimal leading-relaxed my-1">${line.replace(/^\d+\.\s/, '')}</li>`);
      } else if (line.length > 0 && !line.startsWith('<')) {
        processedLines.push(`<p class="text-sm sm:text-base text-slate-700 leading-relaxed my-3">${line}</p>`);
      } else {
        processedLines.push(line);
      }
    }
  }

  if (inTable) {
    processedLines.push('</tbody></table></div>');
  }

  return processedLines.join('\n');
}
