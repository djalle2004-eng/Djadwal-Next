import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('P10 Arabic-First Design System Verification Suite (@djadwal/ui)', () => {
  const UI_SRC_DIR = path.resolve(__dirname, '../src');
  const COMPONENTS_DIR = path.resolve(UI_SRC_DIR, 'components');

  function getAllFiles(dir: string, ext = '.tsx'): string[] {
    let results: string[] = [];
    if (!fs.existsSync(dir)) return results;
    const list = fs.readdirSync(dir);
    for (const file of list) {
      const fullPath = path.resolve(dir, file);
      const stat = fs.statSync(fullPath);
      if (stat && stat.isDirectory()) {
        results = results.concat(getAllFiles(fullPath, ext));
      } else if (fullPath.endsWith(ext) || fullPath.endsWith('.ts')) {
        results.push(fullPath);
      }
    }
    return results;
  }

  it('1. Strictly verifies 0 imports from @mui/* or @emotion/* in packages/ui', () => {
    const allFiles = getAllFiles(UI_SRC_DIR);
    expect(allFiles.length).toBeGreaterThan(15);

    for (const filePath of allFiles) {
      const content = fs.readFileSync(filePath, 'utf8');
      expect(content).not.toMatch(/from\s+['"]@mui\//);
      expect(content).not.toMatch(/from\s+['"]@emotion\//);
    }
  });

  it('2. Enforces RTL-First logical properties: NO physical directions (pl/pr, ml/mr, left/right) in components', () => {
    const componentFiles = getAllFiles(COMPONENTS_DIR, '.tsx');
    expect(componentFiles.length).toBeGreaterThan(15);

    // Regular expression matching physical direction utility classes inside className attributes
    const physicalDirRegex = /\b(pl-\d|pr-\d|ml-\d|mr-\d|left-\d|right-\d|border-l-\d|border-r-\d|text-left|text-right)\b/;

    for (const file of componentFiles) {
      const content = fs.readFileSync(file, 'utf8');
      const match = content.match(physicalDirRegex);
      expect(
        match,
        `File ${path.basename(file)} contains prohibited physical class: "${match?.[0]}". Use logical properties (ps-, pe-, ms-, me-, start-, end-, text-start) instead.`
      ).toBeNull();
    }
  });

  it('3. Confirms export of all 20 core Arabic components in @djadwal/ui', () => {
    const indexContent = fs.readFileSync(path.resolve(UI_SRC_DIR, 'index.ts'), 'utf8');

    const expectedComponents = [
      'Button',
      'Input',
      'Select',
      'Checkbox',
      'Switch',
      'Dialog',
      'Drawer',
      'Tabs',
      'Card',
      'Toast',
      'Skeleton',
      'EmptyState',
      'ErrorState',
      'ErrorDisplay',
      'Table',
      'DataGrid',
      'Badge',
      'Tooltip',
      'DropdownMenu',
      'Breadcrumbs',
      'Pagination',
      'Avatar',
    ];

    for (const comp of expectedComponents) {
      expect(indexContent).toContain(`./components/${comp}`);
    }
  });

  it('4. Confirms design tokens and CSS custom variables with dark mode support', () => {
    const tokensCss = path.resolve(UI_SRC_DIR, 'tokens/tokens.css');
    expect(fs.existsSync(tokensCss)).toBe(true);

    const cssContent = fs.readFileSync(tokensCss, 'utf8');
    expect(cssContent).toContain('--dj-color-primary-600');
    expect(cssContent).toContain('--dj-color-bg');
    expect(cssContent).toContain('--dj-spacing-4');
    expect(cssContent).toContain('--dj-radius-lg');
    expect(cssContent).toContain('.dark');
  });

  it('5. Confirms Arabic variable font loading with swap and unicode-range', () => {
    const fontsCss = path.resolve(UI_SRC_DIR, 'styles/fonts.css');
    expect(fs.existsSync(fontsCss)).toBe(true);

    const fontContent = fs.readFileSync(fontsCss, 'utf8');
    expect(fontContent).toContain('font-display: swap');
    expect(fontContent).toContain('unicode-range');
    expect(fontContent).toContain('line-height: 1.7');
  });

  it('6. Ensures legacy arabic-font-base64.ts was NOT deleted (charter invariant)', () => {
    const legacyFontPath = path.resolve(__dirname, '../../../src/utils/arabic-font-base64.ts');
    expect(fs.existsSync(legacyFontPath)).toBe(true);
  });
});

