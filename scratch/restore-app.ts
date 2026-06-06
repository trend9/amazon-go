import fs from 'fs';

const logPath = 'C:\\Users\\matta\\.gemini\\antigravity-ide\\brain\\8fb7ce21-1dd1-4dc6-a716-03be0d40f820\\.system_generated\\logs\\transcript.jsonl';
const targetFile = 'c:\\Users\\matta\\Downloads\\あまぞん-go!!\\src\\App.tsx';

interface ToolCall {
  name: string;
  args: {
    TargetFile: string;
    StartLine?: number;
    EndLine?: number;
    TargetContent?: string;
    ReplacementContent?: string;
  };
}

interface LogLine {
  step_index: number;
  source: string;
  type: string;
  status: string;
  tool_calls?: ToolCall[];
}

function unescapeString(str: string | undefined): string | undefined {
  if (!str) return str;
  let cleaned = str;
  if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
    cleaned = cleaned.slice(1, -1);
  }
  cleaned = cleaned
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\');
  return cleaned;
}

function restore() {
  const content = fs.readFileSync(logPath, 'utf8');
  const lines = content.split('\n');
  const edits: { step: number; call: ToolCall }[] = [];

  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const parsed: LogLine = JSON.parse(line);
      if (parsed.tool_calls) {
        for (const call of parsed.tool_calls) {
          const fileArg = call.args.TargetFile;
          if (fileArg && fileArg.includes('App.tsx')) {
            edits.push({ step: parsed.step_index, call });
          }
        }
      }
    } catch (e) {
      // ignore
    }
  }

  let appContent = fs.readFileSync(targetFile, 'utf8');

  // Let's filter for the specific steps: 1899, 1907, 1928
  const stepsToApply = [1899, 1907, 1928];

  for (const stepNum of stepsToApply) {
    const edit = edits.find(e => e.step === stepNum);
    if (!edit) {
      console.log(`Warning: Step ${stepNum} not found`);
      continue;
    }

    let target = unescapeString(edit.call.args.TargetContent);
    let replacement = unescapeString(edit.call.args.ReplacementContent);

    if (target && replacement !== undefined) {
      // Normalize target and appContent newlines to match (LF) for substitution
      const normalizedApp = appContent.replace(/\r\n/g, '\n');
      const normalizedTarget = target.replace(/\r\n/g, '\n');
      const normalizedReplacement = replacement.replace(/\r\n/g, '\n');

      if (normalizedApp.includes(normalizedTarget)) {
        const idx = normalizedApp.indexOf(normalizedTarget);
        appContent = normalizedApp.substring(0, idx) + normalizedReplacement + normalizedApp.substring(idx + normalizedTarget.length);
        console.log(`Successfully applied step ${stepNum}`);
      } else {
        console.log(`Error: Target for step ${stepNum} not found in App.tsx!`);
        console.log(`Target preview (first 100 chars):`, JSON.stringify(normalizedTarget.substring(0, 100)));
      }
    }
  }

  // Restore CRLF
  fs.writeFileSync(targetFile, appContent.replace(/\n/g, '\r\n'), 'utf8');
  console.log('App.tsx restored.');
}

restore();
