export const setSection = (object: any, targetSection: string, section: string, shop: string, index: number, shops?: string[]) => {
    let value;
    if (targetSection === 'all') {
        value = object.filter(item => index >= 1 ? shops?.includes(item.shop) : true);
    } else {
        value = object.filter(item => index >= 1 ? item.shop === shop : true);
    }
    return value;
};