export const toHalfWidth = (str: string): string =>
    str.normalize('NFKC').replace(/\D/g, '');