import fs from 'fs';

const logPath = 'C:\\Users\\matta\\.gemini\\antigravity-ide\\brain\\8fb7ce21-1dd1-4dc6-a716-03be0d40f820\\.system_generated\\logs\\transcript.jsonl';

const content = fs.readFileSync(logPath, 'utf8');
const lines = content.split('\n');

for (const line of lines) {
  if (!line.trim()) continue;
  try {
    const parsed = JSON.parse(line);
    if (parsed.step_index === 1899) {
      const call = parsed.tool_calls[0];
      const target = call.args.TargetContent;
      console.log('Target length:', target.length);
      console.log('Ends with quote?', target.endsWith('"'));
      console.log('Last 5 chars:', JSON.stringify(target.substring(target.length - 5)));
      console.log('Char codes of last 5 chars:', target.substring(target.length - 5).split('').map((c: string) => c.charCodeAt(0)));
    }
  } catch (e) {}
}
