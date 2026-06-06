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
      console.log('Type of target:', typeof target);
      console.log('First 50 chars:', JSON.stringify(target.substring(0, 50)));
      console.log('Starts with quote?', target.startsWith('"'));
      console.log('Char codes of first 5 chars:', target.substring(0, 5).split('').map((c: string) => c.charCodeAt(0)));
    }
  } catch (e) {}
}
