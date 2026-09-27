const colors = require('tailwindcss/colors');

const gray = {
    50: colors.neutral[50],
    100: colors.neutral[100],
    200: colors.neutral[200],
    300: colors.neutral[300],
    400: colors.neutral[400],
    500: colors.neutral[500],
    600: colors.neutral[600],
    700: colors.neutral[700],
    800: colors.neutral[800],
    900: colors.neutral[900],
};

const rockRed = {
    50: '#fff1f2',
    100: '#ffe4e6',
    200: '#fecdd3',
    300: '#fda4af',
    400: '#f08a90',
    500: '#d96069',
    600: '#c94f59',
    700: '#a52f3d',
    800: '#7f1d2d',
    900: '#541019',
};

const rockPrimary = Object.fromEntries(
    Object.keys(rockRed).map((shade) => [shade, `rgb(var(--rock-primary-${shade}) / <alpha-value>)`])
);

module.exports = {
    content: ['./resources/scripts/**/*.{js,ts,tsx}'],
    theme: {
        extend: {
            fontFamily: {
                header: ['"IBM Plex Sans"', '"Roboto"', 'system-ui', 'sans-serif'],
            },
            colors: {
                black: '#09090a',
                // "primary" and "neutral" are deprecated, prefer the use of "blue" and "gray"
                // in new code.
                primary: rockPrimary,
                blue: rockPrimary,
                orange: colors.orange,
                gray: gray,
                cyan: colors.cyan,
                neutral: Object.fromEntries(
                    [50, 100, 200, 300, 400, 500, 600, 700, 800, 900].map((shade) => [
                        shade,
                        `rgb(var(--rock-neutral-${shade}) / <alpha-value>)`,
                    ])
                ),
            },
            fontSize: {
                '2xs': '0.625rem',
            },
            transitionDuration: {
                250: '250ms',
            },
            borderColor: (theme) => ({
                default: theme('colors.neutral.400', 'currentColor'),
            }),
        },
    },
    plugins: [
        require('@tailwindcss/forms')({
            strategy: 'class',
        }),
    ],
};
