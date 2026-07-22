export const monthFormate = (date: string) => {
    return date ? date.replace(/-/g, '/').slice(0, 7) : '';
};

export const dateFormate = (date: string) => {
    return date ? date.replace(/-/g, '/') : '';
};