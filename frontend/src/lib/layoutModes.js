export const layoutModes = {
  enabled: ['desktop', 'tablet', 'mobile'],
  planned: [],
  desktop: {
    id: 'desktop',
    minWidth: 1200,
    shellClass: 'layout-desktop'
  },
  tablet: {
    id: 'tablet',
    minWidth: 768,
    shellClass: 'layout-tablet'
  },
  mobile: {
    id: 'mobile',
    minWidth: 0,
    shellClass: 'layout-mobile'
  }
};

export function getLayoutMode({ width } = {}) {
  const viewportWidth = Number.isFinite(width)
    ? width
    : (Number.isFinite(globalThis.innerWidth) ? globalThis.innerWidth : 1200);

  if (viewportWidth >= layoutModes.desktop.minWidth) return layoutModes.desktop;
  if (viewportWidth >= layoutModes.tablet.minWidth) return layoutModes.tablet;
  return layoutModes.mobile;
}
