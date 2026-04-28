export function formatAdvancedSearchValue(value: string) {
    const trimmedValue = value.trim();

    if (!trimmedValue) {
        return '';
    }

    if (!/[\s"]/.test(trimmedValue)) {
        return trimmedValue;
    }

    return `"${trimmedValue.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

export function formatAdvancedSearchText(prefix: string, value: string) {
    const formattedValue = formatAdvancedSearchValue(value);
    return formattedValue ? `${prefix}${formattedValue} ` : undefined;
}
