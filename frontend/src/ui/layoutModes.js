export const layoutModes = {
  enabled: ['desktop'],
  planned: ['tablet', 'mobile'],
  desktop: {
    id: 'desktop',
    minWidth: 1180,
    shellClass: 'layout-desktop'
  }
};

export function getLayoutMode() {
  return layoutModes.desktop;
}
