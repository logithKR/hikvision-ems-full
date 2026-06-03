const fs = require('fs');
const path = require('path');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        if (file === 'node_modules' || file === '.git' || file === 'dist' || file === '.next') return;
        
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) { 
            results = results.concat(walk(file));
        } else if (file.endsWith('.jsx') || file.endsWith('.tsx') || file.endsWith('.js') || file.endsWith('.ts')) {
            results.push(file);
        }
    });
    return results;
}

const files = walk('frontend');
let modifiedCount = 0;

files.forEach(file => {
    let originalContent = fs.readFileSync(file, 'utf8');
    let content = originalContent;
    
    // 1. Remove manual dark classes that conflict with themes
    content = content.replace(/\bdark:bg-slate-9[05]0\b/g, '');
    content = content.replace(/\bdark:bg-slate-800\b/g, '');
    content = content.replace(/\bdark:text-slate-[12]00\b/g, '');
    content = content.replace(/\bdark:text-white\b/g, '');
    content = content.replace(/\bdark:border-slate-[78]00\b/g, '');
    content = content.replace(/\bdark:divide-slate-800(\/50)?\b/g, '');
    content = content.replace(/\bdark:border-sidebar-border\b/g, '');

    // 2. Replace semantic backgrounds
    content = content.replace(/\bbg-white\b/g, 'bg-card');
    content = content.replace(/\bbg-slate-50\b/g, 'bg-background');
    content = content.replace(/\bbg-slate-100\b/g, 'bg-secondary');
    
    // 3. Replace text colors
    content = content.replace(/\btext-slate-900\b/g, 'text-foreground');
    content = content.replace(/\btext-slate-800\b/g, 'text-foreground');
    content = content.replace(/\btext-slate-700\b/g, 'text-foreground');
    content = content.replace(/\btext-slate-500\b/g, 'text-muted-foreground');
    content = content.replace(/\btext-slate-400\b/g, 'text-muted-foreground');
    
    // 4. Replace borders
    content = content.replace(/\bborder-slate-200\b/g, 'border-border');
    content = content.replace(/\bborder-slate-100\b/g, 'border-border');
    
    // Cleanup double spaces created by removing classes
    content = content.replace(/  +/g, ' ');
    // Cleanup className=" "
    content = content.replace(/class(Name)?=" "/g, '');
    content = content.replace(/class(Name)?=" /g, 'className="');
    content = content.replace(/ "/g, '"');

    if (content !== originalContent) {
        fs.writeFileSync(file, content);
        modifiedCount++;
        console.log(`Updated: ${file}`);
    }
});

console.log(`Modified files: ${modifiedCount}`);
