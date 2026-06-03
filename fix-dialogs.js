const fs = require('fs');
const files = [
  'frontend/app/admin/employees/page.jsx',
  'frontend/app/admin/employees/page_old.jsx'
];

files.forEach(file => {
  if (!fs.existsSync(file)) return;
  let content = fs.readFileSync(file, 'utf8');

  // Fix 1: Add missing </DialogBody> before </DialogContent>
  content = content.replace(
    /(\n\s*)\)}\n(\s*)<\/DialogContent>\n(\s*)<\/Dialog>\n\n(\s*)\{\/\* ── Assign Manager Dialog ────────────────────── \*\/\}/g,
    '$1)}\n$2</DialogBody>\n$2</DialogContent>\n$3</Dialog>\n\n$4{/* ── Assign Manager Dialog ────────────────────── */}'
  );

  // Fix 2: Add missing <DialogBody> after </DialogHeader> in 'Assign Manager' dialog
  content = content.replace(
    /(\n\s*<\/DialogDescription>\n\s*<\/DialogHeader>\n)(\s*<div className="space-y-4 py-4">\n\s*<Select)/g,
    '$1        <DialogBody>\n$2'
  );

  fs.writeFileSync(file, content);
  console.log('Fixed', file);
});
