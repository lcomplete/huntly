import { formatAdvancedSearchText, formatAdvancedSearchValue } from "./searchSyntax";

test('formatAdvancedSearchValue keeps simple values unquoted', () => {
    expect(formatAdvancedSearchValue('Inbox')).toBe('Inbox');
});

test('formatAdvancedSearchValue quotes values with spaces', () => {
    expect(formatAdvancedSearchValue('Daily Reads')).toBe('"Daily Reads"');
});

test('formatAdvancedSearchValue escapes quotes inside quoted values', () => {
    expect(formatAdvancedSearchValue('Daily "Reads"')).toBe('"Daily \\"Reads\\""');
});

test('formatAdvancedSearchText returns prefixed text with trailing space', () => {
    expect(formatAdvancedSearchText('collection:', 'Daily Reads')).toBe('collection:"Daily Reads" ');
});
