import fs from 'fs';

const content = fs.readFileSync('src/App.tsx', 'utf-8');
const lines = content.split('\n');
lines.forEach((line, index) => {
  if (line.includes('<img') || line.includes('imageUrl') || line.includes('.img')) {
    console.log(`${index + 1}: ${line.trim()}`);
  }
});
