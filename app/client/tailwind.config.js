module.exports = {
    content: ["./src/**/*.{js,jsx,ts,tsx}"],
    important: '',
    theme: {
        extend: {
            boxShadow:{
                'heavy':'rgba(0, 0, 0, 0.2) 0px 3px 5px -1px, rgba(0, 0, 0, 0.14) 0px 6px 10px 0px, rgba(0, 0, 0, 0.12) 0px 1px 18px 0px'
            }
        },
    },
    corePlugins: {
        // Remove Tailwind CSS's preflight style so it can use the MUI's preflight instead (CssBaseline).
        preflight: false,
    },
    plugins: [
        require('@tailwindcss/line-clamp'),
    ],
};