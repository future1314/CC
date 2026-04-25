const theme = {
    type: 'local-jsx',
    name: 'theme',
    description: 'Change the theme',
    load: () => import('./theme.tsx'),
};
export default theme;
