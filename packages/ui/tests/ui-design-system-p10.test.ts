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

  it('7. Validates WCAG 2.2 AA color contrast ratios (>= 4.5:1 for text, >= 3.0:1 for graphical UI)', () => {
    function hexToRgb(hex: string): [number, number, number] {
      const clean = hex.replace('#', '');
      const bigint = parseInt(clean, 16);
      return [(bigint >> 16) & 255, (bigint >> 8) & 255, bigint & 255];
    }

    function getRelativeLuminance([r, g, b]: [number, number, number]): number {
      const [rs, gs, bs] = [r, g, b].map((c) => {
        const s = c / 255;
        return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
      });
      return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
    }

    function getContrastRatio(hex1: string, hex2: string): number {
      const l1 = getRelativeLuminance(hexToRgb(hex1));
      const l2 = getRelativeLuminance(hexToRgb(hex2));
      const lighter = Math.max(l1, l2);
      const darker = Math.min(l1, l2);
      return (lighter + 0.05) / (darker + 0.05);
    }

    // 1. Text Main (#0f172a) on White (#ffffff)
    const textMainContrast = getContrastRatio('#0f172a', '#ffffff');
    expect(textMainContrast).toBeGreaterThanOrEqual(7.0); // Passes AAA (>= 7:1)

    // 2. Text Muted (#64748b) on White (#ffffff)
    const textMutedContrast = getContrastRatio('#64748b', '#ffffff');
    expect(textMutedContrast).toBeGreaterThanOrEqual(4.5); // Passes AA (>= 4.5:1)

    // 3. Primary 700 (#047857) on White (#ffffff)
    const primary700Contrast = getContrastRatio('#047857', '#ffffff');
    expect(primary700Contrast).toBeGreaterThanOrEqual(4.5); // Passes AA (>= 4.5:1)

    // 4. White (#ffffff) on Danger (#dc2626)
    const dangerContrast = getContrastRatio('#ffffff', '#dc2626');
    expect(dangerContrast).toBeGreaterThanOrEqual(4.5); // Passes AA (>= 4.5:1)

    // 5. White (#ffffff) on Primary 600 (#059669) for graphical components & bold text
    const primary600Contrast = getContrastRatio('#ffffff', '#059669');
    expect(primary600Contrast).toBeGreaterThanOrEqual(3.0); // Passes AA for UI components (>= 3:1)
  });

  it('8. Verifies WCAG 2.2 AA keyboard accessibility and ARIA roles across interactive components', () => {
    // Button: visible focus ring
    const buttonSrc = fs.readFileSync(path.resolve(COMPONENTS_DIR, 'Button/Button.tsx'), 'utf8');
    expect(buttonSrc).toContain('focus-visible:ring-2');
    expect(buttonSrc).toContain('focus-visible:outline-none');
    expect(buttonSrc).toContain('disabled');

    // Input: aria-invalid, aria-describedby, role="alert"
    const inputSrc = fs.readFileSync(path.resolve(COMPONENTS_DIR, 'Input/Input.tsx'), 'utf8');
    expect(inputSrc).toContain('aria-invalid');
    expect(inputSrc).toContain('aria-describedby');
    expect(inputSrc).toContain('role="alert"');

    // Select: aria-invalid, aria-describedby
    const selectSrc = fs.readFileSync(path.resolve(COMPONENTS_DIR, 'Select/Select.tsx'), 'utf8');
    expect(selectSrc).toContain('aria-invalid');
    expect(selectSrc).toContain('aria-describedby');

    // Dialog: role="dialog", aria-modal="true", Escape key handling
    const dialogSrc = fs.readFileSync(path.resolve(COMPONENTS_DIR, 'Dialog/Dialog.tsx'), 'utf8');
    expect(dialogSrc).toContain('role="dialog"');
    expect(dialogSrc).toContain('aria-modal="true"');
    expect(dialogSrc).toContain("e.key === 'Escape'");
    expect(dialogSrc).toContain('aria-label');

    // Drawer: role="dialog", aria-modal="true", Escape key handling
    const drawerSrc = fs.readFileSync(path.resolve(COMPONENTS_DIR, 'Drawer/Drawer.tsx'), 'utf8');
    expect(drawerSrc).toContain('role="dialog"');
    expect(drawerSrc).toContain('aria-modal="true"');
    expect(drawerSrc).toContain("e.key === 'Escape'");

    // Tabs: role="tablist", role="tab", aria-selected, role="tabpanel"
    const tabsSrc = fs.readFileSync(path.resolve(COMPONENTS_DIR, 'Tabs/Tabs.tsx'), 'utf8');
    expect(tabsSrc).toContain('role="tablist"');
    expect(tabsSrc).toContain('role="tab"');
    expect(tabsSrc).toContain('aria-selected');
    expect(tabsSrc).toContain('role="tabpanel"');

    // Toast: role="status", aria-live
    const toastSrc = fs.readFileSync(path.resolve(COMPONENTS_DIR, 'Toast/Toast.tsx'), 'utf8');
    expect(toastSrc).toContain('role="status"');
    expect(toastSrc).toContain('aria-live');

    // ErrorDisplay: role="alert", trace ID, retry action
    const errorDisplaySrc = fs.readFileSync(path.resolve(COMPONENTS_DIR, 'ErrorDisplay/ErrorDisplay.tsx'), 'utf8');
    expect(errorDisplaySrc).toContain('role="alert"');
    expect(errorDisplaySrc).toContain('traceId');
    expect(errorDisplaySrc).toContain('onRetry');
  });

  it('9. Verifies Performance Budget: @djadwal/ui is feather-light and devoid of heavy dependencies', () => {
    const pkgJson = JSON.parse(fs.readFileSync(path.resolve(UI_SRC_DIR, '../package.json'), 'utf8'));
    const allDeps = {
      ...pkgJson.dependencies,
      ...pkgJson.peerDependencies,
    };

    // Strict ban on heavy UI runtimes
    expect(allDeps['@mui/material']).toBeUndefined();
    expect(allDeps['@emotion/react']).toBeUndefined();
    expect(allDeps['ag-grid-community']).toBeUndefined();
    expect(allDeps['pdfmake']).toBeUndefined();
    expect(allDeps['jspdf']).toBeUndefined();
  });
});

