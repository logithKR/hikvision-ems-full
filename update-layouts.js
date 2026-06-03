const fs = require('fs');

const layouts = [
  'frontend/app/admin/layout.jsx',
  'frontend/app/employee/layout.jsx',
  'frontend/app/business-owner/layout.jsx',
  'frontend/app/system-admin/layout.jsx'
];

layouts.forEach(file => {
  if (!fs.existsSync(file)) return;
  let content = fs.readFileSync(file, 'utf8');
  
  if (!content.includes('ThemeToggle')) {
    content = content.replace('import { Button }', 'import { ThemeToggle } from "@/components/theme-toggle"\nimport { Button }');
  }

  // Desktop Logo Header
  content = content.replace(
    /(<Link[^>]*to="[^"]*dashboard"[^>]*>[\s\S]*?<\/Link>)/,
    '$1\n          <div className="ml-auto flex items-center gap-2">\n            <ThemeToggle />\n          </div>'
  );

  // Mobile Header (Add next to logout button)
  content = content.replace(
    /(<Button[^>]*onClick=\{handleLogout\}[^>]*>[\s\S]*?<\/Button>)/,
    '<div className="flex items-center gap-2">\n          <ThemeToggle className="text-white hover:bg-card/20" />\n          $1\n        </div>'
  );

  fs.writeFileSync(file, content);
  console.log('Updated ' + file);
});
