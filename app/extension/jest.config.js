module.exports = {
    "roots": [
        "src"
    ],
    "globals": {
        "ts-jest": {
            "tsconfig": "tsconfig.jest.json"
        }
    },
    "transform": {
        "^.+\\.tsx?$": "ts-jest"
    },
};
