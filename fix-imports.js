const fs = require('fs');

const files = [
  'frontend/app/employee/team/leaves/page.jsx',
  'frontend/app/system-admin/organizations/page.jsx',
];

for (const f of files) {
  let content = fs.readFileSync(f, 'utf8');
  // Add DialogBody before the closing } of the dialog import
  const dialogImportRegex = /(\}\s*from\s*["']@\/components\/ui\/dialog["'])/;
  if (dialogImportRegex.test(content)) {
    content = content.replace(dialogImportRegex, 'DialogBody,\n$1');
    fs.writeFileSync(f, content);
    console.log('Fixed:', f);
  } else {
    console.log('No dialog import found:', f);
  }
}
